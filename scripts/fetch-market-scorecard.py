#!/usr/bin/env python3
"""
긍정 vs 부정 몇대몇 — 자동 분석 스크립트 (GitHub Actions용)
yfinance로 시장 데이터 + 뉴스 수집 → Gemini AI 분석 → data/market-scorecard-data.json 업데이트

스케줄: 하루 5회 (KST 07:15 / 12:00 / 18:30 / 22:00 / 23:30) — 07:00→07:15는 2026-07-15
사용자가 기상 후 텔레그램으로 전달하는 TV 리포트(tv-inbox)를 반영할 시간을 벌기 위한 조정
모델: gemini-2.5-flash-lite (고정)
최대 항목 수: 10 (초과 시 오래된 것부터 삭제)
"""

import json
import os
import sys
import re
import time
import difflib
import urllib.request
import requests
from datetime import datetime, timezone, timedelta

try:
    import yfinance as yf
except ImportError:
    print("ERROR: yfinance 미설치. pip install yfinance 실행 필요.")
    sys.exit(1)

# ─── 설정 ───────────────────────────────────────────────────────────────────
GEMINI_API_KEY     = os.environ.get('GEMINI_API_KEY', '')
GEMINI_MODEL       = 'gemini-2.5-flash'                # 2026-07-03 복구 (7/1 쿼터 리셋 완료 — CLAUDE.md 규정: 스코어카드는 복합 판단이라 flash)
# 폴백: gemini-2.5-flash-lite (call_gemini 내 구현) — 1.5 계열 전부 404, 2.0-flash 서비스 종료 (2026-06-26 확인)

def _gemini_url(model):
    return f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_API_KEY}'

MAX_ENTRIES = 10

OUTPUT_PATH = os.path.normpath(
    os.path.join(os.path.dirname(__file__), '..', 'data', 'market-scorecard-data.json')
)

# 판단 원장 (judgment ledger) — 3영업일 판단 연속성 (2026-07-03)
# market-scorecard-data.json은 10개 상한(약 2일치)이라 3영업일 맥락에 부족 → 별도 원장 유지.
# 원장이 없거나 깨져도 기존처럼 동작한다 (무중단 폴백).
LEDGER_PATH = os.path.normpath(
    os.path.join(os.path.dirname(__file__), '..', 'data', 'judgment-history-scorecard.json')
)
LEDGER_MAX = 20  # 하루 5회 × 4일

# TV 리포트 수신함 (2026-07-15 신설) — tv-inbox.html/텔레그램 포워딩으로 들어온
# TradingView 프리미엄 리포트. 오늘 날짜 파일만 골라 프롬프트에 참고자료로 주입한다.
TV_INBOX_DIR = os.path.normpath(
    os.path.join(os.path.dirname(__file__), '..', 'data', 'tv-inbox')
)
TV_INBOX_MAX_CHARS = 4000  # 프롬프트 비대화 방지 — 리포트가 길면 앞부분만 사용


def load_ledger():
    try:
        with open(LEDGER_PATH, 'r', encoding='utf-8') as f:
            obj = json.load(f)
        return obj if isinstance(obj, list) else []
    except Exception:
        return []


def save_ledger(ledger):
    try:
        with open(LEDGER_PATH, 'w', encoding='utf-8') as f:
            json.dump(ledger, f, ensure_ascii=False)
    except Exception as e:
        print(f"  판단 원장 저장 실패: {e}")


def append_ledger(ledger, kst_now, entry):
    """생성된 카드의 핵심을 한 줄로 원장에 기록 (결정적 조합 — Gemini 의존 없음).

    2026-07-28 추가: 'k' 압축 텍스트 라인(사람이 읽고 프롬프트에 주입되는 용도)과 별개로,
    혼조 재료 전체의 name+category를 'mixed_tags'에 구조화된 형태로 저장한다. 기존엔
    mixed_factors[0]의 name만 텍스트에 묻혀 있어 difflib로 되짚어야 했는데, 이제 category
    정확 일치로 판별할 수 있게 원본 데이터를 함께 남긴다."""
    line = f"긍정 {entry['positive_total']} : 부정 {entry['negative_total']} — {entry['key_event']['name']}"
    if entry.get('summary'):
        line += f" | {entry['summary']}"
    if entry.get('mixed_factors'):
        line += f" | 혼조: {entry['mixed_factors'][0].get('name', '')}"
    ledger_entry = {'d': kst_now.strftime('%Y-%m-%d'), 't': kst_now.strftime('%H:%M'), 'k': line[:160]}
    mixed_tags = [
        {'n': (m.get('name') or '').strip()[:40], 'c': m.get('category') or 'other'}
        for m in (entry.get('mixed_factors') or []) if (m.get('name') or '').strip()
    ]
    if mixed_tags:
        ledger_entry['mixed_tags'] = mixed_tags
    ledger.append(ledger_entry)
    return ledger[-LEDGER_MAX:]


def ledger_context_block(ledger):
    """최근 4개 날짜(직전 3영업일 + 오늘)의 날짜별 마지막 판단으로 연속성 블록 구성.
    파이프라인이 여는 날에만 돌므로 원장의 날짜 자체가 영업일 — 별도 휴일 테이블 불필요."""
    if not ledger:
        return ""
    by_date = {}
    for e in ledger:
        if isinstance(e, dict) and e.get('d') and e.get('k'):
            by_date[e['d']] = e  # 시간순 append → 날짜별 마지막 판단만 남음
    days = list(by_date.values())[-4:]
    if not days:
        return ""
    lines = '\n'.join(f"- {e['d']} {e.get('t', '')}: {e['k']}" for e in days)
    return f"""
=== 직전 3영업일 판단 흐름 (연속성 — 반드시 참고) ===
{lines}
[연속성 규칙]
- 오늘 카드는 위 흐름 위에서 판단하라. 매번 처음 보는 시장처럼 서술하지 마라.
- 긍정/부정 구도가 직전 영업일 대비 개선/악화/유지 중 무엇인지 summary에 반영하라 (예: '3일 연속 긍정 우위 유지', '어제 부정 우위에서 긍정 전환').
- 구도가 크게 바뀌면(±15p 이상) 그 원인 이벤트를 key_event 또는 요인에 반드시 포함하라.
- 단, 위 기록에 끌려가 현재 데이터와 다른 판단을 내리지는 마라. 판단 근거는 항상 오늘의 가격·뉴스다.

"""

# 시장 티커
EQUITY_TICKERS = ['QQQ', 'SPY', 'TSLA', 'NVDA', 'AAPL', 'MSFT', 'GOOGL', 'SOXX']
MACRO_TICKERS  = {
    '^VIX':     ('vix',      'VIX 공포지수'),
    '^TNX':     ('yield10y', '미10년 국채금리(%)'),
    # 62항 — 장기물을 안 보면 '진짜 금리 이야기'를 통째로 놓친다. 2026-08-18에
    # 9월 인상 확률이 100%→3분의 1로 내려앉는 동안 30년물은 5.09%→5.31%(2007년 이후
    # 최고)로 올랐다. 성장주·반도체를 누른 건 정책금리 기대가 아니라 이쪽이었다.
    '^TYX':     ('yield30y', '미30년 국채금리(%)'),
    'CL=F':     ('oil',      'WTI 원유(USD)'),
    'DX-Y.NYB': ('dxy',      '달러인덱스 DXY'),
    'GC=F':     ('gold',     '금 Gold(USD)'),
}

# KST 시간대별 레이블
SCHEDULE_LABELS = {
    7:  '오전 7:00',
    12: '정오 12:00',
    18: '오후 6:30',
    22: '오후 10:00',
    23: '오후 11:30',
}


# ─── 유틸 ───────────────────────────────────────────────────────────────────

def get_kst_now():
    return datetime.now(timezone.utc) + timedelta(hours=9)


# ─── 미국 시장 세션 판정 (2026-07-03 신설) ────────────────────────────────────
# 배경: 기존 코드는 정규장 밖을 전부 '[프리/시간외]' 한 덩어리로 태깅 + ET를
# UTC-4 고정 근사로 계산 → AI가 포스트마켓 시간에 '프리마켓 약세'라고 쓰는 사고 발생.
# zoneinfo로 서머타임까지 정확히 반영한다.

try:
    from zoneinfo import ZoneInfo
    ET_TZ = ZoneInfo('America/New_York')
except Exception:
    ET_TZ = None  # 폴백: 세션 판정 불가 시 세션 블록 생략 (본 기능은 계속 동작)


def get_us_session(dt_utc=None):
    """현재 미국 시장 세션 판정 (DST 자동 반영).
    returns (code, label) — pre/regular/post/closed/weekend"""
    if ET_TZ is None:
        return '', ''
    now_et = (dt_utc or datetime.now(timezone.utc)).astimezone(ET_TZ)
    wd = now_et.weekday()
    hm = now_et.hour + now_et.minute / 60
    if wd >= 5:
        # (58항) 주말에 장이 안 열리는 것을 '휴장'이라 부르지 않는다 — 라벨이
        # 그대로 프롬프트에 들어가 생성문에 옮겨붙기 때문에 여기서부터 막는다.
        return 'weekend', '주말(금요일 정규장 마감 후)'
    if 4.0 <= hm < 9.5:
        return 'pre', '프리마켓'
    if 9.5 <= hm < 16.0:
        return 'regular', '정규장'
    if 16.0 <= hm < 20.0:
        return 'post', '포스트마켓(시간외)'
    return 'closed', '정규장 마감 후(야간)'


def session_tag_for_ts(ts):
    """가격 데이터 봉의 타임스탬프 → 세션 태그 문자열"""
    if ET_TZ is None:
        return ''
    try:
        ts_et = ts.astimezone(ET_TZ)
    except Exception:
        return ''
    today_et = datetime.now(ET_TZ).date()
    if ts_et.date() != today_et:
        return ' [직전 거래일 종가]'
    hm = ts_et.hour + ts_et.minute / 60
    if 4.0 <= hm < 9.5:
        return ' [프리마켓 실시간]'
    if 9.5 <= hm < 16.0:
        return ' [정규장]'
    if 16.0 <= hm < 20.0:
        return ' [포스트마켓 실시간]'
    return ' [야간/시간외]'


# ─── 중복 실행 가드 (2026-07-03 신설, 같은 날 30→75분 상향) ──────────────────
# 배경: 이 워크플로는 세 경로가 제각각 트리거한다 — ① GitHub 자체 cron(지연 잦음),
# ② cron-job.org 직접 dispatch(PAT), ③ 감시견 구조 dispatch. 2026-07-03 아침
# 06:47/07:00/07:51/08:20 4연발 실증. 정규 슬롯 최소 간격이 90분(22:00→23:30)이므로
# 75분 가드면 정상 슬롯은 통과시키고 트리거 폭주만 차단한다.
# FORCE_SCORECARD=1 환경변수로 우회 가능 (수동 재생성용).

MIN_GAP_MINUTES = 75


def recent_entry_exists(kst_now):
    if os.environ.get('FORCE_SCORECARD') == '1':
        return False
    try:
        with open(OUTPUT_PATH, 'r', encoding='utf-8') as f:
            entries = json.load(f).get('entries', [])
        if not entries:
            return False
        last = datetime.strptime(entries[0].get('id', ''), '%Y-%m-%d-%H:%M')
        diff_min = (kst_now.replace(tzinfo=None) - last).total_seconds() / 60
        return 0 <= diff_min < MIN_GAP_MINUTES
    except Exception:
        return False


def kst_label(dt):
    """2026-06-24(수) 22:00 KST 형태"""
    weekday = ['월', '화', '수', '목', '금', '토', '일'][dt.weekday()]
    return dt.strftime(f'%Y-%m-%d({weekday}) %H:%M KST')


def kst_id(dt):
    """2026-06-24-22:00"""
    return dt.strftime('%Y-%m-%d-%H:%M')


def safe_pct(val):
    if val is None:
        return 'N/A'
    sign = '+' if val >= 0 else ''
    return f'{sign}{val:.2f}%'


# ─── 시장 데이터 수집 ─────────────────────────────────────────────────────────

def fetch_equity_data():
    """주요 지수·종목 현재가 + 등락률 (프리마켓/시간외 포함)"""
    rows = []
    for sym in EQUITY_TICKERS:
        try:
            t = yf.Ticker(sym)
            info = t.fast_info
            prev = getattr(info, 'previous_close', None)

            # 프리마켓/포스트마켓 포함 최신 가격 시도
            price = None
            session_tag = ''
            try:
                hist = t.history(period='1d', prepost=True, interval='1m')
                if not hist.empty:
                    price = float(hist['Close'].iloc[-1])
                    ts = hist.index[-1]
                    # 2026-07-03: DST 무시 근사 폐기 → zoneinfo 기반 정확 세션 태깅
                    session_tag = session_tag_for_ts(ts)
            except Exception:
                pass

            # 폴백: fast_info 기본값
            if not price:
                price = getattr(info, 'last_price', None)

            if price and prev:
                pct = (price - prev) / prev * 100
                rows.append(f'{sym}: ${price:,.2f} ({safe_pct(pct)}){session_tag}')
            elif price:
                rows.append(f'{sym}: ${price:,.2f}{session_tag}')
        except Exception as ex:
            rows.append(f'{sym}: 데이터 없음 ({ex})')
    return rows


def fetch_macro_data():
    """VIX, 금리, 원유, 달러, 금"""
    rows = []
    for sym, (key, label) in MACRO_TICKERS.items():
        try:
            t = yf.Ticker(sym)
            info = t.fast_info
            price = getattr(info, 'last_price', None)
            prev  = getattr(info, 'previous_close', None)
            if price:
                if prev:
                    pct = (price - prev) / prev * 100
                    rows.append(f'{label}: {price:.2f} ({safe_pct(pct)})')
                else:
                    rows.append(f'{label}: {price:.2f}')
        except Exception as ex:
            rows.append(f'{label}: 데이터 없음 ({ex})')
    return rows


def fetch_news_headlines(max_per_ticker=3, max_total=20, max_age_hours=6):
    """yfinance .news 로 최신 헤드라인 수집 — 6시간 이내 기사만 포함"""
    headlines = []
    seen = set()
    now_ts = time.time()
    cutoff_ts = now_ts - (max_age_hours * 3600)
    skipped = 0

    tickers_for_news = ['QQQ', 'NVDA', 'TSLA', 'AAPL', 'MSFT', 'GOOGL', 'SPY', '^TNX']
    for sym in tickers_for_news:
        if len(headlines) >= max_total:
            break
        try:
            t = yf.Ticker(sym)
            news = t.news or []
            count = 0
            for item in news:
                if count >= max_per_ticker:
                    break
                if not isinstance(item, dict):
                    continue

                # 발행 시각 추출 — 신/구 yfinance 구조 모두 처리
                pub_ts = None
                content = item.get('content', {})
                if isinstance(content, dict):
                    pub_date_str = content.get('pubDate', '')
                    if pub_date_str:
                        try:
                            from datetime import timezone as tz
                            pub_dt = datetime.fromisoformat(pub_date_str.replace('Z', '+00:00'))
                            pub_ts = pub_dt.timestamp()
                        except Exception:
                            pass
                if pub_ts is None:
                    pub_ts = item.get('providerPublishTime')  # 구버전: Unix timestamp

                # ── 시간 필터: 24시간 초과 기사 제외 ──────────────────────────
                if pub_ts and pub_ts < cutoff_ts:
                    skipped += 1
                    continue

                # 제목 추출
                title = None
                if isinstance(content, dict):
                    title = content.get('title')
                if not title:
                    title = item.get('title')
                if not title or title in seen:
                    continue

                # 경과 시간 레이블 추가 (Gemini가 신선도 판단에 활용)
                if pub_ts:
                    hours_ago = (now_ts - pub_ts) / 3600
                    if hours_ago < 1:
                        age_label = f"({int(hours_ago * 60)}분 전)"
                    else:
                        age_label = f"({hours_ago:.1f}시간 전)"
                    title = f"{title} {age_label}"

                headlines.append(title)
                seen.add(title.split(' (')[0])  # 원제목 기준 중복 제거
                count += 1
        except Exception:
            pass

    if skipped:
        print(f"    (6시간 초과 기사 {skipped}건 제외됨)")
    return headlines


# ─── Google News RSS ─────────────────────────────────────────────────────────

def fetch_google_news_rss(max_per_query=4, max_age_hours=12):
    """Google News RSS로 최신 금융 헤드라인 수집 — API 키 불필요"""
    try:
        import feedparser
    except ImportError:
        print("  feedparser 미설치 — Google News RSS 스킵")
        return []

    import calendar as cal
    now_ts = time.time()
    cutoff  = now_ts - (max_age_hours * 3600)

    queries = [
        "US+stock+market+S%26P+500+Nasdaq",
        "Federal+Reserve+interest+rate+inflation",
        "US+Iran+geopolitics+oil",
        "tech+earnings+semiconductor+AI",
        # 2026-07-03 추가 — 금리·경제지표의 '시장 반응/해석'을 직접 수집
        # (고용 둔화에도 금리 상승 같은 괴리를 AI가 뉴스로 파악할 수 있게)
        "US+treasury+yields+bond+market+reaction",
        "jobs+report+economic+data+market+reaction",
    ]

    headlines = []
    seen = set()

    for q in queries:
        try:
            url  = (f"https://news.google.com/rss/search"
                    f"?q={q}+when:{max_age_hours}h&hl=en-US&gl=US&ceid=US:en")
            feed = feedparser.parse(url)
            count = 0
            for entry in feed.entries:
                if count >= max_per_query:
                    break
                title = entry.get('title', '').strip()
                if not title or title in seen:
                    continue
                pub = entry.get('published_parsed')
                if pub:
                    pub_ts = cal.timegm(pub)
                    if pub_ts < cutoff:
                        continue
                    h_ago = (now_ts - pub_ts) / 3600
                    age   = f"{int(h_ago*60)}분전" if h_ago < 1 else f"{h_ago:.1f}h전"
                    headlines.append(f"[구글뉴스 {age}] {title}")
                else:
                    headlines.append(f"[구글뉴스] {title}")
                seen.add(title)
                count += 1
        except Exception as e:
            print(f"  Google News RSS 오류 ({q[:20]}): {e}")

    print(f"    Google News RSS: {len(headlines)}건")
    return headlines


# ─── Alpha Vantage News Sentiment ────────────────────────────────────────────

def fetch_alphavantage_news(max_items=15):
    """Alpha Vantage NEWS_SENTIMENT — 감성 점수 내장 뉴스 (무료 25회/일)"""
    AV_KEY = os.environ.get('ALPHAVANTAGE_API_KEY', '')
    if not AV_KEY:
        return [], ""

    time_from = (datetime.now(timezone.utc) - timedelta(hours=12)).strftime('%Y%m%dT%H%M')
    try:
        resp = requests.get(
            "https://www.alphavantage.co/query",
            params={
                "function":  "NEWS_SENTIMENT",
                "topics":    "financial_markets,economy_macro,technology",
                "time_from": time_from,
                "sort":      "RELEVANCE",
                "limit":     max_items,
                "apikey":    AV_KEY,
            },
            timeout=20
        )
        data = resp.json()
        if "feed" not in data:
            print(f"  Alpha Vantage 응답 이상: {list(data.keys())}")
            return [], ""

        items   = []
        bullish = 0
        bearish = 0
        for item in data["feed"][:max_items]:
            title = item.get("title", "")
            score = float(item.get("overall_sentiment_score", 0))
            if score >  0.15: bullish += 1; tag = f"↑{score:+.2f}"
            elif score < -0.15: bearish += 1; tag = f"↓{score:+.2f}"
            else:               tag = f"→{score:+.2f}"
            items.append(f"[AV {tag}] {title}")

        total   = bullish + bearish
        summary = (f"Alpha Vantage 감성 집계: 긍정 {bullish}건 / 부정 {bearish}건 / 중립 {max_items-total}건"
                   if total > 0 else "")
        print(f"    Alpha Vantage: {len(items)}건 (긍정 {bullish} / 부정 {bearish})")
        return items, summary

    except Exception as e:
        print(f"  Alpha Vantage 오류: {e}")
        return [], ""


# ─── FRED 매크로 지표 ─────────────────────────────────────────────────────────

def fetch_fred_macro():
    """FRED API로 실제 발표된 매크로 수치 수집 (무료)"""
    FRED_KEY = os.environ.get('FRED_API_KEY', '')
    if not FRED_KEY:
        return []

    # 69항(2026-08-26) — CPIAUCSL 원계열은 '지수 수준'(1982-84=100)이지 %가 아니다.
    # 전 계열에 %를 붙이던 옛 포맷이 "CPI 소비자물가지수 332.81%"라는 오표기를 만들어
    # 보고서까지 옮겨붙었다. CPI는 units=pc1(전년동월비 %)로 받아 진짜 %로 만든다.
    # 날짜도 발표일로 오독되던 것을 '데이터 월'로 명시한다("2026년 7월 1일 발표된" 사고).
    SERIES = {
        "CPIAUCSL": ("pc1", "CPI 소비자물가 상승률(전년동월비 %)"),
        "FEDFUNDS":  (None, "Fed 기준금리(%)"),
        "T10Y2Y":    (None, "10Y-2Y 스프레드(경기선행, %)"),
        "UNRATE":    (None, "실업률(%)"),
        "T10YIE":    (None, "10년 기대인플레이션(%)"),
    }

    rows = []
    for sid, (units, label) in SERIES.items():
        try:
            params = {"series_id": sid, "api_key": FRED_KEY,
                      "sort_order": "desc", "limit": 2, "file_type": "json"}
            if units:
                params["units"] = units
            resp = requests.get(
                "https://api.stlouisfed.org/fred/series/observations",
                params=params, timeout=10
            )
            obs = resp.json().get("observations", [])
            if not obs:
                continue
            val = obs[0].get("value", ".")
            if val == ".":
                continue
            val_f = float(val)
            month = obs[0]["date"][:7]   # 관측월 — 발표일이 아니다
            if len(obs) > 1 and obs[1].get("value", ".") != ".":
                diff = val_f - float(obs[1]["value"])
                rows.append(f"{label}: {val_f:.2f}% ({'+' if diff>=0 else ''}{diff:.2f}%p 전기대비) [{month} 데이터]")
            else:
                rows.append(f"{label}: {val_f:.2f}% [{month} 데이터]")
        except Exception as e:
            print(f"  FRED {sid} 오류: {e}")

    print(f"    FRED 매크로: {len(rows)}개 지표")
    return rows


def fetch_tv_inbox(kst_now):
    """오늘(KST) 날짜로 tv-inbox.html/텔레그램 포워딩된 TradingView 리포트를 모아 반환.
    파일이 없거나 디렉터리 자체가 없어도 빈 문자열 반환 — 기존 동작에 영향 없음(무중단 폴백)."""
    if not os.path.isdir(TV_INBOX_DIR):
        return ""
    today = kst_now.strftime('%Y%m%d')
    try:
        files = sorted(f for f in os.listdir(TV_INBOX_DIR) if f'-{today}-' in f and f.endswith('.md'))
    except Exception as e:
        print(f"  TV 리포트 수신함 조회 실패: {e}")
        return ""
    if not files:
        return ""
    chunks = []
    for fn in files:
        try:
            with open(os.path.join(TV_INBOX_DIR, fn), 'r', encoding='utf-8') as f:
                content = f.read().strip()
            if content:
                chunks.append(content)
        except Exception as e:
            print(f"  TV 리포트 읽기 실패 ({fn}): {e}")
    if not chunks:
        return ""
    combined = '\n\n---\n\n'.join(chunks)
    if len(combined) > TV_INBOX_MAX_CHARS:
        combined = combined[:TV_INBOX_MAX_CHARS] + '\n(이하 생략 — 길이 제한)'
    print(f"    TV 리포트 수신함: {len(files)}개 파일, {len(combined)}자")
    return combined


# ─── Gemini 호출 ──────────────────────────────────────────────────────────────

