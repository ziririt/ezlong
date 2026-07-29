#!/usr/bin/env python3
"""
ATMR 시장 데이터 수집 스크립트 (GitHub Actions용)
yfinance → data/market-signals.json 저장

실행: python scripts/fetch-market-data.py
요구사항: pip install yfinance
"""

import json
import os
import re
import sys
import ssl
import urllib.request
from datetime import datetime, timezone, timedelta

try:
    import yfinance as yf
except ImportError:
    print("ERROR: yfinance 미설치. pip install yfinance 실행 필요.")
    sys.exit(1)

# ─── 설정 ──────────────────────────────────────────────────────────────────
SYMBOLS = ['QQQ', 'VOO', 'TSLA', 'NVDA', 'DIA', 'IWM', 'SOXX']

MACRO_MAP = {
    '^TNX':     ('yield10y',  '미10년물 금리',  '%'),
    '^TYX':     ('yield30y',  '미30년물 금리',  '%'),
    'CL=F':     ('oil',       'WTI 원유',       'USD'),
    'DX-Y.NYB': ('dxy',       '달러인덱스 DXY', ''),
    'GC=F':     ('gold',      '금 Gold',        'USD'),
}

OUTPUT_PATH = os.path.normpath(
    os.path.join(os.path.dirname(__file__), '..', 'data', 'market-signals.json')
)

# ─── Gemini 설정 (스윙 연속성 서술 전용, 2026-07-09 신설) ───────────────────
# 주의: calc_buy_score/calc_sell_score 등 점수 산출 로직에는 절대 관여하지 않는다.
# 이미 계산된 숫자를 "며칠간 어떻게 이어졌는지" 서술하는 용도로만 사용.
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')
GEMINI_MODEL   = 'gemini-2.5-flash-lite'  # 비용 절감 — chart-analysis와 동일 모델 (CLAUDE.md 기준)


# ─── 시장 상태 판단 ────────────────────────────────────────────────────────

def get_is_us_market_open():
    """미국 동부시간 기준 정규장 오픈 여부 (9:30~16:00, 주중)
    pytz 없이 UTC 기반 어림 계산. 서머타임 전환일 ±1일 오차 감수.
    """
    now_utc = datetime.now(timezone.utc)
    if now_utc.weekday() >= 5:  # 토(5), 일(6)
        return False
    # EDT(UTC-4): 3월~11월, EST(UTC-5): 나머지 월
    offset = -4 if 3 <= now_utc.month <= 11 else -5
    et_total_min = ((now_utc.hour + offset) % 24) * 60 + now_utc.minute
    return 570 <= et_total_min < 960  # 9:30 ~ 16:00


# ─── 수학 함수 ─────────────────────────────────────────────────────────────

def calc_sma(closes, period):
    if len(closes) < period:
        return None
    return sum(closes[-period:]) / period

def calc_ema(closes, period):
    if len(closes) < period:
        return []
    k = 2 / (period + 1)
    ema = sum(closes[:period]) / period
    result = [ema]
    for v in closes[period:]:
        ema = v * k + ema * (1 - k)
        result.append(ema)
    return result

def calc_rsi(closes, period=14):
    if len(closes) < period + 1:
        return None
    changes = [closes[i] - closes[i-1] for i in range(1, len(closes))]
    avg_gain = sum(max(0, c) for c in changes[:period]) / period
    avg_loss = sum(max(0, -c) for c in changes[:period]) / period
    for c in changes[period:]:
        avg_gain = (avg_gain * (period - 1) + max(0, c)) / period
        avg_loss = (avg_loss * (period - 1) + max(0, -c)) / period
    if avg_loss == 0:
        return 100.0
    return 100 - 100 / (1 + avg_gain / avg_loss)

def calc_macd(closes, fast=12, slow=26, signal=9):
    if len(closes) < slow + signal:
        return {'macd': 0, 'signal': 0, 'histogram': 0}
    fe = calc_ema(closes, fast)
    se = calc_ema(closes, slow)
    diff = slow - fast
    macd_line = [fe[i + diff] - se[i] for i in range(len(se))]
    sig_line  = calc_ema(macd_line, signal)
    hist      = [macd_line[i + (signal - 1)] - sig_line[i] for i in range(len(sig_line))]
    return {
        'macd':      macd_line[-1] if macd_line else 0,
        'signal':    sig_line[-1]  if sig_line  else 0,
        'histogram': hist[-1]      if hist       else 0,
    }

def get_gear(dev200):
    if dev200 > 2:  return 3
    if dev200 > -2: return 2
    return 1

def r4(v):
    return round(v, 4) if v is not None else None


