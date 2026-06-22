#!/usr/bin/env python3
"""
실시간 주가 수집 — Massive REST API (구 Polygon.io) + yfinance 확장시간 보완
stocks-prices.json 에 현재가·등락률·확장시간 데이터 저장 (스파크라인 없음)
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
from concurrent.futures import ThreadPoolExecutor, as_completed

# ─── API 설정 ─────────────────────────────────────────────────────────────────
MASSIVE_API_KEY = os.environ.get('MASSIVE_API_KEY', '')
BASE_URL = 'https://api.massive.com'

OUTPUT_PATH = os.path.normpath(
    os.path.join(os.path.dirname(__file__), '..', 'data', 'stocks-prices.json')
)

# ─── 수집 대상 심볼 ────────────────────────────────────────────────────────────
# stocks-data.json 과 동일한 종목 전체 (중복 제거)
US_TOP100 = [
    # 시총 순위 1~10 (TSM 7위 수동 추가 2026-06-19)
    'NVDA', 'GOOGL', 'AAPL', 'MSFT', 'AMZN', 'SPCX',  'TSM',  'AVGO', 'TSLA', 'META',
    # 11~20
    'MU',   'BRK-B', 'LLY',  'WMT',  'JPM',  'AMD',   'ASML', 'V',    'INTC', 'XOM',
    # 21~30
    'JNJ',  'ORCL',  'AMAT', 'LRCX', 'CSCO', 'ARM',   'CAT',  'MA',   'COST', 'BAC',
    # 31~40
    'ABBV', 'GE',    'UNH',  'MS',   'CVX',  'PG',    'KO',   'HD',   'GS',   'NFLX',
    # 41~50
    'PLTR', 'KLAC',  'SNDK', 'MRK',  'GEV',  'PM',    'TXN',  'DELL', 'RTX',  'WFC',
    # 51~60
    'MRVL', 'IBM',   'C',    'WDC',  'STX',  'LIN',   'AXP',  'PANW', 'QCOM', 'ANET',
    # 61~70
    'MCD',  'APH',   'TMUS', 'PEP',  'VZ',   'AMGN',  'TJX',  'NEE',  'BA',   'DIS',
    # 71~80
    'CRWD', 'BLK',   'TMO',  'SCHW', 'IBKR', 'APP',   'ETN',  'DE',   'T',    'GILD',
    # 81~90
    'ABT',  'UNP',   'BX',   'GLW',  'PFE',  'WELL',  'HON',  'UBER', 'ISRG', 'SHOP',
    # 91~100
    'COP',  'PLD',   'BKNG', 'CB',   'CRM',  'CVS',   'DHR',  'COF',  'SPGI', 'LMT',
    # 101~110 (가격 추적용, stocks-data.json 스파크라인 없음)
    'VRT',  'LOW',   'PGR',  'PH',   'VRTX', 'SYK',   'MO',   'SBUX', 'PDD',  'HWM',
    # 111~120
    'BMY',  'NEM',   'CDNS', 'EQIX', 'PWR',  'FTNT',  'TT',   'SO',   'MAR',  'SNY',
    # 121~130
    'MDT',  'BNY',   'FCX',  'CMI',  'NOW',  'GD',    'CEG',  'DUK',  'ACN',  'HOOD',
    # 131~140
    'PNC',  'CME',   'MCK',  'USB',  'MNST', 'UPS',   'SNPS', 'JCI',  'ADP',  'KKR',
    # 141~150
    'WMB',  'WM',    'HCA',  'ELV',  'ABNB', 'CSX',   'AMT',  'EMR',  'MMM',  'MELI',
    # 151~160
    'CMCSA','RCL',   'DDOG', 'APO',  'MCO',  'HLT',   'MRSH', 'NOC',  'MDLZ', 'ADBE',
    # 161~170
    'NTES', 'FDX',   'SHW',  'ICE',  'ECL',  'CI',    'ITW',  'NXPI', 'SLB',  'ROST',
    # 171~180
    'COHR', 'TDG',   'INTU', 'ORLY', 'CRH',  'CL',    'DASH', 'GM',   'MPC',  'VLO',
    # 181~190
    'MPWR', 'EOG',   'NBIS', 'AEP',  'AON',  'KMI',   'CVNA', 'SPG',  'FIX',  'CTAS',
    # 191~200
    'LITE', 'NSC',   'PSX',  'BSX',  'MSI',  'WBD',   'DLR',  'URI',  'NKE',  'TRV',
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
    'XLF',  'XLE',  'XLV',  'XLY',  'XLI',  'ARKK', 'TQQQ', 'QLD',  'SQQQ', 'SOXL', 'SOXS',
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


def is_us_edt(dt):
    """주어진 날짜(date 또는 datetime)가 미국 EDT(여름시간, UTC-4)인지 반환. False면 EST(UTC-5)."""
    from datetime import date as _date
    d = dt if isinstance(dt, _date) and not isinstance(dt, datetime) else dt.date() if isinstance(dt, datetime) else dt
    year = d.year
    # DST 시작: 3월 두 번째 일요일
    m8 = datetime(year, 3, 8)
    dst_start = datetime(year, 3, 8 + (6 - m8.weekday()) % 7).date()
    # DST 종료: 11월 첫 번째 일요일
    n1 = datetime(year, 11, 1)
    dst_end = datetime(year, 11, 1 + (6 - n1.weekday()) % 7).date()
    return dst_start <= d < dst_end


def get_intraday_date():
    """
    인트라데이 5분봉 수집 대상 날짜를 미국 동부시간(ET) 기준으로 결정.
    반환 형식: 'YYYY-MM-DD' 문자열.
    - 장중/장 마감 후: 오늘 날짜
    - 프리마켓(9:30 AM ET 이전): 직전 거래일
    - 주말/공휴일: 직전 거래일 (최대 7일 소급)
    """
    # 미국 주요 시장 공휴일 (NYSE 기준, 2025~2027)
    US_MARKET_HOLIDAYS = {
        # 2025
        datetime(2025, 1, 1).date(),   # New Year's Day
        datetime(2025, 1, 20).date(),  # MLK Day
        datetime(2025, 2, 17).date(),  # Presidents Day
        datetime(2025, 4, 18).date(),  # Good Friday
        datetime(2025, 5, 26).date(),  # Memorial Day
        datetime(2025, 6, 19).date(),  # Juneteenth
        datetime(2025, 7, 4).date(),   # Independence Day
        datetime(2025, 9, 1).date(),   # Labor Day
        datetime(2025, 11, 27).date(), # Thanksgiving
        datetime(2025, 12, 25).date(), # Christmas
        # 2026
        datetime(2026, 1, 1).date(),   # New Year's Day
        datetime(2026, 1, 19).date(),  # MLK Day
        datetime(2026, 2, 16).date(),  # Presidents Day
        datetime(2026, 4, 3).date(),   # Good Friday
        datetime(2026, 5, 25).date(),  # Memorial Day
        datetime(2026, 6, 19).date(),  # Juneteenth ← 이번 문제 원인
        datetime(2026, 7, 3).date(),   # Independence Day (observed)
        datetime(2026, 9, 7).date(),   # Labor Day
        datetime(2026, 11, 26).date(), # Thanksgiving
        datetime(2026, 12, 25).date(), # Christmas
        # 2027
        datetime(2027, 1, 1).date(),   # New Year's Day
        datetime(2027, 1, 18).date(),  # MLK Day
        datetime(2027, 2, 15).date(),  # Presidents Day
        datetime(2027, 3, 26).date(),  # Good Friday
        datetime(2027, 5, 31).date(),  # Memorial Day
        datetime(2027, 6, 18).date(),  # Juneteenth (observed)
        datetime(2027, 7, 5).date(),   # Independence Day (observed)
        datetime(2027, 9, 6).date(),   # Labor Day
        datetime(2027, 11, 25).date(), # Thanksgiving
        datetime(2027, 12, 24).date(), # Christmas (observed)
    }

    # EDT = UTC-4, EST = UTC-5 (6~10월은 EDT)
    et_offset = timedelta(hours=-4)
    now_et = datetime.now(timezone.utc) + et_offset

    day = now_et.date()

    # 9:30 AM ET 이전이면 전일로
    if now_et.hour < 9 or (now_et.hour == 9 and now_et.minute < 30):
        day = day - timedelta(days=1)

    # 주말/공휴일 소급 (최대 7일)
    for _ in range(7):
        if day.weekday() < 5 and day not in US_MARKET_HOLIDAYS:
            break
        day -= timedelta(days=1)

    return day.strftime('%Y-%m-%d')


def fetch_intraday_bars(ticker, date, api_key):
    """
    Massive API v2 aggregates — 5분봉 전체 세션 종가 배열 반환.
    프리마켓(4AM~9:30AM) + 정규장(9:30AM~4PM) + 포스트마켓(4PM~8PM) 모두 포함.
    시간순 정렬(sort=asc). Polygon t 필드 = Unix ms UTC.
    베이스라인은 별도 dayOpen 값으로 처리 — 여기선 필터하지 않는다.
    """
    safe_ticker = urllib.parse.quote(ticker, safe='')
    url = (
        f'{BASE_URL}/v2/aggs/ticker/{safe_ticker}/range/5/minute/{date}/{date}'
        f'?adjusted=false&sort=asc&limit=1000&apiKey={api_key}'
    )
    req = urllib.request.Request(url, headers={'Accept': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            data = json.loads(resp.read().decode())
        results = data.get('results', [])
        if not results:
            return []
        return [(int(bar['t']), round(float(bar['c']), 2)) for bar in results if 'c' in bar and 't' in bar]
    except Exception:
        return []


def fetch_intraday_all(symbols, date, api_key, max_workers=15):
    """
    전체 심볼 인트라데이 5분봉 병렬 수집 (ThreadPoolExecutor).
    반환: (dict{sym: [floats]}, ok_count)
    """
    result = {}

    def _fetch(sym):
        return sym, fetch_intraday_bars(sym, date, api_key)

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(_fetch, sym): sym for sym in symbols}
        ok = 0
        for future in as_completed(futures):
            try:
                sym, bars = future.result()
                result[sym] = bars
                if bars:
                    ok += 1
            except Exception:
                pass

    return result, ok


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


def fetch_index_snapshot(api_key):
    """
    Massive v3 indices snapshot — SPX·NDX·DJI 실시간 지수값 수집
    https://api.massive.com/v3/snapshot/indices?ticker.any_of=I:SPX,I:NDX,I:DJI
    반환: [{'symbol':'SPX','price':...,'changePct':...,'change':...}, ...]
    """
    params = urllib.parse.urlencode({
        'ticker.any_of': 'I:SPX,I:NDX,I:DJI',
        'apiKey': api_key,
    })
    url = f'{BASE_URL}/v3/snapshot/indices?{params}'
    req = urllib.request.Request(url, headers={'Accept': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode())
        results = []
        sym_map = {'I:SPX': 'SPX', 'I:NDX': 'NDX', 'I:DJI': 'DJI'}
        for item in data.get('results', []):
            ticker  = item.get('ticker', '')
            symbol  = sym_map.get(ticker, ticker.replace('I:', ''))
            session = item.get('session', {})
            price   = session.get('close') or session.get('value')
            change  = session.get('change')
            pct     = session.get('change_percent')
            if price and price > 0:
                results.append({
                    'symbol':    symbol,
                    'price':     round(float(price), 2),
                    'change':    round(float(change), 2) if change is not None else None,
                    'changePct': round(float(pct),    2) if pct    is not None else None,
                })
        return results
    except Exception as e:
        print(f'  [Index] 수집 실패: {e}')
        return []


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

        # ── 정규장 가격: lastTrade.p → day.c → prevDay.c 순으로 폴백
        # 장마감 후 심야 시간대엔 lastTrade.p / day.c 가 0으로 올 수 있으므로 >0 필터 필수
        price = None
        for _path in [('lastTrade', 'p'), ('day', 'c'), ('prevDay', 'c')]:
            try:
                _v = item
                for _k in _path:
                    _v = _v[_k]
                _p = float(_v)
                if _p > 0:
                    price = round(_p, 2)
                    break
            except (KeyError, TypeError, ValueError):
                pass

        # ── 정규장 등락률·등락액
        # 주의: Massive API의 todaysChangePerc·todaysChange는 내부 기준가가 prevDay.c와
        # 불일치하는 경우가 있음 (Juneteenth 등 공휴일 직후 특히 심각).
        # → 항상 day.c / prevDay.c로 직접 계산. todaysChange* 값은 참조만.
        change_pct = None
        change     = None

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

        day_open   = safe_float(item, 'day', 'o')   # 오늘 시초가 — 1D 수익률 계산용
        day_close  = safe_float(item, 'day', 'c')
        prev_close = safe_float(item, 'prevDay', 'c')

        # day.c · prevDay.c로 직접 계산 (Yahoo Finance 기준과 일치)
        if day_close and prev_close and prev_close > 0:
            change     = round(day_close - prev_close, 2)
            change_pct = round((day_close - prev_close) / prev_close * 100, 2)
        else:
            # fallback: Massive API 제공값 사용 (day.c 없는 비정규 종목 등)
            try:
                change_pct = round(float(item['todaysChangePerc']), 2)
            except (KeyError, TypeError, ValueError):
                pass
            try:
                change = round(float(item['todaysChange']), 2)
            except (KeyError, TypeError, ValueError):
                pass

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
            'dayOpen':    round(day_open, 2) if day_open else None,
            'dayClose':   round(day_close, 2) if day_close else None,   # 정규장 종가 (포스트마켓 기준점)
            'prevClose':  round(prev_close, 2) if prev_close else None,  # 전일 종가 (프리마켓 기준점)
            'extPrice':   ext_price,
            'extPct':     ext_pct,
            'extSession': ext_session,
        }
    return result


def get_yahoo_crumb():
    """
    Yahoo Finance API v8 크럼(crumb) + 쿠키 획득.
    Yahoo Finance는 2024년 이후 crumb 없는 요청에 HTTP 500 반환.
    fc.yahoo.com → cookie 발급 → getcrumb API로 crumb 획득.
    """
    import http.cookiejar

    cj     = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))

    ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/125.0'

    # 1단계: fc.yahoo.com — 쿠키(A1 등) 발급
    try:
        opener.open(
            urllib.request.Request('https://fc.yahoo.com', headers={'User-Agent': ua}),
            timeout=10,
        )
    except Exception:
        pass  # 리디렉션 오류가 나도 쿠키는 저장됨

    # 2단계: crumb 획득
    crumb_req = urllib.request.Request(
        'https://query1.finance.yahoo.com/v1/test/getcrumb',
        headers={'User-Agent': ua, 'Accept': '*/*'},
    )
    with opener.open(crumb_req, timeout=10) as resp:
        crumb = resp.read().decode().strip()

    return opener, crumb


def get_extended_hours_yahoo(symbols):
    """
    Yahoo Finance v8/quote API로 확장시간(프리/포스트/나이트) 데이터 직접 수집.

    - crumb 인증 포함 → HTTP 500 우회
    - Yahoo v8 API는 당일 내내 postMarketPrice 유지 → 나이트 데드존도 커버
    - GitHub Actions(서버사이드)이므로 CORS 제한 없음
    """
    result = {}
    BATCH = 100

    # 크럼 획득
    try:
        opener, crumb = get_yahoo_crumb()
        print(f'  [Yahoo] 크럼 획득 완료 ({crumb[:8]}...)')
    except Exception as e:
        print(f'  [Yahoo] 크럼 획득 실패: {e} — 확장시간 수집 생략')
        return result

    ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/125.0'

    for i in range(0, len(symbols), BATCH):
        batch    = symbols[i:i + BATCH]
        syms_str = ','.join(batch)
        url = (
            'https://query2.finance.yahoo.com/v8/finance/quote'
            '?symbols='  + urllib.parse.quote(syms_str)
            + '&crumb='  + urllib.parse.quote(crumb)
            + '&fields=regularMarketPrice,regularMarketPreviousClose'
              ',postMarketPrice,preMarketPrice'
              ',postMarketChangePercent,preMarketChangePercent'
        )
        try:
            req = urllib.request.Request(url, headers={'User-Agent': ua, 'Accept': 'application/json'})
            with opener.open(req, timeout=20) as resp:
                data = json.loads(resp.read().decode())

            for quote in data.get('quoteResponse', {}).get('result', []):
                sym          = quote.get('symbol', '')
                reg_price    = quote.get('regularMarketPrice')
                prev_close   = quote.get('regularMarketPreviousClose')
                post_price   = quote.get('postMarketPrice')
                pre_price    = quote.get('preMarketPrice')
                post_pct_raw = quote.get('postMarketChangePercent')
                pre_pct_raw  = quote.get('preMarketChangePercent')

                ext_price = ext_pct = ext_session = None

                if post_price and reg_price and abs(post_price - reg_price) > 0.001:
                    ext_price   = round(post_price, 2)
                    ext_pct     = round(post_pct_raw, 2) if post_pct_raw is not None \
                                  else round((post_price - reg_price) / reg_price * 100, 2)
                    ext_session = 'post'
                elif pre_price and prev_close and abs(pre_price - prev_close) > 0.001:
                    ext_price   = round(pre_price, 2)
                    ext_pct     = round(pre_pct_raw, 2) if pre_pct_raw is not None \
                                  else round((pre_price - prev_close) / prev_close * 100, 2)
                    ext_session = 'pre'

                result[sym] = {
                    'extPrice':   ext_price,
                    'extPct':     ext_pct,
                    'extSession': ext_session,
                }

        except Exception as e:
            print(f'  [Yahoo] 배치 {i // BATCH + 1} 오류: {e}')

    ext_ok = sum(1 for v in result.values() if v.get('extPct') is not None)
    print(f'  [Yahoo] 확장시간: {ext_ok}/{len(symbols)} 종목 수집')
    return result


def main():
    if not MASSIVE_API_KEY:
        print('ERROR: MASSIVE_API_KEY 환경변수 없음. GitHub Secret 확인 필요.')
        sys.exit(1)

    now_utc = datetime.now(timezone.utc)
    kst = now_utc + timedelta(hours=9)
    print('=' * 55)
    print('  실시간 주가 수집 — stocks-prices.json')
    print('  소스: Massive API(정규장) + Yahoo Finance v8(확장시간)')
    print(f'  실행: {kst.strftime("%Y-%m-%d %H:%M KST")}')
    print('=' * 55)

    symbols = all_unique_symbols()
    print(f'\n  대상: {len(symbols)}개 심볼 (배치 1~2회 호출)')

    prices = {}

    # ── 1단계: Massive API — 정규장 현재가·등락률 ────────────────────────────
    BATCH = 200
    for i in range(0, len(symbols), BATCH):
        batch = symbols[i:i + BATCH]
        print(f'  [Massive] 배치 {i // BATCH + 1}: {len(batch)}개 요청 중...', end=' ', flush=True)
        try:
            data = fetch_snapshot_batch(batch, MASSIVE_API_KEY)
            parsed = parse_snapshot(data)
            prices.update(parsed)
            ok = sum(1 for v in parsed.values() if v['price'] is not None)
            print(f'OK ({ok}/{len(batch)} 성공)')
        except Exception as e:
            print(f'ERROR: {e}')

    ok_total = sum(1 for v in prices.values() if v['price'] is not None)
    print(f'\n  [Massive] 완료: {ok_total}/{len(symbols)} 종목 가격 수집')

    # Massive API가 확장시간 데이터를 이미 제공했는지 확인
    massive_ext_ok = sum(1 for v in prices.values() if v.get('extPct') is not None)
    print(f'  [Massive] 확장시간 데이터: {massive_ext_ok}개')

    # ── 2단계: Massive API aggregates — 인트라데이 5분봉 수집 ─────────────────
    intraday_date = get_intraday_date()
    print(f'\n  [인트라데이] {intraday_date} 5분봉 수집 중 ({len(symbols)}개, 병렬 15)...', flush=True)
    intraday_data, intraday_ok = fetch_intraday_all(symbols, intraday_date, MASSIVE_API_KEY)
    print(f'  [인트라데이] 완료: {intraday_ok}/{len(symbols)} 종목 데이터 확보')

    # 인트라데이 날짜 기준 정규장 UTC 시각 계산 (EDT/EST 자동 판단)
    intraday_dt = datetime.strptime(intraday_date, '%Y-%m-%d')
    utc_offset  = 4 if is_us_edt(intraday_dt) else 5   # EDT=UTC-4, EST=UTC-5
    # 정규장: 9:30 AM ET ~ 4:00 PM ET
    market_open_ms  = int(datetime(intraday_dt.year, intraday_dt.month, intraday_dt.day,
                                   9 + utc_offset, 30, tzinfo=timezone.utc).timestamp() * 1000)
    market_close_ms = int(datetime(intraday_dt.year, intraday_dt.month, intraday_dt.day,
                                   16 + utc_offset, 0, tzinfo=timezone.utc).timestamp() * 1000)

    # 현재 미국 동부시간 — 어떤 세션인지 판단
    now_et          = datetime.now(timezone.utc) - timedelta(hours=utc_offset)
    is_premarket    = 4 <= now_et.hour < 9 or (now_et.hour == 9 and now_et.minute < 30)
    is_postmarket   = 16 <= now_et.hour < 20

    # ── 프리마켓 시간대: 오늘 날짜 봉 별도 수집 (Massive API 5분봉, 15분 지연)
    # intraday_date = 어제(스파클라인용)이므로 프리마켓 ext를 위해 오늘 날짜를 따로 요청
    today_intraday = {}
    if is_premarket:
        today_et   = now_et.date()
        today_str  = today_et.strftime('%Y-%m-%d')
        print(f'\n  [프리마켓] 오늘({today_str}) 봉 수집 중 (Massive API)...', flush=True)
        today_intraday, today_ok = fetch_intraday_all(symbols, today_str, MASSIVE_API_KEY)
        print(f'  [프리마켓] 완료: {today_ok}/{len(symbols)} 종목')

    intraday_ext_ok = 0
    for sym, bar_pairs in intraday_data.items():
        if sym not in prices or not bar_pairs:
            continue

        # ── 스파클라인용 종가 배열 (어제 전체 세션, 기존 구조 유지)
        closes = [c for _, c in bar_pairs]
        prices[sym]['intraday'] = closes

        # 이미 ext 있으면 건너뜀
        if prices[sym].get('extPct') is not None:
            continue

        # 정규장 봉 (9:30AM~4PM ET, 어제 기준)
        reg_bars = [c for t, c in bar_pairs if market_open_ms <= t < market_close_ms]

        if is_premarket:
            # ── 프리마켓: 오늘 봉의 마지막 값 vs 어제 정규장 마지막 봉
            today_bars = today_intraday.get(sym, [])
            if today_bars:
                last_pre_c     = today_bars[-1][1]
                prev_close_ref = prices[sym].get('prevClose') or \
                                 (reg_bars[-1] if reg_bars else None) or \
                                 prices[sym].get('price')
                if prev_close_ref and abs(last_pre_c - prev_close_ref) > 0.001:
                    prices[sym]['extPrice']   = round(last_pre_c, 2)
                    prices[sym]['extPct']     = round((last_pre_c - prev_close_ref) / prev_close_ref * 100, 2)
                    prices[sym]['extSession'] = 'pre'
                    intraday_ext_ok += 1
        else:
            # ── 포스트마켓 / overnight: 어제(또는 오늘) 포스트마켓 봉
            post_bars     = [(t, c) for t, c in bar_pairs if t >= market_close_ms]
            day_close_ref = prices[sym].get('dayClose') or (reg_bars[-1] if reg_bars else None)

            if post_bars and day_close_ref:
                last_post_c = post_bars[-1][1]
                if abs(last_post_c - day_close_ref) > 0.001:
                    prices[sym]['extPrice']   = round(last_post_c, 2)
                    prices[sym]['extPct']     = round((last_post_c - day_close_ref) / day_close_ref * 100, 2)
                    prices[sym]['extSession'] = 'post'
                    intraday_ext_ok += 1

    print(f'  [인트라데이] Massive 봉 기반 확장시간: {intraday_ext_ok}개 종목')

    # ── 3단계: Yahoo Finance — 포스트마켓/overnight 전용 보완 ────────────────────
    # 프리마켓은 Massive 5분봉으로 충분 — Yahoo 호출 생략 (429 레이트리밋 방지)
    already_ext = sum(1 for v in prices.values() if v.get('extPct') is not None)
    if is_premarket:
        print(f'  [Yahoo] 프리마켓 구간 — 생략 (Massive 봉 기반 {already_ext}개 확보)')
    elif already_ext >= len(symbols) * 0.8:
        print(f'  [Yahoo] 확장시간 이미 충분({already_ext}개) — Yahoo 수집 생략')
    else:
        print(f'\n  [Yahoo] 확장시간 보완 중 ({already_ext}개 이미 확보)...')
        ext_data = get_extended_hours_yahoo(symbols)
        for sym, ext in ext_data.items():
            if sym in prices and prices[sym].get('extPct') is None:
                prices[sym]['extPrice']   = ext['extPrice']
                prices[sym]['extPct']     = ext['extPct']
                prices[sym]['extSession'] = ext['extSession']

    # 최종 결과
    final_ext_ok = sum(1 for v in prices.values() if v.get('extPct') is not None)
    print(f'\n  최종 확장시간 데이터: {final_ext_ok}개 종목')

    # ── 4단계: 주요 지수 실시간 수집 (SPX·NDX·DJI) ───────────────────────────
    # Massive v3 indices 엔드포인트 시도 → 실패 시 SPY/QQQ/DIA 프록시 폴백
    print('\n  [Index] SPX·NDX·DJI 실시간 지수 수집 중...')
    live_indices = fetch_index_snapshot(MASSIVE_API_KEY)

    if not live_indices:
        # SPY→SPX, QQQ→NDX, DIA→DJI 프록시 (등락률만; 가격은 UI에서 stocks-data 폴백)
        proxy_map = [('SPX', 'SPY'), ('NDX', 'QQQ'), ('DJI', 'DIA')]
        for idx_sym, etf_sym in proxy_map:
            etf = prices.get(etf_sym, {})
            if etf.get('changePct') is not None:
                live_indices.append({
                    'symbol':    idx_sym,
                    'price':     None,  # UI가 stocks-data.json 가격 유지
                    'change':    etf.get('change'),
                    'changePct': etf['changePct'],
                })
        src = 'ETF 프록시(SPY/QQQ/DIA)' if live_indices else '없음(stocks-data 폴백)'
        print('  [Index] Massive v3 미지원 — %s 사용: %d개' % (src, len(live_indices)))
    else:
        idx_parts = []
        for x in live_indices:
            if x.get('changePct') is not None:
                idx_parts.append('%s %s (%+.2f%%)' % (x['symbol'], x['price'], x['changePct']))
        print('  [Index] 완료: %d개 지수 — %s' % (len(live_indices), ', '.join(idx_parts)))

    output = {
        'updatedAt':    now_utc.isoformat(),
        'updatedAtKST': kst.strftime('%Y-%m-%d %H:%M KST'),
        'indices':      live_indices,   # SPX·NDX·DJI 실시간 (빈 리스트면 UI에서 폴백)
        'prices': prices,
    }

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, separators=(',', ':'))

    print(f'  저장: {OUTPUT_PATH}')
    print('=' * 55)


if __name__ == '__main__':
    main()