def build_prompt(kst_now, equity_rows, macro_rows, headlines, prev_entries=None,
                 rss_headlines=None, av_items=None, av_summary="", fred_rows=None,
                 history_block="", session_code="", session_label="", tv_inbox_block=""):
    schedule_label = SCHEDULE_LABELS.get(kst_now.hour, f'{kst_now.hour}:00')

    # ── 세션 인지 블록 (2026-07-03 신설) ─────────────────────────────────────
    session_block = ""
    if session_code:
        framing = {
            'pre':     "- 프리마켓 진행 중. 재료는 '몇 시간 뒤 열릴 오늘 정규장'에 영향을 줄 변수 중심으로 선별하라.",
            'regular': "- 정규장 진행 중. 장중 실시간 가격 움직임과 그 원인 중심으로 선별하라.",
            'post':    "- 정규장은 이미 마감됐고 지금은 포스트마켓이다. 재료는 (1) 방금 끝난 정규장 결과를 만든 원인 (2) 다음 정규장에 영향을 줄 변수, 이 두 관점으로 선별하라.",
            'closed':  "- 정규장·포스트마켓 모두 끝난 야간이다. 재료는 (1) 직전 정규장 결과를 만든 원인 (2) 다음 정규장에 영향을 줄 변수, 이 두 관점으로 선별하라.",
            'weekend': "- 금요일 정규장이 끝난 뒤다. 재료는 직전 주 마감 상황과 다음 주 개장에 영향을 줄 변수 중심으로 선별하라.",
        }.get(session_code, "")
        session_block = f"""
=== 현재 미국 시장 세션: {session_label} (위반 시 전체 신뢰도 훼손) ===
- 세션 정의: 프리마켓 = ET 04:00~09:30 / 정규장 = ET 09:30~16:00 / 포스트마켓(시간외) = ET 16:00~20:00 / 그 외 = 장 마감 후
- 현재 세션이 아닌 세션 명칭을 요인 이름·설명·핵심이슈에 쓰는 것 절대 금지.
  (예: 지금이 포스트마켓·장 마감 후면 '프리마켓 약세' 같은 표현 금지 — 프리마켓은 아직 시작도 안 했다)
- [주말을 '휴장'이라고 부르지 않는다] 토·일에 미국장이 열리지 않는 것은 당연한 일이고,
  독자는 금요일 장이 끝나면 다음 장이 월요일이라는 것을 이미 안다. '주말 휴장', '휴장 중'
  같은 표현을 쓰면 오히려 '평일에 장이 안 열린다'는 뜻으로 잘못 읽힌다. 주말이라는 사실
  자체를 굳이 언급할 필요도 없다. 필요하면 '직전 장(금요일) 마감 기준'처럼 쓴다.
  단, 추수감사절·크리스마스 같은 **평일 공휴일 휴장**은 '휴장'이라고 써도 된다 —
  그건 독자가 모를 수 있는 정보라 알릴 값이 있다.
{framing}
"""

    # yfinance 뉴스 + Google News RSS 합산
    all_headlines = list(headlines or []) + list(rss_headlines or [])
    news_block = '\n'.join(f'- {h}' for h in all_headlines) if all_headlines else '- 뉴스 데이터 없음'

    # Alpha Vantage 섹션
    av_block = ""
    if av_items:
        av_block = "\n=== Alpha Vantage 뉴스 감성 (전문 금융뉴스, 감성 점수 포함) ===\n"
        if av_summary:
            av_block += f"{av_summary}\n"
        av_block += '\n'.join(f'- {h}' for h in av_items) + "\n"

    # FRED 실제 수치 섹션
    fred_block = ""
    if fred_rows:
        fred_block = "\n=== FRED 실제 발표 매크로 수치 (추정치 아닌 공식 발표값) ===\n"
        fred_block += '\n'.join(f'- {r}' for r in fred_rows) + "\n"

    # TV 리포트 수신함 섹션 (2026-07-15 신설) — 사용자가 매일 아침 텔레그램/웹으로
    # 전달한 TradingView 프리미엄 리포트. 정성적 참고자료이며, 가격·VIX 실시간 데이터가
    # 여전히 1차 기준이라는 기존 원칙(아래 [데이터 시점 안내])은 그대로 유지한다.
    tv_inbox_section = ""
    if tv_inbox_block:
        tv_inbox_section = f"""
=== 사용자가 오늘 아침 전달한 TradingView 프리미엄 리포트 (정성적 시황 분석 — 참고용) ===
{tv_inbox_block}
[활용 지침] 위 리포트는 사용자가 구독 중인 TradingView 프리미엄 AI 브리핑이다. 여기 담긴 논조·강도를
다른 데이터(가격·VIX·뉴스헤드라인·FRED)와 교차검증해서 참고하되, 이 리포트 하나만으로 결론을 뒤집지
마라. 리포트와 실시간 데이터가 일치하면 신뢰도가 높다고 판단해도 되고, 상충하면 실시간 가격·VIX
데이터를 우선하라.
"""

    # 직전 카드 맥락 블록 구성 (일관성 유지용)
    prev_block = ""
    if prev_entries:
        prev_block = "\n=== 직전 생성된 카드 (일관성 유지 — 반드시 참고) ===\n"
        for pe in prev_entries[:2]:
            prev_block += f"[{pe['id']}] 핵심이슈: {pe['key_event']['name']}\n"
            if pe['key_event'].get('why'):
                prev_block += f"이유: {pe['key_event']['why']}\n"
            if pe.get('summary'):
                prev_block += f"요약: {pe['summary'][:150]}\n"
            if pe.get('mixed_factors'):
                mstr = ' / '.join(m.get('name', '') for m in pe['mixed_factors'])
                prev_block += f"혼조 재료: {mstr}\n"
            prev_block += "\n"
        prev_block += """[일관성 원칙 — 엄격 적용]
- 직전 카드에서 언급된 핵심 이슈가 아직 해소되지 않은 이벤트라면, 이번 카드에도 반드시 포함해야 함
  예: 직전 카드에 "내일 도하 협상"이 핵심이라면, 협상이 끝나기 전까지 모든 카드에 불확실성 포함
- 핵심 이슈가 바뀐 경우, 반드시 새로운 중대 뉴스 이벤트가 발생했기 때문이어야 함
- key_event.name은 뉴스 이벤트여야 함. "기술주 프리마켓 강세/약세" 같은 시장 상태 표현 절대 금지
- [혼조 연속성 — 완화 적용, 2026-07-09 개정] 직전 카드의 혼조 재료(mixed_factors)는 참고만 하되,
  오늘 데이터에서 다시 확인되지 않으면 자동으로 유지하지 마라. 판단 기준은 항상 '오늘의 최신 뉴스·
  가격 데이터'다. 같은 혼조 재료를 이번 카드에도 넣으려면, 그 주제가 아래 [최신 뉴스 헤드라인] 또는
  [현재 시장 데이터]에 오늘도 실제로 등장해야 한다. "전 카드에도 있었으니까"라는 이유만으로 반복
  삽입하는 것은 금지. 특히 key_event(핵심 이슈) 자체가 이미 다른 사건으로 교체됐다면, 이전 핵심
  이슈에서 파생된 혼조 재료는 대부분 더 이상 '최근 6시간+향후 12시간' 판단에 실질적 영향이 없다고
  보고 제외를 우선 검토하라. (배경: 며칠 전 이슈의 혼조 재료가 핵심 이슈가 완전히 바뀐 뒤에도
  근거 없이 그대로 반복 복사되는 사고가 실제로 발생함 — 반드시 오늘 데이터로 재검증할 것)

"""

    # ── 예정 이벤트 블록 (70항, 2026-08-26) ─────────────────────────────────
    # 카드에도 진짜 달력을 쥐여 준다. 69항에서 보고서에만 줬더니, 카드 쪽은 여전히
    # '잭슨홀 미팅 및 Fed 의장 연설 대기'처럼 날짜 없는 재료를 만들어냈다.
    _now_utc = datetime.now(timezone.utc)
    _ev = event_calendar_lines(_now_utc)
    _et_now = f"{_now_utc.astimezone(ET_TZ):%Y-%m-%d %H:%M}" if ET_TZ else ''
    event_block = ""
    if _ev:
        event_block = ("\n=== 예정 이벤트 (공식 일정표 — BLS·BEA·Fed·기업 IR) ===\n"
                       + '\n'.join(_ev)
                       + "\n[표기 규칙] 이 목록에 있는 일정만 쓴다. 없는 일정을 지어내지 마라.\n")

    return f"""당신은 미국 주식시장 시황 분석 전문가입니다.
현재 시각(KST): {kst_now.strftime('%Y-%m-%d %H:%M')} / 뉴욕(ET): {_et_now}
{session_block}{fred_block}{av_block}{event_block}{tv_inbox_section}
=== 데이터 시점 안내 (분석 전 반드시 숙지) ===
- 가격 데이터의 세션 태그를 그대로 신뢰하라: [프리마켓 실시간] [정규장] [포스트마켓 실시간] [야간/시간외] [직전 거래일 종가]
- 태그 없는 항목은 직전 미국 정규장 종가 기준
- 뉴스 헤드라인은 최근 6시간 이내 발행된 기사만 포함 (각 기사에 경과 시간 표시)
- 판단 우선순위: ① 실시간 가격·VIX 데이터 → ② 6시간 이내 뉴스 헤드라인 순으로 적용
- 가격 데이터가 광범위한 하락(-1% 이상 지수 하락, VIX 상승)을 보이면, 뉴스가 긍정적이어도 전체 판단은 부정 우위
- 오래된 뉴스 이벤트(예: 수일 전 실적 발표)는 이미 가격에 반영되었으므로 핵심 이슈로 분류 금지
- 가격 데이터와 뉴스가 상충할 때: 실시간 가격·선물 데이터를 1차 기준으로 사용

{history_block}{prev_block}=== 현재 시장 데이터 ===
[주요 지수·종목]
{chr(10).join(equity_rows)}

[거시경제 지표]
{chr(10).join(macro_rows)}

=== 최신 뉴스 헤드라인 ===
{news_block}

=== 분석 지시 ===
위 데이터를 바탕으로 최근 6시간 + 향후 12시간 미국 주식시장에 영향을 주는 긍정/부정 요인을 분석하세요.

아래 JSON 구조로만 응답하세요. JSON 외 다른 텍스트는 절대 출력하지 마세요.

=== 출력 규칙 ===
- key_event.name: 현재 시장에서 가장 중요한 이슈 한 줄 (한국어, 20자 이내)
- key_event.time: 이슈가 해당되는 시점 또는 기간 (한국어, 30자 이내)
- key_event.why: 이 이슈가 왜 시장에 중요한지 (한국어, 40자 이내, 쉼표로 구분)
- positive_total + negative_total = 반드시 100
- positive_factors 각 score 합계 = positive_total
- negative_factors 각 score 합계 = negative_total
- positive_total·negative_total과 모든 score는 반드시 5의 배수(5·10·15·20…)로 매겨라 —
  점수는 정밀 측정값이 아니라 비중 판단이다. 26·19 같은 잔점수 금지
- 점수는 오직 '원인' 재료에만 배분하라. 지수·VIX·섹터 등락 같은 결과 서술은 요인 항목
  자체가 금지다 — 원인을 3개 못 찾으면 찾은 원인들에 점수 전액을 배분하라
  (결과 항목에 점수를 실었다가 그 항목이 걸러지면 화면의 합계가 깨진다)
- [아직 안 일어난 일은 점수 칸에 못 앉는다 — 2026-08-26 성동님 지적]
  '엔비디아 실적 발표 대기', '지표 발표 앞두고', '연설 경계감'처럼 **예정 이벤트를
  기다린다**는 재료는 긍정·부정 어느 쪽에도 점수를 실을 수 없다. 반드시 mixed_factors다.
  이유: 기다리는 상태는 오르지도 내리지도 않는다. 같은 사실을 '기대감'이라 쓰면 긍정,
  '불확실성'이라 쓰면 부정이 되어, 새 변수가 하나도 없는데 몇 시간 만에 판정이 뒤집힌다.
  실사고: 같은 엔비디아 실적이 12:50 긍정 65점 → 18:20 부정 25점으로 편을 갈아탔다.
  방향을 주장하고 싶으면 '기다린다'가 아니라 **방향을 만든 측정된 사실**을 이름에 써라
  (예: '엔비디아 컨센서스 상향', '반도체 옵션 내재변동성 급등' — 숫자로 확인되는 것).
  주가가 올랐다·내렸다는 결과이므로 근거가 될 수 없다(63항).
- [예정 이벤트는 뉴욕 시간(ET) 날짜를 반드시 적는다 — 2026-08-26 성동님 지시]
  발표·회의·연설·실적처럼 '아직 오지 않은 일정'을 재료로 쓸 때는, 이름 또는 설명에
  위 [예정 이벤트] 목록의 ET 표기를 그대로 넣어라.
  나쁜 예: "잭슨홀 미팅 및 Fed 의장 연설 대기"  ← 언제인지 없어 독자가 판단할 수 없다
  좋은 예: "잭슨홀 Fed 의장 연설 대기(8월 28일(금) 약 10:00 ET)"
  기준시는 뉴욕(ET) 하나로 통일한다. 한국 시간·현지 시간으로 바꿔 쓰지 마라 —
  이 카드는 6개 언어로 번역돼 전 세계 독자가 같은 화면을 본다.
  이미 지난 일정을 '대기·예정·앞두고'로 쓰는 것은 명백한 오류다.
- 요인 수: 각 3~5개
- 실제 영향력 기반 점수 배분 (50:50 기계적 배분 금지)
- mixed_factors: 해석이 엇갈리는 혼조·양면 재료 0~3개 (점수 없음, 아래 규칙 참조)
- summary: 단기 시장 구도 총평 (한국어, 50자 이내)
- 모든 문자열 값은 한국어, 분석/진단형 문체. 서술어 없이 명사로 끝맺어라
  ('~구간', '~우세', '~확대', '~진정' 형태). '~하세요' 권유형, '~했다/~한다' 해라체,
  '~습니다/~입니다' 존대체 전부 금지 — ezlong.com 전 분석글이 같은 명사형 문체다
- name 필드: 20자 이내, desc 필드: 30자 이내
- category 필드 (positive_factors·negative_factors·mixed_factors 각 항목 필수, 2026-07-28 추가):
  아래 목록에서 정확히 하나만 골라 그대로 쓸 것 (목록에 없는 값·번역·창작 금지):
  fed_policy, geopolitics, trade_tariff, macro_data, earnings_bellwether,
  vix_risk_sentiment, oil_energy, dollar_fx, rates_treasury, ai_tech_valuation,
  supply_chain, company_specific, other
  이 값은 화면에 표시되지 않고 내부적으로 "이게 어제·그제와 같은 주제인가"를 판별하는 데
  쓰인다. name은 매번 다르게 표현해도 되지만(자연스러운 서술 유지), 실제로 같은 근본
  이슈(예: 같은 지정학 사건, 같은 Fed 발언 국면)라면 category는 반드시 같은 값을 써야
  한다 — name의 표현이 바뀌어도 category까지 바뀌면 이 필드의 목적이 무력화된다.
  해당 사항이 애매하면 'other'를 쓰되, 'other' 남발은 이 필드의 효용을 떨어뜨리니
  가능한 한 위 12개 구체 카테고리 중 하나로 분류할 것.

=== 매크로 인과관계 절대 규칙 (위반 시 신뢰도 훼손) ===
- 원유/유가 하락 → 에너지 비용 감소, 인플레이션 완화 → 긍정(positive) 분류
  예외: '글로벌 수요 붕괴 신호'로 판단될 경우에만 부정 가능 (이유에 반드시 '경기 둔화 우려' 명시)
- 원유/유가 상승 → 인플레이션 압력 → 기술주·성장주에 부정(negative) 분류. 절대로 긍정 요인으로 분류 금지.
  (유가 상승이 에너지 섹터에 긍정임은 맞으나, 이 분석은 기술주 투자자 대상이므로 기술주 관점 적용)
- "인플레이션 우려 완화"를 desc에 적으면서 negative_factors에 넣는 것은 절대 금지
- VIX 하락 → 긍정(positive), VIX 상승 → 부정(negative)
- 국채금리 하락 → 성장주/기술주 긍정, 국채금리 상승 → 성장주 부정
  단, 이 방향성은 국채금리 하락이 'Fed 완화 기대·인플레 둔화'가 원인일 때만 적용한다.
  같은 카드에서 위험회피(VIX 상승, 주식 전반 하락, 지정학 리스크 등)가 이미 부정 요인으로
  잡혀 있다면, 그 국채금리 하락은 안전자산 선호(flight-to-quality)에 따른 결과일 뿐이지
  성장주에 긍정적인 별개 신호가 아니다. 이 경우 mixed_factors로도 넣지 말고 그냥 생략하거나,
  위험회피 요인의 desc에 부수 현상으로만 짧게 언급하라. (2026-07-18 추가 — 실사고: Fed
  매파 기조를 부정 요인으로 넣어놓고 같은 카드에서 국채금리 하락 0.61%를 "성장주 긍정"이라며
  혼조로 분류하는 자기모순 발생)
- 국채금리 하락을 "안전자산 선호"로 설명하려면, 같은 카드에 실제 위험회피 증거
  (주가 하락, VIX 상승 등)가 있어야 한다. 주가가 오르고 VIX가 내린 날에 "안전자산
  선호·위험회피"라고 쓰면 그 자체가 사실 오류다 — 안전자산 선호는 주식이 팔리고
  채권이 사질 때 쓰는 말이다. 주식도 사고 채권도 산 날은 금리 기대가 내려간 것이다.
  (2026-08-14 추가 — 실사고: 나스닥 +0.95%·SOXX +2.05%·VIX 14.7인 날에 국채금리
  하락을 "안전자산 선호 심리 반영, 경기 둔화 우려 잔존"이라며 부정 25점으로 배정)
- 물가 지표 둔화를 긍정 요인으로 올렸으면, 그 지표가 만든 금리 하락을 같은 카드에서
  부정 요인으로 다시 세지 마라. 원인을 +40으로 세고 그 결과를 −25로 세는 것은
  같은 사건의 이중 계상이며 부호까지 뒤집힌 자기모순이다.
- "경기 둔화 우려"는 부정란을 채우는 만능 열쇠가 아니다. 그날 실제로 나온 약한
  지표나 하락한 주가 같은 증거가 없으면 쓰지 마라. 유가 하락·금리 하락처럼
  디스인플레이션 신호를 "수요 둔화 우려"로 뒤집는 서술이 반복되고 있다.
  (2026-08-14 추가 — 실사고: 18:20 카드가 유가 하락을 긍정 +5점으로 쓰고, 3시간
  30분 뒤 21:50 카드가 같은 유가 하락을 "경기 둔화 우려" 부정 10점으로 씀)
- 부정 요인이 정말 없는 날이면 부정 점수를 낮춰라. 점수를 먼저 정해 놓고 그 칸을
  채울 이유를 찾지 마라. 같은 점수가 여러 장 이어지는데 그 점수를 채우는 재료만
  계속 바뀌고 있다면, 그건 판단이 아니라 칸 채우기다.
- [근거에 이름을 붙인다 — 2026-08-14 운영 제보] 신호·지표를 근거로 들면 **그 지표
  이름과 수치**를, 사람 말을 근거로 들면 **그 사람이나 기관 이름**을 반드시 적어라.
  나쁜 예: name '시장 경고 신호', desc '과거 5번만 나타난 시장 경고 신호 발생, 일부
  전문가 비관론' — 무슨 신호인지도, 누구 말인지도 없어 독자가 판단할 수 없다.
  좋은 예: name '실러 CAPE 41배', desc '경기조정 주가수익비율 41배로 장기 평균 17.8배의
  2배 초과, 과거 같은 수준은 1929년·2000년 등 다섯 차례'.
  '일부 전문가', '일각에서', '분석가들'만 적고 이름이 없으면 그건 근거가 아니다.
- 달러 강세 → 미국 수출주/신흥국 자금 유출 우려 → 부정
- 달러 약세 → 수출주 실적 개선, 원자재 지지 → 긍정
- 지정학적 리스크 완화 → 긍정, 지정학적 긴장 고조 → 부정
- desc에 쓴 인과관계 방향이 긍정/부정 분류와 반드시 일치해야 함

[매크로 지표 최소 유의미 변동폭 — 2026-07-18 추가]
- VIX·국채금리·유가·달러인덱스 같은 매크로 지표는 변동폭이 아주 작으면(대략 상대변동
  1% 미만, 예: 국채금리 0.61% 하락처럼 오차 범위 수준의 움직임) 그 자체를 독립된
  요인이나 혼조 재료로 세우지 마라. 방향이 맞다고 무조건 인과관계 규칙을 기계적으로
  적용하지 말 것 — "하락 추세가 며칠 지속" 또는 "한 번에 큰 폭으로 움직임" 같은
  유의미한 신호가 있을 때만 요인으로 인정한다. 애매하면 아예 카드에서 빼라.
  (배경: 국채금리가 고작 0.61% 하락한 걸 두고 "성장주에 긍정적"이라 서술한 게 실제
  사고였음 — 크기를 무시하고 방향만 본 기계적 해석)

=== 호재/악재 선별 기준 — 반드시 원인을 찾아라 ===

[핵심 원칙]
- "기술주 프리마켓 상승/하락"은 결과(시장 반응)다. 원인(왜 상승하는지)이 호재/악재다.
- 원인을 모르면 그 방향은 호재/악재 목록에 절대 포함하지 않는다.
- key_event.name은 반드시 뉴스 이벤트나 매크로 원인이어야 한다. 시장 상태 묘사 금지.
  금지 예: "기술주 프리마켓 강세", "나스닥 선물 상승" → 이건 결과임
  허용 예: "미-이란 전술적 휴전 합의", "Fed 파월 인하 신호", "CPI 예상치 하회"

[이 원칙은 key_event뿐 아니라 positive_factors/negative_factors 각 항목의 name에도
 똑같이 적용된다 — 2026-07-18 신설, 반복 지적된 실사고 방지]
- 아래와 같은 "가격·지표가 움직인 결과"를 name에 그대로 쓰는 것 절대 금지. 이런 표현이
  나오면 그 가격 변동을 유발한 뉴스·이벤트를 찾아 name에 쓰고, 가격 수치는 desc의
  보조 근거로만 사용하라. 원인을 정말 못 찾겠으면 그 요인 자체를 항목에서 빼라.
  금지 예 (name에 쓰면 안 됨): "반도체 섹터 약세 심화", "VIX 공포지수 급등",
    "VIX 공포지수 하락", "주요 기술주 전반 하락", "주요 기술주 전반 상승",
    "기술주 하락 주도", "기술주 상승 주도"
  올바른 예: "Kimi K3발 AI 밸류에이션 재평가" (desc: "SOXX 1.08% 하락 등 반도체 재평가 압력")
    처럼 name=원인 뉴스, desc=그로 인한 가격 결과 순서로 쓸 것.
- VIX·유가·금리 같은 매크로 지표 자체는 "결과"이자 "확인 신호"다. 그 지표를 움직인
  구체적 뉴스·이벤트가 [최신 뉴스 헤드라인]에 있으면 그 이벤트를 name으로 쓰고, 정말
  근거가 없을 때만 예외적으로 지표명 자체를 name으로 허용한다(단, desc에 왜 원인을
  특정할 수 없는지 암묵적으로 드러나야 함 — 즉 남발 금지).
- 개별 기업 시가총액 순위 다툼(예: "애플, 엔비디아 시총 경쟁", "누가 시총 1위인가")은
  시장 전체를 흔드는 요인이 아니라 단순 트리비아다. 호재/악재/혼조 어디에도 넣지 마라.
  (배경: 이게 실제로 mixed_factors에 며칠간 반복 등장해 서비스 신뢰도를 해친 사고 있었음)

[시장 전체 재료로 인정 — 이것만 호재/악재로 분류]
1. 지정학 이벤트: 전쟁·협상·제재·관세 (리스크온/오프 전체 영향)
2. 매크로 경제지표: CPI, 고용보고서, GDP, PMI, 소비자심리
3. Fed·중앙은행: 금리 결정, FOMC 성명, 파월 발언, 인플레이션 신호
4. 무역·관세 정책: 트럼프 관세 발표·철회, 무역협상 타결·결렬
5. 벨웨더 실적 (섹터 전체 신호로 작동하는 경우만):
   - NVDA 실적 → AI·반도체 섹터 전체 신호
   - MU 실적 → 메모리·반도체 사이클 신호
   - JPM·BAC 실적 → 금융섹터 신호
   단, "실적이 섹터 전체의 건강을 나타낸다"는 맥락이 명확한 경우만 인정
6. 공급망·원자재: 유가 방향, 반도체 공급 부족, 항구 파업 등

[개별 기업 이슈 — 시장 전체 재료로 절대 금지]
- 소프트웨어 버전업·기능 추가 (예: TSLA FSD 업데이트) → TSLA 개별 재료
- 개별 인도량·배송 수치 (예: TSLA Q2 인도량 추정치) → TSLA 개별 재료
- 1~2개 증권사 목표가 상향/하향 (단독) → 해당 종목 개별 재료
- 경영진 SNS·인터뷰 발언 (실적 발표 외) → 해당 종목 개별 재료
- 개별 기업 간 시가총액 순위 다툼 (예: "애플·엔비디아 시총 1위 경쟁") → 시장 전체에
  영향 없는 단순 트리비아, 어느 항목에도 넣지 말 것 (2026-07-18 추가)

[예외 — 개별 기업이지만 시장 전체 재료로 인정 가능한 케이스]
- S&P500 시총 상위 5개(AAPL, MSFT, NVDA, AMZN, GOOGL) 기습 가격 인상
  → 인플레이션 신호·소비자 지출 영향으로 시장 전체에 파급. 인정.
- 나스닥 가중치 5% 이상 종목의 어닝 서프라이즈/쇼크 (실적 발표)
  → 섹터 전체 심리 전환 가능. 인정.
- 시총 상위권 기업의 "역대급" 규모 쇼크 (예: 창사 이래 최대 낙폭, 하루 시총 수백억달러
  증발) → 그 자체로 시장 전체 위험회피 심리에 충격을 줄 수 있어 인정 가능. 단, desc에
  반드시 그 쇼크가 왜 발생했는지(실적 경고 등 원인)를 명시할 것. (2026-07-18 추가)

=== 혼조·양면 재료 (mixed_factors) — 2026-07-03 신설 ===
- 시장 해석이 실제로 엇갈리는 재료는 긍정/부정 어느 한쪽에 억지로 배치하지 말고 mixed_factors(0~3개, 점수 없음)에 넣어라.
- mixed 판단 기준 (하나라도 해당하면 mixed):
  1. 같은 재료에 대해 상반된 해석이 동시에 유통 중 (예: 고용 둔화 → '금리 인하 기대' 호재 해석 vs '경기 침체 신호' 악재 해석)
  2. 실제 시장 반응(가격)이 교과서적 예상과 반대로 나옴 (예: 고용 둔화 발표 후 오히려 금리 상승, 기술주 하락)
  3. 자산군별 반응이 상충 (예: 주식은 악재로, 채권은 호재로 반응)
- mixed 항목의 desc에는 어떤 해석과 어떤 해석이 충돌하는지 양쪽을 모두 서술하라.
- 긍정/부정 요인에 배치한 재료라도 해석 논란이 남아 있으면 desc에 '해석 엇갈림' 명시.
- positive_total + negative_total = 100 규칙은 유지 (mixed는 점수 배분에 미포함)
- 억지로 mixed를 채우지 마라. 방향이 명확한 재료는 긍정/부정에 두는 것이 원칙이다.
- [오늘 데이터 재검증 필수, 2026-07-09 추가] mixed_factors는 반드시 이번 프롬프트의
  [현재 시장 데이터] 또는 [최신 뉴스 헤드라인]에 실제로 등장하는 재료여야 한다. 며칠 전 이벤트를
  오늘 데이터 근거 없이 습관적으로 반복 삽입하는 것은 금지. 직전 카드 참고 블록에 있다는 이유만으로
  넣지 말고, 매번 오늘 데이터 기준으로 처음부터 다시 판단하라.

=== 재료 간 괴리 명시 — 맥락 없는 단독 서술 금지 ===
- 두 데이터가 교과서적 인과와 반대로 움직이면, 그 괴리 자체를 반드시 서술하라.
  나쁜 예: name '미 국채 금리 상승', desc '성장주 투자 매력 감소' (맥락 없음)
  좋은 예: name '고용 둔화에도 금리 상승', desc '인하 기대보다 재정·수급 우려 우세, 성장주 압박'
- 같은 카드 안의 재료들이 서로 모순돼 보이면 summary에서 그 모순을 인정하고 '방향성 혼조'로 서술하라.

=== 이 코너의 정의 — 결과가 아니라 원인을 분석한다 (63항, 오너 재강조) ===
- 이 코너의 존재 이유: **"향후 12시간 주가의 향방을 예상해볼 수 있는, 현재 시점의
  원인 재료"를 분석하는 것**이다. 주가가 오르내린 결과는 이미 누구나 안다.
- 독자의 질문은 언제나 "왜"다. 반도체가 빠지는 날 독자는 반도체가 왜 빠지는지
  궁금한 것이다. 그때 "반도체 섹터 약세"를 부정 재료로 쓰면 **순환논리·동어반복**이다
  — 현상을 묘사하지 말고 원인을 분석하라. 노이즈가 아닌 정보를.
- '심리'와 '수급'은 가격의 다른 이름이다. 'AI 투자 심리 유지', '매수세 유입',
  '관심 지속'은 상태 묘사지 원인이 아니다 — "심리가 왜 유지되는가"의 그 '왜'
  (구체적 이벤트·수치·발언)가 재료다.
- **혼조 칸도 시장 재료만 싣는다.** 단일 기업·단일 제품 이슈(가격 조정, 모델 출시
  루머 등)는 미국 증시 전체를 움직이지 못하면 노이즈다 — 혼조에도 싣지 않는다.
  실사고: '테슬라 사이버트럭 가격 인상 논란'이 혼조로 나갔다. 테슬라 주가조차 못
  움직일 이슈다. 이 코너의 취지는 시장에 영향을 줄 정보를 가려내는 것이다.
  개별 기업 이슈가 시장급이 되는 예외는 벨웨더 실적 이벤트(earnings_bellwether)뿐이다.
- 같은 주제는 판정 하나만 갖는다. 한 주제를 긍정 칸과 혼조 칸에 쪼개 넣지 마라
  (실사고: 'AI 투자 심리 유지'가 긍정 35점, 'Nvidia 실적 발표 대기'가 혼조 — 같은
  이야기다). 판단이 서면 점수 칸에, 양면이면 혼조 칸에 — 한 곳에만.
- 혼조 재료의 설명은 혼조인 이유(양면 또는 변동폭 제한)를 담아라. "…성장주에
  긍정적"처럼 한쪽 방향으로 끝나는 설명을 혼조 칸에 두지 마라.
- summary도 같다. "…약세로 부정 우위" 같은 결과-이유 서술 금지 — 우위의 이유는
  원인 재료의 이름이어야 한다.

=== 단문으로 써라 (65항, 오너 지시) ===
- 한 문장에는 주장 하나만 담는다. '~이나', '~지만'으로 두 주장을 잇지 말고 끊어라.
- 순서는 원리 → 사실(숫자) → 판정. 예:
  나쁜 예: "당일 움직임은 판단을 실을 크기가 아니나, 금리 수준 자체가 성장주 할인율을
  좌우하는 핵심 변수 — 방향 판단 유보" (한 문장에 세 가지, 해석이 필요하다)
  좋은 예: "금리는 성장주 할인율을 좌우하는 핵심 변수. 오늘 미10년 4.70%(-0.72%).
  움직임이 작아 방향 판단은 유보" (끊어 읽히고 해석이 필요 없다)
- 독자가 문장 해석에 신경 쓰게 하지 마라. 한눈에 읽히면 통과, 두 번 읽게 하면 실패다.

=== 빼기보다 혼조 — 분석이 어려운 큰 축은 혼조로 분류한다 (64항, 오너 지시) ===
- 시장을 짓누르는 큰 축(특히 **금리**)은 판단이 애매하다고 카드에서 지우면 안 된다.
  "살짝 하락했지만 긍정이라 하기엔 부족하다" 같은 상황이 바로 혼조 칸의 존재 이유다.
- 이때 혼조 설명에는 **양면을 다 쓴다** — 당일 움직임(예: 소폭 하락)과 그 움직임을
  눌러 담는 배경(예: 금리 수준 자체가 높고 통화정책 국면이 진행 중)을 함께.
- 금리는 매 카드에서 다뤄야 할 상시 주제다. 긍정도 부정도 아니면 혼조로라도 싣는다.
  독자가 "오늘 카드에 금리 얘기가 왜 없지"라고 묻게 만들지 마라.

=== 방향 없는 상태는 재료가 아니다 (60항) ===
- '관망', '눈치보기', '숨 고르기', '방향성 탐색', '보합', '혼조 지속' 처럼 **방향이 없는
  상태**를 positive_factors·negative_factors 의 재료 이름으로 쓰지 마라. 관망은 시장이
  방향을 못 정했다는 뜻이라 오르지도 내리지도 않는다. 배경이지 재료가 아니다.
- 실제 사고: 같은 'Fed 관망'이 한 사이클에는 **부정 10점**, 다음 사이클에는 **긍정 25점**
  으로 나갔다. 새 사실이 생겨서가 아니라, 부호가 없는 재료라 그때그때 빈 칸으로 갔을 뿐이다.
- 관망의 **이유**가 재료다. 관망 자체가 아니라 "무엇 때문에 못 정하고 있는가"를 쓰거나,
  꼭 언급해야 하면 key_event 나 summary 문장에서 배경으로 다뤄라.

=== 이름은 내용과 같은 쪽을 가리켜야 한다 (60항) ===
- 독자는 재료의 **이름**을 먼저 읽고, 그게 긍정 칸에 있는지 부정 칸에 있는지를 본다.
  이름과 칸이 어긋나면 카드는 한눈에 거짓말을 한다.
- 나쁜 예 (실제 사고): 긍정 25점 재료의 이름이 'Fed 금리 인상 관망 심리'. 내용은
  "인상 베팅이 과도했다는 평가 → 인상 리스크 완화"라 방향은 긍정이 맞는데, 독자는
  긍정 칸에서 '금리 인상'이라는 글자를 먼저 읽는다.
- 좋은 예: 'Fed 금리 인상 기대 후퇴' / '추가 인상 가능성 축소'. 이름 끝까지 써서
  방향을 못 박아라. 긍정 칸 이름에 '금리 인상·긴축·매파'를 완화어 없이 쓰지 말고,
  부정 칸 이름에 '금리 인하·완화 전환·비둘기'를 그대로 쓰지 마라.

=== 정책금리와 시장금리가 따로 놀 때 (62항) ===
- Fed 인상 기대가 후퇴하는데 **장기 국채금리(10년·30년)는 오르는** 날이 있다.
  교과서와 반대로 가는 이 상황에서 '금리 인상 기대 후퇴'만 떼어 긍정 재료로 크게 실으면
  카드가 시장과 정반대를 가리킨다. **성장주·반도체를 누르는 것은 정책금리 기대가 아니라
  할인율로 실제 쓰이는 장기금리다.**
- 실제(2026-08-18): 9월 인상 확률이 7월 말 거의 100%에서 3분의 1로 내려앉는 동안
  30년물은 5.09% → 5.31%(2007년 이후 최고)로 올랐고, 그날 반도체는 무너졌다.
- 규칙: 인상 기대 후퇴를 긍정으로 쓰려면 **같은 재료 안에 장기금리 방향을 함께 적어라.**
  좋은 예: '9월 인상 기대는 후퇴했으나 30년물은 5.31%로 2007년 이후 최고 — 할인율 압박은 지속'.
  장기금리가 오르는 날 이 사실을 빼고 인상 기대 후퇴만 크게 실으면 재판정 대상이다.

=== 금리를 말할 때 (60항) ===
- **정책금리(Fed)와 시장금리(국채)는 다른 것이다.** 둘 다 카드에 넣어야 한다면 이름에서
  구분하라 — '정책금리 인상 기대 후퇴' / '시장금리(10년물) 상승'. 구분 없이 '금리'가
  긍정·부정 양쪽에 있으면 독자에게는 그냥 모순이다.
- **용어를 섞지 마라.** 정책금리는 '인상·인하'하고, 시장금리(국채)는 '상승·하락'한다.
  '시장 금리 인상'·'국채금리 인하' 같은 조합은 존재하지 않는 사건이다.
  실사고: 긍정 재료에 "시장 금리 인상 리스크 완화"라 써놓고 같은 카드 부정 재료는
  "미10년 국채금리 상승"이었다 — 한 카드가 시장금리가 오른다고도, 안 오른다고도 했다.

=== 근거 문장에서 조사를 지우지 마라 (60항) ===
- 명사만 이어 붙이면 **누가 무엇을 어떻게 봤는지**가 사라지고, 방향이 두 갈래로 읽힌다.
- 실사고: "골드만삭스 등 Fed 금리 인상 베팅 과도 평가" →
  (가) 골드만이 "시장의 인상 베팅이 과도하다"고 봤다(→ 인상 가능성 낮다, 긍정)
  (나) 골드만 등이 인상에 과도하게 베팅하고 있다(→ 인상 온다, 부정).
  정반대 두 뜻인데 문장이 어느 쪽인지 말하지 않는다. 이런 desc 는 점수를 실을 수 없다.
- 좋은 예: '골드만삭스는 시장의 금리 인상 베팅이 과도하다고 평가 — 인상 가능성 축소'.
  주체·대상·방향을 조사까지 붙여 끝까지 쓴다. 분석 본문의 개조식 문체와는 별개 규칙이다.
- 국채금리 수치는 **수준과 변화를 함께** 적어라. 둘 다 %라서 하나만 적으면 반드시
  오독된다. 좋은 예: '미10년 국채금리 4.70%(+1.19%) 상승'.
  나쁜 예: '미10년 국채금리 1.19% 상승' (금리가 1.19%인 것으로 읽힌다).

=== 동일 기업·티커 양측 동시 등장 절대 금지 ===
- MSFT, AAPL, NVDA, TSLA, GOOGL, AMZN, META, SOXX, QQQ, SPY 등 특정 기업·티커가
  positive_factors와 negative_factors 양쪽에 동시에 등장하는 것은 절대 금지.
- 위반 예 (금지): 긍정에 "MSFT, AAPL 강세" + 부정에 "MSFT 실적 우려" → 명백한 모순
- 해결법: 가장 최근 6시간 이내 데이터에서 해당 기업의 방향이 긍정인지 부정인지 하나로 결정한 뒤, 한쪽에만 배치
- 판단이 어려우면 해당 기업 항목을 생략하고 다른 재료를 사용할 것

=== 테슬라($TSLA) · 일론 머스크 관련 재료 취급 원칙 (엄격 적용) ===

[절대 부정 재료로 분류하면 안 되는 것들 — 아래 패턴 발견 즉시 제외]
- 머스크 본인의 발언, 인터뷰, 경고, 예측, SNS 게시물 (예: "AI 생산 부족 경고", "전망 발언" 등)
- 정치적 공격, 머스크 개인 행동 비판, 언론의 감정적 보도
- OpenAI·Anthropic·Google 등 타 AI 기업 뉴스를 테슬라·머스크와 묶어서 "AI 섹터 우려"로 분류하는 것
- "테슬라 및 AI 섹터 우려", "머스크 관련 심리 위축" 같은 막연한 묶음 표현
- 테슬라를 AI·반도체 섹터 하락과 자동 연결하는 분류

[테슬라 부정 재료로 인정되는 유일한 기준 — 수치·사실 근거 必]
- 실적 쇼크: EPS 또는 매출이 컨센서스 대비 miss, 반드시 수치 명시
- 대규모 리콜: 건수 명시
- 정부·규제기관 제재: 기관명과 제재 내용 명시
- 차량 인도 수치 급감: 전분기 대비 % 명시

위 기준 중 하나라도 수치·사실 근거 없이 해당하지 않으면 테슬라·머스크 관련 항목은 부정 재료 목록에 절대 포함하지 않는다.

=== 개별 기업 재료의 점수 배분 금지 (2026-08-12 강화) ===
- 한 기업의 지역 판매량·애널리스트 등급 조정·개별 계약 같은 뉴스는 그 기업의 재료이지
  미국 시장 전체의 재료가 아니다 — positive_factors/negative_factors에 점수를 배분하지 마라.
- 유일한 예외: 시장 전체를 실제로 움직인 실적 이벤트(예: 지수 급변을 동반한 대형주 실적) —
  이때만 category를 earnings_bellwether로 달고 점수를 배분한다.
- 그 외 개별 기업 소식이 정말 중요하면 mixed_factors(무점수)로만 다뤄라.
- 수치를 인용할 때는 제공된 헤드라인·데이터에 실제로 있는 수치만 쓴다. 헤드라인에 없는
  수치를 만들어 내지 마라.

=== 지표 발표 재료의 방향 일치 (2026-08-12 강화) ===
- 경제지표(주택·고용·물가 등) 발표를 재료로 쓸 때는 제공된 헤드라인·FRED 수치에 실제로
  있는 발표만, 발표된 방향 그대로 서술하라. 헤드라인이 '감소'인 지표를 '견조'로 뒤집어
  쓰는 것은 금지 — 발표 내용을 확인할 수 없으면 그 지표 재료를 아예 쓰지 마라.

- 위 지시문 내용을 절대 출력값에 포함하지 마세요

=== 영어 병기 (2026-07-29 신설) ===
- name_en / desc_en / why_en / summary_en 필드에, 대응하는 한국어 필드와 "완전히 같은 판단·같은 원인·같은 숫자"를 자연스러운 영어로 다시 써라. 직역이 아니라 미국 개인 투자자가 읽는 금융 뉴스레터 톤으로 재작성하되, 결론이나 인과관계를 한국어판과 다르게 쓰면 절대 안 된다.
- 티커·인명·기관명(Fed, CPI 등)은 번역하지 말고 그대로 유지. 숫자·%·달러 금액은 원문과 동일해야 한다.
- category·time·score는 화면에 노출되지 않거나 언어중립적 값이므로 영어 버전이 필요 없다 (time_en 만들지 말 것).
- 글자수 제한(name 20자, desc 30자, summary 50자, why 40자)은 한국어 기준이며 영어 버전에는 적용하지 않는다 — 다만 원문과 비슷한 분량의 짧은 구절로 유지할 것.

=== JSON 구조 ===
{{
  "key_event": {{
    "name": "",
    "name_en": "",
    "time": "",
    "why": "",
    "why_en": ""
  }},
  "positive_total": 0,
  "negative_total": 0,
  "summary": "",
  "summary_en": "",
  "positive_factors": [
    {{"score": 0, "name": "", "name_en": "", "desc": "", "desc_en": "", "category": ""}}
  ],
  "negative_factors": [
    {{"score": 0, "name": "", "name_en": "", "desc": "", "desc_en": "", "category": ""}}
  ],
  "mixed_factors": [
    {{"name": "", "name_en": "", "desc": "", "desc_en": "", "category": ""}}
  ]
}}
"""