# ─── ADX(추세강도) — Wilder 스무딩. scripts/generate-chart-analysis.js의 adx()를
# Python으로 그대로 포팅한 것 (2026-07-09, 실데이터 독립 재현 검증 완료). 로직 변경 금지 —
# 두 언어 버전이 어긋나면 calcBuyScore/calcSellScore 두 엔진 간 판단 불일치가 재발한다.
def calc_adx(highs, lows, closes, period=14):
    n = len(closes)
    if n <= period * 2:
        return None

    tr = [0.0] * n
    plus_dm  = [0.0] * n
    minus_dm = [0.0] * n
    for i in range(1, n):
        hl = highs[i] - lows[i]
        hc = abs(highs[i] - closes[i - 1])
        lc = abs(lows[i]  - closes[i - 1])
        tr[i] = max(hl, hc, lc)

        up_move   = highs[i] - highs[i - 1]
        down_move = lows[i - 1] - lows[i]
        plus_dm[i]  = up_move   if (up_move > down_move and up_move > 0)   else 0.0
        minus_dm[i] = down_move if (down_move > up_move and down_move > 0) else 0.0

    def wilder_smooth(arr):
        out = [None] * n
        seed = sum(arr[1:period + 1])
        out[period] = seed
        for i in range(period + 1, n):
            out[i] = out[i - 1] - (out[i - 1] / period) + arr[i]
        return out

    tr_s      = wilder_smooth(tr)
    plus_dm_s = wilder_smooth(plus_dm)
    minus_dm_s = wilder_smooth(minus_dm)

    plus_di  = [None] * n
    minus_di = [None] * n
    dx       = [None] * n
    for i in range(period, n):
        if tr_s[i]:
            plus_di[i]  = 100 * plus_dm_s[i]  / tr_s[i]
            minus_di[i] = 100 * minus_dm_s[i] / tr_s[i]
        else:
            plus_di[i] = 0.0
            minus_di[i] = 0.0
        s = plus_di[i] + minus_di[i]
        dx[i] = 100 * abs(plus_di[i] - minus_di[i]) / s if s else 0.0

    start = period * 2  # ADX 첫 값 = 그 이전 period개 DX의 단순평균
    if n <= start:
        return None
    adx_val = sum(dx[period:start]) / period
    for i in range(start, n):
        adx_val = (adx_val * (period - 1) + dx[i]) / period
    return adx_val

def classify_adx(v):
    if v is None: return None
    if v < 20: return '무추세(충격 가능)'
    if v < 25: return '추세 형성 초기'
    if v < 50: return '뚜렷한 추세'
    return '과열된 추세(소멸 경계)'


# ─── 점수 계산 (JS calcBuyScore / calcSellScore 와 완전 동기화) ─────────────
# 2026-06-16: calc_buy_score 전면 재작성 — JS 버전과 동기화
# 팩터 추가: rsi5d_ago, hist5d_ago, high5d/low5d 패턴, vol_ratio, up_days5

