#!/usr/bin/env python3
"""
ATMR 시장 데이터 수집 스크립트 (GitHub Actions용)
yfinance → data/market-signals.json 저장

실행: python scripts/fetch-market-data.py
요구사항: pip install yfinance
"""

import json
import os
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

def calc_buy_score(price, sma5, sma200, rsi, macd_hist, high52, low52, vix=18):
    if not price or not sma200 or not rsi: return 50
    score = 0
    dev200 = (price - sma200) / sma200 * 100
    if   dev200 > 2:  score += 25
    elif dev200 > -2: score += 12
    if   rsi < 30: score += 25
    elif rsi < 40: score += 20
    elif rsi < 50: score += 14
    elif rsi < 60: score += 8
    elif rsi < 70: score += 3
    if sma5:
        dev5 = (price - sma5) / sma5 * 100
        if   dev5 < -3:   score += 20
        elif dev5 < -1.5: score += 16
        elif dev5 < 0:    score += 11
        elif dev5 < 1.5:  score += 6
        else:             score += 2
    else: score += 10
    if   vix > 35: score += 15
    elif vix > 28: score += 12
    elif vix > 22: score += 8
    elif vix > 17: score += 5
    else:          score += 1
    h = macd_hist or 0
    if   h < -2: score += 10
    elif h < 0:  score += 7
    elif h < 1:  score += 4
    elif h < 3:  score += 2
    if high52 and low52 and high52 > low52:
        pos52 = (price - low52) / (high52 - low52) * 100
        if   pos52 < 20: score += 5
        elif pos52 < 40: score += 4
        elif pos52 < 60: score += 3
        elif pos52 < 80: score += 1
    return min(100, max(0, round(score)))

def calc_sell_score(price, sma5, sma200, rsi, macd_hist, high52, low52, vix=18):
    if not price or not sma200 or not rsi: return 50
    score = 0
    dev200 = (price - sma200) / sma200 * 100
    if   dev200 > 20: score += 25
    elif dev200 > 12: score += 20
    elif dev200 > 6:  score += 13
    elif dev200 > 2:  score += 7
    elif dev200 > -2: score += 2
    if   rsi > 80: score += 30
    elif rsi > 75: score += 24
    elif rsi > 70: score += 17
    elif rsi > 65: score += 10
    elif rsi > 60: score += 4
    if sma5:
        dev5 = (price - sma5) / sma5 * 100
        if   dev5 > 4:   score += 20
        elif dev5 > 2.5: score += 16
        elif dev5 > 1.5: score += 11
        elif dev5 > 0.5: score += 6
    else: score += 8
    if   vix < 13: score += 12
    elif vix < 15: score += 9
    elif vix < 18: score += 6
    elif vix < 22: score += 3
    h = macd_hist or 0
    if   h > 3:   score += 8
    elif h > 1.5: score += 6
    elif h > 0:   score += 3
    if high52 and low52 and high52 > low52:
        pos52 = (price - low52) / (high52 - low52) * 100
        if   pos52 > 90: score += 5
        elif pos52 > 80: score += 4
        elif pos52 > 70: score += 3
        elif pos52 > 60: score += 1
    return min(100, max(0, round(score)))

def r4(v):
    return round(v, 4) if v is not None else None


# ─── yfinance 데이터 수집 ───────────────────────────────────────────────────

def download_closes(symbol, period='2y'):
    """종목 종가 리스트 반환 (날짜 오름차순)"""
    ticker = yf.Ticker(symbol)
    hist = ticker.history(period=period, interval='1d', auto_adjust=True)
    if hist.empty:
        raise ValueError(f"빈 응답")
    closes = [float(v) for v in hist['Close'].dropna().tolist()]
    if len(closes) < 10:
        raise ValueError(f"데이터 부족: {len(closes)}개")
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

def process_symbol(closes, symbol, vix_price):
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
    mh     = macd.get('histogram', 0)

    return {
        'symbol':    symbol,
        'price':     r4(price),
        'change':    r4(change),
        'changePct': r4(chg_pct),
        'sma5':      r4(sma5),
        'sma20':     r4(sma20),
        'sma50':     r4(sma50),
        'sma200':    r4(sma200),
        'rsi':       round(rsi, 2) if rsi is not None else None,
        'macd':      {k: r4(v) for k, v in macd.items()},
        'high52':    r4(high52),
        'low52':     r4(low52),
        'dev200':    r4(dev200),
        'dev5':      r4(dev5),
        'dev20':     r4(dev20),
        'gear':      gear,
        'vix':       vix,
        'buyScore':  calc_buy_score(price, sma5, sma200, rsi, mh, high52, low52, vix),
        'sellScore': calc_sell_score(price, sma5, sma200, rsi, mh, high52, low52, vix),
        'extPrice':      None,
        'extChange':     None,
        'extChangePct':  None,
        'isMarketOpen':  False,
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
            closes = download_closes(sym, period='2y')
            closes = closes[-504:]  # 최근 2년치
            processed[sym] = process_symbol(closes, sym, vix_price)
            d = processed[sym]
            rsi_str = f"{d['rsi']:.1f}" if d['rsi'] is not None else '-'
            print(f"  → ${d['price']:.2f}, RSI {rsi_str}, SMA200 {d['sma200']:.2f if d['sma200'] else '-'}, Gear {d['gear']}, 매수 {d['buyScore']}, 매도 {d['sellScore']}")
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
