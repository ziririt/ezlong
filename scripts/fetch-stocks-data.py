#!/usr/bin/env python3
"""
주가 데이터 수집 스크립트 — stocks.html용 (GitHub Actions)
yfinance → data/stocks-data.json 저장

미국 시총 100 + 나스닥 100 + S&P 500 상위 100 + 주요 ETF
각 심볼은 한 번만 수집 후 캐시 활용 (중복 요청 없음)
실행: python3 scripts/fetch-stocks-data.py
"""

import json
import os
import sys
import time
from datetime import datetime, timezone, timedelta

try:
    import yfinance as yf
except ImportError:
    print("ERROR: yfinance 미설치. pip install yfinance 실행 필요.")
    sys.exit(1)

# ─── 종목 리스트 ──────────────────────────────────────────────────────────────
# 미국 시총 100: GOOG/GOOGL 중 GOOGL만 포함, BRK-B만 포함, TSM/ASML 포함
US_TOP100 = [
    'NVDA', 'AAPL', 'MSFT', 'AMZN', 'GOOGL', 'META', 'TSLA', 'BRK-B', 'AVGO', 'LLY',
    'JPM', 'UNH', 'V',    'XOM',  'MA',   'COST', 'PG',  'JNJ',  'HD',   'NFLX',
    'ABBV', 'BAC', 'WMT', 'MRK',  'KO',   'CVX',  'ASML','ORCL', 'AMD',  'CRM',
    'ADBE', 'TMO', 'ACN', 'LIN',  'MCD',  'CSCO', 'ABT', 'GE',   'INTU', 'IBM',
    'NOW',  'AMGN','ISRG','PM',   'DHR',  'TXN',  'QCOM','SPGI', 'BKNG', 'AMAT',
    'GS',   'CAT', 'TSM', 'BLK',  'AXP',  'VRTX', 'REGN','SYK',  'T',    'MS',
    'RTX',  'GILD','BSX', 'ETN',  'PLD',  'DE',   'ADI', 'LRCX', 'MU',   'KLAC',
    'NEE',  'CB',  'SCHW','COP',  'EOG',  'PGR',  'ADP', 'UPS',  'TJX',  'ICE',
    'PANW', 'LOW', 'CME', 'CI',   'C',    'BMY',  'ZTS', 'ELV',  'WM',   'CVS',
    'BA',   'HON', 'SO',  'ARM',  'PLTR', 'MELI', 'CRWD','APP',  'WELL', 'MMC',
]

NASDAQ100 = [
    'NVDA', 'AAPL', 'MSFT', 'AMZN', 'META', 'TSLA', 'AVGO', 'GOOGL', 'GOOG', 'COST',
    'NFLX', 'ASML', 'AMD',  'ADBE', 'CSCO', 'TMUS', 'PEP',  'QCOM',  'INTU', 'CMCSA',
    'TXN',  'HON',  'AMGN', 'ISRG', 'SBUX', 'GILD', 'REGN', 'BKNG',  'VRTX', 'ADI',
    'PANW', 'LRCX', 'MU',   'KLAC', 'SNPS', 'CDNS', 'MRVL', 'CEG',   'ORLY', 'MAR',
    'FTNT', 'CHTR', 'KDP',  'DXCM', 'PAYX', 'MNST', 'CPRT', 'ROST',  'PCAR', 'ODFL',
    'FAST', 'IDXX', 'GEHC', 'EA',   'KHC',  'VRSK', 'EXC',  'CTAS',  'ROP',  'BIIB',
    'AEP',  'CTSH', 'CRWD', 'ANSS', 'LULU', 'TEAM', 'DDOG', 'ZS',    'MCHP', 'NXPI',
    'TTWO', 'EBAY', 'ON',   'DLTR', 'ILMN', 'WDAY', 'PYPL', 'FANG',  'SMCI', 'PLTR',
    'ABNB', 'APP',  'COIN', 'AXON', 'HOOD', 'ARM',  'MELI', 'SHOP',  'MRNA', 'ZM',
    'OKTA', 'SNOW', 'INTC', 'WBD',  'ENPH', 'CRSP', 'SIRI', 'RIVN',  'LCID', 'GFS',
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
    'QQQ',  'SPY',  'IVV',  'VOO',  'VTI',  'IWM',  'SOXX', 'SMH',  'XLK',  'XLF',
    'XLE',  'XLV',  'XLY',  'XLI',  'ARKK', 'TQQQ', 'SQQQ', 'SOXL', 'SOXS', 'UPRO',
    'GLD',  'SLV',  'TLT',  'HYG',  'LQD',  'VNQ',  'XBI',  'IBB',  'ICLN', 'BOTZ',
]