def calc_buy_score(price, sma5, sma50, sma200, rsi, macd, high52, low52, vix=18,
                   rsi5d_ago=None, hist5d_ago=None,
                   high5d=None, low5d=None, high20d_excl=None, low20d_excl=None,
                   vol_ratio=None, up_days5=None, adx=None):
    if not price or not sma200 or not rsi:
        return 50
    score = 0
    dev200 = (price - sma200) / sma200 * 100
    in_uptrend        = dev200 > 0
    in_near_uptrend   = dev200 > -2
    in_strong_uptrend = in_uptrend and sma50 is not None and sma50 > sma200

    # 1. Gear 상태 (0~25pt) — 200일선 기준 대세 판단
    if dev200 > 2:      score += 25
    elif dev200 > -2:   score += 12
    # dev200 ≤ -2: 0pt (하락 추세)

    # 2. RSI 구간 (0~20pt) — 골든크로스 상승장에서 RSI 60~70 = 건강한 모멘텀으로 인정
    if rsi < 30:        score += 20
    elif rsi < 40:      score += 16
    elif rsi < 50:      score += 12
    elif rsi < 60:      score += 8
    elif rsi < 70:
        if in_strong_uptrend:   score += 13
        elif in_uptrend:        score += 10
        else:                   score += 4
    elif rsi < 80:      score += 2
    # RSI ≥ 80: 0pt (극단 과매수)

    # 2a. RSI 모멘텀 보정 (−5~+5pt)
    if rsi5d_ago is not None:
        rsi_delta = rsi - rsi5d_ago
        if rsi > 65 and rsi_delta > 5:              score -= 5   # 고RSI 급등 (최우선 감점)
        elif rsi > 65 and rsi_delta > 3:            score -= 3   # 고RSI 상승 중
        elif rsi5d_ago < 40 and rsi_delta > 3:      score += 5   # 과매도 탈출
        elif rsi5d_ago < 45 and rsi_delta > 3:      score += 3   # 저RSI에서 회복
        elif rsi_delta > 10 and in_uptrend:         score += 4   # 상승장 강한 RSI 모멘텀
        elif rsi_delta > 5  and in_uptrend:         score += 2   # 상승장 RSI 상승
        elif rsi5d_ago > 65 and rsi_delta < -3:     score += 2   # 과매수 냉각

    # 3. 단기 추세 정렬 (0~15pt)
    if sma5:
        dev5 = (price - sma5) / sma5 * 100
        if dev5 < -3:                               score += 15  # 강한 눌림 — 매수 기회
        elif dev5 < -1.5:                           score += 13  # 눌림목
        elif dev5 < 0:                              score += 11  # 약한 눌림
        elif dev5 < 1.5 and in_uptrend:             score += 10  # 5일선 근접 상방, 추세 확인
        elif dev5 < 1.5 and in_near_uptrend:        score += 8   # 200일선 -2% 이내 + 5일선 위
        elif dev5 < 3   and in_uptrend:             score += 8   # 5일선 위, 적당한 모멘텀
        elif dev5 < 3   and in_near_uptrend:        score += 6   # 200일선 근처에서 5일선 위
        elif dev5 < 5   and in_uptrend:             score += 6   # 단기 과도
        elif in_uptrend:                            score += 3   # 5%↑ 이상 과도
        elif in_near_uptrend:                       score += 3   # 200일선 근처
        else:                                       score += 1   # 완전 하락추세 중 5일선 위
    else:
        score += 8

    # 4. 시장 환경 (0~15pt)
    if vix > 35:                                    score += 15
    elif vix > 28:                                  score += 12
    elif vix > 22:                                  score += 9
    elif vix > 17:
        if in_uptrend:          score += 8
        elif in_near_uptrend:   score += 7
        else:                   score += 6
    elif vix > 14:
        if in_strong_uptrend:   score += 11
        elif in_uptrend:        score += 8
        elif in_near_uptrend:   score += 6
        else:                   score += 5
    else:
        if in_strong_uptrend:   score += 6
        elif in_uptrend:        score += 4
        elif in_near_uptrend:   score += 3
        else:                   score += 2

    # 5. MACD 종합 (0~14pt)
    macd_line  = (macd or {}).get('macd', 0) or 0
    hist       = (macd or {}).get('histogram', 0) or 0
    if macd_line > 0:
        if hist > 1:        macd_score = 12
        elif hist > -1:     macd_score = 9
        elif hist > -2:     macd_score = 6
        else:               macd_score = 4
    else:
        if hist < -3:       macd_score = 10  # 깊은 과매도 → 반등 기대
        elif hist < -1:     macd_score = 7
        elif hist < 0:      macd_score = 4
        else:               macd_score = 9   # MACD 음수지만 히스토 양전환 = 골든크로스 직전

    if hist5d_ago is not None:
        hist_delta         = hist - hist5d_ago
        hist_turned_pos    = hist >= 0 and hist5d_ago < 0
        if hist_turned_pos:         macd_score += 3   # 양전환 보너스
        elif hist_delta > 0.5:      macd_score += 2   # 히스토 개선
        elif hist_delta < -0.5:     macd_score -= 2   # 히스토 악화

    score += max(0, min(14, macd_score))

    # 6. 52주 위치 (0~5pt)
    if high52 and low52 and high52 > low52:
        pos52 = (price - low52) / (high52 - low52) * 100
        if pos52 < 20:      score += 5
        elif pos52 < 40:    score += 4
        elif pos52 < 60:    score += 3
        elif pos52 < 80:    score += 1

    # 7. 가격 패턴 ±3pt — Higher Low vs Lower High
    if high5d is not None and low5d is not None and high20d_excl is not None and low20d_excl is not None:
        if low5d > low20d_excl * 1.005:            score += 3   # Higher Low
        elif high5d < high20d_excl * 0.995:        score -= 3   # Lower High

    # 8. 거래량 확인 (0~7pt)
    if vol_ratio is not None:
        if vol_ratio > 1.5:     score += 7
        elif vol_ratio > 1.2:   score += 5
        elif vol_ratio > 0.8:   score += 3
        elif vol_ratio > 0.5:   score += 2
        else:                   score += 1

    # 9. 방향성 팩터 (±4pt) — 최근 5거래일 상승 일수
    if up_days5 is not None:
        if up_days5 >= 4:       score += 4
        elif up_days5 >= 3:     score += 2
        elif up_days5 == 1:     score -= 1
        elif up_days5 == 0:     score -= 3
        # up_days5 == 2: 중립

    # 10. 추세 강도 보정 (ADX) [2026-07-09 신규] — 200일선 위/눌림목 팩터가 만점을 줘도,
    # ADX가 낮으면(무추세) 그건 추세가 아니라 충격성 변동일 수 있다. AI 차트분석 엔진(Gemini)이
    # 이미 이 판단을 하고 있는데 계산식 엔진엔 없어서 두 엔진이 어긋나는 문제(2026-07-09 발견)를 막는다.
    if adx is not None:
        if adx < 20:      score -= 8   # 무추세(충격 가능) — 추세로 확정하기 이르다
        elif adx < 25:    score -= 3   # 추세 형성 초기 — 부분 감점
        # adx >= 25: 보정 없음 (뚜렷한 추세로 인정)

    return min(100, max(0, round(score)))


