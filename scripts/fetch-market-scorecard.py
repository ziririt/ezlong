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
    """생성된 카드의 핵심을 한 줄로 원장에 기록 (결정적 조합 — Gemini 의존 없음)"""
    line = f"긍정 {entry['positive_total']} : 부정 {entry['negative_total']} — {entry['key_event']['name']}"
    if entry.get('summary'):
        line += f" | {entry['summary']}"
    if entry.get('mixed_factors'):
        line += f" | 혼조: {entry['mixed_factors'][0].get('name', '')}"
    ledger.append({'d': kst_now.strftime('%Y-%m-%d'), 't': kst_now.strftime('%H:%M'), 'k': line[:160]})
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
        return 'weekend', '주말 휴장'
    if 4.0 <= hm < 9.5:
        return 'pre', '프리마켓'
    if 9.5 <= hm < 16.0:
        return 'regular', '정규장'
    if 16.0 <= hm < 20.0:
        return 'post', '포스트마켓(시간외)'
    return 'closed', '휴장(정규장 마감 후 야간)'


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

    SERIES = {
        "CPIAUCSL": "CPI 소비자물가(%)",
        "FEDFUNDS":  "Fed 기준금리(%)",
        "T10Y2Y":    "10Y-2Y 스프레드(경기선행, %)",
        "UNRATE":    "실업률(%)",
        "T10YIE":    "10년 기대인플레이션(%)",
    }

    rows = []
    for sid, label in SERIES.items():
        try:
            resp = requests.get(
                "https://api.stlouisfed.org/fred/series/observations",
                params={"series_id": sid, "api_key": FRED_KEY,
                        "sort_order": "desc", "limit": 2, "file_type": "json"},
                timeout=10
            )
            obs = resp.json().get("observations", [])
            if not obs:
                continue
            val = obs[0].get("value", ".")
            if val == ".":
                continue
            val_f = float(val)
            date  = obs[0]["date"]
            if len(obs) > 1 and obs[1].get("value", ".") != ".":
                diff = val_f - float(obs[1]["value"])
                rows.append(f"{label}: {val_f:.2f}% ({'+' if diff>=0 else ''}{diff:.2f}% 전기대비) [{date}]")
            else:
                rows.append(f"{label}: {val_f:.2f}% [{date}]")
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
            'closed':  "- 정규장·포스트마켓 모두 끝난 야간 휴장이다. 재료는 (1) 직전 정규장 결과를 만든 원인 (2) 다음 정규장에 영향을 줄 변수, 이 두 관점으로 선별하라.",
            'weekend': "- 주말 휴장이다. 재료는 직전 주 마감 상황과 다음 주 개장에 영향을 줄 변수 중심으로 선별하라.",
        }.get(session_code, "")
        session_block = f"""
=== 현재 미국 시장 세션: {session_label} (위반 시 전체 신뢰도 훼손) ===
- 세션 정의: 프리마켓 = ET 04:00~09:30 / 정규장 = ET 09:30~16:00 / 포스트마켓(시간외) = ET 16:00~20:00 / 그 외 = 휴장
- 현재 세션이 아닌 세션 명칭을 요인 이름·설명·핵심이슈에 쓰는 것 절대 금지.
  (예: 지금이 포스트마켓·휴장이면 '프리마켓 약세' 같은 표현 금지 — 프리마켓은 아직 시작도 안 했다)
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

    return f"""당신은 미국 주식시장 시황 분석 전문가입니다.
현재 시각(KST): {kst_now.strftime('%Y-%m-%d %H:%M')} ({schedule_label})
{session_block}{fred_block}{av_block}{tv_inbox_section}
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
- 요인 수: 각 3~5개
- 실제 영향력 기반 점수 배분 (50:50 기계적 배분 금지)
- mixed_factors: 해석이 엇갈리는 혼조·양면 재료 0~3개 (점수 없음, 아래 규칙 참조)
- summary: 단기 시장 구도 총평 (한국어, 50자 이내)
- 모든 문자열 값은 한국어, 분석/진단형 문체 ("~하세요" 금지)
- name 필드: 20자 이내, desc 필드: 30자 이내

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

- 위 지시문 내용을 절대 출력값에 포함하지 마세요