# ─── 회사명 사전 ──────────────────────────────────────────────────────────────
COMPANY_NAMES = {
    'AAPL':'Apple Inc.', 'MSFT':'Microsoft Corp.', 'NVDA':'NVIDIA Corp.',
    'AMZN':'Amazon.com Inc.', 'META':'Meta Platforms', 'GOOGL':'Alphabet (A)',
    'GOOG':'Alphabet (C)', 'TSLA':'Tesla Inc.', 'AVGO':'Broadcom Inc.',
    'COST':'Costco Wholesale', 'NFLX':'Netflix Inc.', 'ASML':'ASML Holding',
    'AMD':'Advanced Micro Dev.', 'ADBE':'Adobe Inc.', 'CSCO':'Cisco Systems',
    'PEP':'PepsiCo Inc.', 'TMUS':'T-Mobile US', 'QCOM':'Qualcomm Inc.',
    'INTU':'Intuit Inc.', 'CMCSA':'Comcast Corp.', 'TXN':'Texas Instruments',
    'HON':'Honeywell Intl.', 'AMGN':'Amgen Inc.', 'SBUX':'Starbucks Corp.',
    'ISRG':'Intuitive Surgical', 'GILD':'Gilead Sciences', 'REGN':'Regeneron Pharma.',
    'BKNG':'Booking Holdings', 'VRTX':'Vertex Pharma.', 'ADI':'Analog Devices',
    'PANW':'Palo Alto Networks', 'LRCX':'Lam Research', 'MU':'Micron Technology',
    'KLAC':'KLA Corp.', 'SNPS':'Synopsys Inc.', 'CDNS':'Cadence Design',
    'MRVL':'Marvell Technology', 'CEG':'Constellation Energy', 'ORLY':"O'Reilly Auto",
    'MAR':'Marriott Intl.', 'FTNT':'Fortinet Inc.', 'CHTR':'Charter Commun.',
    'KDP':'Keurig Dr Pepper', 'DXCM':'DexCom Inc.', 'PAYX':'Paychex Inc.',
    'MNST':'Monster Beverage', 'CPRT':'Copart Inc.', 'ROST':'Ross Stores',
    'PCAR':'PACCAR Inc.', 'ODFL':'Old Dominion Freight', 'FAST':'Fastenal Co.',
    'IDXX':'IDEXX Laboratories', 'GEHC':'GE HealthCare', 'EA':'Electronic Arts',
    'KHC':'Kraft Heinz Co.', 'VRSK':'Verisk Analytics', 'EXC':'Exelon Corp.',
    'CTAS':'Cintas Corp.', 'ROP':'Roper Technologies', 'BIIB':'Biogen Inc.',
    'AEP':'American Electric Power', 'CTSH':'Cognizant Technology', 'CRWD':'CrowdStrike',
    'ANSS':'ANSYS Inc.', 'LULU':'Lululemon Athletica', 'TEAM':'Atlassian Corp.',
    'DDOG':'Datadog Inc.', 'ZS':'Zscaler Inc.', 'MCHP':'Microchip Technology',
    'NXPI':'NXP Semiconductors', 'TTWO':'Take-Two Interactive', 'EBAY':'eBay Inc.',
    'ON':'ON Semiconductor', 'DLTR':'Dollar Tree Inc.', 'ILMN':'Illumina Inc.',
    'WDAY':'Workday Inc.', 'PYPL':'PayPal Holdings', 'FANG':'Diamondback Energy',
    'SMCI':'Super Micro Computer', 'ABNB':'Airbnb Inc.', 'APP':'AppLovin Corp.',
    'PLTR':'Palantir Technologies', 'COIN':'Coinbase Global', 'AXON':'Axon Enterprise',
    'HOOD':'Robinhood Markets', 'ARM':'Arm Holdings', 'MELI':'MercadoLibre Inc.',
    'SHOP':'Shopify Inc.', 'MRNA':'Moderna Inc.', 'ZM':'Zoom Video Commun.',
    'OKTA':'Okta Inc.', 'SNOW':'Snowflake Inc.', 'INTC':'Intel Corp.',
    'WBD':'Warner Bros. Discovery', 'ENPH':'Enphase Energy', 'CRSP':'CRISPR Therapeutics',
    'SIRI':'Sirius XM Holdings', 'RIVN':'Rivian Automotive', 'LCID':'Lucid Group',
    'GFS':'GlobalFoundries',
    # S&P / Top100 추가
    'BRK-B':'Berkshire Hathaway B', 'JPM':'JPMorgan Chase', 'LLY':'Eli Lilly & Co.',
    'UNH':'UnitedHealth Group', 'XOM':'Exxon Mobil Corp.', 'V':'Visa Inc.',
    'MA':'Mastercard Inc.', 'PG':'Procter & Gamble', 'JNJ':'Johnson & Johnson',
    'HD':'Home Depot Inc.', 'ABBV':'AbbVie Inc.', 'BAC':'Bank of America',
    'MRK':'Merck & Co.', 'KO':'Coca-Cola Co.', 'WMT':'Walmart Inc.',
    'CVX':'Chevron Corp.', 'CRM':'Salesforce Inc.', 'ORCL':'Oracle Corp.',
    'TMO':'Thermo Fisher Scientific', 'ACN':'Accenture PLC', 'LIN':'Linde PLC',
    'MCD':"McDonald's Corp.", 'ABT':'Abbott Laboratories', 'GE':'GE Aerospace',
    'DHR':'Danaher Corp.', 'IBM':'IBM Corp.', 'NOW':'ServiceNow Inc.',
    'PM':'Philip Morris Intl.', 'SPGI':'S&P Global Inc.', 'AMAT':'Applied Materials',
    'GS':'Goldman Sachs', 'CAT':'Caterpillar Inc.', 'TSM':'Taiwan Semiconductor',
    'BLK':'BlackRock Inc.', 'AXP':'American Express', 'SYK':'Stryker Corp.',
    'T':'AT&T Inc.', 'MS':'Morgan Stanley', 'RTX':'RTX Corp.',
    'BSX':'Boston Scientific', 'ETN':'Eaton Corp.', 'PLD':'Prologis Inc.',
    'DE':'Deere & Co.', 'NEE':'NextEra Energy', 'CB':'Chubb Ltd.',
    'SCHW':'Charles Schwab', 'SO':'Southern Co.', 'MMC':'Marsh & McLennan',
    'COP':'ConocoPhillips', 'EOG':'EOG Resources', 'PGR':'Progressive Corp.',
    'ADP':'ADP Inc.', 'UPS':'UPS Inc.', 'TJX':'TJX Companies',
    'ICE':'Intercontinental Exchange', 'LOW':"Lowe's Companies", 'CME':'CME Group Inc.',
    'WELL':'Welltower Inc.', 'CI':'The Cigna Group', 'C':'Citigroup Inc.',
    'BMY':'Bristol-Myers Squibb', 'ZTS':'Zoetis Inc.', 'ELV':'Elevance Health',
    'WM':'Waste Management', 'CVS':'CVS Health Corp.', 'BA':'Boeing Co.',
    'USB':'US Bancorp', 'MDLZ':'Mondelez Intl.',
    # ETF
    'QQQ':'Invesco QQQ Trust', 'SPY':'SPDR S&P 500 ETF', 'IVV':'iShares Core S&P 500',
    'VOO':'Vanguard S&P 500', 'VTI':'Vanguard Total Stock Market',
    'IWM':'iShares Russell 2000', 'SOXX':'iShares Semiconductor ETF',
    'SMH':'VanEck Semiconductor ETF', 'XLK':'Technology Select Sector',
    'XLF':'Financial Select Sector', 'XLE':'Energy Select Sector',
    'XLV':'Health Care Select Sector', 'XLY':'Consumer Discretionary Sector',
    'XLI':'Industrial Select Sector', 'ARKK':'ARK Innovation ETF',
    'TQQQ':'ProShares UltraPro QQQ', 'SQQQ':'ProShares UltraPro Short QQQ',
    'SOXL':'Direxion Semicon. Bull 3X', 'SOXS':'Direxion Semicon. Bear 3X',
    'UPRO':'ProShares UltraPro S&P500', 'GLD':'SPDR Gold Shares',
    'SLV':'iShares Silver Trust', 'TLT':'iShares 20+ Year Treasury Bond',
    'HYG':'iShares High Yield Corp Bond', 'LQD':'iShares IG Corporate Bond',
    'VNQ':'Vanguard Real Estate ETF', 'XBI':'SPDR Biotech ETF',
    'IBB':'iShares Biotechnology ETF', 'ICLN':'iShares Global Clean Energy',
    'BOTZ':'Global X Robotics & AI ETF',
}