def calc_sell_score(price, sma5, sma200, rsi, macd, high52, low52, vix=18,
                    rsi5d_ago=None, hist5d_ago=None,
                    high5d=None, low5d=None, high20d_excl=None, low20d_excl=None,
                    adx=None):
    if not price or not sma200 or not rsi:
        return 50
    score = 0
    dev200 = (price - sma200) / sma200 * 100

    if dev200 > 20:     score += 25
    elif dev200 > 12:   score += 20
    elif dev200 > 6:    score += 13
    elif dev200 > 2:    score += 7
    elif dev200 > -2:   score += 2

    if rsi > 80:        score += 30
    elif rsi > 75:      score += 24
    elif rsi > 70:      score += 17
    elif rsi > 65:      score += 10
    elif rsi > 60:      score += 4

    if rsi5d_ago is not None:
        rsi_delta = rsi - rsi5d_ago
        if rsi5d_ago >= 65 and rsi_delta > 3:      score += 5
        elif rsi5d_ago >= 60 and rsi_delta > 3:    score += 3
        elif rsi5d_ago >= 65 and rsi_delta < -3:   score -= 3
        elif rsi < 40 and rsi_delta < -5:          score -= 5

    if sma5:
        dev5 = (price - sma5) / sma5 * 100
        if dev5 > 4:        score += 20
        elif dev5 > 2.5:    score += 16
        elif dev5 > 1.5:    score += 11
        elif dev5 > 0.5:    score += 6
    else:
        score += 8

    if vix < 13:    score += 12
    elif vix < 15:  score += 9
    elif vix < 18:  score += 6
    elif vix < 22:  score += 3

    hist = (macd or {}).get('histogram', 0) or 0
    if hist > 3:        score += 8
    elif hist > 1.5:    score += 6
    elif hist > 0:      score += 3

    if hist5d_ago is not None:
        hist_delta = hist - hist5d_ago
        if hist_delta > 0.5:        score += 3
        elif hist_delta < -0.5:     score -= 2

    if high52 and low52 and high52 > low52:
        pos52 = (price - low52) / (high52 - low52) * 100
        if pos52 > 90:      score += 5
        elif pos52 > 80:    score += 4
        elif pos52 > 70:    score += 3
        elif pos52 > 60:    score += 1

    if high5d is not None and low5d is not None and high20d_excl is not None and low20d_excl is not None:
        if high5d < high20d_excl * 0.995:      score += 3   # Lower High
        elif low5d > low20d_excl * 1.005:      score -= 3   # Higher Low

    # 추세 강도 보정 (ADX) [2026-07-09 신규] — calc_buy_score와 대칭 적용.
    # 무추세 구간에서는 매도 쪽 확신도 같이 낮춘다 (한쪽만 낮추면 반대쪽으로 왜곡되어 재발한다).
    if adx is not None:
        if adx < 20:      score -= 8
        elif adx < 25:    score -= 3

    return min(100, max(0, round(score)))


# ─── yfinance 데이터 수집 ───────────────────────────────────────────────────

def download_history(symbol, period='2y'):
    """종목 종가·거래량·고가·저가 리스트 반환 (날짜 오름차순)
    Close NaN 행 제거 후 나머지 컬럼도 동일 행만 유지 → 모두 동일 길이·동일 날짜.
    High/Low는 2026-07-09 ADX(추세강도) 계산용으로 추가 — 기존 closes/volumes 순서는 그대로 유지해
    기존 호출부(download_closes 등) 하위호환 깨지지 않게 한다.
    """
    ticker = yf.Ticker(symbol)
    hist = ticker.history(period=period, interval='1d', auto_adjust=True)
    if hist.empty:
        raise ValueError("빈 응답")
    df = hist[['Close', 'Volume', 'High', 'Low']].copy()
    df = df.dropna(subset=['Close'])        # Close NaN 행 제거
    df['Volume'] = df['Volume'].fillna(0)   # Volume NaN → 0 (날짜 유지)
    closes  = [float(v) for v in df['Close'].tolist()]
    volumes = [float(v) for v in df['Volume'].tolist()]
    highs   = [float(v) for v in df['High'].tolist()]
    lows    = [float(v) for v in df['Low'].tolist()]
    if len(closes) < 2:
        raise ValueError(f"데이터 부족: {len(closes)}개")
    return closes, volumes, highs, lows

def download_closes(symbol, period='2y'):
    """종목 종가 리스트만 반환 (VIX·매크로·지수 전용)"""
    closes, _, _, _ = download_history(symbol, period)
    return closes

def download_price(symbol):
    """현재가·등락률만 반환 (단기 5일치)"""
    try:
        closes = download_closes(symbol, period='5d')
        if len(closes) < 2:
            return None
        price = closes[-1]
        prev  = closes[-2]
        change = price - prev
        chg_pct = change / prev * 100 if prev else 0
        return {'price': r4(price), 'change': r4(change), 'changePct': r4(chg_pct)}
    except Exception as e:
        print(f"  [yf] {symbol} 실패: {e}")
        return None


# ─── 종목 처리 ─────────────────────────────────────────────────────────────

