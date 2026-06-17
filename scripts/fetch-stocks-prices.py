#!/usr/bin/env python3
"""
실시간 주가 수집 — Massive REST API (구 Polygon.io)
stocks-prices.json 에 현재가·등락률만 저장 (스파크라인 없음)
GitHub Actions에서 10분마다 실행 → 최대 10분 시차

환경변수: MASSIVE_API_KEY
실행: python3 scripts/fetch-stocks-prices.py
"""

import json
import os
import sys
import time
import urllib.request
import urllib.parse
from datetime import datetime, timezone, timedelta

# ─── API 설정 ─────────────────────────────────────────────────────────────────
MASSIVE_API_KEY = os.environ.get('MASSIVE_API_KEY', '')
BASE_URL = 'https://api.massive.com'

OUTPUT_PATH = os.path.normpath(
    os.path.join(os.path.dirname(__file__), '..', 'data', 'stocks-prices.json')
)

# ─── 수집 대상 심볼 ────────────────────────────────────────────────────────────
# stocks-data.json 과 동일한 종목 전체 (중복 제거)
US_TOP100 = [
    'NVDA', 'AAPL', 'SPCX', 'MSFT', 'AMZN', 'GOOGL', 'META', 'TSLA', 'BRK-B', 'AVGO',
    'LLY',  'JPM',  'UNH', 'V',    'XOM',  'MA',   'COST', 'PG',  'JNJ',  'HD',
    'NFLX', 'ABBV', 'BAC', 'WMT',  'MRK',  'KO',   'CVX',  'ASML','ORCL', 'AMD',
    'CRM',  'ADBE', 'TMO', 'ACN',  'LIN',  'MCD',  'CSCO', 'ABT', 'GE',   'INTU',
    'IBM',  'NOW',  'AMGN','ISRG', 'PM',   'DHR',  'TXN',  'QCOM','SPGI', 'BKNG',
    'AMAT', 'GS',   'CAT', 'TSM',  'BLK',  'AXP',  'VRTX', 'REGN','SYK',  'T',
    'MS',   'RTX',  'GILD','BSX',  'ETN',  'PLD',  'DE',   'ADI', 'LRCX', 'MU',
    'KLAC', 'NEE',  'CB',  'SCHW', 'COP',  'EOG',  'PGR',  'ADP', 'UPS',  'TJX',
    'ICE',  'PANW', 'LOW', 'CME',  'CI',   'C',    'BMY',  'ZTS', 'ELV',  'WM',
    'CVS',  'BA',   'HON', 'SO',   'ARM',  'PLTR', 'MELI', 'CRWD','APP',  'MMC',
]

NASDAQ100 = [
    'NVDA', 'AAPL', 'SPCX', 'MSFT', 'AMZN', 'META', 'TSLA', 'AVGO', 'GOOGL', 'GOOG',
    'NFLX', 'ASML', 'AMD',  'ADBE', 'CSCO', 'TMUS', 'PEP',  'QCOM', 'INTU', 'CMCSA',
    'TXN',  'HON',  'AMGN', 'ISRG', 'SBUX', 'GILD', 'REGN', 'BKNG', 'VRTX', 'ADI',
    'PANW', 'LRCX', 'MU',   'KLAC', 'SNPS', 'CDNS', 'MRVL', 'CEG',  'ORLY', 'MAR',
    'FTNT', 'CHTR', 'KDP',  'DXCM', 'PAYX', 'MNST', 'CPRT', 'ROST', 'PCAR', 'ODFL',
    'FAST', 'IDXX', 'GEHC', 'EA',   'KHC',  'VRSK', 'EXC',  'CTAS', 'ROP',  'BIIB',
    'AEP',  'CTSH', 'CRWD', 'ANSS', 'LULU', 'TEAM', 'DDOG', 'ZS',   'MCHP', 'NXPI',
    'TTWO', 'EBAY', 'ON',   'DLTR', 'ILMN', 'WDAY', 'PYPL', 'FANG', 'SMCI', 'PLTR',
    'ABNB', 'APP',  'COIN', 'AXON', 'HOOD', 'ARM',  'MELI', 'SHOP', 'MRNA', 'ZM',
    'OKTA', 'SNOW', 'INTC', 'WBD',  'ENPH', 'CRSP', 'SIRI', 'RIVN', 'LCID', 'GFS',
]

