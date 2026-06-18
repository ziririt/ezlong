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
    'NVDA', 'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'SPCX', 'META', 'TSLA', 'BRK-B', 'AVGO',
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


def get_intraday_date():
    """
    인트라데이 5분봉 수집 대상 날짜를 미국 동부시간(ET) 기준으로 결정.
    - 장중/장 마감 후: 오늘 날짜
    - 프리마켓(9:30 AM ET 이전): 직전 거래일
    - 주말/공휴일: 직전 거래일 (최대 3일 소급)
    """
    # EDT = UTC-4, EST = UTC-5 (6~10월은 EDT)
    et_offset = timedelta(hours=-4)
    now_et = datetime.now(timezone.utc) + et_offset

    day = now_et.date()

    # 9:30 AM ET 이전이면 전일로
    if now_et.hour < 9 or (now_et.hour == 9 and now_et.minute < 30):
        day = day - timedelta(days=1)

    # 주말 소급 (토요일→금요일, 일요일→금요일)
    for _ in range(3):
        if day.weekday() < 5:  # 0=월 … 4=금
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
        return [round(float(bar['c']), 2) for bar in results if 'c' in bar]
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

        day_open   = safe_float(item, 'day', 'o')   # 오늘 시초가 — 1D 수익률 계산용
        day_close  = safe_float(item, 'day', 'c')
        prev_close = safe_float(item, 'prevDay', 'c')

        # todaysChangePerc = 0 이지만 day.c · prevDay.c로 실제 변동을 알 수 있으면 재계산
        # (SPCX 등 Massive API가 changePerc를 0으로 잘못 반환하는 케이스 대응)
        if (change_pct is None or (change_pct == 0 and (change is None or change == 0))) \
                and day_close and prev_close and prev_close > 0:
            computed = round((day_close - prev_close) / prev_close * 100, 2)
            if abs(computed) > 0.01:   # 실제 변화가 있을 때만 덮어씀
                change_pct = computed
                change = round(day_close - prev_close, 2)

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
            'dayOpen':    round(day_open, 2) if day_open else None,  # 오늘 시초가
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

    for sym, bars in intraday_data.items():
        if sym in prices and bars:
            # 시간순 그대로 저장 (프리마켓→정규장→포스트마켓)
            # 베이스라인은 dayOpen 필드(별도)를 stocks.html에서 참조
            prices[sym]['intraday'] = bars

    # ── 3단계: Yahoo Finance v8/quote API — 확장시간 수집 ────────────────────
    # Massive $29 플랜은 postMarket/preMarket 필드 미제공 → 항상 Yahoo로 수집
    # Yahoo v8 API는 나이트 데드존(20:00~04:00 ET)에서도 당일 마지막 after-hours 가격 유지
    if massive_ext_ok > 0:
        print(f'  [Massive] 확장시간 {massive_ext_ok}개 이미 있음 — Yahoo 보완 생략')
    else:
        print('\n  [Yahoo] 확장시간 수집 중 (v8/quote API)...')
        ext_data = get_extended_hours_yahoo(symbols)
        for sym, ext in ext_data.items():
            if sym in prices:
                prices[sym]['extPrice']   = ext['extPrice']
                prices[sym]['extPct']     = ext['extPct']
                prices[sym]['extSession'] = ext['extSession']

    # 최종 결과
    final_ext_ok = sum(1 for v in prices.values() if v.get('extPct') is not None)
    print(f'\n  최종 확장시간 데이터: {final_ext_ok}개 종목')

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