def process_symbol(closes, volumes, highs, lows, symbol, vix_price):
    price = closes[-1]
    prev  = closes[-2]
    change  = price - prev
    chg_pct = change / prev * 100 if prev else 0

    sma5   = calc_sma(closes, 5)
    sma20  = calc_sma(closes, 20)
    sma50  = calc_sma(closes, 50)
    sma200 = calc_sma(closes, min(200, len(closes)))
    rsi    = calc_rsi(closes, 14)
    macd   = calc_macd(closes)

    tail252 = closes[-252:] if len(closes) >= 252 else closes
    high52  = max(tail252)
    low52   = min(tail252)

    dev200 = (price - sma200) / sma200 * 100 if sma200 else 0
    dev5   = (price - sma5)   / sma5   * 100 if sma5   else 0
    dev20  = (price - sma20)  / sma20  * 100 if sma20  else 0
    gear   = get_gear(dev200)
    vix    = vix_price or 18

    # ── 추가 팩터 계산 (2026-06-16 신규) ──────────────────────────────────
    rsi5d_ago    = calc_rsi(closes[:-5], 14)               if len(closes) > 20 else None
    macd5d       = calc_macd(closes[:-5])                  if len(closes) > 35 else None
    hist5d_ago   = macd5d.get('histogram') if macd5d else None
    high5d       = max(closes[-5:])                        if len(closes) >= 5  else None
    low5d        = min(closes[-5:])                        if len(closes) >= 5  else None
    high20d_excl = max(closes[-20:-5])                     if len(closes) > 20  else None
    low20d_excl  = min(closes[-20:-5])                     if len(closes) > 20  else None

    up_days5 = None
    if len(closes) > 6:
        tail6    = closes[-6:]
        up_days5 = sum(1 for i in range(1, 6) if tail6[i] > tail6[i - 1])

    vol_ratio = None
    if volumes and len(volumes) >= 21:
        latest_vol = volumes[-1]
        vol20_avg  = sum(volumes[-21:-1]) / 20
        if vol20_avg > 1000:
            vol_ratio = latest_vol / vol20_avg

    # ADX(추세강도) [2026-07-09 신규]
    adx_val = calc_adx(highs, lows, closes, 14) if highs and lows else None

    return {
        'symbol':       symbol,
        'price':        r4(price),
        'change':       r4(change),
        'changePct':    r4(chg_pct),
        'sma5':         r4(sma5),
        'sma20':        r4(sma20),
        'sma50':        r4(sma50),
        'sma200':       r4(sma200),
        'rsi':          round(rsi, 2) if rsi is not None else None,
        'macd':         {k: r4(v) for k, v in macd.items()},
        'high52':       r4(high52),
        'low52':        r4(low52),
        'dev200':       r4(dev200),
        'dev5':         r4(dev5),
        'dev20':        r4(dev20),
        'gear':         gear,
        'vix':          vix,
        # 추가 팩터
        'rsi5dAgo':     r4(rsi5d_ago),
        'hist5dAgo':    r4(hist5d_ago),
        'high5d':       r4(high5d),
        'low5d':        r4(low5d),
        'high20dExcl':  r4(high20d_excl),
        'low20dExcl':   r4(low20d_excl),
        'volRatio':     r4(vol_ratio),
        'upDays5':      up_days5,
        'adx':          r4(adx_val),
        'adxStatus':    classify_adx(adx_val),
        # 점수
        'buyScore':  calc_buy_score(
            price, sma5, sma50, sma200, rsi, macd, high52, low52, vix,
            rsi5d_ago, hist5d_ago, high5d, low5d, high20d_excl, low20d_excl,
            vol_ratio, up_days5, adx_val
        ),
        'sellScore': calc_sell_score(
            price, sma5, sma200, rsi, macd, high52, low52, vix,
            rsi5d_ago, hist5d_ago, high5d, low5d, high20d_excl, low20d_excl,
            adx_val
        ),
        'extPrice':      None,
        'extChange':     None,
        'extChangePct':  None,
        'isMarketOpen':  get_is_us_market_open(),
        # 최근 5거래일 일봉 변동률 — [0]=오늘, [1]=어제, [2]=2일전, ...
        'recentDailyReturns': [
            round((closes[-(i+1)] - closes[-(i+2)]) / closes[-(i+2)] * 100, 2)
            if len(closes) > i + 1 and closes[-(i+2)] != 0 else None
            for i in range(5)
        ],
    }


# ─── CNN Fear & Greed ───────────────────────────────────────────────────────

def fetch_fear_and_greed():
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE

    endpoints = [
        'https://production.dataviz.cnn.io/index/fearandgreed/graphdata',
        'https://production.dataviz.cnn.io/index/fearandgreed/graphdata/',
    ]
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept':     'application/json',
        'Referer':    'https://www.cnn.com/markets/fear-and-greed',
        'Origin':     'https://www.cnn.com',
    }
    for url in endpoints:
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=12, context=ctx) as resp:
                data = json.loads(resp.read().decode())
            fg = data.get('fear_and_greed', {})
            if fg and isinstance(fg.get('score'), (int, float)):
                print(f"  [F&G] 성공: score={round(fg['score'])}")
                def rnd(v): return round(v) if v is not None else None
                return {
                    'score':      round(fg['score']),
                    'rating':     fg.get('rating'),
                    'prevClose':  rnd(fg.get('previous_close')),
                    'prev1Week':  rnd(fg.get('previous_1_week')),
                    'prev1Month': rnd(fg.get('previous_1_month')),
                    'timestamp':  fg.get('timestamp', datetime.now(timezone.utc).isoformat()),
                }
        except Exception as e:
            print(f"  [F&G] {url} 실패: {e}")

    print("  [F&G] 모든 엔드포인트 실패")
    return None


