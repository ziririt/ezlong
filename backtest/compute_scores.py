"""과거 전 구간에 대해 현행 buyScore/sellScore를 재계산한다.

핵심: 점수 로직을 재구현하지 않고 scripts/fetch-market-data.py의
calc_buy_score / calc_sell_score / calc_* 함수를 그대로 import해서 쓴다.
(재구현하면 라이브와 어긋나는 순간 진단 전체가 무효가 된다)
"""
import importlib.util, os, sys
import pandas as pd

_HERE = os.path.dirname(os.path.abspath(__file__))
_SPEC = importlib.util.spec_from_file_location(
    'fmd', os.path.join(_HERE, '..', 'scripts', 'fetch-market-data.py'))
fmd = importlib.util.module_from_spec(_SPEC)
_orig_argv = sys.argv
try:
    _SPEC.loader.exec_module(fmd)   # main()은 __main__ 가드 뒤라 실행 안 됨
finally:
    sys.argv = _orig_argv


def load_csv(sym):
    fn = sym.replace('^', '_') + '.csv'
    df = pd.read_csv(os.path.join(_HERE, 'data', fn), parse_dates=['Date'], index_col='Date')
    return df


def daily_scores(sym, vix_close):
    """sym의 전체 히스토리에 대해 일자별 buy/sell score + 지표 DataFrame 반환.

    vix_close: 날짜 index의 VIX 종가 Series (심볼 df와 날짜 정렬은 reindex로 맞춘다)
    """
    df = load_csv(sym)
    closes = df['Close'].tolist()
    highs = df['High'].tolist()
    lows = df['Low'].tolist()
    vols = df['Volume'].tolist()
    vix_al = vix_close.reindex(df.index).ffill().fillna(18.0).tolist()

    rows = []
    # 지표 안정화를 위해 최소 220일 이후부터 산출 (200SMA 필요)
    for i in range(220, len(df)):
        c = closes[: i + 1]
        h = highs[: i + 1]
        l = lows[: i + 1]
        v = vols[: i + 1]
        price = c[-1]
        sma5 = fmd.calc_sma(c, 5)
        sma50 = fmd.calc_sma(c, 50)
        sma200 = fmd.calc_sma(c, 200)
        rsi = fmd.calc_rsi(c)
        macd = fmd.calc_macd(c)
        lookback = c[-252:]
        high52, low52 = max(lookback), min(lookback)
        rsi5d_ago = fmd.calc_rsi(c[:-5]) if len(c) > 25 else None
        macd5d = fmd.calc_macd(c[:-5]) if len(c) > 40 else None
        hist5d_ago = macd5d['histogram'] if macd5d else None
        high5d, low5d = max(c[-5:]), min(c[-5:])
        high20d_excl = max(c[-25:-5]) if len(c) >= 25 else None
        low20d_excl = min(c[-25:-5]) if len(c) >= 25 else None
        vol_ratio = None
        if len(v) >= 21 and v[-1]:
            avg20 = sum(v[-21:-1]) / 20
            vol_ratio = (v[-1] / avg20) if avg20 else None
        up_days5 = sum(1 for j in range(-5, 0) if c[j] > c[j - 1])
        adx = fmd.calc_adx(h, l, c)
        vix = vix_al[i]

        buy = fmd.calc_buy_score(price, sma5, sma50, sma200, rsi, macd, high52, low52, vix,
                                 rsi5d_ago, hist5d_ago, high5d, low5d,
                                 high20d_excl, low20d_excl, vol_ratio, up_days5, adx)
        sell = fmd.calc_sell_score(price, sma5, sma200, rsi, macd, high52, low52, vix,
                                   rsi5d_ago, hist5d_ago, high5d, low5d,
                                   high20d_excl, low20d_excl, adx)
        dev200 = (price - sma200) / sma200 * 100 if sma200 else None
        # ATR14 (Wilder) — 신규 지표 후보: 트랜치 간격/손절에 사용
        trs = []
        for j in range(max(1, i - 13), i + 1):
            tr = max(highs[j] - lows[j], abs(highs[j] - closes[j - 1]), abs(lows[j] - closes[j - 1]))
            trs.append(tr)
        atr = sum(trs) / len(trs)
        rows.append({
            'date': df.index[i], 'close': price, 'high': h[-1], 'low': l[-1],
            'buy': buy, 'sell': sell, 'rsi': rsi, 'dev200': dev200,
            'gear': fmd.get_gear(dev200), 'vix': vix, 'adx': adx,
            'atr_pct': atr / price * 100, 'sma200': sma200,
            'macd_hist': macd['histogram'] if macd else None,
        })
    out = pd.DataFrame(rows).set_index('date')
    return out


def composite(frames, weights):
    """여러 심볼 점수 프레임을 라이브와 동일한 가중평균(QQQ4:VOO3:SOXX3)으로 합성."""
    idx = None
    for f in frames:
        idx = f.index if idx is None else idx.intersection(f.index)
    comp = pd.DataFrame(index=idx)
    for col in ('buy', 'sell', 'gear'):
        num = sum(f.loc[idx, col] * w for f, w in zip(frames, weights))
        comp[col] = (num / sum(weights)).round().astype(int)
    base = frames[0].loc[idx]  # QQQ 세부 지표는 첫 프레임 기준 (라이브와 동일)
    for col in ('close', 'high', 'low', 'rsi', 'dev200', 'vix', 'adx', 'atr_pct', 'sma200', 'macd_hist'):
        comp[col] = base[col]
    return comp


if __name__ == '__main__':
    vix = load_csv('^VIX')['Close']
    cache_dir = os.path.join(_HERE, 'scores')
    os.makedirs(cache_dir, exist_ok=True)
    frames = {}
    for sym in ['QQQ', 'VOO', 'SOXX', 'TSLA', 'NVDA']:
        s = daily_scores(sym, vix)
        s.to_csv(os.path.join(cache_dir, f'{sym}.csv'))
        frames[sym] = s
        print(sym, len(s), s.index[0].date(), '→', s.index[-1].date(),
              'buy median', int(s['buy'].median()))
    comp = composite([frames['QQQ'], frames['VOO'], frames['SOXX']], [4, 3, 3])
    comp.to_csv(os.path.join(cache_dir, 'COMP.csv'))
    print('COMP', len(comp), 'band B+ days:', int((comp['buy'] >= 65).sum()))
