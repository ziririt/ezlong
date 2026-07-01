#!/usr/bin/env python3
"""
긍정 vs 부정 몇대몇 — 자동 분석 스크립트 (GitHub Actions용)
yfinance로 시장 데이터 + 뉴스 수집 → Gemini AI 분석 → data/market-scorecard-data.json 업데이트

스케줄: 하루 5회 (KST 07:00 / 12:00 / 18:30 / 22:00 / 23:30)
모델: gemini-2.5-flash-lite (고정)
최대 항목 수: 10 (초과 시 오래된 것부터 삭제)
"""

import json
import os
import sys
import re
import time
import requests
from datetime import datetime, timezone, timedelta

try:
    import yfinance as yf
except ImportError:
    print("ERROR: yfinance 미설치. pip install yfinance 실행 필요.")
    sys.exit(1)

# ─── 설정 ───────────────────────────────────────────────────────────────────
GEMINI_API_KEY     = os.environ.get('GEMINI_API_KEY', '')
GEMINI_MODEL       = 'gemini-2.5-flash-lite'           # 임시 flash-lite (2026-06-27: flash 쿼터 소진 대응)
# 7월 1일 쿼터 리셋 후 gemini-2.5-flash로 복구 예정
# 폴백 없음 — v1beta에서 1.5 계열 전부 404, 2.0-flash 서비스 종료 (2026-06-26 확인)

def _gemini_url(model):
    return f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_API_KEY}'

MAX_ENTRIES = 10

OUTPUT_PATH = os.path.normpath(
    os.path.join(os.path.dirname(__file__), '..', 'data', 'market-scorecard-data.json')
)

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

            # 프리마켓/시간외 포함 최신 가격 시도
            price = None
            session_tag = ''
            try:
                hist = t.history(period='1d', prepost=True, interval='1m')
                if not hist.empty:
                    price = float(hist['Close'].iloc[-1])
                    ts = hist.index[-1]
                    # 정규장(9:30-16:00 ET) 외 시간이면 태그 추가
                    et_hour = (ts.utctimetuple().tm_hour - 4) % 24  # ET 근사
                    if et_hour < 9 or et_hour >= 16:
                        session_tag = ' [프리/시간외]'
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


# ─── Gemini 호출 ──────────────────────────────────────────────────────────────