# ─── 스윙 연속성 서술 (Gemini, 2026-07-09 신설) ─────────────────────────────
# chart-analysis 파이프라인의 judgment ledger continuity와 같은 목적:
# "오늘 처음 보는 것처럼" 매일 스냅샷만 보여주던 스윙 시그널 화면에
# 최근 며칠 흐름을 종합한 서술을 붙인다. 점수 산출 로직(calc_buy_score 등)은
# 절대 건드리지 않는다 — 이미 계산된 숫자만 서술 재료로 넘긴다.

def _qqq_score_history_lines(previous_signals, today_qqq):
    """previousSignals(최신이 맨 앞)에서 날짜별 '가장 최근' QQQ 스냅샷만 추려
    오래된 날짜 → 최근 날짜 순으로 최대 4일 + 오늘(today_qqq) 리스트 반환."""
    by_date = {}
    # 오래된 것부터 순회하며 덮어써서, 같은 날짜는 그날의 마지막(가장 최근) 값만 남긴다.
    for s in reversed(previous_signals):
        d = (s.get('atKST') or '')[:10]
        q = s.get('qqq') or {}
        if d and isinstance(q.get('buyScore'), (int, float)):
            by_date[d] = q
    days = list(by_date.items())[-4:]
    today_kst = (datetime.now(timezone.utc) + timedelta(hours=9)).strftime('%Y-%m-%d')
    if today_qqq is not None and today_qqq.get('buyScore') is not None:
        days = [d for d in days if d[0] != today_kst] + [(today_kst, today_qqq)]
    lines = []
    for d, q in days:
        label = '오늘' if d == today_kst else d[5:]
        lines.append(
            f"{label}: 매수점수 {q.get('buyScore')} · 매도점수 {q.get('sellScore')} · "
            f"RSI {q.get('rsi')} · Gear {q.get('gear')}"
        )
    return lines


def generate_swing_continuity(processed, previous_signals, fg_data):
    """실패해도 파이프라인 전체를 절대 중단시키지 않는다 — None 반환 시
    프런트엔드가 기존 방식(숫자 나열)으로 조용히 폴백한다."""
    if not GEMINI_API_KEY:
        print("  [swingContinuity] GEMINI_API_KEY 없음 — 건너뜀")
        return None
    try:
        qqq = processed.get('QQQ')
        if not qqq:
            return None
        today_qqq = {
            'rsi': qqq.get('rsi'), 'buyScore': qqq.get('buyScore'),
            'sellScore': qqq.get('sellScore'), 'gear': qqq.get('gear'),
        }
        history_lines = _qqq_score_history_lines(previous_signals, today_qqq)
        if len(history_lines) < 2:
            print("  [swingContinuity] 히스토리 부족(초기 실행 등) — 건너뜀")
            return None

        def fmt_returns(sym):
            d = processed.get(sym)
            if not d:
                return f"{sym}: 데이터 없음"
            arr = d.get('recentDailyReturns') or []
            # arr[0]=오늘 ... 과거→오늘 순으로 보이게 뒤집는다
            vals = ' → '.join(
                (f"{v:+.2f}%" if v is not None else 'N/A') for v in reversed(arr)
            )
            return f"{sym}: {vals}"

        returns_lines = [fmt_returns(s) for s in ['QQQ', 'SOXX', 'TSLA', 'NVDA']]

        prompt = (
            "너는 15년 경력 스윙 트레이더다. 아래 데이터만 근거로 "
            "\"최근 며칠 흐름이 오늘 시그널로 어떻게 이어졌는지\" 딱 2~3문장으로 서술하라.\n\n"
            "[QQQ 매수/매도 점수 최근 흐름 — 날짜별]\n"
            + "\n".join(history_lines) + "\n\n"
            "[최근 5거래일 일봉 등락률 — 과거→오늘 순]\n"
            + "\n".join(returns_lines) + "\n\n"
            f"[참고] VIX: {qqq.get('vix')} · Fear&Greed: {fg_data.get('score') if fg_data else 'N/A'}\n\n"
            "절대 규칙:\n"
            "- 위에 주어진 숫자만 사용하라. 새로운 숫자를 지어내지 마라.\n"
            "- \"~하세요\", \"~하십시오\" 같은 명령형 금지. \"~구간\", \"~권고\", \"~흐름\" 같은 진단형 표현만 사용.\n"
            "- 오늘 점수가 며칠 전과 비교해 개선/악화/유지 중 무엇인지 반드시 언급하라.\n"
            "- 종목 간 온도차가 있으면(예: 반도체만 유독 약세) 그 차이를 짚어라.\n"
            "- 마크다운 금지.\n\n"
            "[영어 병기 — 2026-07-29 신설]\n"
            "- en 필드에 ko와 완전히 같은 판단·같은 숫자를 자연스러운 영어로 다시 써라. "
            "직역이 아니라 미국 개인 투자자가 읽는 톤으로 재작성하되 결론은 절대 다르게 쓰지 마라.\n"
            "- 티커·숫자는 그대로 유지.\n\n"
            "다음 JSON만 반환하라. 다른 텍스트는 절대 붙이지 마라:\n"
            "{\"ko\": \"한국어 2~3문장\", \"en\": \"English 2-3 sentences\"}"
        )

        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": 0.3,
                "maxOutputTokens": 1024,
                "responseMimeType": "application/json",
                "thinkingConfig": {"thinkingBudget": 0},
            },
        }
        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{GEMINI_MODEL}:generateContent?key={GEMINI_API_KEY}"
        )
        req = urllib.request.Request(
            url,
            data=json.dumps(payload).encode('utf-8'),
            headers={'Content-Type': 'application/json'},
            method='POST',
        )
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read().decode('utf-8'))

        parts = (((data.get('candidates') or [{}])[0]).get('content') or {}).get('parts') or []
        text = ''.join(p.get('text', '') for p in parts if not p.get('thought')).strip()
        if not text:
            print("  [swingContinuity] Gemini 빈 응답 — 건너뜀")
            return None
        # 2026-07-29: 응답이 {"ko":..., "en":...} JSON으로 바뀜 — ko/en 동시 파싱.
        # 파싱 실패(구모델이 실수로 순수 텍스트를 낸 경우 등) 시 그 텍스트를 ko로만 사용하고
        # en은 없는 채로 진행 — 프런트엔드(한국어판)는 기존과 동일하게 동작, 영어판만 결손.
        try:
            m = re.search(r'\{[\s\S]*\}', text)
            parsed = json.loads(m.group(0) if m else text)
            ko_text = (parsed.get('ko') or '').strip()
            en_text = (parsed.get('en') or '').strip()
            if not ko_text:
                print("  [swingContinuity] ko 필드 비어있음 — 건너뜀")
                return None
            print(f"  [swingContinuity] 생성 완료 (ko {len(ko_text)}자 / en {len(en_text)}자)")
            return {'ko': ko_text, 'en': en_text or None}
        except (json.JSONDecodeError, AttributeError):
            print("  [swingContinuity] JSON 파싱 실패 — 원문을 ko로만 사용(en 없음)")
            return {'ko': text, 'en': None}
    except Exception as e:
        print(f"  [swingContinuity] 실패(무시하고 계속 진행): {e}")
        return None


