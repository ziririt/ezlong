#!/usr/bin/env python3
"""
주가 데이터 수집 스크립트 — stocks.html용 (GitHub Actions)
yfinance → data/stocks-data.json 저장

나스닥 100 + S&P 500 상위 100 + 주요 ETF
실행: python scripts/fetch-stocks-data.py
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

NASDAQ100 = [
    'NVDA', 'AAPL', 'MSFT', 'AMZN', 'META', 'TSLA', 'AVGO', 'GOOGL', 'GOOG', 'COST',
    'NFLX', 'ASML', 'AMD', 'ADBE', 'CSCO', 'TMUS', 'PEP', 'QCOM', 'INTU', 'CMCSA',
    'TXN', 'HON', 'AMGN', 'ISRG', 'SBUX', 'GILD', 'REGN', 'BKNG', 'VRTX', 'ADI',
    'PANW', 'LRCX', 'MU', 'KLAC', 'SNPS', 'CDNS', 'MRVL', 'CEG', 'ORLY', 'MAR',
    'FTNT', 'CHTR', 'KDP', 'DXCM', 'PAYX', 'MNST', 'CPRT', 'ROST', 'PCAR', 'ODFL',
    'FAST', 'IDXX', 'GEHC', 'EA', 'KHC', 'VRSK', 'EXC', 'CTAS', 'ROP', 'BIIB',
    'AEP', 'CTSH', 'CRWD', 'ANSS', 'LULU', 'TEAM', 'DDOG', 'ZS', 'MCHP', 'NXPI',
    'TTWO', 'EBAY', 'ON', 'DLTR', 'ILMN', 'WDAY', 'PYPL', 'FANG', 'SMCI', 'PLTR',
    'ABNB', 'APP', 'COIN', 'AXON', 'HOOD', 'ARM', 'MELI', 'SHOP', 'MRNA', 'ZM',
    'OKTA', 'SNOW', 'INTC', 'WBD', 'ENPH', 'CRSP', 'SIRI', 'RIVN', 'LCID', 'GFS',
]

SP500_TOP100 = [
    'NVDA', 'AAPL', 'MSFT', 'AMZN', 'META', 'GOOGL', 'GOOG', 'BRK-B', 'TSLA', 'AVGO',
    'JPM', 'LLY', 'UNH', 'XOM', 'V', 'MA', 'PG', 'JNJ', 'HD', 'COST',
    'ABBV', 'NFLX', 'BAC', 'MRK', 'KO', 'WMT', 'CVX', 'AMD', 'CRM', 'ADBE',
    'ORCL', 'PEP', 'TMO', 'ACN', 'LIN', 'MCD', 'CSCO', 'ABT', 'GE', 'DHR',
    'INTU', 'IBM', 'NOW', 'AMGN', 'ISRG', 'PM', 'TXN', 'QCOM', 'SPGI', 'BKNG',
    'AMAT', 'GS', 'CAT', 'BLK', 'AXP', 'VRTX', 'REGN', 'SYK', 'T', 'MS',
    'RTX', 'GILD', 'BSX', 'ETN', 'PLD', 'DE', 'ADI', 'LRCX', 'MU', 'KLAC',
    'NEE', 'CB', 'SCHW', 'SO', 'MMC', 'COP', 'EOG', 'PGR', 'ADP', 'UPS',
    'TJX', 'ICE', 'PANW', 'LOW', 'CME', 'WELL', 'CI', 'C', 'BMY', 'INTC',
    'ZTS', 'ELV', 'WM', 'CVS', 'PYPL', 'BA', 'USB', 'SBUX', 'MAR', 'MDLZ',
]

ETF_LIST = [
    'QQQ', 'SPY', 'IVV', 'VOO', 'VTI', 'IWM', 'SOXX', 'SMH', 'XLK', 'XLF',
    'XLE', 'XLV', 'XLY', 'XLI', 'ARKK', 'TQQQ', 'SQQQ', 'SOXL', 'SOXS', 'UPRO',
    'GLD', 'SLV', 'TLT', 'HYG', 'LQD', 'VNQ', 'XBI', 'IBB', 'ICLN', 'BOTZ',
]

# ─── 회사명 사전 ──────────────────────────────────────────────────────────────

COMPANY_NAMES = {
    'AAPL': 'Apple Inc.', 'MSFT': 'Microsoft Corp.', 'NVDA': 'NVIDIA Corp.',
    'AMZN': 'Amazon.com Inc.', 'META': 'Meta Platforms', 'GOOGL': 'Alphabet Inc. (A)',
    'GOOG': 'Alphabet Inc. (C)', 'TSLA': 'Tesla Inc.', 'AVGO': 'Broadcom Inc.',
    'COST': 'Costco Wholesale', 'NFLX': 'Netflix Inc.', 'ASML': 'ASML Holding',
    'AMD': 'Advanced Micro Dev.', 'ADBE': 'Adobe Inc.', 'CSCO': 'Cisco Systems',
    'PEP': 'PepsiCo Inc.', 'TMUS': 'T-Mobile US Inc.', 'QCOM': 'Qualcomm Inc.',
    'INTU': 'Intuit Inc.', 'CMCSA': 'Comcast Corp.', 'TXN': 'Texas Instruments',
    'HON': 'Honeywell Intl.', 'AMGN': 'Amgen Inc.', 'SBUX': 'Starbucks Corp.',
    'ISRG': 'Intuitive Surgical', 'GILD': 'Gilead Sciences', 'REGN': 'Regeneron Pharma.',
    'BKNG': 'Booking Holdings', 'VRTX': 'Vertex Pharmaceuticals', 'ADI': 'Analog Devices',
    'PANW': 'Palo Alto Networks', 'LRCX': 'Lam Research', 'MU': 'Micron Technology',
    'KLAC': 'KLA Corp.', 'SNPS': 'Synopsys Inc.', 'CDNS': 'Cadence Design',
    'MRVL': 'Marvell Technology', 'CEG': 'Constellation Energy', 'ORLY': "O'Reilly Auto",
    'MAR': 'Marriott Intl.', 'FTNT': 'Fortinet Inc.', 'CHTR': 'Charter Commun.',
    'KDP': 'Keurig Dr Pepper', 'DXCM': 'DexCom Inc.', 'PAYX': 'Paychex Inc.',
    'MNST': 'Monster Beverage', 'CPRT': 'Copart Inc.', 'ROST': 'Ross Stores',
    'PCAR': 'PACCAR Inc.', 'ODFL': 'Old Dominion Freight', 'FAST': 'Fastenal Co.',
    'IDXX': 'IDEXX Laboratories', 'GEHC': 'GE HealthCare', 'EA': 'Electronic Arts',
    'KHC': 'Kraft Heinz Co.', 'VRSK': 'Verisk Analytics', 'EXC': 'Exelon Corp.',
    'CTAS': 'Cintas Corp.', 'ROP': 'Roper Technologies', 'BIIB': 'Biogen Inc.',
    'AEP': 'American Electric Power', 'CTSH': 'Cognizant Technology', 'CRWD': 'CrowdStrike',
    'ANSS': 'ANSYS Inc.', 'LULU': 'Lululemon Athletica', 'TEAM': 'Atlassian Corp.',
    'DDOG': 'Datadog Inc.', 'ZS': 'Zscaler Inc.', 'MCHP': 'Microchip Technology',
    'NXPI': 'NXP Semiconductors', 'TTWO': 'Take-Two Interactive', 'EBAY': 'eBay Inc.',
    'ON': 'ON Semiconductor', 'DLTR': 'Dollar Tree Inc.', 'ILMN': 'Illumina Inc.',
    'WDAY': 'Workday Inc.', 'PYPL': 'PayPal Holdings', 'FANG': 'Diamondback Energy',
    'SMCI': 'Super Micro Computer', 'ABNB': 'Airbnb Inc.', 'APP': 'AppLovin Corp.',
    'PLTR': 'Palantir Technologies', 'COIN': 'Coinbase Global', 'AXON': 'Axon Enterprise',
    'HOOD': 'Robinhood Markets', 'ARM': 'Arm Holdings', 'MELI': 'MercadoLibre Inc.',
    'SHOP': 'Shopify Inc.', 'MRNA': 'Moderna Inc.', 'ZM': 'Zoom Video Commun.',
    'OKTA': 'Okta Inc.', 'SNOW': 'Snowflake Inc.', 'INTC': 'Intel Corp.',
    'WBD': 'Warner Bros. Discovery', 'ENPH': 'Enphase Energy', 'CRSP': 'CRISPR Therapeutics',
    'SIRI': 'Sirius XM Holdings', 'RIVN': 'Rivian Automotive', 'LCID': 'Lucid Group',
    'GFS': 'GlobalFoundries',
    # S&P 500 추가
    'BRK-B': 'Berkshire Hathaway B', 'JPM': 'JPMorgan Chase', 'LLY': 'Eli Lilly & Co.',
    'UNH': 'UnitedHealth Group', 'XOM': 'Exxon Mobil Corp.', 'V': 'Visa Inc.',
    'MA': 'Mastercard Inc.', 'PG': 'Procter & Gamble', 'JNJ': 'Johnson & Johnson',
    'HD': 'Home Depot Inc.', 'ABBV': 'AbbVie Inc.', 'BAC': 'Bank of America',
    'MRK': 'Merck & Co.', 'KO': 'Coca-Cola Co.', 'WMT': 'Walmart Inc.',
    'CVX': 'Chevron Corp.', 'CRM': 'Salesforce Inc.', 'ORCL': 'Oracle Corp.',
    'TMO': 'Thermo Fisher Scientific', 'ACN': 'Accenture PLC', 'LIN': 'Linde PLC',
    'MCD': "McDonald's Corp.", 'ABT': 'Abbott Laboratories', 'GE': 'GE Aerospace',
    'DHR': 'Danaher Corp.', 'IBM': 'IBM Corp.', 'NOW': 'ServiceNow Inc.',
    'PM': 'Philip Morris Intl.', 'SPGI': 'S&P Global Inc.', 'AMAT': 'Applied Materials',
    'GS': 'Goldman Sachs', 'CAT': 'Caterpillar Inc.', 'BLK': 'BlackRock Inc.',
    'AXP': 'American Express', 'SYK': 'Stryker Corp.', 'T': 'AT&T Inc.',
    'MS': 'Morgan Stanley', 'RTX': 'RTX Corp.', 'BSX': 'Boston Scientific',
    'ETN': 'Eaton Corp.', 'PLD': 'Prologis Inc.', 'DE': 'Deere & Co.',
    'NEE': 'NextEra Energy', 'CB': 'Chubb Ltd.', 'SCHW': 'Charles Schwab',
    'SO': 'Southern Co.', 'MMC': 'Marsh & McLennan', 'COP': 'ConocoPhillips',
    'EOG': 'EOG Resources', 'PGR': 'Progressive Corp.', 'ADP': 'ADP Inc.',
    'UPS': 'UPS Inc.', 'TJX': 'TJX Companies', 'ICE': 'Intercontinental Exchange',
    'LOW': "Lowe's Companies", 'CME': 'CME Group Inc.', 'WELL': 'Welltower Inc.',
    'CI': 'The Cigna Group', 'C': 'Citigroup Inc.', 'BMY': 'Bristol-Myers Squibb',
    'ZTS': 'Zoetis Inc.', 'ELV': 'Elevance Health', 'WM': 'Waste Management',
    'CVS': 'CVS Health Corp.', 'BA': 'Boeing Co.', 'USB': 'US Bancorp',
    'MDLZ': 'Mondelez Intl.',
    # ETF
    'QQQ': 'Invesco QQQ Trust', 'SPY': 'SPDR S&P 500 ETF', 'IVV': 'iShares Core S&P 500',
    'VOO': 'Vanguard S&P 500', 'VTI': 'Vanguard Total Stock Market', 'IWM': 'iShares Russell 2000',
    'SOXX': 'iShares Semiconductor ETF', 'SMH': 'VanEck Semiconductor ETF',
    'XLK': 'Technology Select Sector', 'XLF': 'Financial Select Sector',
    'XLE': 'Energy Select Sector', 'XLV': 'Health Care Select Sector',
    'XLY': 'Consumer Discretionary Sector', 'XLI': 'Industrial Select Sector',
    'ARKK': 'ARK Innovation ETF', 'TQQQ': 'ProShares UltraPro QQQ',
    'SQQQ': 'ProShares UltraPro Short QQQ', 'SOXL': 'Direxion Semicon. Bull 3X',
    'SOXS': 'Direxion Semicon. Bear 3X', 'UPRO': 'ProShares UltraPro S&P500',
    'GLD': 'SPDR Gold Shares', 'SLV': 'iShares Silver Trust',
    'TLT': 'iShares 20+ Year Treasury Bond', 'HYG': 'iShares High Yield Corp Bond',
    'LQD': 'iShares IG Corporate Bond', 'VNQ': 'Vanguard Real Estate ETF',
    'XBI': 'SPDR Biotech ETF', 'IBB': 'iShares Biotechnology ETF',
    'ICLN': 'iShares Global Clean Energy', 'BOTZ': 'Global X Robotics & AI ETF',
}

OUTPUT_PATH = os.path.normpath(
    os.path.join(os.path.dirname(__file__), '..', 'data', 'stocks-data.json')
)


# ─── 수집 함수 ────────────────────────────────────────────────────────────────

def get_sparkline(ticker_obj, days=5):
    """최근 5거래일 종가 배열 반환"""
    try:
        hist = ticker_obj.history(period='5d', interval='1d')
        if hist.empty:
            return []
        closes = [round(float(c), 2) for c in hist['Close'].tolist()]
        return closes[-days:]
    except Exception:
        return []


def fetch_ticker(symbol):
    """단일 종목 데이터 수집"""
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


def fetch_list(symbols, label):
    print(f"\n[{label}] {len(symbols)}개 수집 시작...")
    results = []
    for i, sym in enumerate(symbols):
        print(f"  [{i+1:3d}/{len(symbols)}] {sym:<8}", end=' ')
        data = fetch_ticker(sym)
        price_str = f"${data['price']:.2f}" if data['price'] else 'N/A'
        pct_str = f"{data['changePct']:+.2f}%" if data['changePct'] is not None else ''
        print(f"{price_str:>10} {pct_str}")
        data['rank'] = i + 1
        results.append(data)
        time.sleep(0.25)  # rate limit 방지
    return results


# ─── 메인 ─────────────────────────────────────────────────────────────────────

def main():
    now_utc = datetime.now(timezone.utc)
    kst = now_utc + timedelta(hours=9)

    print('=' * 50)
    print('  주가 데이터 수집 — stocks-data.json')
    print(f'  실행: {kst.strftime("%Y-%m-%d %H:%M KST")}')
    print('=' * 50)

    nasdaq100_data = fetch_list(NASDAQ100, '나스닥 100')
    time.sleep(2)

    sp500_data = fetch_list(SP500_TOP100, 'S&P 500 상위 100')
    time.sleep(2)

    etf_data = fetch_list(ETF_LIST, '주요 ETF')

    success_n = sum(1 for x in nasdaq100_data if x['price'])
    success_s = sum(1 for x in sp500_data if x['price'])
    success_e = sum(1 for x in etf_data if x['price'])

    output = {
        'generatedAt': now_utc.isoformat(),
        'generatedAtKST': kst.strftime('%Y-%m-%d %H:%M KST'),
        'nasdaq100': nasdaq100_data,
        'sp500': sp500_data,
        'etf': etf_data,
    }

    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, separators=(',', ':'))

    print('\n' + '=' * 50)
    print(f'  완료: {OUTPUT_PATH}')
    print(f'  나스닥100: {success_n}/{len(nasdaq100_data)} | S&P500: {success_s}/{len(sp500_data)} | ETF: {success_e}/{len(etf_data)}')
    print('=' * 50)


if __name__ == '__main__':
    main()