def _call_single_model(model, payload, max_retries=4):
    """단일 모델로 최대 max_retries회 시도. 성공 시 dict 반환, 실패 시 None.
    429 Rate Limit은 더 긴 백오프 적용 (5s→15s→45s→120s).
    """
    url = _gemini_url(model)
    wait_secs        = [5, 15, 45, 120]   # 일반 오류 백오프
    wait_secs_429    = [30, 60, 120, 180]  # 429 Rate Limit 전용 (더 길게)

    for attempt in range(max_retries):
        try:
            resp = requests.post(url, json=payload, timeout=180)
            resp.raise_for_status()
            data = resp.json()

            # thinking 모델(gemini-2.5-flash 등)은 parts가 여러 개일 수 있음.
            # thought=True 파트를 건너뛰고 실제 JSON 텍스트 파트를 찾는다.
            parts = data["candidates"][0]["content"]["parts"]
            text = None
            for part in parts:
                if part.get("thought"):
                    continue  # thinking 토큰 건너뜀
                text = part.get("text", "")
                if text.strip():
                    break

            if not text:
                print(f"  ERROR: {model} — 유효한 텍스트 파트 없음")
                return None

            text = text.strip()
            text = re.sub(r'^```[a-zA-Z]*\n?', '', text)
            text = re.sub(r'\n?```$', '', text)
            return json.loads(text)
        except requests.exceptions.RequestException as e:
            status = getattr(e.response, 'status_code', None) if hasattr(e, 'response') else None
            print(f"  ERROR: {model} 요청 실패 (시도 {attempt+1}/{max_retries}) — {e}")
            if attempt < max_retries - 1 and status in (None, 429, 500, 502, 503, 504):
                # 429는 별도 백오프
                wait = wait_secs_429[attempt] if status == 429 else wait_secs[attempt]
                print(f"  {wait}초 후 재시도...")
                time.sleep(wait)
                continue
            return None
        except (KeyError, IndexError, json.JSONDecodeError) as e:
            print(f"  ERROR: {model} 응답 파싱 실패 — {e}")
            return None

    return None


def call_gemini(prompt):
    if not GEMINI_API_KEY:
        print("WARNING: GEMINI_API_KEY 없음 — 스킵")
        return None

    # thinkingBudget: 0 — thinking 토큰 비활성화 (비용 절감, 2026-06-27)
    # gemini-2.5-flash는 thinking 토큰을 자동 생성해 요금이 12배 비쌈
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.4,
            # 2026-07-29: 8192 → 12288 — name_en/desc_en/summary_en/why_en 병기로 출력
            # 필드 수가 늘어난 데 대한 안전 여유 (실제 사용량이 늘지 않으면 비용 영향 없음).
            "maxOutputTokens": 12288,
            "responseMimeType": "application/json",
            "thinkingConfig": {"thinkingBudget": 0}
        }
    }

    print(f"  1차 시도: {GEMINI_MODEL}")
    result = _call_single_model(GEMINI_MODEL, payload, max_retries=4)
    if result:
        print(f"  성공: {GEMINI_MODEL}")
        return result

    # 폴백 모델 (2026-07-03 추가) — 배경: 7/2 저녁 18:20~01:16 사이 5회 연속 실패로
    # 스코어카드가 밤새 갱신되지 않았음. 1차 모델(쿼터/일시 장애) 실패 시 형제 모델로 재시도.
    # 1.5 계열은 v1beta 404라 사용 불가 — 2.5 계열 내에서만 폴백.
    fallback = 'gemini-2.5-flash' if GEMINI_MODEL != 'gemini-2.5-flash' else 'gemini-2.5-flash-lite'
    print(f"  1차 모델 전체 실패 → 폴백 시도: {fallback}")
    result = _call_single_model(fallback, payload, max_retries=2)
    if result:
        print(f"  성공(폴백): {fallback}")
        return result

    return None


# ─── JSON 업데이트 ───────────────────────────────────────────────────────────

def load_existing():
    if os.path.exists(OUTPUT_PATH):
        with open(OUTPUT_PATH, 'r', encoding='utf-8') as f:
            return json.load(f)
    return {"entries": [], "max_entries": MAX_ENTRIES}


def save_data(data):
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"저장 완료: {OUTPUT_PATH}")


def _with_clean_category(factors):
    """각 요인 dict에 category를 고정 목록 값으로 정제해서 채워넣는다 (2026-07-28).
    Gemini가 category를 빠뜨리거나 목록 밖 값을 내도 크래시 없이 'other'로 강등."""
    out = []
    for f in (factors or []):
        if not isinstance(f, dict):
            continue
        f = dict(f)
        f['category'] = clean_category(f.get('category'))
        out.append(f)
    return out


def build_entry(kst_now, result):
    """Gemini 결과 + 타임스탬프 → 항목 dict"""
    # 데스킹 전 원본 보존 (과잉 제거 시 복원용) — deep-ish copy로 원본 오염 방지
    orig_pos = [dict(f) for f in _with_clean_category(result.get("positive_factors", []))]
    orig_neg = [dict(f) for f in _with_clean_category(result.get("negative_factors", []))]
    entry = llm_desk_factors({
        "id":            kst_id(kst_now),
        "timestamp_kst": kst_label(kst_now),
        "key_event": {
            "name": result.get("key_event", {}).get("name", "-"),
            "name_en": result.get("key_event", {}).get("name_en", ""),
            "time": result.get("key_event", {}).get("time", ""),
            "why":  result.get("key_event", {}).get("why", ""),
            "why_en": result.get("key_event", {}).get("why_en", "")
        },
        "positive_total":   int(result.get("positive_total", 50)),
        "negative_total":   int(result.get("negative_total", 50)),
        "summary":          result.get("summary", ""),
        "summary_en":       result.get("summary_en", ""),
        "positive_factors": desk_factors(_with_clean_category(result.get("positive_factors", [])), '긍정'),
        "negative_factors": desk_factors(_with_clean_category(result.get("negative_factors", [])), '부정'),
        # 혼조·양면 (2026-07-03), category 태그 추가 (2026-07-28), 결과 재료 데스크 (2026-07-31)
        "mixed_factors":    desk_factors(_with_clean_category((result.get("mixed_factors") or [])[:3]), '혼조')
    })
    # 데스킹으로 빠진 점수를 남은 원인 재료에 재배분 — 소계=항목합 보장 (2026-08-01 사고 수정)
    return rebalance_factor_scores(entry, orig_pos, orig_neg)


MIXED_FACTOR_STALE_HOURS = 24  # 혼조 재료 무한 반복 방지 — 이 시간 이상 연속되면 오늘 데이터 재확인 요구

# 혼조 재료 이름에서 걸러낼 범용 접속/서술어 — 이 단어들만으로는 "오늘 뉴스에도 있다"고
# 판정하지 않는다. "해석/논쟁/엇갈림/지속" 같은 말은 완전히 다른 주제에도 붙는 상투구라,
# 이것만 매칭돼도 grounded로 오판하면 안전장치가 사실상 무력화된다 (2026-07-10).
MIXED_FACTOR_GENERIC_WORDS = {
    '해석', '논쟁', '엇갈림', '우려', '지속', '고조', '완화', '기대', '전망',
    '반등', '상승', '하락', '둔화', '데이터', '신호', '전환', '심리', '변수',
    '요인', '가능성', '불확실성', '지수', '재료',
}

# ─── 요인 카테고리 태그 — difflib 문자열 유사도 대체 (2026-07-28 신설) ────────────
# 배경: 혼조 재료 재활용 사고(feedback_scorecard_mixed_factor_staleness.md)의 근본 원인은
# "같은 주제인지"를 name의 difflib 문자열 유사도로만 판정한 것 — 리워딩이 조금만 달라도
# (예: '고용 둔화 해석 논쟁' vs '고용 데이터 해석 논쟁') 다른 주제로 오인하거나, 반대로
# 우연히 어휘가 겹치면 다른 주제를 같은 주제로 오인했다. 이번 개선은 Gemini가 매번 자유
# 서술하는 name과 별개로, 고정 목록에서 고르는 category 태그를 추가로 받아 — 문자열이
# 아니라 정확한 값 일치로 같은 주제를 판별한다. name은 그대로 화면 표시용 자연어를 유지.
FACTOR_CATEGORIES = [
    'fed_policy',           # Fed·중앙은행 금리 결정, FOMC, 파월 발언
    'geopolitics',          # 전쟁·제재·지정학 리스크
    'trade_tariff',         # 관세·무역협상
    'macro_data',           # CPI·고용·GDP·PMI 등 경제지표
    'earnings_bellwether',  # 벨웨더 기업 실적(NVDA/MU/JPM 등 섹터 신호)
    'vix_risk_sentiment',   # VIX·안전자산 선호·리스크온오프
    'oil_energy',           # 유가·에너지·원자재
    'dollar_fx',            # 달러인덱스·환율
    'rates_treasury',       # 국채금리·수익률곡선
    'ai_tech_valuation',    # AI·반도체 밸류에이션 재평가
    'supply_chain',         # 공급망·반도체 공급·항구파업
    'company_specific',     # 개별 기업 이슈(프롬프트 예외 규정에 따라 인정된 경우)
    'other',                # 위 어디에도 안 맞는 경우 — 남용 금지, 최소화
]


# ─── 결과 재료 데스크 (2026-07-31 신설) — "요인=원인" 원칙의 결정적 필터 ─────────
# 배경: 프롬프트로 수차례 지시했음에도 Gemini가 'VIX 공포지수 하락', '나스닥 상승',
# '반도체 섹터 강세' 같은 결과(시장 반응)를 원인 재료로 계속 출력 (유저 재지적 2026-07-31,
# feedback_scorecard_cause_vs_effect.md). 프롬프트 지시는 확률적이라 재발한다 —
# 데스크(결정적 후처리)로 걸러낸다. 원리: 재료 이름이 "시장 상태 명사 + 방향 서술"의
# 조합이면서 원인 어휘(실적/결정/협상/지표 발표 등)가 하나도 없으면 결과로 판정해 제외.
import re as _re

_RESULT_SUBJECT_RE = _re.compile(
    r'(VIX|공포\s*지수|나스닥|S&P\s*500|S&P|다우|러셀|증시|주가\s*지수|기술주|'
    r'반도체\s*(섹터|주|업종)?|섹터|프리마켓|포스트마켓|선물|시장\s*전반)')
_RESULT_DIRECTION_RE = _re.compile(
    r'(상승|하락|급등|급락|강세|약세|반등|폭등|폭락|돌파|경신|랠리|마감|'
    r'심화|확대|지속|안정|회복|하회|상회|부진|호조|우위)')
_CAUSE_WHITELIST_RE = _re.compile(
    r'(실적|가이던스|어닝|발표|결정|동결|인하|인상|합의|협상|타결|결렬|제재|관세|'
    r'전쟁|휴전|공습|파업|규제|소송|판결|투자|수주|계약|출시|공개|인수|합병|'
    r'CPI|PPI|PCE|GDP|PMI|고용|실업|소매판매|FOMC|연준|파월|의사록|'
    r'재고|공급|감산|증산|출하|점유율|전망치|상향|하향|성장|매출|이익|적자|흑자)')


def _is_result_only(name):
    """이름이 결과 서술(시장 상태 + 방향)뿐이고 원인 어휘가 없으면 True"""
    if not name:
        return False
    if _CAUSE_WHITELIST_RE.search(name):
        return False
    return bool(_RESULT_SUBJECT_RE.search(name) and _RESULT_DIRECTION_RE.search(name))


def desk_factors(factors, kind=''):
    """결과 전용 재료 제외 + 로그. 점수 총합(positive_total 등)은 건드리지 않는다 —
    총점은 Gemini의 종합 판단이고, 여기서는 '표시되는 근거 목록'의 결함만 데스킹한다."""
    kept = []
    for f in (factors or []):
        name = (f or {}).get('name', '')
        if _is_result_only(name):
            print(f"::notice::[데스크] 결과 재료 제외({kind}): {name}")
        else:
            kept.append(f)
    return kept


DESK_LLM_MODEL = 'claude-sonnet-5'

def llm_desk_factors(entry):
    """2차 데스크 (Sonnet 5) — 정규식이 못 잡는 변형 결과 재료를 원인/결과로 재판정.
    API 키 없음/실패/과잉 삭제 시 무변경. 총점은 건드리지 않는다. (2026-07-31 유저 승인 편성)"""
    key = os.environ.get('ANTHROPIC_API_KEY', '').strip()
    if not key:
        return entry
    names = []
    for kind in ('positive_factors', 'negative_factors', 'mixed_factors'):
        for f in entry.get(kind) or []:
            names.append(f.get('name', ''))
    if not names:
        return entry
    prompt = (
        "미국주식 시황 재료 목록이다. 각 항목이 '원인'(뉴스 이벤트·실적·정책·협상 등 시장을 움직인 이유)인지 "
        "'결과'(시장·지수·섹터·VIX 등의 등락 상태 서술일 뿐 이유가 아님)인지 판정하라.\n"
        "결과 예시: 'VIX 하락', '나스닥 상승', '반도체 섹터 강세', '위험선호 회복'.\n"
        "원인 예시: 'MSFT 실적 호조', 'FOMC 매파적 동결', '관세 합의', 'CPI 둔화'.\n"
        "애매하면 '원인'으로 판정하라(과잉 삭제 금지).\n\n"
        + "\n".join(f"{i}. {n}" for i, n in enumerate(names))
        + '\n\n[출력 — 이 JSON만] {"verdicts": [{"i": 0, "result_only": false}, ...]} (목록 전체에 대해)')
    try:
        body = json.dumps({'model': DESK_LLM_MODEL, 'max_tokens': 2500,
                           'messages': [{'role': 'user', 'content': prompt}]}).encode()
        req = urllib.request.Request('https://api.anthropic.com/v1/messages', data=body,
            headers={'x-api-key': key, 'anthropic-version': '2023-06-01',
                     'content-type': 'application/json'})
        r = json.loads(urllib.request.urlopen(req, timeout=90).read().decode())
        txt = ''.join(b.get('text', '') for b in r.get('content', []) if b.get('type') == 'text')
        v = json.loads(txt[txt.index('{'): txt.rindex('}') + 1]).get('verdicts', [])
        drop_idx = {x['i'] for x in v if x.get('result_only')}
        if not drop_idx or len(drop_idx) > len(names) // 2:   # 과잉 삭제 방어
            if len(drop_idx) > len(names) // 2:
                print(f"::warning::[LLM데스크] 과잉 삭제({len(drop_idx)}/{len(names)}) — 무시")
            return entry
        i = 0
        for kind in ('positive_factors', 'negative_factors', 'mixed_factors'):
            kept = []
            for f in entry.get(kind) or []:
                if i in drop_idx:
                    print(f"::notice::[LLM데스크] 결과 재료 제외({kind}): {f.get('name')}")
                else:
                    kept.append(f)
                i += 1
            entry[kind] = kept
    except Exception as e:
        print(f"::warning::[LLM데스크] 실패 — 정규식 필터만 적용: {e}")
    return entry


def _apportion(weights, units):
    """weights 비례로 units개를 정수 배분 (최대잉여법, 각 항목 최소 1). 합 = units 보장."""
    n = len(weights)
    s = sum(weights)
    if s <= 0:
        base = units // n
        res = [base] * n
        res[0] += units - base * n
        return res
    quotas = [w / s * units for w in weights]
    res = [max(1, int(q)) for q in quotas]
    rem = units - sum(res)
    order = sorted(range(n), key=lambda i: quotas[i] - int(quotas[i]), reverse=True)
    guard = 0
    while rem != 0 and guard < 1000:
        idx = order[guard % n]
        if rem > 0:
            res[idx] += 1
            rem -= 1
        elif res[idx] > 1:
            res[idx] -= 1
            rem += 1
        guard += 1
    return res


