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
GEMINI_MODEL       = 'gemini-2.5-flash'                # 1차 시도 (GA, 고품질 — 2026-06-25 확정)
GEMINI_MODEL_FALLBACK = 'gemini-1.5-flash'             # 폴백 — gemini-2.0-flash는 v1beta 404 확인, 1.5-flash로 변경

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

=== 데이터 시점 안내 (분석 전 반드시 숙지) ===
- 가격 데이터 중 [프리/시간외] 표시가 없는 항목은 직전 미국 정규장 종가 기준
- [프리/시간외] 표시 항목은 현재 프리마켓 또는 시간외 실시간 가격
- 뉴스 헤드라인은 가장 최신 정보를 담고 있으며 프리마켓 동향을 반영
- 가격 데이터와 뉴스가 서로 다른 방향을 가리킬 때: 뉴스 헤드라인을 현재 시장 판단의 1차 기준으로 사용
- 예시: 가격은 전일 하락이지만 뉴스에서 "Futures Jump", "premarket surge", "어닝 서프라이즈" 언급 → 현재 긍정 신호로 분류

=== 현재 시장 데이터 ===
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
- "인플레이션 우려 완화"를 desc에 적으면서 negative_factors에 넣는 것은 절대 금지
- VIX 하락 → 긍정(positive), VIX 상승 → 부정(negative)
- 국채금리 하락 → 성장주/기술주 긍정, 국채금리 상승 → 성장주 부정
- 달러 강세 → 미국 수출주/신흥국 자금 유출 우려 → 부정
- 달러 약세 → 수출주 실적 개선, 원자재 지지 → 긍정
- 지정학적 리스크 완화 → 긍정, 지정학적 긴장 고조 → 부정
- desc에 쓴 인과관계 방향이 긍정/부정 분류와 반드시 일치해야 함

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


def _call_single_model(model, payload, max_retries=3):
    """단일 모델로 최대 max_retries회 시도. 성공 시 dict 반환, 실패 시 None."""
    url = _gemini_url(model)
    wait_secs = [15, 30, 60]

    for attempt in range(max_retries):
        try:
            resp = requests.post(url, json=payload, timeout=60)
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
                wait = wait_secs[attempt]
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

    # 공통 payload — thinkingConfig 제거 (v1beta 400 오류 원인)
    # thinking 토큰은 _call_single_model 내부 parts 루프로 처리
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.4,
            "responseMimeType": "application/json"
        }
    }

    # 1차: gemini-2.5-flash (3회 재시도)
    print(f"  1차 시도: {GEMINI_MODEL}")
    result = _call_single_model(GEMINI_MODEL, payload, max_retries=3)
    if result:
        print(f"  성공: {GEMINI_MODEL}")
        return result

    # 폴백: gemini-1.5-flash (2회 재시도) — gemini-2.0-flash는 v1beta 404
    print(f"  폴백 전환: {GEMINI_MODEL_FALLBACK}")
    result = _call_single_model(GEMINI_MODEL_FALLBACK, payload, max_retries=2)
    if result:
        print(f"  성공(폴백): {GEMINI_MODEL_FALLBACK}")
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