def build_prompt(kst_now, equity_rows, macro_rows, headlines, prev_entries=None,
                 rss_headlines=None, av_items=None, av_summary="", fred_rows=None):
    schedule_label = SCHEDULE_LABELS.get(kst_now.hour, f'{kst_now.hour}:00')

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
            prev_block += "\n"
        prev_block += """[일관성 원칙 — 엄격 적용]
- 직전 카드에서 언급된 핵심 이슈가 아직 해소되지 않은 이벤트라면, 이번 카드에도 반드시 포함해야 함
  예: 직전 카드에 "내일 도하 협상"이 핵심이라면, 협상이 끝나기 전까지 모든 카드에 불확실성 포함
- 핵심 이슈가 바뀐 경우, 반드시 새로운 중대 뉴스 이벤트가 발생했기 때문이어야 함
- key_event.name은 뉴스 이벤트여야 함. "기술주 프리마켓 강세/약세" 같은 시장 상태 표현 절대 금지

"""

    return f"""당신은 미국 주식시장 시황 분석 전문가입니다.
현재 시각(KST): {kst_now.strftime('%Y-%m-%d %H:%M')} ({schedule_label})
{fred_block}{av_block}
=== 데이터 시점 안내 (분석 전 반드시 숙지) ===
- 가격 데이터 중 [프리/시간외] 표시가 없는 항목은 직전 미국 정규장 종가 기준
- [프리/시간외] 표시 항목은 현재 프리마켓 또는 시간외 실시간 가격
- 뉴스 헤드라인은 최근 6시간 이내 발행된 기사만 포함 (각 기사에 경과 시간 표시)
- 판단 우선순위: ① 실시간 가격·VIX 데이터 → ② 6시간 이내 뉴스 헤드라인 순으로 적용
- 가격 데이터가 광범위한 하락(-1% 이상 지수 하락, VIX 상승)을 보이면, 뉴스가 긍정적이어도 전체 판단은 부정 우위
- 오래된 뉴스 이벤트(예: 수일 전 실적 발표)는 이미 가격에 반영되었으므로 핵심 이슈로 분류 금지
- 가격 데이터와 뉴스가 상충할 때: 실시간 가격·선물 데이터를 1차 기준으로 사용

{prev_block}=== 현재 시장 데이터 ===
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
- 달러 강세 → 미국 수출주/신흥국 자금 유출 우려 → 부정
- 달러 약세 → 수출주 실적 개선, 원자재 지지 → 긍정
- 지정학적 리스크 완화 → 긍정, 지정학적 긴장 고조 → 부정
- desc에 쓴 인과관계 방향이 긍정/부정 분류와 반드시 일치해야 함

=== 호재/악재 선별 기준 — 반드시 원인을 찾아라 ===

[핵심 원칙]
- "기술주 프리마켓 상승/하락"은 결과(시장 반응)다. 원인(왜 상승하는지)이 호재/악재다.
- 원인을 모르면 그 방향은 호재/악재 목록에 절대 포함하지 않는다.
- key_event.name은 반드시 뉴스 이벤트나 매크로 원인이어야 한다. 시장 상태 묘사 금지.
  금지 예: "기술주 프리마켓 강세", "나스닥 선물 상승" → 이건 결과임
  허용 예: "미-이란 전술적 휴전 합의", "Fed 파월 인하 신호", "CPI 예상치 하회"

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

[예외 — 개별 기업이지만 시장 전체 재료로 인정 가능한 케이스]
- S&P500 시총 상위 5개(AAPL, MSFT, NVDA, AMZN, GOOGL) 기습 가격 인상
  → 인플레이션 신호·소비자 지출 영향으로 시장 전체에 파급. 인정.
- 나스닥 가중치 5% 이상 종목의 어닝 서프라이즈/쇼크 (실적 발표)
  → 섹터 전체 심리 전환 가능. 인정.

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

    # gemini-2.5-flash 단독 4회 재시도 (폴백 없음 — v1beta 1.5계열 전부 404)
    print(f"  1차 시도: {GEMINI_MODEL}")
    result = _call_single_model(GEMINI_MODEL, payload, max_retries=4)
    if result:
        print(f"  성공: {GEMINI_MODEL}")
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
        "negative_factors": result.get("negative_factors", [])
    }


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


def validate_content(entry):
    """내용 모순 검증 — 동일 기업 양측 등장, 유가 방향 오류, VIX 방향 오류"""
    def texts(factors):
        return [(f.get('name', '') + ' ' + f.get('desc', '')).lower() for f in factors]

    pos_texts = texts(entry.get('positive_factors', []))
    neg_texts = texts(entry.get('negative_factors', []))

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

    return errors


# ─── 메인 ────────────────────────────────────────────────────────────────────

def main():
    kst_now = get_kst_now()
    print(f"=== 긍정 vs 부정 분석 시작 ({kst_label(kst_now)}) ===")

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

    # 2. 기존 데이터 로드 (직전 카드 맥락을 프롬프트에 넣기 위해 먼저 로드)
    data = load_existing()
    prev_entries = data.get("entries", [])[:2]  # 최근 2개 → 일관성 맥락용
    if prev_entries:
        print(f"  직전 카드 참고: {[e['id'] for e in prev_entries]}")

    # 3. Gemini 분석
    print("  [4] Gemini AI 분석 중...")
    prompt = build_prompt(kst_now, equity_rows, macro_rows, headlines, prev_entries,
                          rss_headlines=rss_headlines, av_items=av_items,
                          av_summary=av_summary, fred_rows=fred_rows)
    result = call_gemini(prompt)

    if not result:
        print("  ERROR: Gemini 결과 없음 — 스크립트 종료")
        sys.exit(1)

    print(f"  결과: 긍정 {result.get('positive_total')} vs 부정 {result.get('negative_total')}")

    # 4. 항목 생성 + 검증
    entry = build_entry(kst_now, result)
    validate_entry(entry)

    # 4-1. 내용 모순 검증 — 모순 발견 시 1회 재시도 (2026-06-29 추가)
    content_errors = validate_content(entry)
    if content_errors:
        print(f"  WARNING: 내용 모순 {len(content_errors)}건 발견 — 재시도")
        for err in content_errors:
            print(f"    ❌ {err}")
        result2 = call_gemini(prompt)
        if result2:
            entry2 = build_entry(kst_now, result2)
            validate_entry(entry2)
            errors2 = validate_content(entry2)
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
    print(f"  총 항목 수: {len(entries)}")
    print("=== 완료 ===")


if __name__ == '__main__':
    main()