SP500_TOP100 = [
    'NVDA', 'AAPL', 'MSFT', 'AMZN', 'META', 'GOOGL', 'GOOG', 'BRK-B', 'TSLA', 'AVGO',
    'JPM',  'LLY',  'UNH',  'XOM',  'V',    'MA',    'PG',   'JNJ',   'HD',   'COST',
    'ABBV', 'NFLX', 'BAC',  'MRK',  'KO',   'WMT',   'CVX',  'AMD',   'CRM',  'ADBE',
    'ORCL', 'PEP',  'TMO',  'ACN',  'LIN',  'MCD',   'CSCO', 'ABT',   'GE',   'DHR',
    'INTU', 'IBM',  'NOW',  'AMGN', 'ISRG', 'PM',    'TXN',  'QCOM',  'SPGI', 'BKNG',
    'AMAT', 'GS',   'CAT',  'BLK',  'AXP',  'VRTX',  'REGN', 'SYK',   'T',    'MS',
    'RTX',  'GILD', 'BSX',  'ETN',  'PLD',  'DE',    'ADI',  'LRCX',  'MU',   'KLAC',
    'NEE',  'CB',   'SCHW', 'SO',   'MMC',  'COP',   'EOG',  'PGR',   'ADP',  'UPS',
    'TJX',  'ICE',  'PANW', 'LOW',  'CME',  'WELL',  'CI',   'C',     'BMY',  'INTC',
    'ZTS',  'ELV',  'WM',   'CVS',  'PYPL', 'BA',    'USB',  'SBUX',  'MAR',  'MDLZ',
]

ETF_LIST = [
    'QQQ',  'SPY',  'DIA',  'IVV',  'VOO',  'VTI',  'IWM',  'SOXX', 'SMH',  'XLK',
    'XLF',  'XLE',  'XLV',  'XLY',  'XLI',  'ARKK', 'TQQQ', 'SQQQ', 'SOXL', 'SOXS',
    'UPRO', 'GLD',  'SLV',  'TLT',  'HYG',  'LQD',  'VNQ',  'XBI',  'IBB',  'ICLN', 'BOTZ',
]

# 반도체 종목 (CLAUDE.md 참고)
SEMI_LIST = [
    'NVDA', 'AVGO', 'TSM',  'ASML', 'AMD',  'INTC', 'QCOM', 'TXN',  'ADI',  'MU',
    'MRVL', 'NXPI', 'MCHP', 'MPWR', 'SWKS', 'QRVO', 'AMAT', 'LRCX', 'KLAC', 'TER',
    'SNPS', 'CDNS', 'ON',   'GFS',  'LSCC',
]


def all_unique_symbols():
    seen = set()
    result = []
    for sym in US_TOP100 + NASDAQ100 + SP500_TOP100 + ETF_LIST + SEMI_LIST:
        if sym not in seen:
            seen.add(sym)
            result.append(sym)
    return result


def fetch_snapshot_batch(symbols, api_key):
    """
    Massive v2 snapshot endpoint — 여러 종목 한 번에 조회
    https://api.massive.com/v2/snapshot/locale/us/markets/stocks/tickers
    """
    # Polygon/Massive: tickers 파라미터는 BRK-B 같은 하이픈 심볼을 그대로 사용
    tickers_str = ','.join(symbols)
    params = urllib.parse.urlencode({
        'tickers': tickers_str,
        'apiKey': api_key,
    })
    url = f'{BASE_URL}/v2/snapshot/locale/us/markets/stocks/tickers?{params}'

    req = urllib.request.Request(url, headers={'Accept': 'application/json'})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())


