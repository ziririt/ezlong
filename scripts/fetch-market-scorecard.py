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
import requests
from datetime import datetime, timezone, timedelta

try:
    import yfinance as yf
except ImportError:
    print("ERROR: yfinance 미설치. pip install yfinance 실행 필요.")
    sys.exit(1)

# ─── 설정 ───────────────────────────────────────────────────────────────────
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')
GEMINI_MODEL   = 'gemini-2.5-flash-lite'
GEMINI_URL     = f'https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}'

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
    """주요 지수·종목 현재가 + 등락률"""
    rows = []
    for sym in EQUITY_TICKERS:
        try:
            t = yf.Ticker(sym)
            info = t.fast_info
            price   = getattr(info, 'last_price', None)
            prev    = getattr(info, 'previous_close', None)
            if price and prev:
                pct = (price - prev) / prev * 100
                rows.append(f'{sym}: ${price:,.2f} ({safe_pct(pct)})')
            elif price:
                rows.append(f'{sym}: ${price:,.2f}')
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


def fetch_news_headlines(max_per_ticker=3, max_total=20):
    """yfinance .news 로 최신 헤드라인 수집"""
    headlines = []
    seen = set()
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
                # yfinance news 구조: title / link / providerPublishTime / publisher
                title = None
                if isinstance(item, dict):
                    # 최신 yfinance 구조: content.title
                    content = item.get('content', {})
                    if isinstance(content, dict):
                        title = content.get('title')
                    if not title:
                        title = item.get('title')
                if title and title not in seen:
                    headlines.append(title)
                    seen.add(title)
                    count += 1
        except Exception:
            pass
    return headlines


# ─── Gemini 호출 ──────────────────────────────────────────────────────────────

def build_prompt(kst_now, equity_rows, macro_rows, headlines):
    schedule_label = SCHEDULE_LABELS.get(kst_now.hour, f'{kst_now.hour}:00')
    news_block = '\n'.join(f'- {h}' for h in headlines) if headlines else '- 뉴스 데이터 없음'

    return f"""당신은 미국 주식시장 시황 분석 전문가입니다.
현재 시각(KST): {kst_now.strftime('%Y-%m-%d %H:%M')} ({schedule_label})

=== 현재 시장 데이터 ===
[주요 지수·종목]
{chr(10).join(equity_rows)}

[거시경제 지표]
{chr(10).join(macro_rows)}

=== 최신 뉴스 헤드라인 ===
{news_block}

=== 분석 지시 ===
위 데이터를 바탕으로 최근 6시간 + 향후 12시간 미국 주식시장에 영향을 주는 긍정/부정 요인을 분석하세요.

반드시 아래 JSON 형식으로만 응답하세요. 다른 텍스트 없이 JSON만 출력합니다.

{{
  "key_event": {{
    "name": "가장 중요한 이벤트명 (한국어, 20자 이내)",
    "time": "이벤트 시점 설명 (한국어, 30자 이내)",
    "why": "왜 중요한지 한 줄 (한국어, 쉼표·가운뎃점으로 구분, 40자 이내)"
  }},
  "positive_total": 긍정_합계_숫자,
  "negative_total": 부정_합계_숫자,
  "summary": "총평 한 문장 (한국어, 50자 이내). 단기 구도와 완충재를 언급.",
  "positive_factors": [
    {{"score": 점수, "name": "요인명 (15자 이내)", "desc": "설명 (30자 이내)"}},
    ...
  ],
  "negative_factors": [
    {{"score": 점수, "name": "요인명 (15자 이내)", "desc": "설명 (30자 이내)"}},
    ...
  ]
}}

규칙:
- positive_total + negative_total = 정확히 100
- 긍정 요인 각 score 합계 = positive_total
- 부정 요인 각 score 합계 = negative_total
- 요인 수: 각 3~5개 (중요도 낮으면 억지로 채우지 않음)
- 실제 영향력 기반으로 점수 배분 (기계적 50:50 금지)
- 모든 텍스트 한국어
- 분석/진단형 문체 사용 ("~하세요" 행동 촉구 금지)
- 설명은 짧고 간결하게
"""


def call_gemini(prompt):
    if not GEMINI_API_KEY:
        print("WARNING: GEMINI_API_KEY 없음 — 더미 데이터 반환")
        return None

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.4,
            "responseMimeType": "application/json"
        }
    }

    try:
        resp = requests.post(GEMINI_URL, json=payload, timeout=60)
        resp.raise_for_status()
        data = resp.json()
        text = data["candidates"][0]["content"]["parts"][0]["text"]
        # JSON만 추출 (앞뒤 마크다운 제거)
        text = text.strip()
        text = re.sub(r'^```[a-zA-Z]*\n?', '', text)
        text = re.sub(r'\n?```$', '', text)
        return json.loads(text)
    except requests.exceptions.RequestException as e:
        print(f"ERROR: Gemini API 요청 실패 — {e}")
        return None
    except (KeyError, IndexError, json.JSONDecodeError) as e:
        print(f"ERROR: Gemini 응답 파싱 실패 — {e}")
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

    print("  [3] 뉴스 헤드라인 수집...")
    headlines = fetch_news_headlines()
    print(f"    {len(headlines)}개 헤드라인 수집")
    for h in headlines[:5]:
        print(f"    - {h}")

    # 2. Gemini 분석
    print("  [4] Gemini AI 분석 중...")
    prompt = build_prompt(kst_now, equity_rows, macro_rows, headlines)
    result = call_gemini(prompt)

    if not result:
        print("  ERROR: Gemini 결과 없음 — 스크립트 종료")
        sys.exit(1)

    print(f"  결과: 긍정 {result.get('positive_total')} vs 부정 {result.get('negative_total')}")

    # 3. 항목 생성 + 검증
    entry = build_entry(kst_now, result)
    validate_entry(entry)

    # 4. 기존 데이터 로드 + 신규 항목 추가
    data = load_existing()
    entries = data.get("entries", [])

    # 같은 id가 있으면 덮어씀 (중복 방지)
    entries = [e for e in entries if e.get("id") != entry["id"]]
    entries.insert(0, entry)  # 최신이 맨 앞

    # 최대 10개 유지 (오래된 것 제거)
    entries = entries[:MAX_ENTRIES]

    data["entries"]    = entries
    data["updated_at"] = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    data["max_entries"] = MAX_ENTRIES

    # 5. 저장
    save_data(data)
    print(f"  총 항목 수: {len(entries)}")
    print("=== 완료 ===")


if __name__ == '__main__':
    main()