def _redistribute(factors, total, step=5):
    """항목 점수를 비례 조정해 합이 정확히 total이 되게.
    가급적 step(5) 단위로 배분한다 (2026-08-01 유저 요청 — 26·19·27·14 같은 잔점수가
    조잡해 보임. 점수는 정밀 측정값이 아니라 비중 판단이므로 5·10 단위가 정직한 표현).
    5단위 배분이 불가능한 경우(총점이 5의 배수가 아니거나 항목 수 × 5 > 총점)만 1단위 폴백."""
    if not factors or total <= 0:
        return factors
    n = len(factors)
    weights = [int(f.get('score', 0) or 0) for f in factors]
    if step > 1 and total % step == 0 and total // step >= n:
        units = _apportion(weights, total // step)
        for f, u in zip(factors, units):
            f['score'] = u * step
    else:
        units = _apportion(weights, total)
        for f, u in zip(factors, units):
            f['score'] = u
    return factors


def rebalance_factor_scores(entry, orig_pos=None, orig_neg=None):
    """데스킹 후 '소계 = 항목 점수 합'을 항상 보장한다 (2026-08-01 이슈 제보 사고 —
    부정 합계 60인데 항목 합 30인 카드가 공개 노출됨. 원인: 2026-07-31 결과 재료 데스크가
    재료를 빼면서 점수 재배분을 하지 않았다).
    원칙: 총점(positive_total/negative_total)은 Gemini의 종합 판단이므로 유지하고,
    빠진 결과 재료의 점수를 남은 같은 편 '원인' 재료들에 비례 재배분한다 — 결과를 만든
    원인들이 그 무게를 나눠 지는 구조.
    가드: 데스킹이 그 편 점수의 60% 초과를 걷어냈고 남은 재료가 2개 미만이면, 재배분이
    소수 항목을 기형적으로 부풀리므로(단독 재료 80점 등) 데스킹 전 목록으로 되돌린 뒤
    재배분한다 — 표시 일관성이 결과재료 순수성보다 우선 (원인 순수성 1차 방어는 Gemini
    프롬프트 규칙)."""
    for side, orig in (('positive', orig_pos), ('negative', orig_neg)):
        total = int(entry.get(f'{side}_total', 0) or 0)
        kept = entry.get(f'{side}_factors') or []
        kept_sum = sum(int(f.get('score', 0) or 0) for f in kept)
        # 합이 맞고 전 항목이 5단위면 손대지 않는다. 합이 맞아도 잔점수(26·19 등)면 5단위로 재배분.
        if kept_sum == total and all(int(f.get('score', 0) or 0) % 5 == 0 for f in kept):
            continue
        if orig and len(kept) < 2 and kept_sum * 10 < total * 4:
            print(f"::warning::[데스크] {side} 과잉 제거(잔여 {kept_sum}/{total}) — "
                  f"원본 목록 복원 후 재배분")
            kept = [dict(f) for f in orig]
        entry[f'{side}_factors'] = _redistribute(kept, total)
    return entry


def clean_category(cat):
    """고정 목록 밖 값이 오면 안전하게 'other'로 강등 (Gemini가 목록을 벗어난 값을
    낼 가능성에 대한 방어 — 크래시 방지 및 하위 로직 오염 방지)."""
    return cat if cat in FACTOR_CATEGORIES else 'other'


def _mixed_factor_similar(a, b, threshold=0.55):
    """혼조 재료 이름 두 개가 리워딩만 다른 같은 주제인지 판정 (구버전 폴백 전용).
    예: '고용 둔화 해석 논쟁' vs '고용 데이터 해석 논쟁' → 대부분 겹침, 같은 주제로 판정.
    2026-07-28부터는 category가 있으면 이 함수 대신 정확 일치를 우선 사용한다 —
    이 함수는 category 정보가 없는 구버전 원장 항목과 비교할 때만 폴백으로 쓰인다."""
    if not a or not b:
        return False
    return difflib.SequenceMatcher(None, a, b).ratio() >= threshold


def _mixed_factor_same_topic(name, category, hist_name, hist_category):
    """두 혼조 재료가 같은 주제인지 판정. category 정확 일치(둘 다 있고 'other'가
    아닐 때)를 리워딩에 흔들리지 않는 최우선 신호로 삼아 즉시 같은 주제로 인정한다.
    다만 category가 불일치하거나 정보가 없어도 곧바로 '다른 주제'로 확정하지 않고,
    항상 difflib 이름 유사도를 추가로 확인한다 — category 하나만으로 최종 판정하면
    Gemini가 같은 이슈에 category를 날마다 다르게 배정했을 때(예: 같은 금리 이슈를
    하루는 'rates_treasury', 다음날은 'fed_policy'로) 안전망이 완전히 사라지는 회귀가
    생긴다(2026-07-28 1차 구현 후 블라인드 감사에서 지적됨). category 불일치인데
    이름까지 우연히 비슷해 과잉 매칭되는 부작용은, 뒤따르는 grounding 체크(오늘
    데이터에 실제로 등장하는 재료인지)가 최종 관문 역할을 하므로 위험이 낮다."""
    if category and hist_category and category != 'other' and hist_category != 'other' \
            and category == hist_category:
        return True
    return _mixed_factor_similar(name, hist_name)


def _grounding_tokens(name):
    """오늘 뉴스/데이터 grounding 체크에 쓸 '의미 있는' 토큰만 추림.
    범용 접속어(해석/논쟁 등)만 남으면 안전장치가 무력화되므로, 그런 경우에만 폴백으로
    전체 토큰을 쓴다."""
    tokens = [t for t in re.split(r'\s+', name) if len(t) >= 2]
    specific = [t for t in tokens if t not in MIXED_FACTOR_GENERIC_WORDS]
    return specific or tokens


def _ledger_mixed_history(ledger):
    """판단 원장(ledger)에서 혼조 재료 (datetime, name, category) 목록을 복원한다.

    2026-07-28부터 append_ledger()가 'mixed_tags'(구조화된 name+category 목록)를
    별도로 저장하므로 그걸 우선 사용한다. 그 필드가 없는 구버전 원장 항목(2026-07-28
    이전 기록, 최대 4일치 남아있을 수 있음)은 압축 'k' 라인의 '혼조: <이름>' 텍스트만
    복원하고 category는 None으로 둔다 — _mixed_factor_same_topic()이 이 경우 자동으로
    difflib 폴백으로 넘어간다.

    data.json(entries, 최근 10개=~2일치)과 달리 원장은 사후 수동 정리로 지워지지 않는다
    (2026-07-09 정리 때도 원장 원본은 그대로 남아 있었음). 그래서 며칠 전 반복되다 잠깐
    끊기고 다시 나오는 재활용 소재를 잡아낼 수 있는 유일한 소스다."""
    out = []
    for e in (ledger or []):
        if not isinstance(e, dict):
            continue
        try:
            dt = datetime.strptime(f"{e.get('d','')} {e.get('t','')}", '%Y-%m-%d %H:%M')
        except Exception:
            continue

        tags = e.get('mixed_tags')
        if tags:
            for tag in tags:
                if not isinstance(tag, dict):
                    continue
                name = (tag.get('n') or '').strip()
                if name:
                    out.append((dt, name, tag.get('c') or None))
            continue

        # 구버전 폴백 — mixed_tags 없는 2026-07-28 이전 원장 기록
        k = e.get('k') or ''
        if '혼조: ' not in k:
            continue
        name = k.split('혼조: ', 1)[1].strip()
        if name:
            out.append((dt, name, None))
    return out


def _collect_mixed_history(existing_entries, ledger):
    """data.json(최근 10개, 정확한 구조)과 판단 원장(최근 20개, ~4일, 사후정리로도
    안 지워짐)을 합쳐 (datetime, name, category) 후보 목록을 만든다.
    category는 2026-07-28 이전 데이터엔 없을 수 있음(None) — 호출부에서 폴백 처리."""
    candidates = []
    for e in (existing_entries or []):
        if not isinstance(e, dict):
            continue
        try:
            dt = datetime.strptime(e.get('id', ''), '%Y-%m-%d-%H:%M')
        except Exception:
            continue
        for m in (e.get('mixed_factors') or []):
            try:
                nm = (m.get('name') or '').strip()
            except Exception:
                continue
            if nm:
                candidates.append((dt, nm, m.get('category') or None))
    candidates.extend(_ledger_mixed_history(ledger))
    return candidates


def prune_stale_mixed_factors(entry, existing_entries, headlines, rss_headlines, kst_now,
                               ledger=None, equity_rows=None, macro_rows=None):
    """혼조 재료(mixed_factors)가 STALE_HOURS 넘게 반복되고 있는데 오늘 뉴스·데이터에도
    등장하지 않으면 강제로 제거한다 — 프롬프트 지시만으로는 막지 못한 실제 사고에 대한 안전장치.

    배경 (2026-07-09): "고용 둔화 해석 논쟁" 혼조 재료가 7/4~7/9까지 핵심 이슈가
    "고용 둔화"에서 "미-이란 긴장·유가 급등"으로 완전히 바뀐 뒤에도 문구 그대로 반복 등장.
    1차 조치로 "직전 카드부터 끊김없이 이어진 반복 24시간+"만 잡는 안전장치를 넣었다.

    배경 (2026-07-10, 2차 사고): 1차 조치를 배포한 지 하루 만에 "고용 데이터 해석 논쟁"
    (리워딩만 다른 동일 주제)이 재발함. 원인은 두 가지였다 —
    ① 중간에 "미-이란 긴장"으로 3사이클(약 10시간) 다른 혼조 재료가 끼어들면서 "끊김없는
       연속"이 깨져, 코드가 이걸 신규 재료로 오판(age=0)해 24시간 체크 자체가 발동 안 함.
    ② 사람이 수동으로 오염된 과거 카드의 mixed_factors를 비웠기 때문에, data.json
       existing_entries만 봐서는 "예전에 있었다"는 흔적조차 안 남아 있었음.
    그래서 이번엔 (a) existing_entries가 끊겨도 판단 원장(ledger, 사후정리로 안 지워짐)까지
    합쳐서 "며칠 전에도 있었나"를 다시 찾고, (b) 이름이 완전히 같지 않고 리워딩만 다른 경우도
    같은 주제로 인식(difflib 유사도)하도록 강화했다.
    """
    mixed = entry.get('mixed_factors') or []
    if not mixed:
        return entry, []

    all_context_text = ' '.join(
        list(headlines or []) + list(rss_headlines or []) +
        list(equity_rows or []) + list(macro_rows or [])
    ).lower()

    history = _collect_mixed_history(existing_entries, ledger)
    now_naive = kst_now.replace(tzinfo=None)

    kept, dropped = [], []
    for mf in mixed:
        name = (mf.get('name') or '').strip()
        if not name:
            continue
        category = mf.get('category')

        # 2026-07-28: category 정확 일치를 1차 기준으로, 정보가 없으면 difflib 폴백
        matches = [dt for dt, hname, hcat in history
                   if _mixed_factor_same_topic(name, category, hname, hcat)]
        first_seen_dt = min(matches) if matches else now_naive
        age_hours = (now_naive - first_seen_dt).total_seconds() / 3600

        if age_hours >= MIXED_FACTOR_STALE_HOURS:
            tokens = _grounding_tokens(name)
            grounded = any(tok.lower() in all_context_text for tok in tokens)
            if not grounded:
                dropped.append((name, round(age_hours, 1)))
                continue

        kept.append(mf)

    entry['mixed_factors'] = kept
    return entry, dropped


def validate_entry(entry):
    """점수 합계 검증"""
    pos_total = entry["positive_total"]
    neg_total = entry["negative_total"]
    pos_sum = sum(f.get("score", 0) for f in entry["positive_factors"])
    neg_sum = sum(f.get("score", 0) for f in entry["negative_factors"])

    if pos_total + neg_total != 100:
        print(f"WARNING: 합계 {pos_total + neg_total} ≠ 100 — 보정")
        entry["negative_total"] = 100 - pos_total

    if pos_sum != pos_total:
        print(f"WARNING: 긍정 요인 합계 {pos_sum} ≠ {pos_total}")
    if neg_sum != neg_total:
        print(f"WARNING: 부정 요인 합계 {neg_sum} ≠ {neg_total}")


def validate_content(entry, session_code='', snap=None):
    """내용 모순 검증 — 동일 기업 양측 등장, 유가 방향 오류, VIX 방향 오류, 세션 용어 오용"""
    def texts(factors):
        return [(f.get('name', '') + ' ' + f.get('desc', '')).lower() for f in factors]

    pos_texts = texts(entry.get('positive_factors', []))
    neg_texts = texts(entry.get('negative_factors', []))
    mixed_texts = texts(entry.get('mixed_factors', []))
    kev = entry.get('key_event', {})
    kev_text = (kev.get('name', '') + ' ' + kev.get('why', '')).lower()
    all_texts = pos_texts + neg_texts + mixed_texts + [kev_text]

    errors = []

    # ── 체크 1: 동일 기업·티커가 긍정·부정 양쪽에 동시 등장 ──────────────────
    # 영어 티커 + 한국어 기업명 모두 체크 (한국어만 쓰면 영어 티커 검사 통과 버그 방지)
    TICKERS = ['msft', 'aapl', 'nvda', 'tsla', 'googl', 'amzn', 'meta',
               'soxx', 'qqq', 'spy', 'amd', 'broadcom', 'mu ',
               # 63항 — 영문 사명 표기 추가. 실사고: 카드가 'Nvidia'라고 써서
               # 'nvda'로는 못 잡았다. 검사는 카드가 실제로 쓰는 표기를 봐야 한다.
               'nvidia', 'micron', 'apple', 'microsoft', 'tesla', 'google', 'alphabet',
               '마이크로소프트', '애플', '엔비디아', '테슬라', '구글', '아마존', '메타', '브로드컴',
               '마이크론']
    for ticker in TICKERS:
        in_pos = any(ticker in t for t in pos_texts)
        in_neg = any(ticker in t for t in neg_texts)
        if in_pos and in_neg:
            errors.append(f"모순: '{ticker.strip()}'가 긍정·부정 양쪽에 동시 등장")
        # 63항(2026-08-25 실사고): 긍정 35점 'AI 투자 심리 유지 :: Nvidia 실적 발표
        # 대기 속…' 과 혼조 'Nvidia 실적 발표 대기'가 같은 카드에 공존했다. 같은
        # 주제를 점수 칸과 혼조 칸에 쪼개 놓으면 독자는 어느 판정을 믿어야 하는지
        # 알 수 없다 — 판정은 하나여야 한다.
        in_mix = any(ticker in t for t in mixed_texts)
        if in_mix and (in_pos or in_neg):
            errors.append(f"분열: '{ticker.strip()}'가 점수 칸과 혼조 칸에 동시 등장 — "
                          f"같은 주제의 판정은 하나여야 한다. 합치거나 한쪽을 지워라")

    # ── 체크 2·3·4: 방향(유가·VIX·국채금리) + 국면 + 미세 변동 ─────────────────
    # 2026-08-14: 세 검사를 direction_offenders 하나로 합쳤다. 예전엔 여기서
    # 문자열만 만들고 끝나 '감지하고도 게시'가 났다. 이제 같은 함수가 집행
    # (enforce_direction_rules)에도 쓰여, 잡힌 재료는 반드시 점수를 잃는다.
    # 유가는 상승만 보고 하락은 안 봤는데(8/13 21:50 사고) 이제 양방향 대칭이다.
    for _side, _f, _why in direction_offenders(entry, snap):
        errors.append(_why)

    # ── 체크 5: 세션 용어 오용 (2026-07-03) — 포스트마켓 시간에 '프리마켓 약세' 같은 사고 방지 ──
    if session_code in ('post', 'closed', 'weekend'):
        if any('프리마켓' in t for t in all_texts):
            errors.append(f"세션 오류: 현재 세션({session_code})인데 '프리마켓' 표현 사용 — 프리마켓은 아직 시작 전")
    if session_code == 'pre':
        if any('포스트마켓' in t for t in all_texts):
            errors.append("세션 오류: 현재 프리마켓인데 '포스트마켓' 표현 사용")

    # ── 체크 6: key_event가 시장 상태 묘사 (원인이 아닌 결과) ────────────────
    STATE_WORDS = ['프리마켓', '포스트마켓', '시간외', '선물 상승', '선물 하락', '선물 약세', '선물 강세']
    kev_name = kev.get('name', '')
    for w in STATE_WORDS:
        if w in kev_name:
            errors.append(f"오류: key_event.name '{kev_name}'은 시장 상태 묘사(결과) — 원인 이벤트로 교체 필요")
            break

    # ── 체크 7: 요인(factor) name이 결과(가격 움직임)만 서술 — 원인 없이 포장 (2026-07-18) ──
    # 배경: "반도체 섹터 약세 심화", "VIX 공포지수 급등", "주요 기술주 전반 하락" 같은
    # 이름이 며칠씩 반복 등장. 이건 전부 가격이 움직인 결과지, 왜 움직였는지(원인)가 아님.
    # 유저가 직접 지적: "요인과 결과를 명확하게 구분하라."
    FACTOR_RESULT_ONLY = [
        '공포지수 급등', '공포지수 상승', '공포지수 하락',
        'vix 지수 급등', 'vix 지수 상승', 'vix 지수 하락',
        '약세 심화', '강세 심화', '전반 하락', '전반 상승',
        # 2026-08-19 실사고: '반도체 섹터 전반 약세'가 부정 35점을 달고 나갔다.
        # '약세 심화'만 막아두니 '전반 약세'로 옷을 갈아입었다.
        '전반 약세', '전반 강세', '섹터 약세', '섹터 강세', '섹터 전반',
        '전반적 하락', '전반적 상승', '하락 주도', '상승 주도',
        '시총 경쟁', '시총 1위 경쟁', '시가총액 경쟁',
        # 63항(2026-08-25): '심리'와 '수급'은 가격의 다른 이름이다 — 상태 묘사지
        # 원인이 아니다. 실사고: 긍정 35점 이름이 'AI 투자 심리 유지'였다.
        # 독자의 질문은 "심리가 왜 유지되는가"다. 그 '왜'가 재료다.
        '심리 유지', '심리 지속', '심리 개선', '심리 악화', '심리 위축', '심리 강화',
        '심리 회복', '관심 지속', '관심 확대', '매수세 유입', '매수세 지속',
        '매도세 유입', '매도세 지속', '매도세 확대', '저가 매수',
    ]
    for f in (entry.get('positive_factors', []) + entry.get('negative_factors', [])
              + entry.get('mixed_factors', [])):
        fname = (f.get('name', '') or '').lower()
        for pat in FACTOR_RESULT_ONLY:
            if pat in fname:
                errors.append(f"오류: 요인명 '{f.get('name','')}'은 결과(가격 움직임)만 서술 — "
                               f"원인(뉴스·이벤트)으로 교체 필요")
                break

    # ── 체크 12: 결과를 원인 자리에 놓는 순환 서술 (2026-08-25 신설, 63항) ────
    # 실사고: summary가 "반도체 섹터 약세로 부정 우위 지속". 반도체가 빠진 건 결과다.
    # 독자는 '왜 빠지는지'가 궁금한데 '빠져서 부정'이라고 답하면 동어반복이다.
    _CIRCULAR = re.compile(r'(약세|강세|하락|상승|급락|급등|부진|호조)\s*(로|으로)\s*'
                           r'(긍정|부정)\s*우위')
    summ = entry.get('summary', '') or ''
    m_c = _CIRCULAR.search(summ)
    if m_c:
        errors.append(f"순환 서술: 요약 '{m_c.group(0)}' — 주가·섹터의 등락은 결과다. "
                      f"결과를 우위의 이유로 쓰지 말고, 그 등락을 만든 원인(이벤트·금리·"
                      f"유가 등)을 이유로 써라")

    # ── 체크 13: 혼조 재료가 한쪽 방향만 주장 (2026-08-25 신설, 63항) ─────────
    # 실사고: 혼조 칸의 '미 국채금리 하락' 설명이 "성장주에 긍정적"으로 끝났다.
    # 혼조는 양면이 있다는 뜻인데 설명이 한쪽만 말하면 독자는 분류를 의심한다.
    # (점수를 실을 크기가 아니어서 혼조로 내린 재료라면, 설명에 그 사정 —
    #  변동폭이 작다 · 해석이 갈린다 — 이 드러나야 한다.)
    _ONE_SIDED_TAIL = re.compile(r'(긍정적|부정적|호재|악재)\s*$')
    _TWO_SIDED = re.compile(r'이나|지만|반면|혼조|엇갈|양면|불확실|제한적|미미|관망|대기')
    for f in entry.get('mixed_factors') or []:
        dsc = (f.get('desc') or '').strip()
        if _ONE_SIDED_TAIL.search(dsc) and not _TWO_SIDED.search(dsc):
            errors.append(f"혼조 서술 오류: '{f.get('name','')}' 설명이 한쪽 방향"
                          f"(\"…{dsc[-12:]}\")으로 끝난다 — 혼조인 이유(양면 또는 "
                          f"변동폭 제한)를 설명에 담아라")

    # ── 체크 14: 혼조 칸의 개별 기업 노이즈 (2026-08-25 신설, 67항) ──────────
    # G4는 점수 칸만 막았고 혼조 칸은 뒷문이었다. 실사고: '테슬라 사이버트럭 가격
    # 인상 논란'(company_specific)이 혼조로 게시됐다. 단일 기업, 단일 제품, 그중
    # 판매량이 가장 작은 제품의 가격 이슈다 — 미국 증시를 움직이지 못한다.
    # 이 코너의 취지는 시장에 영향을 줄 정보를 가려내는 것이다. 노이즈는 혼조도 아니다.
    for f in entry.get('mixed_factors') or []:
        if (f.get('category') or '') == 'company_specific':
            errors.append(f"혼조 노이즈: '{f.get('name','')}'(개별 기업) — 미국 증시 전체에 "
                          f"영향을 줄 재료가 아니면 혼조에도 싣지 않는다. 시장을 움직일 "
                          f"이슈라면 벨웨더 실적 등 시장 카테고리로 분류해 근거를 대라. "
                          f"아니면 빼라")

    # ── 체크 16: 예정 이벤트 '대기'에 점수 (2026-08-26 신설, 72항) ───────────
    for _side, _f, _why in event_wait_offenders(entry):
        errors.append(_why)

    # ── 체크 15: 이미 지난 일정을 '대기'로 서술 (2026-08-26 신설, 70항) ──────
    # 예정 이벤트에 날짜를 붙이기 시작하면(70항) 그 반대편 병도 같이 잡아야 한다 —
    # 잭슨홀이 끝난 다음 날에도 '잭슨홀 연설 대기'가 남아 있으면 독자를 속이는 것이다.
    for _stale in stale_event_offenders(entry):
        errors.append(_stale)

    # ── 체크 9: 금리가 긍정·부정 양쪽에 (2026-08-17 신설, 60항) ──────────────
    _both = rate_on_both_sides(entry)
    if _both:
        errors.append(_both)

    # ── 체크 11: 정책금리 기대 vs 장기 시장금리 괴리 (2026-08-19 신설, 62항) ──
    _split = policy_vs_market_rate(entry, snap)
    if _split:
        errors.append(_split)

    # ── 체크 10: 조사 없는 명사 나열로 방향이 두 갈래 (2026-08-17 신설, 60항) ──
    _collapsed = collapsed_clause_violation(entry)
    if _collapsed:
        errors.append(_collapsed)

    # ── 체크 8: 주말을 '휴장'이라 부름 (2026-08-17 신설, 58항) ────────────────
    # 성동님 지시 — "사람들은 토/일요일 주식시장을 하지 않는 것을 '휴장'이라고
    # 하지 않는다. 그러므로 '휴장'이라고 하면 평일에 주식시장 하지 않는 것으로
    # 오해를 한다." 맞는 지적이다. 금요일 장이 끝나면 다음 장이 월요일이라는 건
    # 독자가 이미 아는 사실이라 알릴 값이 없고, 굳이 이름을 붙이면 없던 정보가
    # 생긴 것처럼 읽힌다. 평일 공휴일 휴장(추수감사절 등)은 반대다 — 모르면
    # 손해라 알려야 한다. 그래서 공휴일 단어가 같이 있는 문장은 통과시킨다.
    if any('주말 휴장' in t or '주말휴장' in t for t in all_texts):
        errors.append("표현 오류: '주말 휴장' — 토·일에 장이 안 열리는 것을 휴장이라 부르지 않는다")
    elif session_code == 'weekend':
        for t in all_texts:
            if '휴장' in t and not any(h in t for h in _HOLIDAY_WORDS):
                errors.append("표현 오류: 주말을 '휴장'이라 표현 — 필요하면 "
                              "'직전 장(금요일) 마감 기준'처럼 쓴다")
                break

    return errors


# ─── 주말 '휴장' 표현 최종 관문 (58항) ───────────────────────────────────────
# 재판정을 시켜도 같은 단어가 두 번 나오는 경우가 있다. 그때 경고만 찍고 게시하면
# 52항에서 없앤 '감지하고도 게시'가 표현 층에서 재발한다. 그래서 마지막에 결정적
# 치환을 하나 둔다 — 애매한 자리는 건드리지 않고, 명백히 틀린 조합만 바꾼다.
_HOLIDAY_WORDS = (
    '공휴일', '추수감사절', '크리스마스', '성탄', '독립기념일', '노동절',
    '마틴 루터', '대통령의 날', '현충일', '메모리얼', '준틴스', '부활절',
    '성금요일', '굿프라이데이', '신정', '새해 첫',
)


def scrub_weekend_closure_word(entry, session_code=''):
    """주말을 '휴장'이라 부른 표현만 지운다. 공휴일 휴장 문장은 손대지 않는다."""
    def fix(s):
        if not s or '휴장' not in s:
            return s
        if any(h in s for h in _HOLIDAY_WORDS):
            return s                                   # 공휴일 휴장은 정당한 표현
        s = s.replace('주말 휴장 중', '금요일 장 마감 후')
        s = s.replace('주말휴장', '주말').replace('주말 휴장', '주말')
        if session_code == 'weekend':
            # '휴장 중이라/이다/이고'의 조사까지 같이 갈아야 문장이 안 깨진다 —
            # '장 마감 후이라' 같은 비문이 나오면 고친 게 아니라 흠집을 낸 것이다.
            s = s.replace('휴장 중이', '마감된 상태').replace('휴장 중', '마감된 상태')
            s = s.replace('휴장일', '비거래일').replace('휴장', '마감')
        return s

    for key in ('positive_factors', 'negative_factors', 'mixed_factors'):
        for f in (entry.get(key) or []):
            for k in ('name', 'desc'):
                if f.get(k):
                    f[k] = fix(f[k])
    kev = entry.get('key_event') or {}
    for k in ('name', 'why'):
        if kev.get(k):
            kev[k] = fix(kev[k])
    return entry


# ─── 요약 순환 서술 교정 (63항) ──────────────────────────────────────────────
# 체크 12는 재판정 사유일 뿐이라, 재시도로도 안 고쳐지면 "약세로 부정 우위"가
# 그대로 게시된다(2026-08-25 실제 발생 — 두 시도 모두 같은 문구를 썼다).
# 그래서 결정적 교정을 둔다. 문장을 새로 쓰지는 않는다 — 결과 어구만 걷어낸다.
#   "지정학적 긴장 고조와 반도체 섹터 약세로 부정 우위" → "지정학적 긴장 고조로 부정 우위"
#   "반도체 섹터 약세로 부정 우위" → "부정 우위" (원인이 그것뿐이면 이유째 뗀다)
_RESULT_PHRASE = r'[가-힣A-Za-z0-9 ]{0,14}?(?:약세|강세|하락|상승|급락|급등|부진|호조)'
_CIRC_CONJ = re.compile(r'\s*(?:와|과|및)\s*' + _RESULT_PHRASE +
                        r'(?=\s*(?:로|으로)\s*(?:긍정|부정)\s*우위)')
_CIRC_SOLE = re.compile(_RESULT_PHRASE + r'\s*(?:로|으로)\s*(?=(?:긍정|부정)\s*우위)')

def _fix_ro_josa(text):
    """어구를 걷어낸 자리의 조사 교정 — '긴장과 …약세로'에서 결과 어구를 떼면
    '긴장로'가 남는다(2026-08-25 실제 발생). 받침 있는 말 뒤의 '로'는 '으로'다
    (ㄹ 받침 제외). 우위 앞자리만 본다 — 문장 전체를 건드리지 않는다."""
    def rep(mm):
        ch = mm.group(1)
        jong = (ord(ch) - 0xAC00) % 28
        return ch + ('로' if jong in (0, 8) else '으로')
    return re.sub(r'([가-힣])로(?=\s*(?:긍정|부정)\s*우위)', rep, text)


def scrub_circular_summary(entry):
    v = entry.get('summary') or ''
    if not v:
        return entry
    nv = _CIRC_CONJ.sub('', v)
    nv = _CIRC_SOLE.sub('', nv)
    if nv != v:
        nv = _fix_ro_josa(nv)
        entry['summary'] = re.sub(r'\s{2,}', ' ', nv).strip(' ,')
        print(f"::warning::[63항] 요약 순환 서술 교정: '{v}' → '{entry['summary']}'")
    return entry


# ─── 금리 상시 노출 보증 (64항) ──────────────────────────────────────────────
# 오너 지시(2026-08-25): "미 국채금리가 살짝 하락했지만 긍정 재료라 할 만하지 않다.
# 나라면 혼조라고 하겠다. 주식시장을 짓누르는 가장 큰 악재이니까. 분석 곤란하다고
# 아예 빼는 것은 오히려 문제다. 그런 것을 애매/혼조로 분류하면 되잖니."
# 프롬프트·재판정 지시로도 모델이 금리를 통째로 빼면, 실측치만으로 혼조 재료를
# 만들어 넣는다. 판단은 지어내지 않는다 — 숫자와 '판단 유보'만 쓴다.
# 국면 서술(금리 인상기·인하기 등)은 코드에 박지 않는다 — 국면은 바뀌고,
# 하드코딩된 국면은 언젠가 반드시 거짓말이 된다. 그건 모델의 몫이다.

def ensure_rates_visible(entry, snap):
    if not snap or snap.get('yield_level') is None:
        return entry
    has_rates = False
    for side in ('positive_factors', 'negative_factors', 'mixed_factors'):
        for f in entry.get(side) or []:
            t = (f.get('name', '') or '') + ' ' + (f.get('desc', '') or '')
            if re.search(r'금리|국채|수익률|10년물|30년물', t):
                has_rates = True
                break
        if has_rates:
            break
    if has_rates:
        return entry
    lvl, pct = snap['yield_level'], snap.get('yield_pct')
    d10 = f"미10년 {lvl:.2f}%" + (f"({pct:+.2f}%)" if pct is not None else '')
    l30, p30 = snap.get('yield30_level'), snap.get('yield30_pct')
    d30 = (f" · 미30년 {l30:.2f}%" + (f"({p30:+.2f}%)" if p30 is not None else '')) if l30 else ''
    # 문안은 단문 세 개다(65항, 성동님 지시): 원리 → 오늘 숫자 → 판정.
    # 복문으로 이으면 독자가 해석에 신경을 쓴다. 끊어서 한눈에 읽히게.
    entry.setdefault('mixed_factors', []).append({
        'name': '미 국채금리 수준', 'name_en': 'US Treasury Yields',
        'desc': (f"금리는 성장주 할인율을 좌우하는 핵심 변수. "
                 f"오늘 {d10}{d30}. 움직임이 작아 방향 판단은 유보"),
        'desc_en': (f"Yields drive growth-stock discount rates. "
                    f"Today {d10}{d30}. Move too small to call — on hold"),
        'category': 'rates_treasury',
    })
    print("::warning::[64항] 카드에 금리가 없어 실측치로 혼조 재료 보충")
    return entry


# ─── 국채금리 수치 표기 교정 (60항) ──────────────────────────────────────────
# 금리는 수준도 %, 변화도 %다. 하나만 적으면 독자가 반드시 헷갈린다 —
# "미10년 국채금리 1.19% 상승"은 금리가 1.19%라는 말로 읽힌다(실제 4.70%였다).
# 글에 적힌 숫자가 실측 변화율과 같을 때만, 수준을 앞에 붙여준다. 다른 숫자면
# 손대지 않는다 — 모르는 수치를 코드가 지어내는 순간 더 큰 사고가 된다.
_YIELD_TXT = re.compile(r'(국채\s*금리|국채\s*수익률|10년물)([^0-9%]{0,8})'
                        r'(\d+(?:\.\d+)?)\s*%')

def fix_yield_number(entry, snap):
    if not snap:
        return entry
    lvl, pct = snap.get('yield_level'), snap.get('yield_pct')
    if lvl is None or pct is None:
        return entry

    def fix(s):
        if not s or '%' not in s:
            return s
        def rep(m):
            n = float(m.group(3))
            if abs(n - abs(pct)) > 0.05:        # 변화율이 아닌 숫자 — 손대지 않는다
                return m.group(0)
            return f"{m.group(1)}{m.group(2)}{lvl:.2f}%({pct:+.2f}%)"
        return _YIELD_TXT.sub(rep, s)

    for key in ('positive_factors', 'negative_factors', 'mixed_factors'):
        for f in (entry.get(key) or []):
            for k in ('name', 'desc'):
                if f.get(k):
                    f[k] = fix(f[k])
    kev = entry.get('key_event') or {}
    for k in ('name', 'why'):
        if kev.get(k):
            kev[k] = fix(kev[k])
    return entry



# ─── 심층 보고서 (66항, 2026-08-25 성동님 지시) ──────────────────────────────
# "현재의 분석이 너무 요약적이라서 무슨 말인지 잘 모를 때, 이 보고서를 보면
#  '아… 이런 이야기였구나'를 알 수 있을 정도로. 전후 사정을 알 수 있을 정도로."
# 카드가 확정된 뒤(집행·교정 완료 후) 별도 호출로 쓴다 — 같이 만들면 집행이
# 재료를 바꿨을 때 보고서가 낡은 카드를 설명하게 된다. 실패해도 카드는 나간다.

# 소제목은 화면(market-vs.html REPORT_SECTIONS)과 한 벌이다 — 2026-08-25 성동님 확정:
# 현재 판 정리 / 호재 / 악재 / 혼조·경계 / 앞으로 12시간 체크포인트
REPORT_SECTIONS = [('overview', '현재 판 정리'), ('positive', '호재'),
                   ('negative', '악재'), ('mixed', '혼조·경계'),
                   ('watch', '앞으로 12시간 체크포인트')]

# ─── 68항 — 보고서는 카드의 해설이지 두 번째 판정이 아니다 ─────────────────────
# 실사고(2026-08-26 00:51 카드): 카드에는 테슬라 재료가 없는데, 보고서 악재 섹션에
# '테슬라 사이버트럭 가격 인상: … 주가에 부정적 영향'이 등장했다. 그 시각 TSLA는
# 장중 +1.54% 상승 중이었다. 본판은 67항 게이트가 걸렀는데, 보고서 생성이 뉴스
# 원문을 근거 자료로 받다 보니 거기서 노이즈를 다시 끌어와 제 판정을 얹은 것이다.
# 원칙: 호재/악재/혼조 블릿의 '주제'(콜론 앞 핵심어)는 확정 카드의 재료여야 한다.
# 카드에 없는 개별 기업이 주제면 그 블릿을 걷어낸다. 단, 시장 재료의 '근거'로
# 개별 기업 등락을 인용하는 것(예: 반도체 강세의 근거로 "NVDA +2.2%")은 정상이라
# 콜론 앞만 본다. watch(체크포인트)는 벨웨더 실적 등 예정 이벤트가 올 수 있어 면제.
_RPT_COMPANY_GROUPS = {
    'tesla':     ['tsla', 'tesla', '테슬라'],
    'nvidia':    ['nvda', 'nvidia', '엔비디아'],
    'apple':     ['aapl', 'apple', '애플'],
    'microsoft': ['msft', 'microsoft', '마이크로소프트'],
    'google':    ['googl', 'google', 'alphabet', '구글', '알파벳'],
    'amazon':    ['amzn', 'amazon', '아마존'],
    'meta':      ['meta', '메타'],
    'amd':       ['amd'],
    'broadcom':  ['avgo', 'broadcom', '브로드컴'],
    'micron':    ['micron', '마이크론'],   # 'mu'는 두 글자라 오탐이 많아 뺀다
    'intel':     ['intc', 'intel', '인텔'],
    'marvell':   ['marvell', '마벨'],
}

def _rpt_groups_in(text):
    """텍스트에 등장하는 기업 그룹 집합. 같은 회사의 티커·영문·한글 표기를 한 그룹으로
    묶는다 — 카드가 '테슬라'라고 쓰고 보고서가 'Tesla'라고 써도 같은 회사다(63항 교훈)."""
    low = (text or '').lower().replace('메타버스', '')   # '메타버스'는 메타(회사)가 아니다
    found = set()
    for g, aliases in _RPT_COMPANY_GROUPS.items():
        for a in aliases:
            if re.search(r'[a-z]', a):
                # 라틴 표기는 낱말 경계 — 'meta'가 'metadata' 안에서 잡히는 것 방지
                if re.search(r'(?<![a-z])' + re.escape(a) + r'(?![a-z])', low):
                    found.add(g)
                    break
            elif a in low:
                found.add(g)
                break
    return found

def report_offcard_scrub(rep, entry):
    """호재/악재/혼조 블릿 중 '카드에 없는 개별 기업'이 주제인 것을 걷어낸다.
    걷어낸 (섹션, 기업, 블릿) 목록을 돌려준다 — 호출부가 경고를 찍는다."""
    kev = entry.get('key_event') or {}
    card_text = ' '.join(filter(None,
        [entry.get('summary', ''), kev.get('name', ''), kev.get('why', '')] +
        [(f.get('name', '') + ' ' + f.get('desc', ''))
         for s in ('positive_factors', 'negative_factors', 'mixed_factors')
         for f in (entry.get(s) or [])]))
    on_card = _rpt_groups_in(card_text)
    dropped = []
    for k in ('positive', 'negative', 'mixed'):
        kept = []
        for line in (rep.get(k) or '').split('\n'):
            head = line.split(':', 1)[0]           # "- 핵심어: 내용"의 핵심어만 본다
            off = _rpt_groups_in(head) - on_card
            if line.strip() and off:
                dropped.append((k, sorted(off), line.strip()))
                continue
            kept.append(line)
        rep[k] = '\n'.join(kept).strip()
    return dropped


# ─── 69항 — watch(앞으로 12시간 체크포인트)의 일정 검증 ──────────────────────
# 실사고(2026-08-26 성동님 지적): watch에 "CPI 소비자물가 지표: 다음 CPI 발표 시
# 인플레이션 추이가 확인될 예정 …"이 올랐다. 다음 CPI는 9월 11일 — 12시간이 아니라
# 2주 뒤다. 같은 카드에서 NVDA 실적도 "향후 12시간 내 예정"이라고 썼는데 실제로는
# 더 뒤였다. 모델은 일정표가 없으면 '다음 발표'를 임박한 것처럼 쓴다.
# 대책: 공식 일정표를 코드가 들고, 프롬프트에 실제 일정을 주고, 어긴 블릿은 걷어낸다.
#
# 일정 출처(2026-08-26 원문 확인): BLS bls.gov/schedule/2026 (고용보고서·CPI·PPI),
# BEA bea.gov/news/schedule (PCE·GDP), Fed federalreserve.gov (FOMC).
# ★ 2026년 말까지만 들어 있다. 2027년 일정이 발표되면(통상 연말) 여기에 이어 붙일 것.
#   일정표가 소진되면 검증은 조용히 꺼지고 경고만 찍는다 — 낡은 표로 오판하지 않는다.
# 70항(2026-08-26) — 5번째 칸 approx: 공식 시각이 아직 공표되지 않아 관례로 적은 경우.
# 화면에는 '약'을 붙여 확정 일정과 구분한다. 모르는 것을 아는 척하지 않는다.
_ECON_CALENDAR = [
    # (ET 날짜, ET 시각, 종류, 이름, 시각 미확정 여부)
    ('2026-08-26', '08:30', 'pce',  'PCE 개인소비지출(7월분)·GDP 2차 잠정치(2분기)', False, 'PCE inflation (Jul) and Q2 GDP 2nd est.'),
    ('2026-08-28', '10:00', 'jackson',
     '잭슨홀 심포지엄(8/27~29) Fed 의장 기조연설 — 케빈 워시 취임 후 첫 연설', True, 'Jackson Hole symposium (Aug 27-29) — Fed Chair keynote'),
    ('2026-09-04', '08:30', 'jobs', '고용보고서(8월분)', False, 'Jobs report (Aug)'),
    ('2026-09-10', '08:30', 'ppi',  'PPI 생산자물가(8월분)', False, 'PPI (Aug)'),
    ('2026-09-11', '08:30', 'cpi',  'CPI 소비자물가(8월분)', False, 'CPI (Aug)'),
    ('2026-09-16', '14:00', 'fomc', 'FOMC 금리 결정', False, 'FOMC rate decision'),
    ('2026-09-30', '08:30', 'pce',  'PCE 개인소비지출(8월분)·GDP 확정치(2분기)', False, 'PCE inflation (Aug) and Q2 GDP 3rd est.'),
    ('2026-10-02', '08:30', 'jobs', '고용보고서(9월분)', False, 'Jobs report (Sep)'),
    ('2026-10-14', '08:30', 'cpi',  'CPI 소비자물가(9월분)', False, 'CPI (Sep)'),
    ('2026-10-15', '08:30', 'ppi',  'PPI 생산자물가(9월분)', False, 'PPI (Sep)'),
    ('2026-10-28', '14:00', 'fomc', 'FOMC 금리 결정', False, 'FOMC rate decision'),
    ('2026-10-29', '08:30', 'pce',  'PCE 개인소비지출(9월분)·GDP 속보치(3분기)', False, 'PCE inflation (Sep) and Q3 GDP advance'),
    ('2026-11-06', '08:30', 'jobs', '고용보고서(10월분)', False, 'Jobs report (Oct)'),
    ('2026-11-10', '08:30', 'cpi',  'CPI 소비자물가(10월분)', False, 'CPI (Oct)'),
    ('2026-11-13', '08:30', 'ppi',  'PPI 생산자물가(10월분)', False, 'PPI (Oct)'),
    ('2026-11-25', '08:30', 'pce',  'PCE 개인소비지출(10월분)', False, 'PCE inflation (Oct)'),
    ('2026-12-04', '08:30', 'jobs', '고용보고서(11월분)', False, 'Jobs report (Nov)'),
    ('2026-12-09', '14:00', 'fomc', 'FOMC 금리 결정', False, 'FOMC rate decision'),
    ('2026-12-10', '08:30', 'cpi',  'CPI 소비자물가(11월분)', False, 'CPI (Nov)'),
    ('2026-12-15', '08:30', 'ppi',  'PPI 생산자물가(11월분)', False, 'PPI (Nov)'),
    ('2026-12-23', '08:30', 'pce',  'PCE 개인소비지출(11월분)', False, 'PCE inflation (Nov)'),
]

_KST_TZ = timezone(timedelta(hours=9))

# ─── 70항 — 예정 이벤트는 뉴욕(ET) 날짜·시각까지 적는다 (2026-08-26, 성동님 지시) ──
# 지시 원문: "'잭슨홀 미팅 및 Fed 의장 연설 대기' 이런 것은 일정(날짜)를 명시해주면
# 좋겠다. 미국 주식이니 전 세계인들이 보는 것이니 뉴욕 시간 기준으로."
# 기준시는 ET 하나로 통일한다 — 6개 언어판이 같은 카드를 번역해 쓰는데 각자 자국 시간을
# 쓰면 같은 이벤트가 언어마다 다른 날짜로 보인다. 미국장 이벤트의 공용 시계는 뉴욕이다.
_ET_WD_KO = ['월', '화', '수', '목', '금', '토', '일']

def et_stamp(dt_utc, approx=False):
    """'8월 28일(금) 10:00 ET' — 한국어 카드용.
    approx=True → '약 10:00 ET'(공식 시각 미공표)
    approx='close' → '장 마감 후 ET'(실적은 날짜만 공표되고 시각은 관례다)"""
    if ET_TZ is None:
        return ''
    e = dt_utc.astimezone(ET_TZ)
    head = f"{e.month}월 {e.day}일({_ET_WD_KO[e.weekday()]})"
    if approx == 'close':
        return f"{head} 장 마감 후 ET"
    return f"{head} {'약 ' if approx else ''}{e.hour:02d}:{e.minute:02d} ET"

def et_stamp_en(dt_utc, approx=False):
    """'Aug 28 (Fri) 10:00 ET' — 영문 병기 필드용."""
    if ET_TZ is None:
        return ''
    e = dt_utc.astimezone(ET_TZ)
    head = f"{e:%b} {e.day} ({e:%a})"
    if approx == 'close':
        return f"{head} after the close ET"
    return f"{head} {'approx. ' if approx else ''}{e.hour:02d}:{e.minute:02d} ET"

def event_calendar_lines(now_utc=None, days=7):
    """향후 N일 예정 이벤트를 ET 표기로. 카드 프롬프트·보고서 프롬프트 공용.
    KST는 일부러 넣지 않는다 — 프롬프트에 두 시계를 주면 생성문이 섞인다."""
    now = now_utc or datetime.now(timezone.utc)
    lines = []
    for dt, _key, name, approx, _en in _econ_events(now):
        h = (dt - now).total_seconds() / 3600.0
        if h <= 24 * days:
            lines.append(f"- {name}: {et_stamp(dt, approx)} (약 {h:.0f}시간 뒤)")
    for g, dt in sorted(fetch_bellwether_earnings().items(), key=lambda x: x[1]):
        h = (dt - now).total_seconds() / 3600.0
        if 0 < h <= 24 * days:
            tk = _BELLWETHER_TICKERS.get(g, g)
            lines.append(f"- {tk} 실적 발표: {et_stamp(dt, 'close')} (약 {h:.0f}시간 뒤)")
    return lines

def _econ_events(now_utc=None):
    """일정표에서 아직 안 지난 이벤트를 (UTC datetime, 종류, 이름)으로. ET→UTC는
    zoneinfo로 서머타임까지 반영. 표가 소진되면 빈 목록 + 경고."""
    if ET_TZ is None:
        return []
    now = now_utc or datetime.now(timezone.utc)
    out = []
    for d, t, key, name, approx, name_en in _ECON_CALENDAR:
        dt = (datetime.strptime(d + ' ' + t, '%Y-%m-%d %H:%M')
              .replace(tzinfo=ET_TZ).astimezone(timezone.utc))
        if dt > now:
            out.append((dt, key, name, approx, name_en))
    if not out:
        print("::warning::[69항] 경제 일정표 소진 — 2027년 일정을 추가할 것(BLS/BEA/Fed)")
    return out

def _next_event_hours(key, now_utc=None):
    """해당 종류의 다음 이벤트까지 남은 시간(시간 단위). 표에 없으면 None."""
    now = now_utc or datetime.now(timezone.utc)
    for dt, k, _n, _a, _e in _econ_events(now):
        if k == key:
            return (dt - now).total_seconds() / 3600.0
    return None

# 벨웨더 실적 발표일 — yfinance 캘린더, 실행당 1회 조회. 실패는 조용히 건너뛴다
# (조회 불가 ≠ 위반). 시각은 안 주므로 '현지 마감 후'(ET 16:30)로 가정해 계산한다.
_BELLWETHER_TICKERS = {'nvidia': 'NVDA', 'apple': 'AAPL', 'microsoft': 'MSFT',
                       'google': 'GOOGL', 'amazon': 'AMZN', 'meta': 'META',
                       'tesla': 'TSLA', 'broadcom': 'AVGO'}
_EARN_CACHE = {}

def fetch_bellwether_earnings():
    """{기업 그룹: 다음 실적 발표 UTC datetime}. 캐시됨."""
    if _EARN_CACHE.get('done'):
        return _EARN_CACHE.get('map', {})
    m = {}
    if ET_TZ is not None:
        for g, tk in _BELLWETHER_TICKERS.items():
            try:
                cal = yf.Ticker(tk).calendar or {}
                dates = cal.get('Earnings Date') or []
                if dates:
                    d0 = dates[0]   # datetime.date
                    m[g] = (datetime(d0.year, d0.month, d0.day, 16, 30, tzinfo=ET_TZ)
                            .astimezone(timezone.utc))
            except Exception:
                pass
    _EARN_CACHE['done'] = True
    _EARN_CACHE['map'] = m
    return m

_EVT_MENTION = {
    'cpi':  re.compile(r'(?<![a-z])cpi(?![a-z])|소비자\s*물가'),
    'ppi':  re.compile(r'(?<![a-z])ppi(?![a-z])|생산자\s*물가'),
    'pce':  re.compile(r'(?<![a-z])pce(?![a-z])|개인\s*소비\s*지출'),
    'jobs': re.compile(r'고용\s*보고서|비농업|(?<![a-z])nfp(?![a-z])|고용\s*지표'),
    'fomc': re.compile(r'(?<![a-z])fomc(?![a-z])|연방공개시장|금리\s*결정'),
    # 70항 — 잭슨홀은 매년 8월 말 사흘, 의장 기조연설이 그해 최대 통화정책 이벤트다.
    'jackson': re.compile(r'잭슨\s*홀|jackson\s*hole'),
}

# 70항 집행 — 예정 이벤트를 다루면서 날짜가 없는 재료에 ET 표기를 붙인다.
# 이미 날짜가 있으면 건드리지 않는다(모델이 제대로 썼으면 그대로 둔다).
_DATE_TOKEN = re.compile(r'\d{1,2}\s*월\s*\d{1,2}\s*일|(?<![A-Za-z])ET(?![A-Za-z])|\d{1,2}/\d{1,2}')
_FUTURE_FRAME = re.compile(r'대기|예정|앞두|앞둔|임박')   # 70항: 확실히 '아직 안 온 일'만

def _past_events(now_utc, hours=72):
    """최근 N시간 안에 이미 지나간 일정 — '대기/예정' 오표기를 잡는 데 쓴다."""
    if ET_TZ is None:
        return {}
    out = {}
    for d, t, key, name, approx, _en in _ECON_CALENDAR:
        dt = (datetime.strptime(d + ' ' + t, '%Y-%m-%d %H:%M')
              .replace(tzinfo=ET_TZ).astimezone(timezone.utc))
        age = (now_utc - dt).total_seconds() / 3600.0
        if 0 < age <= hours:
            out[key] = (dt, name)
    return out

# '인플레이션 지표'처럼 뭉뚱그린 표현 — CPI·PPI·PCE 중 가장 가까운 것을 가리킨다.
_INFLATION_GENERIC = re.compile(r'인플레이션\s*(?:지표|데이터|수치|발표)|물가\s*지표'
                                r'|inflation\s+(?:data|print|report|gauge)')

def _short_name(name):
    """달력 이름에서 라벨만 — 'PCE 개인소비지출(7월분)·GDP 2차 잠정치' → 'PCE 개인소비지출'."""
    return re.split(r'[(\u2014—]', name)[0].strip(' -·')

def _event_hits(text, ev, earns):
    """텍스트가 가리키는 예정 이벤트를 가까운 순으로. 각 원소 (UTC dt, 이름, 시각모드).

    여러 개가 걸리면 가까운 순으로 준다 — 카드의 시야는 향후 12시간이라, 독자가 먼저
    만나는 촉매가 우선이다. ('엔비디아 실적 및 잭슨홀 대기'에 사흘 뒤 잭슨홀만 적으면
    몇 시간 뒤 실적을 앞둔 독자에게는 틀린 안내다.)"""
    low = text.lower()
    cands = []
    for key, rx in _EVT_MENTION.items():
        if rx.search(low) and key in ev:
            cands.append(ev[key])
    if _INFLATION_GENERIC.search(low):
        for key in ('cpi', 'ppi', 'pce'):
            if key in ev and ev[key] not in cands:
                cands.append(ev[key])
    if '실적' in text or 'earnings' in low:
        for g in _rpt_groups_in(low):
            if g in earns:
                tk = _BELLWETHER_TICKERS.get(g, g)
                cands.append((earns[g], f"{tk} 실적", 'close', f"{tk} earnings"))
    return sorted(cands, key=lambda c: c[0])

def annotate_event_dates(entry, now_utc=None):
    """예정 이벤트를 다루는 재료의 설명 끝에 뉴욕(ET) 날짜·시각을 붙인다.
    붙인 목록을 돌려준다 — 호출부가 로그를 찍는다."""
    now = now_utc or datetime.now(timezone.utc)
    ev = {}
    for dt, key, name, approx, name_en in _econ_events(now):
        ev.setdefault(key, (dt, name, approx, name_en))   # 같은 종류면 가장 가까운 것
    earns = fetch_bellwether_earnings()
    stamped = []

    def _do(item, ko_pair, en_pair, max_events=2):
        ko_name, ko_body = ko_pair
        text = f"{item.get(ko_name) or ''} {item.get(ko_body) or ''}"
        if not _FUTURE_FRAME.search(text) or _DATE_TOKEN.search(text):
            return
        hits = _event_hits(text, ev, earns)[:max_events]   # 셋이면 문장이 무너진다
        if not hits:
            return
        # 하나면 날짜만(재료 이름이 이미 무엇인지 말해 준다), 둘이면 각각 이름을 붙인다
        if len(hits) == 1:
            dt, name, mode, _en = hits[0]
            ko_tail, en_tail = et_stamp(dt, mode), et_stamp_en(dt, mode)
        else:
            ko_tail = ', '.join(f"{_short_name(n)} {et_stamp(d, m)}" for d, n, m, _e in hits)
            en_tail = ', '.join(f"{_short_name(e)} {et_stamp_en(d, m)}" for d, _n, m, e in hits)
        body = (item.get(ko_body) or '').rstrip()
        item[ko_body] = (body.rstrip('.') + f" ({ko_tail})").strip()
        en_name, en_body = en_pair
        if item.get(en_body):
            item[en_body] = item[en_body].rstrip().rstrip('.') + f" ({en_tail})"
        stamped.append((item.get(ko_name) or hits[0][1], ko_tail))

    for k in ('positive_factors', 'negative_factors', 'mixed_factors'):
        for f in (entry.get(k) or []):
            _do(f, ('name', 'desc'), ('name_en', 'desc_en'))
    kev = entry.get('key_event')
    if isinstance(kev, dict):
        # 핵심 이슈 줄은 카드 맨 위 한 줄이라 자리가 좁다 — 가장 가까운 하나만.
        _do(kev, ('name', 'why'), ('name_en', 'why_en'), max_events=1)
    return stamped

def stale_event_offenders(entry, now_utc=None):
    """이미 지난 일정을 '대기·예정·앞두고'로 쓴 재료. 재판정 사유 문자열 목록."""
    now = now_utc or datetime.now(timezone.utc)
    past = _past_events(now)
    if not past:
        return []
    upcoming = {}
    for dt, key, _n, _a, _e in _econ_events(now):
        upcoming.setdefault(key, dt)
    _WAIT = re.compile(r'대기|예정|앞두|임박')
    out = []
    for k in ('positive_factors', 'negative_factors', 'mixed_factors'):
        for f in (entry.get(k) or []):
            text = f"{f.get('name') or ''} {f.get('desc') or ''}"
            if not _WAIT.search(text):
                continue
            low = text.lower()
            for key, rx in _EVT_MENTION.items():
                if not rx.search(low) or key not in past:
                    continue
                nxt = upcoming.get(key)
                # 다음 회차가 2주 밖이면 '대기'는 지난 일정을 가리키는 것이다
                if nxt is None or (nxt - now).total_seconds() / 3600.0 > 24 * 14:
                    out.append(f"지난 일정을 대기로 서술: '{f.get('name','')}' — "
                               f"{past[key][1]}은(는) {et_stamp(past[key][0])}에 이미 끝났다. "
                               f"결과를 평가하거나 재료에서 빼라")
                break
    return out
_SCHED_FRAME = re.compile(r'발표|예정|임박|앞두|대기')
_IMMINENT_CLAIM = re.compile(r'12\s*시간|임박|오늘\s*밤?|내일')

def report_schedule_scrub(rep, now_utc=None):
    """watch 블릿의 일정 주장 검증. 규칙 —
    · 예정 이벤트(지표·실적 발표)를 체크포인트로 쓰려면 48시간 이내여야 한다.
      그보다 멀거나 일정표에 없는 '다음 발표'는 12시간 체크포인트가 아니다.
    · 12~48시간 뒤 이벤트는 되지만(포지셔닝은 12시간 재료다), '12시간 내·임박'
      이라고 단정하면 거짓이므로 걷어낸다.
    걷어낸 (사유, 블릿) 목록을 돌려준다."""
    now = now_utc or datetime.now(timezone.utc)
    earns = fetch_bellwether_earnings()
    dropped, kept = [], []
    for line in (rep.get('watch') or '').split('\n'):
        low = line.lower()
        bad = None
        if line.strip() and _SCHED_FRAME.search(line):
            hours = None
            what = None
            for key, rx in _EVT_MENTION.items():
                if rx.search(low):
                    what, hours = key, _next_event_hours(key, now)
                    break
            if what is None and '실적' in line:
                for g in _rpt_groups_in(low):
                    if g in earns:
                        what = f'{g} 실적'
                        hours = (earns[g] - now).total_seconds() / 3600.0
                        break
            # hours가 None이면(일정표 소진·조회 실패) 검증 불가 — 오판으로 지우는 것보다
            # 통과가 낫다. 확인된 날짜가 있을 때만 집행한다.
            if what is not None and hours is not None:
                if hours > 48:
                    bad = f"'{what}' 다음 일정은 {hours/24:.0f}일 뒤 — 12시간 체크포인트 아님"
                elif hours > 12 and _IMMINENT_CLAIM.search(line):
                    bad = f"'{what}'는 {hours:.0f}시간 뒤인데 임박했다고 주장"
        if bad:
            dropped.append((bad, line.strip()))
        else:
            kept.append(line)
    rep['watch'] = '\n'.join(kept).strip()
    return dropped


def desk_deep_report(entry, headlines, rss_headlines, av_items, fred_rows, snap):
    """확정된 카드를 A4 한 장 분량으로 풀어 쓴 보고서. entry['report'] 에 저장."""
    factors = []
    for side, ko in (('positive_factors', '긍정'), ('negative_factors', '부정'),
                     ('mixed_factors', '혼조')):
        for f in entry.get(side) or []:
            sc = f.get('score')
            factors.append(f"[{ko}{f' {sc}점' if sc else ''}] {f.get('name')}: {f.get('desc')}")
    news = '\n'.join(f'- {h}' for h in (list(headlines or []) + list(rss_headlines or []))[:24])
    av = '\n'.join(f'- {h}' for h in (av_items or [])[:12])
    fred = '\n'.join(f'- {r}' for r in (fred_rows or []))
    # 69항 — 향후 7일 내 공식 예정 이벤트를 실제 일정과 함께 준다. 모델이 '다음 발표'를
    # 임박한 것처럼 지어내는 병의 처방은 진짜 달력을 손에 쥐여 주는 것이다.
    _now_u = datetime.now(timezone.utc)
    events = '\n'.join(event_calendar_lines(_now_u))    # 70항 — 기준시를 ET로 통일
    now_kst_str = (f"{_now_u.astimezone(_KST_TZ):%Y-%m-%d %H:%M} KST"
                   + (f" = 뉴욕 {_now_u.astimezone(ET_TZ):%m-%d %H:%M} ET" if ET_TZ else ""))
    prompt = f"""당신은 미국 주식 시황 데스크다. 아래 '확정 카드'는 이미 게시된 판정이다.
이 카드를 처음 보고 "무슨 말인지 잘 모르겠다" 싶은 독자를 위해, 전후 사정을 풀어 쓴
심층 보고서를 쓴다. 카드의 판정·점수를 바꾸거나 새 판정을 만들지 마라 — 설명만 한다.

[확정 카드]
- 총점: 긍정 {entry.get('positive_total')} 대 부정 {entry.get('negative_total')}
- 요약: {entry.get('summary')}
- 핵심 이슈: {(entry.get('key_event') or {}).get('name')} — {(entry.get('key_event') or {}).get('why')}
- 재료:
{chr(10).join(factors)}

[근거로 쓸 수 있는 뉴스 헤드라인]
{news or '- 없음'}

[전문 금융뉴스]
{av or '- 없음'}

[공식 발표 매크로 수치 — 대괄호 속 날짜는 '데이터가 가리키는 달'이지 발표일이 아니다]
{fred or '- 없음'}

[예정 이벤트 — 공식 일정표(BLS·BEA·Fed) 기준. 여기 없는 일정을 지어내지 마라]
현재 시각: {now_kst_str}
{events or '- 향후 7일 내 주요 예정 이벤트 없음'}

[쓰는 법 — 전부 필수]
- 다섯 부분으로 쓴다: overview(현재 판 정리), positive(호재), negative(악재),
  mixed(혼조 재료가 왜 양면인지), watch(향후 12시간 무엇이 확인되면 판이 어느 쪽으로
  기우는지 2~3개). 혼조 재료가 없으면 mixed는 빈 문자열.
- **형식: 전 섹션 닷블릿.** 각 줄은 "- "로 시작한다. 문단·서술형 줄글 금지.
  줄과 줄 사이는 개행(\n) 하나.
- **각 블릿은 "핵심어: 내용" 꼴.** 콜론 앞은 그 항목의 주제(재료명·지표명·이벤트명),
  콜론 뒤는 전후 사정과 근거. 예 — "- 이란 제재: 미국이 이란 석유 구매국 제재를 예고.
  중동 공급 차질 우려로 브렌트유 91달러까지 상승. 인플레이션 재점화 경로로 증시 압박".
- **문장은 명사형으로 끝낸다.** "~했습니다/~입니다" 금지. "~상승", "~예고", "~잔존"처럼
  서술어 없이 끝맺는다. 단, 의미가 흐려질 만큼 줄이지 마라 — 블릿 하나에 수치·주체·
  인과를 담아 두세 단문 분량으로 디테일하게. 짧아서 해석이 필요한 글은 실패다.
- overview는 블릿 3~4개: 오늘 판의 결론 → 그 판을 만든 원인 한두 개 → 하단을 받치는 것.
- 총 분량 1,000~1,600자(한글 기준). A4 한 장 이내.
- 근거에는 이름을 붙인다. 기관·인물·지표명·수치를 명시한다. '일부 전문가' 금지.
- 원인을 쓴다. '반도체 약세' 같은 결과 묘사를 근거로 쓰지 마라.
- **호재/악재/혼조 블릿의 주제는 확정 카드의 재료만.** 보고서는 카드의 해설이지
  두 번째 판정이 아니다. 뉴스 블록은 카드 재료의 전후 사정을 채우는 용도일 뿐,
  거기서 새 재료를 끌어와 블릿으로 얹지 마라. 특히 개별 기업의 제품 가격·리콜·
  소송 같은 단일 기업 이슈는 카드에 없으면 절대 금지 — 카드를 만들 때 이미
  '시장을 움직일 재료가 아니다'로 판정된 것이다.
- 시장 재료를 설명하는 **근거로** 개별 기업 등락을 인용하는 것은 된다.
  예 — 반도체 섹터 강세의 근거로 "NVDA +2.2%, SOXX +1.5%".
- watch에는 카드 밖이라도 시장 전체를 움직일 예정 이벤트(벨웨더 실적 발표·주요
  지표 발표·연준 일정)는 쓸 수 있다. 단일 기업의 소소한 뉴스는 여기도 금지.
- **예정 이벤트에는 뉴욕 시간(ET) 날짜·시각을 반드시 붙인다.** 위 [예정 이벤트]의 표기를
  그대로 옮겨라 — 예: "잭슨홀 Fed 의장 기조연설(8월 28일(금) 약 10:00 ET)". 한국 시간 등
  다른 기준시로 바꾸지 마라 — 전 세계 독자가 같은 카드를 본다.
- **watch는 '앞으로 12시간' 안에 확인 가능한 것만.** 예정 이벤트는 위 [예정 이벤트]에
  있는 것만, 그 일시를 붙여서 쓴다. 일정표에 없는 '다음 발표'를 임박한 것처럼 쓰는
  것은 오류다 — 다음 CPI가 몇 주 뒤인데 12시간 체크포인트로 쓰면 안 된다.
- 12~48시간 뒤 이벤트는 그것을 앞둔 포지셔닝이 12시간 안에 판을 움직일 때만,
  실제 일시와 함께 쓴다(예: "NVDA 실적(현지 26일 장 마감 후, 약 28시간 뒤) 앞둔
  포지셔닝"). '12시간 내 예정'이라는 말은 실제로 12시간 안일 때만 쓴다.
- 12시간 내 예정 이벤트가 없으면, 지금 움직이는 실측 지표(국채금리·유가·달러·VIX·
  지수 선물)의 추이 확인을 체크포인트로 쓴다.
- 위 자료에 없는 수치·일정·이벤트를 만들어내지 마라. 모르면 안 쓴다.
- **출처 기사 제목을 나열하지 마라.** "(뉴스: …)", "(출처: …)" 같은 영문 헤드라인
  인용 금지 — 근거는 내용(기관·수치·이벤트)으로 녹여 쓰는 것이지 제목을 붙이는 게 아니다.

[출력 — 이 JSON만]
{{"overview": "…", "positive": "…", "negative": "…", "mixed": "…", "watch": "…"}}"""
    result = call_gemini(prompt)
    if not result:
        return None
    # 실사고(2026-08-26 백필 AttributeError): 전 섹션 닷블릿을 요구하니 모델이 가끔
    # 섹션 값을 문자열이 아니라 블릿 '배열'로 돌려준다. .strip()이 리스트에서 터졌다.
    # 형태가 다르다고 버리지 않는다 — 배열이면 줄바꿈으로 이어 붙여 같은 꼴로 받는다.
    if isinstance(result, list):
        result = result[0] if result and isinstance(result[0], dict) else None
    if not isinstance(result, dict):
        print(f"::warning::[66항] 보고서 응답 형태 이상({type(result).__name__}) — 폐기")
        return None
    rep = {}
    for key, _ in REPORT_SECTIONS:
        v = result.get(key)
        if isinstance(v, list):
            v = '\n'.join(str(x) for x in v if x is not None)
        rep[key] = v.strip() if isinstance(v, str) else ''
    # 출처 기사 제목 제거 — "(뉴스: Exchange-Traded Funds, …)" 같은 헤드라인 나열은
    # 독자에게 소음이다(2026-08-25 성동님 지적). 괄호째 걷어낸다.
    # "(8분 전 뉴스)", "(2.5시간 전 구글뉴스)" 같은 경과 시각 인용도 같은 소음이다.
    _cite = re.compile(r'\s*[\(\[](?:뉴스|출처|기사|참고|News|Source)\s*:[^\)\]]*[\)\]]', re.I)
    _ago = re.compile(r'\s*\([^()]*?(?:분|시간)\s*전[^()]*?\)')
    for k in rep:
        rep[k] = _ago.sub('', _cite.sub('', rep[k])).strip()

    # 68항 — 카드에 없는 개별 기업이 주제인 블릿은 코드가 걷어낸다. 프롬프트 지시만으로는
    # 못 막는다는 걸 이미 배웠다(51항 이래 반복된 교훈). 감지하고도 게시하지 않는다.
    for _k, _off, _line in report_offcard_scrub(rep, entry):
        print(f"::warning::[68항] 카드 밖 기업 블릿 제거({_k}/{','.join(_off)}): {_line[:70]}")
    # 69항 — watch의 일정 주장을 공식 일정표와 대조한다. 프롬프트에 달력을 줬어도
    # 어긴 블릿은 코드가 걷어낸다. 감지하고도 게시하지 않는다.
    for _why, _line in report_schedule_scrub(rep):
        print(f"::warning::[69항] 일정 오류 블릿 제거({_why}): {_line[:70]}")
    if not rep.get('positive') or not rep.get('negative'):
        print("::warning::[68항] 걷어내고 나니 호재/악재 한쪽이 비었다 — 보고서 폐기(백필이 재작성)")
        return None

    body = ''.join(rep.values())
    if len(body) < 400:
        print(f"::warning::[66항] 보고서 분량 미달({len(body)}자) — 폐기")
        return None
    if len(body) > 2600:
        print(f"::warning::[66항] 보고서 과다({len(body)}자) — 폐기")
        return None

    # 표현 규칙은 보고서에도 적용된다 — 주말 '휴장'(58항)·금리 수치 표기(60항)
    holder = {'positive_factors': [],
              'negative_factors': [],
              'mixed_factors': [{'name': k, 'desc': rep[k]} for k in rep],
              'key_event': {}}
    scrub_weekend_closure_word(holder, get_us_session()[0])
    fix_yield_number(holder, snap)
    for f in holder['mixed_factors']:
        rep[f['name']] = f['desc']
    return rep


# ─── 메인 ────────────────────────────────────────────────────────────────────

# ─── 극단 판정 가드레일 (2026-08-11 신설, CLAUDE.md 51항) ─────────────────────
# 배경: 지수가 사상 최고치 부근 보합(SPY −0.03%)이고 VIX 15.4인 날, 긍정 20:부정 80
# 판정이 다섯 번 연속 유지된 사고. 근거 문구('에너지 가격 급등')는 실측(WTI +0.1%)과
# 어긋났고, 직전 판단(65:35)에서 새 충격 없이 20시간 만에 45점이 움직였다. 프롬프트
# 지시만으로는 재발을 못 막아, 수집해 둔 실측 데이터와 대조하는 코드 안전장치를 둔다.
# 구성: G1 사실 대조(강한 표현 vs 실제 등락률) · G2 점수 변화 상한(새 충격 없이 ±30)
# · G3 극단값 앵커(평온한 시장에서 부정 66+ 금지, 공황 시장에서 긍정 66+ 금지).
# 1차는 위반 사유를 프롬프트에 붙여 재판정(모순 재시도와 같은 경로), 그래도 남으면
# 점수는 코드로 클램프하고(_redistribute 로 소계=항목합 유지) 문구는 강한 단어만 완화.

_GR_PCT_RE = re.compile(r'\(([+\-−]?\d+(?:\.\d+)?)%\)')
_GR_LEVEL_RE = re.compile(r':\s*\$?([\d,]+(?:\.\d+)?)')

def _gr_row(rows, prefix):
    for r in rows or []:
        if r.startswith(prefix):
            return r
    return None

def _gr_pct(rows, prefix):
    r = _gr_row(rows, prefix)
    if not r:
        return None
    m = _GR_PCT_RE.search(r)
    return float(m.group(1).replace('−', '-')) if m else None

def _gr_level(rows, prefix):
    r = _gr_row(rows, prefix)
    if not r:
        return None
    m = _GR_LEVEL_RE.search(r)
    return float(m.group(1).replace(',', '')) if m else None

def market_snapshot(equity_rows, macro_rows):
    """프롬프트에 이미 넣는 수집 문자열에서 가드레일용 실측치를 다시 꺼낸다.
    파싱 실패 항목은 None — 해당 검사만 조용히 건너뛴다(검사 불가 ≠ 위반)."""
    return {
        'qqq_pct': _gr_pct(equity_rows, 'QQQ:'),
        'spy_pct': _gr_pct(equity_rows, 'SPY:'),
        # 62항 — 섹터 학살은 지수에 안 보인다. 2026-08-19 장중 QQQ -1.59%인 날
        # SOXX 는 -6.03%였다(MU -7.5%, SK하이닉스 -8.7%). 지수만 보면 '조용한 날'이다.
        'soxx_pct': _gr_pct(equity_rows, 'SOXX:'),
        'vix': _gr_level(macro_rows, 'VIX 공포지수:'),
        'vix_pct': _gr_pct(macro_rows, 'VIX 공포지수:'),
        'oil_pct': _gr_pct(macro_rows, 'WTI 원유(USD):'),
        # G6(미세 변동) 판정에 쓴다 — 금리·달러도 실측 상대변동을 봐야 한다.
        'yield_pct': _gr_pct(macro_rows, '미10년 국채금리(%):'),
        'dxy_pct': _gr_pct(macro_rows, '달러인덱스 DXY:'),
        # 60항 — 금리는 '수준(4.70%)'과 '변화(+1.19%)'가 둘 다 %라서, 하나만 적으면
        # 반드시 오독된다. 실사고: "국채금리 1.19% 상승"이 금리가 1.19%인 것처럼 읽혔다.
        'yield_level': _gr_level(macro_rows, '미10년 국채금리(%):'),
        # 62항 — 장기물. 정책금리 기대와 시장금리가 따로 노는지 보는 눈이다.
        'yield30_pct': _gr_pct(macro_rows, '미30년 국채금리(%):'),
        'yield30_level': _gr_level(macro_rows, '미30년 국채금리(%):'),
    }

def fetch_spy_off_high():
    """SPY 종가가 52주 고점에서 몇 % 아래인지. 실패 시 None(검사 생략)."""
    try:
        h = yf.Ticker('SPY').history(period='1y', interval='1d', auto_adjust=False)
        if h.empty:
            return None
        return round(float((h['High'].max() - h['Close'].iloc[-1]) / h['High'].max() * 100), 2)
    except Exception:
        return None

def _gr_entry_texts(entry):
    parts = []
    for k in ('positive_factors', 'negative_factors', 'mixed_factors'):
        for f in entry.get(k) or []:
            parts.append((f, (f.get('name', '') + ' ' + f.get('desc', ''))))
    return parts, entry.get('summary', '')

# (주제 정규식, 강한 표현 정규식, 스냅샷 키, 요구 조건, 설명) — 조건 미충족이면 위반
_GR_CLAIMS = [
    (r'유가|원유|에너지', r'급등|폭등', 'oil_pct', lambda v: v >= 1.5, '유가 급등 주장'),
    (r'유가|원유|에너지', r'급락|폭락', 'oil_pct', lambda v: v <= -1.5, '유가 급락 주장'),
    (r'기술주|나스닥', r'급락|폭락|하락\s*(?:압력|세)?\s*심화|하방\s*압력\s*심화', 'qqq_pct',
     lambda v: v <= -1.0, '기술주 급락·심화 주장'),
    (r'VIX|공포\s*지수', r'급등|폭등', 'vix_pct', lambda v: v >= 10.0, 'VIX 급등 주장'),
]

_GR_SUBJECTS_ALL = (r'유가|원유|에너지|기술주|나스닥|반도체|VIX|공포\s*지수|금리|달러|지수'
                    r'|성장주|위험자산|안전자산|관련주|소비주|채권|주식|증시')

def _gr_claim_hit(text, subj_re, claim_re, deny_after=None):
    """주어와 강한 표현이 '가까이 붙어 있고, 사이에 다른 주어가 없을 때만' 그 주어의
    주장으로 인정한다. '유가 급등과 기술주 급락'에서 '급락'을 유가 주장으로 오인하는
    것 방지 — 주어 뒤 14자 이내에 표현이 오되, 그 사이에 기술주 같은 다른 주어가
    끼어 있으면 그 표현은 그쪽 주어의 것이다.

    deny_after: 표현 바로 뒤(8자 이내)에 이 패턴이 오면 그 매치는 무시한다.
    "국채금리 상승에도 실적 기대가 우위"처럼 양보 구문으로 받은 방향어는 그 재료의
    주장이 아니라 반대 사실의 인정이다 (2026-08-14 감사 지적).
    """
    for m in re.finditer(r'(?:' + subj_re + r')([^.,·]{0,14}?)(?:' + claim_re + r')', text, re.I):
        gap = m.group(1)
        others = [w for w in re.findall(_GR_SUBJECTS_ALL, gap, re.I)
                  if not re.fullmatch(subj_re, w, re.I)]
        if others:
            continue
        if deny_after and re.match(r'.{0,8}?(?:' + deny_after + r')', text[m.end():], re.S):
            continue
        return True
    return False

def _gr_shock(snap):
    """점수가 크게 뛰어도 되는 '새 충격'이 실제로 있었는가 — 실측 기준.

    2026-08-19 보강(62항): 지수 셋(QQQ·SPY·VIX)만 보고 있었다. 그날 장중 QQQ 는
    -1.59%로 문턱(2.0%) 아래였는데 SOXX 는 -6.03%, MU -7.5%, SK하이닉스 -8.7%였다.
    카드는 부정을 35 → 70 으로 올리려 했고 G2 변화 상한이 '새 충격 없음'이라며
    막았다 — 반도체가 무너지는 화면을 보면서 카드는 긍정 65 : 부정 35 를 유지했다.
    **섹터 학살은 지수에 안 보인다.** SOXX 를 충격 판정에 넣는다. 문턱 4.0%는 QQQ
    2.0%를 SOXX 의 변동성(대략 두 배)으로 환산한 값이다."""
    q, s = snap.get('qqq_pct'), snap.get('spy_pct')
    v, vc = snap.get('vix'), snap.get('vix_pct')
    x = snap.get('soxx_pct')
    return ((q is not None and abs(q) >= 2.0) or (s is not None and abs(s) >= 1.5)
            or (x is not None and abs(x) >= 4.0)
            or (v is not None and v >= 25.0) or (vc is not None and abs(vc) >= 20.0))

def _gr_calm(snap, spy_off_high):
    """평온한 시장: VIX 18 미만 + 지수 고점 3% 이내 + 당일 급락 없음."""
    v, q = snap.get('vix'), snap.get('qqq_pct')
    if v is None or v >= 18.0:
        return False
    if spy_off_high is not None and spy_off_high > 3.0:
        return False
    return q is None or q > -1.5

def _gr_panic(snap, spy_off_high):
    v = snap.get('vix')
    return (v is not None and v >= 30.0) or (spy_off_high is not None and spy_off_high >= 15.0)

# ─── 방향·서사 검사 (2026-08-14 신설, CLAUDE.md 52항) ────────────────────────
# 배경: 8/13 23:20 카드가 "인플레이션 둔화 기대(예상치 하회 PPI)"를 긍정 40점으로
# 올려놓고, 그 PPI가 만든 국채금리 하락(4.69→4.66, 상대 −0.64%)을 "안전자산 선호
# 심리 반영"이라며 부정 25점으로 깎았다. 원인을 +40, 그 결과를 −25로 센 셈이다.
# 그날 나스닥 +0.95%, SOXX +2.05%, VIX 14.7 — 안전자산 선호와는 정반대 국면이었다.
#
# 뼈아픈 지점: 이걸 잡는 검사(validate_content 체크4)는 이미 있었고 실제로 걸렸다.
# 그런데 재판정 후에도 오류가 남으면 "위반이 더 적은 쪽"을 골라 그대로 게시하는
# 구조라, 감지하고도 내보냈다. 8/11 가드레일(G1~G4)에만 집행권을 주고 그보다 먼저
# 있던 방향 검사에는 안 준 설계 누락이다.
#
# 이번에 넣는 것:
#  · 방향 검사 대칭 보강 — 유가 하락을 부정에 넣는 경우가 검사조차 없었다
#    (8/13 21:50 "유가 하락에 따른 경기 둔화 우려" 10점이 무사통과. 3시간 반 전
#     18:20 카드는 같은 유가 하락을 긍정 +5점으로 썼다).
#  · G5 국면 일관성 — 주가가 오르고 VIX가 내린 날에 '안전자산 선호·위험회피' 금지.
#  · G6 미세 변동 — 매크로 지표 상대변동 1% 미만이면 점수를 못 싣는다.
#    (프롬프트에 2026-07-18자로 이미 있던 조항인데 지시만으로 또 뚫렸다.)
#  · 집행권 — 위반 재료는 점수를 잃고 혼조로 내려간다. 같은 편에 다른 재료가 없어
#    한쪽이 통째로 비어버리는 경우엔 카드를 아예 내지 않는다. 코드가 정직하게
#    고칠 수 없는 판정은 게시하지 않는 것이 틀린 카드를 내보내는 것보다 낫다.

# 주제 정규식은 긴 표기를 앞에 둔다 — 'VIX 지수'를 'VIX'로 먼저 끊으면 남은 '지수'가
# _gr_claim_hit 의 '사이에 낀 다른 주어' 필터에 걸려 미탐이 난다(감사 지적 6번).
_SUBJ_RATE = r'국채\s*금리|국채\s*수익률|채권\s*금리|시장\s*금리|10년물|금리'
_SUBJ_VIX = r'VIX\s*지수|공포\s*지수|VIX'
_SUBJ_OIL = r'에너지\s*가격|유가|원유|WTI'

# 양보·부정 구문 뒤에 오는 방향어는 그 재료의 주장이 아니다.
# "국채금리 상승에도 실적 기대가 우위"는 긍정 재료로 정상이다(감사 지적 5번).
_CONCESSIVE = r'에도|에 비해|불구|하지만|그럼에도|무색|상쇄|넘어서|웃돌'

_DIR_RULES = [
    # (주제 정규식, 방향 정규식, 금지된 편, 사유)
    # 방향어에 '인상·인하'를 넣지 않는다 — "금리 인상 압력 완화"(둔화 호재를 서술한
    # 정상 문구)가 '금리 상승'으로 오인되던 자리다. 정책금리 기대는 fed_policy 영역이고
    # 여기서 보는 것은 시장금리의 실제 방향이다.
    (_SUBJ_RATE, r'하락|안정|내림', 'negative_factors',
     '금리 하락은 성장주에 유리 — 부정 요인이 될 수 없다'),
    (_SUBJ_RATE, r'상승|급등|오름', 'positive_factors',
     '금리 상승은 성장주 밸류 압박 — 긍정 요인이 될 수 없다'),
    (_SUBJ_VIX, r'하락|안정|진정|내림', 'negative_factors',
     'VIX 하락은 심리 안정 — 부정 요인이 될 수 없다'),
    (_SUBJ_VIX, r'상승|급등|오름', 'positive_factors',
     'VIX 상승은 공포 확대 — 긍정 요인이 될 수 없다'),
    (_SUBJ_OIL, r'상승|급등|고공|오름', 'positive_factors',
     '유가 상승은 인플레 압력 — 기술주 관점에서 긍정 요인이 될 수 없다'),
    (_SUBJ_OIL, r'하락|급락|안정|내림', 'negative_factors',
     '유가 하락은 인플레 압력 완화 — 기술주 관점에서 부정 요인이 될 수 없다'),
]

# G5 — 국면과 어긋나는 서사. 주가가 오르는 날의 '안전자산 선호'는 정의상 성립하지 않는다
# (안전자산 선호는 주식이 팔리고 채권이 사질 때 쓰는 말이다).
# 단, 그 심리가 '완화·해소'된다는 서술은 리스크온 국면에서 오히려 정상이므로 제외한다.
_RISKOFF_WORDS = r'안전\s*자산\s*(?:선호|수요|쏠림)|위험\s*회피|리스크\s*오프|flight[\s-]*to[\s-]*(?:quality|safety)'
_RISKON_WORDS = r'위험\s*선호|리스크\s*온|안도\s*랠리|위험\s*자산\s*선호'
_TONE_NEGATED = r'완화|해소|축소|후퇴|진정|둔화|감소|약화|위축|제한|소멸|사라'

# G6 — 매크로 지표별 최소 유의미 상대변동(%). 이 아래면 점수를 실을 수 없다.
# 지표마다 평소 변동폭이 다르므로 임계값을 따로 둔다(감사 지적 4번) — VIX 는 하루
# 3~8% 가 예사여서 1% 기준이면 사실상 발동하지 않고, 달러인덱스는 1% 가 연중 몇 번
# 뿐이라 같은 기준이면 dollar_fx 카테고리가 상시 점수 금지가 된다.
_SUBJ_DXY = r'달러\s*인덱스|달러\s*지수|DXY'
# 크기·사실 검사에는 맨 '금리'를 넣지 않는다 — '금리 인하 기대'는 정책금리 얘기(fed_policy)라
# 10년물 실측 변동폭으로 재면 안 된다(감사 2차 지적 3번).
_SUBJ_MKT_RATE = r'국채\s*금리|국채\s*수익률|채권\s*금리|시장\s*금리|10년물'
_MICRO_SUBJECTS = [
    (_SUBJ_MKT_RATE, 'yield_pct', '국채금리', 1.0),
    (_SUBJ_OIL, 'oil_pct', '유가', 1.5),
    (_SUBJ_DXY, 'dxy_pct', '달러인덱스', 0.3),
    (_SUBJ_VIX, 'vix_pct', 'VIX', 5.0),
]

# 방향 서술이 실측과 반대인가. 분류(어느 편에 넣었나)가 아니라 사실 자체를 본다.
# 실사고: 유가가 1.72% 내린 날 부정 재료 설명에 '에너지 가격 상승 압력'.
# G1(_GR_CLAIMS)은 '급등·폭등' 같은 강한 표현만 봐서 밋밋한 '상승'을 놓쳤다.
_FACT_DIRS = [
    (_SUBJ_OIL, 'oil_pct', '유가'),
    (_SUBJ_MKT_RATE, 'yield_pct', '국채금리'),
    (_SUBJ_DXY, 'dxy_pct', '달러인덱스'),
    (_SUBJ_VIX, 'vix_pct', 'VIX'),
]
# '강세·약세'는 넣지 않는다 — 주식을 가리키는 서술어라 'VIX 안정에 위험자산 강세'가
# 'VIX 상승 주장'으로 뒤집힌다(감사 2차 지적 4번).
_UP_WORDS = r'상승|급등|폭등|오름|올라'
_DOWN_WORDS = r'하락|급락|폭락|내림|내려'

# 어느 쪽도 이 값을 넘지 않는다. 90:10 은 판정이 아니라 선언이다 — 위반 재료를 걷어낸
# 뒤 남은 점수를 반대편에 넘길 때 한쪽이 무한정 부풀지 않게 하는 구조적 상한.
_SIDE_MAX = 85


def _tone_word_hit(text, words):
    """국면 서사어가 '완화·해소' 같은 부정어에 걸리지 않은 채로 등장하는가."""
    for m in re.finditer(words, text, re.I):
        tail = text[m.end():m.end() + 12]
        if not re.search(_TONE_NEGATED, tail):
            return True
    return False


def _risk_tone(snap):
    """그날 시장이 리스크온인가 리스크오프인가. 판정 불가면 None(검사 생략)."""
    if not snap:
        return None
    q, v, vc = snap.get('qqq_pct'), snap.get('vix'), snap.get('vix_pct')
    if q is None:
        return None
    # 주가가 뚜렷이 오르고 공포지수가 잠잠하다 → 리스크온.
    # VIX 상승 허용폭을 5%로 좁혔다 — QQQ +0.3%인데 VIX +9%인 날을 리스크온으로
    # 보면 그날 부정 쪽의 정당한 위험회피 서술까지 금지된다(감사 지적 3번).
    if q >= 0.6 and (vc is None or vc <= 5.0) and (v is None or v < 22.0):
        return 'on'
    if q <= -0.3 and (vc is None or vc > -10.0):
        return 'off'
    return None


# ── 익명 근거 금지 (2026-08-14 신설, 운영 제보) ────────────────────────────────
# 증상: 부정 25점 전부를 짊어진 재료가 "시장 경고 신호 / 과거 5번만 나타난 시장 경고
# 신호 발생, 일부 전문가 비관론"이었다. 무슨 신호인지, 누가 한 말인지가 없다.
# 실제 원문은 실러 CAPE(경기조정 주가수익비율) 41배 — 장기 평균 17.8배의 두 배가 넘고,
# 과거 다섯 번은 1929년·1997~2001년·2017~2018년·2019~2020년·2020~2022년이었다.
# 이름만 적었어도 독자가 스스로 판단할 수 있는 재료였는데 '경고 신호'로 뭉갰다.
# 제보 원문: "혹시 Shiller CAPE 비율인가? 그럼 그 정도는 얘기해줘야지."
#
# 규칙: 신호·지표를 근거로 들면 그 이름을, 사람 말을 근거로 들면 그 이름을 밝힌다.
# 둘 다 없으면 점수를 실을 수 없다(혼조로 내려가거나 카드가 안 나간다).
_VAGUE_SIGNAL = (r'경고\s*신호|경고\s*시그널|위험\s*신호|이상\s*신호|경계\s*신호|'
                 r'하락\s*신호|매도\s*신호|시장\s*신호|기술적\s*신호')
_VAGUE_VOICE = (r'일부\s*전문가|전문가들|일각에서|일각의|분석가들|시장\s*일각|월가\s*일부|'
                r'일부\s*투자자|일부\s*기관|비관론자')
# 지표 이름 — 이 중 하나라도 있으면 '무슨 신호인지' 밝힌 것으로 본다
_IND_ANCHOR = (r'CAPE|실러|쉴러|PER|주가수익|PBR|PSR|버핏\s*지[수표]|힌덴부르크|골든\s*크로스|'
               r'데드\s*크로스|장단기\s*금리\s*차|수익률\s*곡선|역전|풋콜|put[/\s]?call|VIX|'
               r'RSI|MACD|이격도|신고가|신저가|AAII|공포\s*탐욕|배당\s*수익률|시가총액\s*대비|'
               r'\d+\s*배|\d+(?:\.\d+)?\s*%|\d+\s*[pP]|\d{2,}\s*(?:포인트|선)')
# 출처 이름 — 라틴 고유명사(3자 이상) 또는 알려진 기관·인물
_SRC_ANCHOR = (r'[A-Z][A-Za-z]{2,}|골드만|모건\s*스탠리|JP\s*모건|씨티|BofA|뱅크오브아메리카|'
               r'UBS|바클레이|번스타인|웰스\s*파고|블랙록|브리지워터|버크셔|'
               r'버핏|버리|달리오|서머스|엘\s*에리언|파월|옐런|연준|Fed|IMF|OECD|'
               r'무디스|S&P|피치|골드만삭스|노무라|미즈호|웨드부시|번지|카이저')


def anonymous_evidence(entry):
    """점수를 실은 재료가 '무슨 신호인지·누구 말인지'를 안 밝혔는가."""
    out = []
    for side in ('positive_factors', 'negative_factors'):
        side_ko = '긍정' if side == 'positive_factors' else '부정'
        for f in entry.get(side) or []:
            if int(f.get('score', 0) or 0) <= 0:
                continue
            name = f.get('name', '') or ''
            text = name + ' ' + (f.get('desc', '') or '')
            why = []
            if re.search(_VAGUE_SIGNAL, text, re.I) and not re.search(_IND_ANCHOR, text, re.I):
                why.append('무슨 신호인지 이름이 없다 — 지표명(예: 실러 CAPE, 힌덴부르크, '
                           '장단기 금리차)이나 그 수치를 밝혀라')
            if re.search(_VAGUE_VOICE, text, re.I) and not re.search(_SRC_ANCHOR, text):
                why.append("'일부 전문가·일각'은 근거가 아니다 — 말한 사람이나 기관 이름을 밝혀라")
            if why:
                out.append((side, f, f"익명 근거: {side_ko} '{name}': " + ' / '.join(why)))
    return out


# ─── 60항: 방향 없는 상태는 재료가 아니다 / 이름이 내용을 배신하지 않는다 ────
# 2026-08-17 실사고. 같은 'Fed 관망'이 한 사이클은 **부정 10점**, 다음 사이클은
# **긍정 25점**으로 나갔다. 새 사실이 생겨서가 아니다 — 관망은 시장이 방향을 못
# 정했다는 뜻이라 애초에 부호가 없고, 부호가 없으니 그때그때 필요한 칸으로 간다.
# 편이 필요할 때마다 부호가 바뀌는 것은 재료가 아니라 채움재다.
_NO_DIR_NAME = (r'관망|눈치\s*보기|지켜보기|대기\s*심리|방향성\s*탐색|숨\s*고르기|'
                r'혼조세?\s*지속|보합')

# 이름이 방향을 주장하고 있는가. '인상·인하'는 뺐다 — '금리 인상 논쟁'처럼 주제어로만
# 쓰이는 경우가 많아, 이걸 방향어로 세면 관망 재료가 이름만 바꿔 빠져나간다.
_DIR_CLAIM_WORD = (r'상승|하락|급등|급락|확대|축소|완화|후퇴|강세|약세|개선|악화|우려|'
                   r'기대|둔화|가속|상향|하향|호조|부진|증가|감소|압력|긴장|호실적|'
                   r'서프라이즈|쇼크|반등|조정')

# ─── 72항 — 아직 안 일어난 일은 방향이 없다 (2026-08-26, 성동님 지적) ────────
# 실사고: 같은 '엔비디아 실적 발표'가 12:50 카드에서 긍정 65점('실적 기대감'),
# 5시간 반 뒤 18:20 카드에서 부정 25점('실적 발표 대기')으로 편을 갈아탔다.
# 그 사이 실적은 나오지도 않았고 새 변수도 없었다. 이름만 '기대감 ↔ 대기'로
# 바꾸면 같은 사실이 양쪽 칸 어디에나 앉을 수 있다는 뜻이다 — 그건 판정이 아니다.
#
# 원리: 예정된 이벤트를 '기다리는 상태' 자체는 오르지도 내리지도 않는다. 60항이
# '관망'을 막았는데 '대기·앞두고'는 그물을 빠져나갔다. 같은 병이다.
# 규칙: 예정 이벤트를 기다린다는 프레임의 재료는 점수 칸에 앉을 수 없다 — 혼조다.
# 방향을 주장하려면 '기다린다'가 아니라 **방향을 만든 사실**을 이름에 적어야 한다
# (예: '엔비디아 컨센서스 상향', '반도체 옵션 내재변동성 급등' 처럼 측정된 사실).
_EVENT_WAIT_FRAME = r'대기|앞두고|앞둔|기다리|예정|임박|경계감|관망'
_EVENT_WAIT_WHAT = (r'발표|실적|어닝|연설|기조|회의|심포지엄|지표|결과|공개|'
                    r'FOMC|CPI|PPI|PCE|GDP|잭슨\s*홀')

def event_wait_offenders(entry):
    """예정 이벤트를 '기다린다'는 프레임으로 점수를 받은 재료. (편, 재료, 사유)"""
    out = []
    for side in ('positive_factors', 'negative_factors'):
        side_ko = '긍정' if side == 'positive_factors' else '부정'
        for f in entry.get(side) or []:
            if int(f.get('score', 0) or 0) <= 0:
                continue
            text = f"{f.get('name', '') or ''} {f.get('desc', '') or ''}"
            if not re.search(_EVENT_WAIT_FRAME, text):
                continue
            if not re.search(_EVENT_WAIT_WHAT, text, re.I):
                continue
            out.append((side, f,
                        f"대기 재료에 점수: {side_ko} '{f.get('name','')}' — 아직 일어나지 "
                        f"않은 이벤트를 '기다린다'는 것은 방향이 아니다. 같은 사실이 "
                        f"'기대감'이면 긍정, '불확실성'이면 부정이 되어 판정이 뒤집힌다. "
                        f"혼조로 옮기거나, 방향을 만든 **측정된 사실**(컨센서스 변화·"
                        f"내재변동성·포지션 지표 등)을 이름에 적고 그것을 재료로 삼아라"))
    return out


def demote_event_waits(entry):
    """집행 — 대기 재료를 혼조로 옮기고 남은 재료에 점수를 재배분한다(총점 불변).
    64항 원칙: 강등의 목적지는 삭제가 아니라 혼조다."""
    moved = []
    flagged = {}
    for side, f, _why in event_wait_offenders(entry):
        flagged.setdefault(side, []).append(f)
    for side, bad in flagged.items():
        factors = entry.get(side) or []
        keep = [f for f in factors if f not in bad]
        if not keep:
            # 그 편이 통째로 대기 재료였다 — 판정을 지탱할 근거가 없다는 뜻이다.
            # 52항 원칙대로 호출부가 이번 사이클 게시를 포기한다(빈 칸을 내보내느니).
            entry['_wait_side_emptied'] = side
        total = int(entry.get(side.replace('_factors', '_total'), 0) or 0)
        if keep:
            entry[side] = _redistribute(keep, total)
        else:
            entry[side] = []
        for f in bad:
            f.pop('score', None)
            # 4-7b(67항)가 혼조에서 개별 기업을 걷어내므로, 벨웨더 실적 대기는
            # 그 예외 범주로 옮겨 적는다. 그 외는 시장 범주로 둔다.
            if re.search(r'실적|어닝|earnings', f"{f.get('name','')} {f.get('desc','')}", re.I):
                f['category'] = 'earnings_bellwether'
            elif (f.get('category') or '') == 'company_specific':
                f['category'] = 'other'
            entry.setdefault('mixed_factors', []).append(f)
            moved.append(f.get('name', ''))
    return moved


def no_direction_offenders(entry):
    """'방향 없음'인데 긍정·부정 칸에서 점수를 받은 재료.
    관망은 배경이지 재료가 아니다 — 필요하면 핵심이슈 문장에서 다룬다.

    두 겹으로 본다. (1) 이름이 대놓고 관망류인 경우. (2) 이름은 '…논쟁 지속'처럼
    중립인데 설명이 관망을 말하는 경우 — 실제로 'Fed 금리 인상 논쟁 지속 / 투자자
    관망세 유지'가 부정 10점을 달고 1차 규칙을 빠져나갔다. 이름만 갈아입으면 통과하는
    규칙은 규칙이 아니다. 다만 이름이 방향을 주장하고 있으면(상승·완화·우려 등)
    관망은 곁들인 배경으로 보고 건드리지 않는다."""
    out = []
    for side in ('positive_factors', 'negative_factors'):
        side_ko = '긍정' if side == 'positive_factors' else '부정'
        for f in entry.get(side) or []:
            if int(f.get('score', 0) or 0) <= 0:
                continue
            name = f.get('name', '') or ''
            desc = f.get('desc', '') or ''
            why = None
            if re.search(_NO_DIR_NAME, name):
                why = ('관망·눈치보기 같은 \'방향 없음\'은 오르지도 내리지도 않는다 — '
                       '점수를 실을 재료가 아니라 배경이다')
            elif re.search(_NO_DIR_NAME, desc) and not re.search(_DIR_CLAIM_WORD, name):
                why = ('이름은 중립인데 설명이 관망을 말한다 — 방향을 주장하지 않는 재료에 '
                       '점수를 실었다. 관망의 이유를 방향까지 써서 이름에 담든가, 혼조로 내려라')
            if why:
                out.append((side, f, f"무방향 재료: {side_ko} '{name}': " + why))
    return out


# 이름과 내용의 방향이 어긋난 재료. 실사고 — 긍정 25점 재료의 이름이
# 'Fed 금리 인상 관망 심리'였다. 내용은 "인상 베팅이 과도했다 → 인상 리스크 완화"라
# 방향 자체는 긍정이 맞는데, 독자는 긍정 칸에서 '금리 인상'이라는 글자를 먼저 읽는다.
# 카드가 한눈에 거짓말을 하는 셈이다. 이름은 내용과 같은 쪽을 가리켜야 한다.
_HAWK_NAME = r'금리\s*인상|긴축|매파'          # 주식에 불리한 쪽
_DOVE_NAME = r'금리\s*인하|완화\s*전환|비둘기'  # 주식에 유리한 쪽
_EASE_TAIL = (r'완화|후퇴|축소|약화|진정|해소|기대\s*감소|가능성\s*축소|'
              r'과도|되돌림|일단락|종료|중단|없|미미')

def name_betrays_content(entry):
    """긍정 칸 이름이 매파 단어로 시작하거나, 부정 칸 이름이 비둘기 단어로 시작하는데
    그 이름 안에 '완화·후퇴' 같은 꼬리가 없는 경우 — 이름만 읽으면 편이 뒤집힌다."""
    out = []
    for side, bad_re, ko in (('positive_factors', _HAWK_NAME, '긍정'),
                             ('negative_factors', _DOVE_NAME, '부정')):
        for f in entry.get(side) or []:
            if int(f.get('score', 0) or 0) <= 0:
                continue
            name = f.get('name', '') or ''
            if re.search(bad_re, name) and not re.search(_EASE_TAIL, name):
                out.append((side, f, f"이름-내용 불일치: {ko} '{name}': 이름이 반대편을 "
                                     f"가리킨다 — 내용이 '기대 후퇴·리스크 완화'라면 이름도 "
                                     f"'{'금리 인상 기대 후퇴' if ko == '긍정' else '금리 인하 기대 후퇴'}'"
                                     f"처럼 끝까지 써라"))
    return out


# 금리 용어 — 정책금리는 '인상·인하', 시장금리는 '상승·하락'이다. 이건 취향이 아니라
# 다른 사건을 가리키는 다른 말이다. 섞어 쓰면 문장이 스스로 모순된다.
# 실사고(2026-08-17): 긍정 재료에 "시장 금리 인상 리스크 완화"라 써놓고, 같은 카드
# 부정 재료는 "미10년 국채금리 상승"이었다. 글자 그대로 읽으면 한 카드가 시장금리가
# 오른다고도 하고 안 오른다고도 한 셈이다.
_RATE_TERM_MISUSE = re.compile(r'(시장\s*금리|국채\s*금리|채권\s*금리|10년물|시중\s*금리)'
                               r'[^.,·]{0,8}?(인상|인하)')

def rate_term_offenders(entry):
    out = []
    for side in ('positive_factors', 'negative_factors'):
        side_ko = '긍정' if side == 'positive_factors' else '부정'
        for f in entry.get(side) or []:
            if int(f.get('score', 0) or 0) <= 0:
                continue
            name = f.get('name', '') or ''
            text = name + ' ' + (f.get('desc', '') or '')
            mm = _RATE_TERM_MISUSE.search(text)
            if mm:
                out.append((side, f, f"금리 용어 오류: {side_ko} '{name}': "
                                     f"'{mm.group(0).strip()}' — 정책금리(Fed)는 인상·인하하고, "
                                     f"시장금리(국채)는 상승·하락한다. 둘을 섞으면 문장이 "
                                     f"스스로 모순된다"))
    return out


# 명사만 이어 붙여 '누가 무엇을'이 사라진 근거 문장. 실사고(2026-08-17):
# "골드만삭스 등 Fed 금리 인상 베팅 과도 평가" — (가) 골드만이 '시장의 인상 베팅이
# 과도하다'고 봤다(긍정) (나) 골드만 등이 인상에 과도하게 베팅한다(부정), 두 뜻이
# 정반대인데 문장은 어느 쪽인지 말하지 않는다. 34항의 명사형 개조식은 분석 본문의
# 문체이지, 방향이 걸린 근거 문장에서 조사를 지워도 된다는 뜻이 아니다.
_COLLAPSED_EVAL = re.compile(r'(?<![을를이가])\s(과도|과소|부정적|긍정적)\s*(평가|반영|해석)')

def collapsed_clause_violation(entry):
    hits = []
    for side in ('positive_factors', 'negative_factors', 'mixed_factors'):
        for f in entry.get(side) or []:
            text = (f.get('name', '') or '') + ' ' + (f.get('desc', '') or '')
            m2 = _COLLAPSED_EVAL.search(text)
            if m2:
                hits.append(f"'{(f.get('name') or '').strip()}'")
    if hits:
        return ("주어·목적어 없는 명사 나열: " + ', '.join(hits) +
                " — '누가 무엇을 어떻게 봤는지'를 조사까지 붙여 써라. "
                "나쁜 예: 'Fed 금리 인상 베팅 과도 평가'(두 뜻으로 읽힌다). "
                "좋은 예: '골드만삭스는 시장의 인상 베팅이 과도하다고 평가'")
    return None


# 정책금리와 시장금리를 이름만 보고 갈라내는 표지.
_POLICY_MARK = r'정책금리|기준금리|Fed|연준|FOMC|금리\s*인상|금리\s*인하|긴축|완화\s*전환'
_MARKET_MARK = r'국채|10년물|시장금리|채권|수익률'

# ─── 62항: 정책금리 기대와 시장금리가 따로 놀 때 ─────────────────────────────
# 2026-08-18 실제 시장. 9월 인상 확률은 7월 말 거의 100%에서 3분의 1로 내려앉았는데,
# 30년물 국채금리는 5.09% → 5.31%(2007년 이후 최고)로 **올랐다.** 같은 날 반도체는
# 무너졌다(SOXX -5.7%, MU -7.5%, SK하이닉스 -8.7%).
#
# 교과서대로면 인상 기대가 후퇴하면 장기금리도 내려야 한다. 반대로 갔다는 건 시장이
# 다른 걸 보고 있다는 뜻이다 — 재정적자·기간 프리미엄·채권 자경단. 이때 '금리 인상
# 기대 후퇴'를 큰 긍정으로 실으면, 카드가 시장과 정반대를 가리킨다. 성장주를 누르는
# 것은 정책금리 기대가 아니라 **할인율로 실제로 쓰이는 장기금리**다.
#
# 그래서 막는 것은 '긍정으로 쓰는 것' 자체가 아니라 **장기금리가 반대로 가는 사실을
# 빼놓고 쓰는 것**이다. 같은 재료 안에 그 사실이 있으면 통과시킨다.
_POLICY_EASE = re.compile(r'(금리\s*인상|긴축|매파)[^.,]{0,12}(후퇴|완화|축소|약화|낮게|'
                          r'과도|기대\s*감소|가능성\s*축소|진정)'
                          r'|(인하|완화)\s*(기대|전환)')
_LONG_RATE_MENTION = re.compile(r'장기\s*금리|30년|시장\s*금리|국채\s*금리|10년물|수익률\s*곡선|'
                                r'기간\s*프리미엄|채권\s*시장')

def policy_vs_market_rate(entry, snap):
    """정책금리 완화 기대를 긍정으로 실었는데 장기 시장금리는 오르고 있는가.

    집행(점수 박탈)은 하지 않는다 — 그 재료가 거짓은 아니기 때문이다. 다만 사실의
    절반만 적은 것이라 재판정을 시킨다. 30년물이 없으면 10년물로 대신 본다."""
    if not snap:
        return None
    pct = snap.get('yield30_pct')
    which, lvl = '30년물', snap.get('yield30_level')
    if pct is None:
        pct, which, lvl = snap.get('yield_pct'), '10년물', snap.get('yield_level')
    if pct is None or pct < 1.0:          # 오차 범위 움직임은 이야기가 아니다
        return None
    for f in entry.get('positive_factors') or []:
        if int(f.get('score', 0) or 0) <= 0:
            continue
        text = (f.get('name', '') or '') + ' ' + (f.get('desc', '') or '')
        if not _POLICY_EASE.search(text):
            continue
        if _LONG_RATE_MENTION.search(text):
            continue                      # 반대 방향 사실을 이미 밝혔다 — 통과
        return (f"정책금리와 시장금리가 따로 논다: 긍정 '{f.get('name')}' 는 인상 기대 "
                f"후퇴를 근거로 드는데, 같은 시각 미{which} 국채금리는 "
                f"{(f'{lvl:.2f}%' if lvl is not None else '')}({pct:+.2f}%) **오르고 있다**. "
                f"성장주 할인율로 실제 쓰이는 건 이쪽이다 — 이 사실을 같은 재료 안에 "
                f"밝히거나(예: '인상 기대는 후퇴했지만 장기금리는 상승'), 점수를 그에 맞게 낮춰라.")
    return None


def rate_on_both_sides(entry):
    """금리가 긍정·부정 양쪽에 올라왔는데 **두 이름이 서로를 구분하지 못하는** 카드.

    정책금리 기대와 시장금리 실측은 다른 것이라 공존 자체는 정상이다 —
    '정책금리 인상 기대 후퇴'(긍정)와 '미10년 국채금리 상승'(부정)은 둘 다 사실일 수
    있고, 이름이 이미 구분하고 있으니 걸지 않는다. 문제는 양쪽 다 그냥 '금리'라고만
    적어 독자가 모순으로 읽는 경우다. 집행하지 않고 재판정 사유로만 쓴다.
    (2026-08-17 첫 판 오탐 정정 — 이름이 이미 구분된 카드까지 잡아 재판정을 낭비했다.)"""
    def hit(side):
        for f in entry.get(side) or []:
            if int(f.get('score', 0) or 0) > 0 and re.search(r'금리|수익률', f.get('name', '') or ''):
                return f.get('name') or ''
        return None
    p, n = hit('positive_factors'), hit('negative_factors')
    if not (p and n):
        return None
    def kind(name):
        pol = bool(re.search(_POLICY_MARK, name, re.I))
        mkt = bool(re.search(_MARKET_MARK, name))
        if pol and not mkt:
            return 'policy'
        if mkt and not pol:
            return 'market'
        return 'vague'
    kp, kn = kind(p), kind(n)
    if kp != 'vague' and kn != 'vague' and kp != kn:
        return None          # 이름이 이미 정책금리 / 시장금리를 갈라놨다 — 정상
    return (f"금리 양쪽 등장: 긍정 '{p}' 와 부정 '{n}' 이 한 화면에 있는데 이름만으로는 "
            f"구분이 안 된다 — 정책금리(Fed)인지 시장금리(국채)인지 이름에 드러내라. "
            f"아니면 하나로 합쳐라")


def direction_offenders(entry, snap=None):
    """방향·국면·크기 규칙을 어긴 '점수를 실은' 재료를 (편, 재료, 사유)로 돌려준다.

    한 재료가 여러 규칙에 걸려도 항목은 하나만 만든다 — 사유는 이어 붙인다.
    이유가 둘 있다: (1) 집행 때 같은 재료가 mixed_factors 에 여러 번 들어가 화면에
    같은 혼조 재료가 반복 노출되던 문제, (2) main() 의 재시도 채택이 위반 '건수'를
    비교하는데 한 재료가 3건으로 세어져 더 나쁜 결과를 고르던 문제. (감사 지적 2·8번)

    혼조(mixed_factors)는 보지 않는다 — 점수를 안 실은 재료는 판정을 왜곡하지 않는다.
    """
    found = []
    tone = _risk_tone(snap)
    for side in ('positive_factors', 'negative_factors'):
        side_ko = '긍정' if side == 'positive_factors' else '부정'
        for f in entry.get(side) or []:
            if int(f.get('score', 0) or 0) <= 0:
                continue
            name = f.get('name', '') or ''
            text = name + ' ' + (f.get('desc', '') or '')
            reasons = []

            # 방향 규칙 — 이름과 설명을 함께 본다. 설명이 인과를 담기 때문이다
            # (실사고: 이름은 '고유가', 설명은 '유가 하락에도…'인 자기모순 카드).
            for subj_re, dir_re, bad_side, why in _DIR_RULES:
                if side == bad_side and _gr_claim_hit(text, subj_re, dir_re,
                                                      deny_after=_CONCESSIVE):
                    reasons.append(f'방향 오류 — {why}')
                    break

            # G5 국면 불일치
            if tone == 'on' and _tone_word_hit(text, _RISKOFF_WORDS):
                vix = snap.get('vix')
                reasons.append(
                    f"국면 불일치 — 주가 상승(QQQ {snap.get('qqq_pct'):+.2f}%)"
                    f"{f'·VIX {vix}' if vix is not None else ''}인 리스크온 국면에서 "
                    f"'안전자산 선호·위험회피' 서술은 성립하지 않는다")
            elif tone == 'off' and _tone_word_hit(text, _RISKON_WORDS):
                reasons.append(
                    f"국면 불일치 — 주가 하락(QQQ {snap.get('qqq_pct'):+.2f}%) 국면에서 "
                    f"'위험선호·안도 랠리' 서술은 성립하지 않는다")

            # 사실 방향 대조 — 서술한 방향이 실측과 반대인가
            if snap:
                for subj_re, key, label in _FACT_DIRS:
                    v = snap.get(key)
                    if v is None:
                        continue
                    up = _gr_claim_hit(text, subj_re, _UP_WORDS, deny_after=_CONCESSIVE)
                    dn = _gr_claim_hit(text, subj_re, _DOWN_WORDS, deny_after=_CONCESSIVE)
                    if up and not dn and v < 0:
                        reasons.append(f'사실 대조 실패 — {label} 상승이라 썼는데 실측 {v:+.2f}%')
                    elif dn and not up and v > 0:
                        reasons.append(f'사실 대조 실패 — {label} 하락이라 썼는데 실측 {v:+.2f}%')

            # G6 미세 변동 — 이름만 본다. 설명까지 보면 '인플레이션 둔화 신호'처럼
            # 다른 재료가 근거로 국채금리를 곁들여 언급한 경우까지 걷어내게 된다.
            # 그 지표가 이 재료의 주인공일 때만(=이름에 있을 때만) 크기를 따진다.
            if snap:
                for subj_re, key, label, floor in _MICRO_SUBJECTS:
                    if not re.search(subj_re, name, re.I):
                        continue
                    # 62항 보강(2026-08-19) — 크기 검사는 '움직였다'고 **주장할 때만** 건다.
                    # 수준을 말하는 재료는 오늘 변화율로 판단할 대상이 아니다.
                    # 실제: 30년물이 5.32%로 2007년 이후 최고인 날, 장중 변화는 -0.2%였다.
                    # "고금리 수준 지속"은 참인데 "오차 범위"라며 걷어내면 그날의 진짜
                    # 이야기가 통째로 사라진다. 안전장치가 사실을 이기면 안 된다.
                    if not re.search(_UP_WORDS + '|' + _DOWN_WORDS, name):
                        break
                    v = snap.get(key)
                    if v is None:
                        continue   # 이 지표는 측정 불가 — 이름에 있는 다른 지표를 계속 본다
                    if abs(v) < floor:
                        reasons.append(
                            f'미세 변동 재료화 — {label} 실측 {v:+.2f}%는 오차 범위'
                            f'(상대 {floor}% 미만). 방향이 맞아도 점수를 실을 크기가 아니다. '
                            f'단, 재료를 지우지 말고 혼조로 옮겨 배경(수준·국면)을 설명하라 — '
                            f'큰 축을 카드에서 빼면 독자는 그 축이 사라졌다고 오해한다')
                    break

            if reasons:
                found.append((side, f, f"{side_ko} '{name}': " + ' / '.join(reasons)))
    # 익명 근거도 같은 집행 경로를 탄다 — 점수를 잃고 혼조로 내려간다
    found.extend(anonymous_evidence(entry))
    # 60항 — 무방향 재료와 이름-내용 불일치도 같은 경로. 둘 다 '읽는 사람이
    # 카드를 오해하게 만드는' 잘못이라, 경고만 남기면 그대로 화면에 나간다.
    found.extend(no_direction_offenders(entry))
    found.extend(name_betrays_content(entry))
    found.extend(rate_term_offenders(entry))

    # 한 재료가 여러 규칙에 걸리면 항목을 하나로 합친다. 이 함수는 집행에도 쓰이는데,
    # 중복이 남으면 같은 재료가 혼조 칸에 두 번 들어가 화면에 두 번 보인다.
    # (본 루프는 원래 하나만 만들지만, 뒤에 붙는 세 검사는 각자 따로 만든다.)
    merged, order = {}, []
    for side, f, why in found:
        k = id(f)
        if k not in merged:
            merged[k] = [side, f, [why]]
            order.append(k)
        else:
            merged[k][2].append(why)
    return [(s, f, ' / '.join(w)) for s, f, w in (merged[k] for k in order)]


def score_frozen_violation(entry, prev_entries, snap=None):
    """G7 — 점수는 못 박혀 있는데 그 점수를 채우는 이유만 매번 바뀌는 패턴.

    배경(8/13): 긍정 75 : 부정 25가 22시간·아홉 장 연속 유지되는 동안 부정 25점의
    정체는 'AI 안전 규제' → '고유가' → '반도체 약세' → '유가 하락' → '국채금리 하락'
    으로 계속 갈렸다. 숫자를 먼저 정하고 이유를 나중에 찾은 흔적이다.

    코드가 대신 고쳐줄 정답이 없는 종류라 집행하지 않는다 — 재판정 프롬프트에만
    붙여 스스로 다시 보게 한다. (집행 가능한 것만 집행한다는 원칙)
    """
    if not prev_entries:
        return None
    neg = entry.get('negative_total')
    if neg is None:
        return None
    same = []
    for e in prev_entries[:3]:
        if e.get('negative_total') != neg:
            break
        same.append(e)
    if len(same) < 3:
        return None

    def names(e):
        return {(f.get('name') or '').strip() for f in (e.get('negative_factors') or [])}

    cur = names(entry)
    churn = sum(1 for e in same if cur and names(e) and not (cur & names(e)))
    if churn >= 2:
        return (f"점수 고착 의심: 부정 {neg}이 직전 {len(same)}장과 동일한데 부정 요인의 정체는 "
                f"매번 바뀌었다. 점수를 먼저 정하고 이유를 나중에 맞추지 마라 — 오늘 실제로 "
                f"부정 재료가 없으면 부정 점수를 낮춰라")
    return None


def enforce_direction_rules(entry, snap):
    """방향·국면·크기·사실 위반 재료의 점수를 걷어 혼조로 내린다.

    걷어낸 점수는 남은 재료에 얹지 않는다 — 재배분하면 모델이 10점이라 판정한 재료가
    25점으로 부풀어 화면에 나가고, "부정 재료가 없으면 부정 점수를 낮춰라"는 지시와
    정반대가 된다. 양편의 잔여 가중치를 한 번에 계산해 100으로 재정규화한다
    (편마다 순차로 조정하면 두 번째 편이 이미 부풀려진 값을 읽는다 — 감사 2차 지적 2번).

    한쪽 편의 유일한 재료가 위반이면 그 편이 통째로 비어버린다 — 그 경우엔 코드가
    정직하게 만들 수 있는 판정이 없으므로 (entry, False)를 돌려 게시를 포기시킨다.
    75분 뒤 다음 사이클이 다시 시도한다. 직전 카드가 그대로 남는 편이 낫다.

    주의: 이 함수는 총점을 움직이므로, 호출한 쪽에서 G2/G3 클램프를 한 번 더
    돌려야 한다(감사 2차 지적 1번 — 재료 하나를 걷어낸 것만으로 무충격 45점 이동이
    가능하다). main() 4-3이 그 역할을 한다.
    """
    offenders = direction_offenders(entry, snap)
    if not offenders:
        return entry, True

    SIDES = ('positive_factors', 'negative_factors')
    plan = {}
    for side in SIDES:
        # 객체 동일성으로 고른다 — dict 의 '==' 로 비교하면 이름·설명·점수가 우연히
        # 같은 다른 재료까지 같이 걷어낸다(감사 1차 지적 9번).
        bad_ids = {id(f) for s, f, _ in offenders if s == side}
        factors = entry.get(side) or []
        bad = [f for f in factors if id(f) in bad_ids]
        keep = [f for f in factors if id(f) not in bad_ids]
        if bad and not keep:
            print(f"::warning::[방향집행] {side}의 유일한 재료가 위반 — 코드로 고칠 수 없어 게시 포기")
            return entry, False
        if not keep:
            print(f"::warning::[방향집행] {side}에 재료가 없다 — 점수를 옮길 곳이 없어 게시 포기")
            return entry, False
        plan[side] = (bad, keep, sum(int(f.get('score', 0) or 0) for f in bad))

    # 잔여 가중치 = 원래 총점 − 걷어낸 점수. 두 편을 함께 100으로 재정규화한다.
    left = {side: max(0, int(entry.get(side.replace('_factors', '_total'), 0) or 0) - plan[side][2])
            for side in SIDES}
    if sum(left.values()) <= 0:
        print("::warning::[방향집행] 양편 모두 잔여 점수 0 — 게시 포기")
        return entry, False

    pos = int(round(left['positive_factors'] * 100.0 / sum(left.values()) / 5.0) * 5)
    pos = max(100 - _SIDE_MAX, min(_SIDE_MAX, pos))   # 90:10 은 판정이 아니라 선언이다
    totals = {'positive_factors': pos, 'negative_factors': 100 - pos}

    for side in SIDES:
        bad, keep, _ = plan[side]
        entry[side.replace('_factors', '_total')] = totals[side]
        entry[side] = _redistribute(keep, totals[side])
        for f in bad:
            f.pop('score', None)
            # 63항 — 강등된 재료가 "성장주에 긍정적" 같은 방향 주장을 단 채 혼조
            # 칸에 앉아 있으면 독자는 분류를 의심한다(2026-08-25 실사고). 방향
            # 주장 꼬리를 떼고, 왜 점수가 없는지를 한마디 남긴다.
            for k in ('desc', 'desc_en'):
                v = (f.get(k) or '')
                nv = re.sub(r'[,·]?\s*(성장주|기술주|시장)?\s*(에|에게)?\s*'
                            r'(긍정적|부정적|positive|negative)\s*$', '', v).rstrip(' ,·')
                if nv != v:
                    f[k] = nv + (' — 방향 대비 크기·근거가 약해 판정 제외' if k == 'desc'
                                 else ' — excluded from scoring')
            entry.setdefault('mixed_factors', []).append(f)
            print(f"::warning::[방향집행] 재료 강등: '{f.get('name','')}' → 혼조(무점수)")
    print(f"::warning::[방향집행] 점수 재정규화: 긍정 {totals['positive_factors']} : "
          f"부정 {totals['negative_factors']}")
    return entry, True


def guardrail_violations(entry, snap, prev_entry, spy_off_high):
    errors = []
    # G1 — 사실 대조: 강한 표현은 실측 등락률이 뒷받침해야 한다
    factor_texts, summary = _gr_entry_texts(entry)
    all_texts = [t for _, t in factor_texts] + [summary]
    for subj_re, claim_re, key, ok, label in _GR_CLAIMS:
        val = snap.get(key)
        if val is None:
            continue
        for t in all_texts:
            if _gr_claim_hit(t, subj_re, claim_re) and not ok(val):
                errors.append(f"사실 대조 실패: {label} — 실측 {key}={val:+.2f}%로 뒷받침 안 됨 ('{t[:40]}')")
                break
    # G2 — 변화 상한: 새 충격 없이 직전 판정에서 30점 초과 이동 금지
    if prev_entry and not _gr_shock(snap):
        prev_neg = int(prev_entry.get('negative_total', 50) or 50)
        neg = int(entry.get('negative_total', 50) or 50)
        if abs(neg - prev_neg) > 30:
            errors.append(f"변화 상한 초과: 직전 부정 {prev_neg} → {neg} (새 충격 없이 30점 초과 이동). "
                          f"{max(0, prev_neg - 30)}~{min(100, prev_neg + 30)} 범위에서 재판정 필요")
    # G4 — 개별 기업 재료의 점수 배분 금지 (2026-08-12 신설, 운영 피드백)
    # 한 기업의 지역 판매·등급 조정 같은 뉴스는 시장 전체의 재료가 아니다. 시장을
    # 실제로 움직인 실적 이벤트는 earnings_bellwether 카테고리로 허용된다.
    # 해당 종목 주가가 그날 올랐는데 부정 재료로 실리는 자기모순도 이 검사가 잡는다.
    for side, side_ko in (('positive_factors', '긍정'), ('negative_factors', '부정')):
        for f in entry.get(side) or []:
            if f.get('category') == 'company_specific' and int(f.get('score', 0) or 0) > 0:
                errors.append(f"개별 기업 재료 점수 배분: {side_ko} '{f.get('name','')}'(company_specific)는 "
                              f"시장 전체 재료가 아님 — 시장 전체를 움직인 실적 이벤트(earnings_bellwether)만 "
                              f"점수 허용, 그 외 개별 기업 뉴스는 제외하거나 혼조(무점수)로")
    # G3 — 극단값 앵커
    neg = int(entry.get('negative_total', 50) or 50)
    pos = int(entry.get('positive_total', 50) or 50)
    if _gr_calm(snap, spy_off_high) and neg > 65:
        errors.append(f"극단값 앵커: VIX {snap.get('vix')} · 고점 대비 {spy_off_high}% 이내의 평온한 시장에서 "
                      f"부정 {neg}는 과잉 — 부정 상한 65")
    if _gr_panic(snap, spy_off_high) and pos > 65:
        errors.append(f"극단값 앵커: 공황 지표(VIX {snap.get('vix')} / 고점 대비 −{spy_off_high}%)에서 "
                      f"긍정 {pos}는 과잉 — 긍정 상한 65")
    return errors

def enforce_guardrails(entry, snap, prev_entry, spy_off_high):
    """재판정 후에도 남은 위반을 코드로 강제한다. 점수는 클램프(+소계=항목합 재배분),
    문구는 실측과 모순되는 강한 단어만 완화(급등→상승, 급락→하락)."""
    changed = False
    neg = int(entry.get('negative_total', 50) or 50)
    lo, hi = 0, 100
    # G2 클램프
    if prev_entry and not _gr_shock(snap):
        pv = prev_entry.get('negative_total')
        prev_neg = int(pv) if pv is not None else 50   # 정당한 0점을 50으로 왜곡하지 않는다
        lo, hi = max(0, prev_neg - 30), min(100, prev_neg + 30)
        if neg < lo or neg > hi:
            neg = lo if neg < lo else hi
            changed = True
    # G3 클램프
    if _gr_calm(snap, spy_off_high) and neg > 65:
        neg = min(neg, 65)
        hi = min(hi, 65)
        changed = True
    if _gr_panic(snap, spy_off_high) and (100 - neg) > 65:
        neg = max(neg, 35)
        lo = max(lo, 35)
        changed = True
    if changed:
        # 5단위 반올림이 클램프 경계 밖으로 나가면 경계 안쪽 5단위로 되돌린다
        neg = int(round(neg / 5.0) * 5)
        if neg < lo:
            neg = int(-(-lo // 5) * 5)      # lo 이상의 최소 5단위
        elif neg > hi:
            neg = int(hi // 5 * 5)          # hi 이하의 최대 5단위
        print(f"::warning::[가드레일] 점수 클램프 적용: 부정 {entry.get('negative_total')} → {neg}")
        entry['negative_total'] = neg
        entry['positive_total'] = 100 - neg
        entry['positive_factors'] = _redistribute(entry.get('positive_factors') or [], entry['positive_total'])
        entry['negative_factors'] = _redistribute(entry.get('negative_factors') or [], entry['negative_total'])
    # G4 강제 — 개별 기업(company_specific) 점수 재료는 걷어내고 같은 편에 재배분.
    # 단 그 편의 유일한 재료면 빈 칸이 생기므로 남긴다(재판정 피드백이 1차 방어).
    for side in ('positive_factors', 'negative_factors'):
        factors = entry.get(side) or []
        keep = [f for f in factors if not (f.get('category') == 'company_specific'
                                           and int(f.get('score', 0) or 0) > 0)]
        if keep and len(keep) < len(factors):
            dropped = [f.get('name', '') for f in factors if f not in keep]
            total = int(entry.get(side.replace('_factors', '_total'), 0) or 0)
            entry[side] = _redistribute(keep, total)
            print(f"::warning::[가드레일] 개별 기업 재료 제거·재배분: {', '.join(dropped)}")

    # G1 문구 완화 — 실측이 뒷받침하지 않는 강한 단어만 교체 (명사형 유지)
    SOFTEN = [('급등', '상승'), ('폭등', '상승'), ('급락', '하락'), ('폭락', '하락'),
              ('하방 압력 심화', '하방 압력 경계'), ('하락 압력 심화', '하락 압력 경계')]
    factor_texts, _ = _gr_entry_texts(entry)
    for subj_re, claim_re, key, ok, label in _GR_CLAIMS:
        val = snap.get(key)
        if val is None:
            continue
        for f, t in factor_texts:
            if _gr_claim_hit(t, subj_re, claim_re) and not ok(val):
                for a, b in SOFTEN:
                    if a in f.get('name', '') or a in f.get('desc', ''):
                        f['name'] = f.get('name', '').replace(a, b)
                        f['desc'] = f.get('desc', '').replace(a, b)
                        print(f"::warning::[가드레일] 문구 완화: '{a}' → '{b}' ({label}, 실측 {val:+.2f}%)")
        summ = entry.get('summary', '')
        if summ and _gr_claim_hit(summ, subj_re, claim_re) and not ok(val):
            for a, b in SOFTEN:
                if a in entry['summary']:
                    entry['summary'] = entry['summary'].replace(a, b)
                    print(f"::warning::[가드레일] 요약 완화: '{a}' → '{b}' ({label})")
    return entry


def main():
    kst_now = get_kst_now()
    print(f"=== 긍정 vs 부정 분석 시작 ({kst_label(kst_now)}) ===")

    # 0. 중복 실행 가드 (2026-07-03) — 감시견 구조 + 정기 cron 겹침 방지
    if recent_entry_exists(kst_now):
        print(f"  직전 카드가 {MIN_GAP_MINUTES}분 이내 생성됨 — 중복 실행 건너뜀 (FORCE_SCORECARD=1로 우회 가능)")
        sys.exit(0)

    # 0-1. 현재 미국 시장 세션 판정 (2026-07-03)
    session_code, session_label = get_us_session()
    print(f"  현재 미국 세션: {session_label or '판정 불가'}")

    # 1. 시장 데이터 수집
    print("  [1] 주식·지수 데이터 수집...")
    equity_rows = fetch_equity_data()
    for r in equity_rows:
        print(f"    {r}")

    print("  [2] 거시경제 데이터 수집...")
    macro_rows = fetch_macro_data()
    for r in macro_rows:
        print(f"    {r}")

    # 가드레일용 실측 스냅샷 (51항) — 프롬프트에 넣는 것과 같은 수집치를 파싱
    snap = market_snapshot(equity_rows, macro_rows)
    spy_off_high = fetch_spy_off_high()
    print(f"  가드레일 스냅샷: QQQ {snap['qqq_pct']}% · SPY {snap['spy_pct']}% · "
          f"VIX {snap['vix']} ({snap['vix_pct']}%) · WTI {snap['oil_pct']}% · "
          f"SPY 고점 대비 −{spy_off_high}%")

    print("  [3] 뉴스 헤드라인 수집 (yfinance)...")
    headlines = fetch_news_headlines()
    print(f"    yfinance: {len(headlines)}건")
    for h in headlines[:3]:
        print(f"    - {h}")

    print("  [3-a] Google News RSS 수집...")
    rss_headlines = fetch_google_news_rss()

    print("  [3-b] Alpha Vantage 뉴스 감성 수집...")
    av_items, av_summary = fetch_alphavantage_news()

    print("  [3-c] FRED 매크로 실수치 수집...")
    fred_rows = fetch_fred_macro()
    for r in fred_rows:
        print(f"    {r}")

    print("  [3-d] TV 리포트 수신함 확인...")
    tv_inbox_block = fetch_tv_inbox(kst_now)

    # 2. 기존 데이터 로드 (직전 카드 맥락을 프롬프트에 넣기 위해 먼저 로드)
    data = load_existing()
    prev_entries = data.get("entries", [])[:2]  # 최근 2개 → 일관성 맥락용
    if prev_entries:
        print(f"  직전 카드 참고: {[e['id'] for e in prev_entries]}")

    # 2-1. 판단 원장 로드 — 직전 3영업일 판단 흐름 (2026-07-03)
    ledger = load_ledger()
    history_block = ledger_context_block(ledger)
    if history_block:
        print(f"  판단 원장 참고: {len(ledger)}개 기록")

    # 3. Gemini 분석
    print("  [4] Gemini AI 분석 중...")
    prompt = build_prompt(kst_now, equity_rows, macro_rows, headlines, prev_entries,
                          rss_headlines=rss_headlines, av_items=av_items,
                          av_summary=av_summary, fred_rows=fred_rows,
                          history_block=history_block,
                          session_code=session_code, session_label=session_label,
                          tv_inbox_block=tv_inbox_block)
    result = call_gemini(prompt)

    if not result:
        print("  ERROR: Gemini 결과 없음 — 스크립트 종료")
        sys.exit(1)

    print(f"  결과: 긍정 {result.get('positive_total')} vs 부정 {result.get('negative_total')}")

    # 4. 항목 생성 + 검증
    entry = build_entry(kst_now, result)

    # 4-0. 혼조 재료 고착 방지 (2026-07-09 신설, 2026-07-10 강화) — 프롬프트 준수에만
    # 의존하지 않는 코드 안전장치. ledger를 함께 넘겨 끊겼다 재등장하는 패턴도 잡는다.
    entry, dropped_mixed = prune_stale_mixed_factors(
        entry, data.get("entries", []), headlines, rss_headlines, kst_now,
        ledger=ledger, equity_rows=equity_rows, macro_rows=macro_rows
    )
    if dropped_mixed:
        for name, age in dropped_mixed:
            print(f"  WARNING: 혼조 재료 '{name}' {age}시간째 반복 & 오늘 뉴스 미확인 — 자동 제거")

    validate_entry(entry)

    # 4-1. 내용 모순 + 가드레일 검증 — 발견 시 1회 재시도 (2026-06-29 추가,
    # 2026-07-03 세션 검증 확장, 2026-08-11 가드레일 3종 + 재시도에 위반 사유 피드백)
    prev_entry_for_guard = (data.get("entries") or [None])[0]
    prev_entries_for_guard = (data.get("entries") or [])[:3]

    def _all_violations(e):
        v = validate_content(e, session_code, snap) \
            + guardrail_violations(e, snap, prev_entry_for_guard, spy_off_high)
        frozen = score_frozen_violation(e, prev_entries_for_guard, snap)
        if frozen:
            v.append(frozen)
        return v

    content_errors = _all_violations(entry)
    if content_errors:
        print(f"  WARNING: 검증 실패 {len(content_errors)}건 발견 — 재시도")
        for err in content_errors:
            print(f"    ❌ {err}")
        # 같은 프롬프트를 다시 던지면 같은 답이 온다 — 무엇이 틀렸는지 붙여서 재판정
        retry_prompt = prompt + "\n\n=== 재판정 지시 — 직전 응답이 아래 검증에 실패했다 ===\n" \
            + "\n".join(f"- {e}" for e in content_errors) \
            + "\n위 문제를 모두 해소한 새 판정을 같은 JSON 형식으로 다시 내라. " \
              "실측 등락률이 뒷받침하지 않는 강한 표현(급등·급락 등)은 쓰지 마라."
        result2 = call_gemini(retry_prompt)
        if result2:
            entry2 = build_entry(kst_now, result2)
            entry2, dropped_mixed2 = prune_stale_mixed_factors(
                entry2, data.get("entries", []), headlines, rss_headlines, kst_now,
                ledger=ledger, equity_rows=equity_rows, macro_rows=macro_rows
            )
            if dropped_mixed2:
                for name, age in dropped_mixed2:
                    print(f"  WARNING: (재시도) 혼조 재료 '{name}' {age}시간째 반복 & 오늘 뉴스 미확인 — 자동 제거")
            validate_entry(entry2)
            errors2 = _all_violations(entry2)
            if errors2:
                print(f"  WARNING: 재시도에도 검증 실패 {len(errors2)}건 존재 — 두 결과 중 위반이 적은 쪽 사용")
                for err in errors2:
                    print(f"    ❌ {err}")
                if len(errors2) < len(content_errors):
                    entry = entry2
            else:
                print(f"  ✅ 재시도 성공 — 검증 통과 결과 채택")
                entry = entry2
        else:
            print(f"  재시도 실패 — 1차 결과 그대로 사용")

    # 4-2. 재판정 후에도 남은 가드레일 위반은 코드로 강제 (51항) — 점수 클램프 + 문구 완화
    remaining = guardrail_violations(entry, snap, prev_entry_for_guard, spy_off_high)
    if remaining:
        print(f"  WARNING: 가드레일 위반 {len(remaining)}건 잔존 — 코드 강제 적용")
        entry = enforce_guardrails(entry, snap, prev_entry_for_guard, spy_off_high)
        validate_entry(entry)

    # 4-3. 방향·국면·미세변동 위반 집행 (52항) — 8/13 '감지하고도 게시' 사고의 직접 대응.
    # 여기서부터는 경고가 아니라 집행이다. 위반 재료는 점수를 잃고 혼조로 내려간다.
    dir_left = direction_offenders(entry, snap)
    if dir_left:
        print(f"  WARNING: 방향·국면 위반 {len(dir_left)}건 잔존 — 코드 강제 적용")
        for _s, _f, _why in dir_left:
            print(f"    ❌ {_why}")
        entry, ok = enforce_direction_rules(entry, snap)
        if not ok:
            # 한쪽 편이 통째로 비는 판정은 코드가 정직하게 만들 수 없다.
            # 틀린 카드를 내보내느니 이번 사이클을 거른다 — 직전 카드가 그대로 남는다.
            print("::warning::[52항] 위반 재료가 한쪽 편의 전부 — 이번 사이클 게시 포기")
            print("=== 중단 (카드 미생성) ===")
            sys.exit(0)
        # 재료 하나를 걷어낸 것만으로 총점이 크게 움직일 수 있다(부정 40→85 등).
        # 그러면 방금 4-2에서 맞춰놓은 G2(변화 상한)·G3(극단값 앵커)가 다시 깨지므로
        # 클램프를 한 번 더 돌린다. 순서가 중요하다 — 방향 집행이 먼저, 점수 앵커가 나중.
        after = guardrail_violations(entry, snap, prev_entry_for_guard, spy_off_high)
        if after:
            print(f"  WARNING: 방향 집행 후 가드레일 위반 {len(after)}건 — 재클램프")
            entry = enforce_guardrails(entry, snap, prev_entry_for_guard, spy_off_high)
        validate_entry(entry)

    # 4-4. 주말 '휴장' 표현 최종 치환 (58항) — 재판정으로도 안 고쳐진 잔여분 처리
    entry = scrub_weekend_closure_word(entry, session_code)
    # 4-5. 국채금리 수치 표기 교정 (60항) — 수준과 변화가 둘 다 %라 하나만 적으면 오독된다
    entry = fix_yield_number(entry, snap)
    # 4-6. 요약 순환 서술 교정 (63항) — 재판정으로도 안 고쳐진 결과-이유 어구를 걷어낸다
    entry = scrub_circular_summary(entry)
    # 4-7. 금리 상시 노출 보증 (64항) — 모델이 금리를 통째로 뺐으면 실측치로 혼조 보충
    entry = ensure_rates_visible(entry, snap)

    # 4-7b. 혼조 칸 개별 기업 노이즈 제거 (67항) — 재판정으로도 남으면 코드가 걷어낸다.
    # 점수가 없는 재료라 판정(총점)은 변하지 않는다. 감지하고도 게시하지 않는다(52항).
    _mf = entry.get('mixed_factors') or []
    _noise = [f for f in _mf if (f.get('category') or '') == 'company_specific']
    if _noise:
        entry['mixed_factors'] = [f for f in _mf if f not in _noise]
        for _f in _noise:
            print(f"::warning::[67항] 혼조 노이즈 제거: '{_f.get('name','')}'(개별 기업)")

    # 4-7d. 대기 재료 혼조 강등 (72항) — 재판정으로도 남으면 코드가 옮긴다.
    # 삭제가 아니라 이동이다(64항). 남은 재료에 점수를 재배분해 총점은 그대로 둔다.
    for _nm in demote_event_waits(entry):
        print(f"::warning::[72항] 대기 재료 혼조 강등: '{_nm}'")
    if entry.pop('_wait_side_emptied', None):
        # 한쪽 편이 통째로 '기다림'뿐이었다. 그 편에는 판정을 지탱할 근거가 없다.
        # 틀린 카드를 내보내느니 이번 사이클을 거른다 — 직전 카드가 그대로 남는다(52항).
        print("::warning::[72항] 한쪽 편이 대기 재료뿐 — 이번 사이클 게시 포기")
        print("=== 중단 (카드 미생성) ===")
        sys.exit(0)

    # 4-7c. 예정 이벤트 ET 날짜 표기 (70항) — 프롬프트로 시켰어도 빠지면 코드가 붙인다.
    # 판정·점수는 건드리지 않는다. 독자가 '언제'를 알 수 있게 사실을 더할 뿐이다.
    for _nm, _st in annotate_event_dates(entry):
        print(f"  [70항] 일정 표기 보강: '{_nm}' → {_st}")

    # 4-8. 심층 보고서 (66항) — 확정된 카드를 A4 한 장으로 풀어 쓴다. 실패해도 카드는 나간다.
    try:
        rep = desk_deep_report(entry, headlines, rss_headlines, av_items, fred_rows, snap)
        if rep:
            entry['report'] = rep
            entry['report_at'] = kst_label(kst_now)
            print(f"  심층 보고서 생성: {sum(len(v) for v in rep.values())}자")
    except Exception as _re:
        print(f"::warning::[66항] 보고서 생성 실패 — 카드만 게시: {type(_re).__name__}: {_re}")

    # 4-9. 보고서 백필 — 직전 카드 중 보고서가 없는 것을 최대 2장까지 채운다.
    # 도입 시점 이전 카드와, 생성이 실패했던 카드를 다음 사이클이 자연 치유한다.
    try:
        _bf = 0
        for _old in (data.get('entries') or []):
            if _bf >= 2:
                break
            if _old.get('report'):
                continue
            _r2 = desk_deep_report(_old, headlines, rss_headlines, av_items, fred_rows, snap)
            if _r2:
                _old['report'] = _r2
                _old['report_at'] = kst_label(kst_now)
                _bf += 1
                print(f"  보고서 백필: {_old.get('timestamp_kst')}")
    except Exception as _re:
        # 원인 추적을 위해 타입만이 아니라 메시지까지 남긴다(2026-08-26 AttributeError 사고)
        print(f"::warning::[66항] 보고서 백필 실패(무시): {type(_re).__name__}: {_re}")

    # 5. 신규 항목 추가
    entries = data.get("entries", [])

    # 같은 id가 있으면 덮어씀 (중복 방지)
    entries = [e for e in entries if e.get("id") != entry["id"]]
    entries.insert(0, entry)  # 최신이 맨 앞

    # 최대 10개 유지 (오래된 것 제거)
    entries = entries[:MAX_ENTRIES]

    data["entries"]    = entries
    data["updated_at"] = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    data["max_entries"] = MAX_ENTRIES

    # 6. 저장
    save_data(data)

    # 6-1. 판단 원장 기록 (2026-07-03) — 실패해도 본 저장에는 영향 없음
    try:
        ledger = append_ledger(ledger, kst_now, entry)
        save_ledger(ledger)
        print(f"  판단 원장 기록 완료 ({len(ledger)}개)")
    except Exception as e:
        print(f"  판단 원장 기록 실패: {e}")

    print(f"  총 항목 수: {len(entries)}")
    print("=== 완료 ===")


if __name__ == '__main__':
    main()