OUTPUT_PATH = os.path.normpath(
    os.path.join(os.path.dirname(__file__), '..', 'data', 'stocks-data.json')
)


# ─── 수집 함수 ────────────────────────────────────────────────────────────────

def get_sparkline(ticker_obj, days=5):
    try:
        hist = ticker_obj.history(period='5d', interval='1d')
        if hist.empty:
            return []
        closes = [round(float(c), 2) for c in hist['Close'].tolist()]
        return closes[-days:]
    except Exception:
        return []


def fetch_ticker(symbol):
    try:
        t = yf.Ticker(symbol)
        fi = t.fast_info
        price = None
        prev_close = None
        try:
            price = round(float(fi.last_price), 2) if fi.last_price else None
            prev_close = round(float(fi.previous_close), 2) if fi.previous_close else None
        except Exception:
            pass
        change = None
        change_pct = None
        if price and prev_close and prev_close != 0:
            change = round(price - prev_close, 2)
            change_pct = round((change / prev_close) * 100, 2)
        sparkline = get_sparkline(t)
        return {
            'symbol': symbol,
            'name': COMPANY_NAMES.get(symbol, symbol),
            'price': price,
            'change': change,
            'changePct': change_pct,
            'sparkline': sparkline,
        }
    except Exception as e:
        print(f"  ERROR {symbol}: {e}")
        return {
            'symbol': symbol,
            'name': COMPANY_NAMES.get(symbol, symbol),
            'price': None,
            'change': None,
            'changePct': None,
            'sparkline': [],
        }


