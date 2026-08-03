"""10년치 일봉 OHLCV + VIX 수집 → backtest/data/*.csv (백테스트 전용, 사이트 무관)"""
import yfinance as yf, os
os.makedirs('backtest/data', exist_ok=True)
SYMS = ['QQQ','VOO','SOXX','TSLA','NVDA','TQQQ','SOXL','SPY','RSP','^VIX',
        # TOP9 집중분석 확장 (2026-08-03): 빅테크 7종 추가
        'AAPL','MSFT','GOOG','AMZN','META','AVGO','TSM']
for s in SYMS:
    df = yf.Ticker(s).history(period='12y', interval='1d', auto_adjust=False)
    if df is None or df.empty:
        raise SystemExit(f'empty: {s}')
    df = df[['Open','High','Low','Close','Volume']]
    df.index = df.index.tz_localize(None)
    fn = s.replace('^','_') + '.csv'
    df.to_csv(f'backtest/data/{fn}')
    print(s, len(df), df.index[0].date(), '→', df.index[-1].date())