def parse_snapshot(data):
    """
    응답에서 { ticker: {price, changePct, extPrice, extPct, extSession} } 딕셔너리 추출

    - price: 정규장 최근 체결가 (lastTrade.p 우선 → day.c)
    - changePct: 정규장 등락률 (todaysChangePerc)
    - extPrice: 확장시간 최근 가격 (postMarket.c 또는 preMarket.c)
    - extPct: 확장시간 등락률 (종가 대비)
    - extSession: 'post' | 'pre' | null
    """
    result = {}
    for item in data.get('tickers', []):
        ticker = item.get('ticker', '')
        if not ticker:
            continue

        # ── 정규장 가격: lastTrade.p 우선 → day.c
        price = None
        try:
            price = round(float(item['lastTrade']['p']), 2)
        except (KeyError, TypeError, ValueError):
            pass
        if price is None:
            try:
                price = round(float(item['day']['c']), 2)
            except (KeyError, TypeError, ValueError):
                pass

        # ── 정규장 등락률·등락액
        change_pct = None
        try:
            change_pct = round(float(item['todaysChangePerc']), 2)
        except (KeyError, TypeError, ValueError):
            pass

        change = None
        try:
            change = round(float(item['todaysChange']), 2)
        except (KeyError, TypeError, ValueError):
            pass

        # ── 확장시간 (포스트마켓 / 나이트마켓 / 프리마켓)
        # Polygon/Massive v2 snapshot 응답에 postMarket / preMarket 객체가 포함됨
        # postMarket.c: 포스트마켓(+나이트마켓) 마지막 가격
        # preMarket.c : 프리마켓 마지막 가격
        # 우선순위: postMarket → preMarket
        ext_price   = None
        ext_pct     = None
        ext_session = None

        def safe_float(obj, *keys):
            try:
                v = obj
                for k in keys:
                    v = v[k]
                f = float(v)
                return f if f > 0 else None
            except (KeyError, TypeError, ValueError):
                return None

        day_close  = safe_float(item, 'day', 'c')
        prev_close = safe_float(item, 'prevDay', 'c')

        post_c = safe_float(item, 'postMarket', 'c')
        pre_c  = safe_float(item, 'preMarket', 'c')

        if post_c and day_close and abs(post_c - (day_close or 0)) > 0.001:
            # 포스트/나이트 마켓: 정규장 종가 대비 변동률
            ext_price   = round(post_c, 2)
            ext_pct     = round((post_c - day_close) / day_close * 100, 2)
            ext_session = 'post'
        elif pre_c and prev_close and abs(pre_c - (prev_close or 0)) > 0.001:
            # 프리마켓: 전일 종가 대비 변동률
            ext_price   = round(pre_c, 2)
            ext_pct     = round((pre_c - prev_close) / prev_close * 100, 2)
            ext_session = 'pre'

        result[ticker] = {
            'price':      price,
            'change':     change,
            'changePct':  change_pct,
            'extPrice':   ext_price,
            'extPct':     ext_pct,
            'extSession': ext_session,
        }
    return result


def main():
    if not MASSIVE_API_KEY:
        print('ERROR: MASSIVE_API_KEY 환경변수 없음. GitHub Secret 확인 필요.')
        sys.exit(1)

    now_utc = datetime.now(timezone.utc)
    kst = now_utc + timedelta(hours=9)
    print('=' * 55)
    print('  실시간 주가 수집 — stocks-prices.json (Massive API)')
    print(f'  실행: {kst.strftime("%Y-%m-%d %H:%M KST")}')
    print('=' * 55)

    symbols = all_unique_symbols()
    print(f'\n  대상: {len(symbols)}개 심볼 (배치 1~2회 호출)')

    prices = {}

    # 250개씩 나눠서 요청 (Massive API 상 안전한 배치 크기)
    BATCH = 200
    for i in range(0, len(symbols), BATCH):
        batch = symbols[i:i + BATCH]
        print(f'  배치 {i // BATCH + 1}: {len(batch)}개 요청 중...', end=' ', flush=True)
        try:
            data = fetch_snapshot_batch(batch, MASSIVE_API_KEY)
            parsed = parse_snapshot(data)
            prices.update(parsed)
            ok = sum(1 for v in parsed.values() if v['price'] is not None)
            print(f'OK ({ok}/{len(batch)} 성공)')
        except Exception as e:
            print(f'ERROR: {e}')

    # 결과 출력
    ok_total = sum(1 for v in prices.values() if v['price'] is not None)
    print(f'\n  완료: {ok_total}/{len(symbols)} 종목 가격 수집')

    output = {
        'updatedAt':    now_utc.isoformat(),
        'updatedAtKST': kst.strftime('%Y-%m-%d %H:%M KST'),
        'prices': prices,
    }

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, separators=(',', ':'))

    print(f'  저장: {OUTPUT_PATH}')
    print('=' * 55)


if __name__ == '__main__':
    main()