# ─── 메인 ───────────────────────────────────────────────────────────────────

def main():
    print(f"\n=== ATMR 데이터 수집 시작 ({datetime.now(timezone.utc).isoformat()}) ===\n")
    print("데이터 소스: yfinance (Yahoo Finance)\n")

    processed   = {}
    error_count = 0

    # ── 1. VIX ──────────────────────────────────────────────────────────
    vix_price = 18.0
    vix_entry = None
    print("--- VIX 변동성 지수 수집 ---")
    try:
        vc = download_closes('^VIX', period='5d')
        vix_price = vc[-1]
        prev_vix  = vc[-2]
        vix_chg   = vix_price - prev_vix
        vix_pct   = vix_chg / prev_vix * 100 if prev_vix else 0
        vix_entry = {'price': r4(vix_price), 'change': r4(vix_chg), 'changePct': r4(vix_pct)}
        print(f"  ^VIX: {vix_price:.2f} ({'+' if vix_chg >= 0 else ''}{vix_pct:.2f}%)")
    except Exception as e:
        print(f"  VIX 수집 실패: {e}. 기본값 {vix_price} 사용.")

    # ── 2. 종목별 히스토리 ─────────────────────────────────────────────
    print(f"\n--- 종목별 히스토리 수집 (yfinance, 2년치) ---")
    for i, sym in enumerate(SYMBOLS):
        try:
            print(f"[{i+1}/{len(SYMBOLS)}] {sym} 수집 중...")
            closes, volumes, highs, lows = download_history(sym, period='2y')
            closes  = closes[-504:]   # 최근 2년치
            volumes = volumes[-504:]
            highs   = highs[-504:]
            lows    = lows[-504:]
            processed[sym] = process_symbol(closes, volumes, highs, lows, sym, vix_price)
            d = processed[sym]
            rsi_str    = f"{d['rsi']:.1f}"    if d['rsi']    is not None else '-'
            sma200_str = f"{d['sma200']:.2f}" if d['sma200'] is not None else '-'
            vol_str    = f"{d['volRatio']:.2f}" if d['volRatio'] is not None else '-'
            print(f"  → ${d['price']:.2f}, RSI {rsi_str}, SMA200 {sma200_str}, "
                  f"Gear {d['gear']}, VolRatio {vol_str}, upDays5 {d['upDays5']}, "
                  f"매수 {d['buyScore']}, 매도 {d['sellScore']}")
        except Exception as e:
            print(f"  → ERROR: {e}")
            error_count += 1

    # VIX processed 추가
    if vix_entry:
        processed['VIX'] = {
            'symbol': 'VIX', **vix_entry, 'vix': r4(vix_price),
            'buyScore': None, 'sellScore': None,
            'sma5': None, 'sma20': None, 'sma50': None, 'sma200': None,
            'rsi': None, 'macd': None, 'high52': None, 'low52': None,
            'dev200': None, 'dev5': None, 'gear': None,
        }

    # ── 3. 지수 ────────────────────────────────────────────────────────
    print("\n--- 나스닥100 / S&P500 지수 수집 ---")
    ndx_data  = download_price('^IXIC')
    gspc_data = download_price('^GSPC')
    if ndx_data:
        print(f"  ^IXIC: {ndx_data['price']:,.2f} ({'+' if ndx_data['changePct'] >= 0 else ''}{ndx_data['changePct']:.2f}%)")
    if gspc_data:
        print(f"  ^GSPC: {gspc_data['price']:,.2f} ({'+' if gspc_data['changePct'] >= 0 else ''}{gspc_data['changePct']:.2f}%)")

    # ── 4. CNN F&G ─────────────────────────────────────────────────────
    print("\n--- CNN Fear & Greed Index 수집 ---")
    fg_data = fetch_fear_and_greed()
    if fg_data:
        print(f"  Fear & Greed: {fg_data['score']} ({fg_data['rating']}) | 전일 {fg_data.get('prevClose','-')}, 1주전 {fg_data.get('prev1Week','-')}, 1개월전 {fg_data.get('prev1Month','-')}")

    # ── 5. 매크로 ──────────────────────────────────────────────────────
    print("\n--- 매크로 지표 수집 (국채금리·원유·달러·금) ---")
    macro_data = {}
    for sym, (key, label, unit) in MACRO_MAP.items():
        raw = download_price(sym)
        if raw:
            macro_data[key] = {**raw, 'symbol': sym, 'label': label, 'unit': unit}
            print(f"  {label}: {raw['price']:.2f}{unit} ({'+' if raw['changePct'] >= 0 else ''}{raw['changePct']:.2f}%)")

    # ── 6. 저장 ────────────────────────────────────────────────────────
    now = datetime.now(timezone.utc)
    kst = now + timedelta(hours=9)
    kst_str = kst.strftime('%Y-%m-%d %H:%M')

    HISTORY_MAX = 144
    previous_signals = []
    if os.path.exists(OUTPUT_PATH):
        try:
            with open(OUTPUT_PATH, 'r') as f:
                existing = json.load(f)
            previous_signals = existing.get('previousSignals', [])
            qqq  = existing.get('symbols', {}).get('QQQ')
            soxx = existing.get('symbols', {}).get('SOXX')
            if qqq:
                snapshot = {
                    'at':    existing.get('generatedAt'),
                    'atKST': existing.get('generatedAtKST'),
                    'qqq': {
                        'rsi':       qqq.get('rsi'),
                        'macdHist':  (qqq.get('macd') or {}).get('histogram'),
                        'dev5':      qqq.get('dev5'),
                        'dev200':    qqq.get('dev200'),
                        'gear':      qqq.get('gear'),
                        'buyScore':  qqq.get('buyScore'),
                        'sellScore': qqq.get('sellScore'),
                        'price':     qqq.get('price'),
                    },
                    'soxxMacdHist': ((soxx or {}).get('macd') or {}).get('histogram'),
                    'fearAndGreed': (existing.get('fearAndGreed') or {}).get('score'),
                    'yield10y':     ((existing.get('macro') or {}).get('yield10y') or {}).get('price'),
                }
                previous_signals.insert(0, snapshot)
            if len(previous_signals) > HISTORY_MAX:
                previous_signals = previous_signals[:HISTORY_MAX]
            print(f"\n  히스토리 스냅샷 저장: {len(previous_signals)}개 (최대 {HISTORY_MAX}개)")
        except Exception as e:
            print(f"  이전 데이터 읽기 실패: {e}")

    # ── 6.5. 스윙 연속성 서술 (실패해도 무시하고 계속) ──────────────────
    print("\n--- 스윙 연속성 서술 생성 (Gemini) ---")
    _continuity = generate_swing_continuity(processed, previous_signals, fg_data)
    # 2026-07-29: generate_swing_continuity가 {'ko':..., 'en':...} dict 또는 None을 반환하도록
    # 변경됨. swingContinuity(ko) 키 이름·값 형식은 기존과 완전히 동일하게 유지 —
    # atmr-dashboard.html이 이 값을 그대로 innerHTML에 꽂는 기존 코드를 건드리지 않기 위함.
    # swingContinuityEn은 신규 키 — en/atmr-dashboard.html 전용.
    swing_continuity = _continuity.get('ko') if _continuity else None
    swing_continuity_en = _continuity.get('en') if _continuity else None

    output = {
        'generatedAt':    now.isoformat(),
        'generatedAtKST': kst_str + ' KST',
        'symbolCount':    len(processed),
        'errorCount':     error_count,
        'dataSource':     'yfinance',
        'symbols':        processed,
        'indices':  {'NDX': ndx_data, 'GSPC': gspc_data},
        'fearAndGreed':   fg_data,
        'macro':          macro_data if macro_data else None,
        'previousSignals': previous_signals,
        'swingContinuity': swing_continuity,
        'swingContinuityEn': swing_continuity_en,
    }

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, 'w') as f:
        json.dump(output, f, indent=2)

    print(f"\n=== 완료: {OUTPUT_PATH} ({len(processed)}개 종목) ===")
    print(f"=== 생성 시각: {kst_str} KST ===\n")

    if error_count == len(SYMBOLS):
        print("모든 종목 수집 실패. GitHub Actions 로그를 확인하세요.")
        sys.exit(1)


if __name__ == '__main__':
    main()