def build_array(symbols, cache):
    out = []
    for i, sym in enumerate(symbols):
        item = dict(cache[sym])
        item['rank'] = i + 1
        out.append(item)
    return out


def main():
    now_utc = datetime.now(timezone.utc)
    kst = now_utc + timedelta(hours=9)

    print('=' * 55)
    print('  주가 데이터 수집 — stocks-data.json')
    print(f'  실행: {kst.strftime("%Y-%m-%d %H:%M KST")}')
    print('=' * 55)

    # 중복 없이 모든 심볼을 한 번씩만 수집
    all_symbols = list(dict.fromkeys(US_TOP100 + NASDAQ100 + SP500_TOP100 + ETF_LIST))
    print(f'\n전체 {len(all_symbols)}개 심볼 수집 시작...\n')

    cache = {}
    for i, sym in enumerate(all_symbols):
        print(f'  [{i+1:3d}/{len(all_symbols)}] {sym:<8}', end=' ')
        cache[sym] = fetch_ticker(sym)
        d = cache[sym]
        price_str = f"${d['price']:.2f}" if d['price'] else 'N/A'
        pct_str = f"{d['changePct']:+.2f}%" if d['changePct'] is not None else ''
        print(f"{price_str:>12} {pct_str}")
        time.sleep(0.25)

    top100_data   = build_array(US_TOP100,    cache)
    nasdaq100_data = build_array(NASDAQ100,   cache)
    sp500_data    = build_array(SP500_TOP100, cache)
    etf_data      = build_array(ETF_LIST,     cache)

    ok_t = sum(1 for x in top100_data   if x['price'])
    ok_n = sum(1 for x in nasdaq100_data if x['price'])
    ok_s = sum(1 for x in sp500_data    if x['price'])
    ok_e = sum(1 for x in etf_data      if x['price'])

    output = {
        'generatedAt':    now_utc.isoformat(),
        'generatedAtKST': kst.strftime('%Y-%m-%d %H:%M KST'),
        'top100':    top100_data,
        'nasdaq100': nasdaq100_data,
        'sp500':     sp500_data,
        'etf':       etf_data,
    }

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, separators=(',', ':'))

    print('\n' + '=' * 55)
    print(f'  완료: {OUTPUT_PATH}')
    print(f'  시총100: {ok_t}/{len(top100_data)} | 나스닥: {ok_n}/{len(nasdaq100_data)} | S&P: {ok_s}/{len(sp500_data)} | ETF: {ok_e}/{len(etf_data)}')
    print('=' * 55)


if __name__ == '__main__':
    main()