=== JSON 구조 ===
{{
  "key_event": {{
    "name": "",
    "time": "",
    "why": ""
  }},
  "positive_total": 0,
  "negative_total": 0,
  "summary": "",
  "positive_factors": [
    {{"score": 0, "name": "", "desc": ""}}
  ],
  "negative_factors": [
    {{"score": 0, "name": "", "desc": ""}}
  ],
  "mixed_factors": [
    {{"name": "", "desc": ""}}
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
            "maxOutputTokens": 8192,
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


def build_entry(kst_now, result):
    """Gemini 결과 + 타임스탬프 → 항목 dict"""
    return {
        "id":            kst_id(kst_now),
        "timestamp_kst": kst_label(kst_now),
        "key_event": {
            "name": result.get("key_event", {}).get("name", "-"),
            "time": result.get("key_event", {}).get("time", ""),
            "why":  result.get("key_event", {}).get("why", "")
        },
        "positive_total":   int(result.get("positive_total", 50)),
        "negative_total":   int(result.get("negative_total", 50)),
        "summary":          result.get("summary", ""),
        "positive_factors": result.get("positive_factors", []),
        "negative_factors": result.get("negative_factors", []),
        "mixed_factors":    (result.get("mixed_factors") or [])[:3]  # 혼조·양면 (2026-07-03)
    }


MIXED_FACTOR_STALE_HOURS = 24  # 혼조 재료 무한 반복 방지 — 이 시간 이상 연속되면 오늘 데이터 재확인 요구

# 혼조 재료 이름에서 걸러낼 범용 접속/서술어 — 이 단어들만으로는 "오늘 뉴스에도 있다"고
# 판정하지 않는다. "해석/논쟁/엇갈림/지속" 같은 말은 완전히 다른 주제에도 붙는 상투구라,
# 이것만 매칭돼도 grounded로 오판하면 안전장치가 사실상 무력화된다 (2026-07-10).
MIXED_FACTOR_GENERIC_WORDS = {
    '해석', '논쟁', '엇갈림', '우려', '지속', '고조', '완화', '기대', '전망',
    '반등', '상승', '하락', '둔화', '데이터', '신호', '전환', '심리', '변수',
    '요인', '가능성', '불확실성', '지수', '재료',
}


def _mixed_factor_similar(a, b, threshold=0.55):
    """혼조 재료 이름 두 개가 리워딩만 다른 같은 주제인지 판정.
    예: '고용 둔화 해석 논쟁' vs '고용 데이터 해석 논쟁' → 대부분 겹침, 같은 주제로 판정."""
    if not a or not b:
        return False
    return difflib.SequenceMatcher(None, a, b).ratio() >= threshold


def _grounding_tokens(name):
    """오늘 뉴스/데이터 grounding 체크에 쓸 '의미 있는' 토큰만 추림.
    범용 접속어(해석/논쟁 등)만 남으면 안전장치가 무력화되므로, 그런 경우에만 폴백으로
    전체 토큰을 쓴다."""
    tokens = [t for t in re.split(r'\s+', name) if len(t) >= 2]
    specific = [t for t in tokens if t not in MIXED_FACTOR_GENERIC_WORDS]
    return specific or tokens


def _ledger_mixed_history(ledger):
    """판단 원장(ledger)의 압축된 'k' 라인에서 '혼조: <이름>' 부분만 뽑아
    (datetime, name) 목록으로 복원한다.

    data.json(entries, 최근 10개=~2일치)과 달리 원장은 사후 수동 정리로 지워지지 않는다
    (2026-07-09 정리 때도 원장 원본은 그대로 남아 있었음). 그래서 며칠 전 반복되다 잠깐
    끊기고 다시 나오는 재활용 소재를 잡아낼 수 있는 유일한 소스다."""
    out = []
    for e in (ledger or []):
        if not isinstance(e, dict):
            continue
        k = e.get('k') or ''
        if '혼조: ' not in k:
            continue
        name = k.split('혼조: ', 1)[1].strip()
        if not name:
            continue
        try:
            dt = datetime.strptime(f"{e.get('d','')} {e.get('t','')}", '%Y-%m-%d %H:%M')
        except Exception:
            continue
        out.append((dt, name))
    return out


def _collect_mixed_history(existing_entries, ledger):
    """data.json(최근 10개, 정확한 구조)과 판단 원장(최근 20개, ~4일, 사후정리로도
    안 지워짐)을 합쳐 (datetime, name) 후보 목록을 만든다."""
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
                candidates.append((dt, nm))
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

        matches = [dt for dt, hname in history if _mixed_factor_similar(name, hname)]
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


def validate_content(entry, session_code=''):
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
               '마이크로소프트', '애플', '엔비디아', '테슬라', '구글', '아마존', '메타', '브로드컴']
    for ticker in TICKERS:
        in_pos = any(ticker in t for t in pos_texts)
        in_neg = any(ticker in t for t in neg_texts)
        if in_pos and in_neg:
            errors.append(f"모순: '{ticker.strip()}'가 긍정·부정 양쪽에 동시 등장")

    # ── 체크 2: 유가 상승을 긍정 요인으로 분류 (기술주 투자자 관점에선 인플레 압력) ──
    OIL_RISE = ['유가 상승', '유가상승', 'wti 상승', '원유 상승', '유가 올', '원유 올',
                '유가가 상승', '원유가 상승', '에너지 가격 상승']
    for kw in OIL_RISE:
        if any(kw in t for t in pos_texts):
            errors.append(f"오류: '{kw}'를 긍정 요인 분류 — 기술주 관점에선 인플레이션 압력(부정)")
            break

    # ── 체크 3: VIX 방향 오류 ────────────────────────────────────────────────
    if any('vix' in t and ('상승' in t or '급등' in t or '올라' in t) for t in pos_texts):
        errors.append("오류: VIX 상승이 긍정 요인에 분류됨 (VIX↑ = 공포지수 상승 = 부정)")
    if any('vix' in t and ('하락' in t or '안정' in t or '내려' in t) for t in neg_texts):
        errors.append("오류: VIX 하락이 부정 요인에 분류됨 (VIX↓ = 안정 = 긍정)")

    # ── 체크 4: 국채금리 방향 오류 ──────────────────────────────────────────
    if any(('국채금리' in t or '금리' in t) and ('상승' in t or '급등' in t) for t in pos_texts):
        errors.append("오류: 국채금리 상승이 긍정 요인에 분류됨 (금리↑ = 성장주 밸류 압박 = 부정)")
    if any(('국채금리' in t or '금리' in t) and ('하락' in t or '안정' in t) for t in neg_texts):
        errors.append("오류: 국채금리 하락이 부정 요인에 분류됨 (금리↓ = 성장주 유리 = 긍정)")

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
        '전반적 하락', '전반적 상승', '하락 주도', '상승 주도',
        '시총 경쟁', '시총 1위 경쟁', '시가총액 경쟁',
    ]
    for f in (entry.get('positive_factors', []) + entry.get('negative_factors', [])
              + entry.get('mixed_factors', [])):
        fname = (f.get('name', '') or '').lower()
        for pat in FACTOR_RESULT_ONLY:
            if pat in fname:
                errors.append(f"오류: 요인명 '{f.get('name','')}'은 결과(가격 움직임)만 서술 — "
                               f"원인(뉴스·이벤트)으로 교체 필요")
                break

    return errors


# ─── 메인 ────────────────────────────────────────────────────────────────────

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

    # 4-1. 내용 모순 검증 — 모순 발견 시 1회 재시도 (2026-06-29 추가, 2026-07-03 세션 검증 확장)
    content_errors = validate_content(entry, session_code)
    if content_errors:
        print(f"  WARNING: 내용 모순 {len(content_errors)}건 발견 — 재시도")
        for err in content_errors:
            print(f"    ❌ {err}")
        result2 = call_gemini(prompt)
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
            errors2 = validate_content(entry2, session_code)
            if errors2:
                print(f"  WARNING: 재시도에도 모순 {len(errors2)}건 존재 — 1차 결과 그대로 사용")
                for err in errors2:
                    print(f"    ❌ {err}")
            else:
                print(f"  ✅ 재시도 성공 — 모순 없는 결과 채택")
                entry = entry2
        else:
            print(f"  재시도 실패 — 1차 결과 그대로 사용")

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
