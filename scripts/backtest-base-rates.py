"""88항 원칙 7·8 — 점수의 기저율을 실측하고 data/base-rates.json 을 만든다.

왜 이 파일이 있나
-----------------
화면은 "매수 매력도 74점"이라고만 말한다. 74가 좋은 숫자인지 나쁜 숫자인지는
아무 데도 안 적혀 있다. 기준이 없는 숫자는 정보가 아니라 장식이다(원칙 8).
그래서 같은 점수대에서 **과거에 실제로 어떻게 됐는지**를 옆에 붙인다.

같은 자료로 원칙 7(점수식에 방향 항을 더할 것인가)도 판정한다.

설계 원칙
---------
- **점수식을 재구현하지 않는다.** fetch-market-data.py 의 함수를 그대로 import 한다.
  옮겨 적으면 '화면에 뜨는 점수'가 아니라 '내가 옮겨 적은 점수'를 재게 된다.
- **미래를 보지 않는다.** 거래일 t 의 점수는 t 까지의 종가만으로 낸다.
- **워밍업 250거래일은 버린다.** 200일선·52주 고저가 안정될 때까지.

실행
----
    python3 scripts/backtest-base-rates.py <데이터폴더> [--write]

데이터폴더에 SOXX.csv QQQ.csv VOO.csv VIX.csv (yfinance to_csv 형식)가 있어야 한다.
샌드박스에서는 야후가 막혀 있어 맥에서 받는다:

    python3 -c "import yfinance as yf
    for s,n in [('SOXX','SOXX'),('QQQ','QQQ'),('VOO','VOO'),('^VIX','VIX')]:
        d=yf.download(s,period='6y',interval='1d',progress=False,auto_adjust=False,threads=False)
        d.columns=[c[0] if isinstance(c,tuple) else c for c in d.columns]; d.to_csv(n+'.csv')"

--write 를 주면 data/base-rates.json 을 덮어쓴다.
"""
import csv
import json
import os
import sys
import importlib.util
import statistics as st
from datetime import datetime, timezone, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, 'data', 'base-rates.json')

WARMUP = 250                       # 200일선·52주 고저 안정 구간
HORIZONS = (5, 20)                 # 스윙 보유 기간: 1주 / 1개월
SYMBOLS = ('SOXX', 'QQQ', 'VOO')   # 화면 종합 점수를 만드는 셋과 같다
BANDS = ('0-37', '38-49', '50-64', '65-79', '80+')
MIN_N = 20                         # 이보다 적으면 숫자를 말하지 않는다


def _load_score_fn():
    spec = importlib.util.spec_from_file_location(
        'fmd', os.path.join(HERE, 'fetch-market-data.py'))
    m = importlib.util.module_from_spec(spec)
    sys.modules['fmd'] = m
    spec.loader.exec_module(m)
    return m


def load_csv(folder, name):
    rows = []
    with open(os.path.join(folder, name + '.csv'), newline='') as f:
        for r in csv.DictReader(f):
            d = (r.get('Date') or r.get('') or '')[:10]
            if not d or not d[0].isdigit():
                continue
            try:
                rows.append((d, float(r['High']), float(r['Low']),
                             float(r['Close']), float(r.get('Volume') or 0)))
            except (ValueError, KeyError, TypeError):
                continue
    rows.sort()
    return rows


def band_of(b):
    if b >= 80: return '80+'
    if b >= 65: return '65-79'
    if b >= 50: return '50-64'
    if b >= 38: return '38-49'
    return '0-37'


def summarize(vals):
    """표본이 MIN_N 미만이면 None. 모르는 것은 모른다고 한다."""
    if len(vals) < MIN_N:
        return {'n': len(vals), 'enough': False}
    s = sorted(vals)
    return {
        'n': len(vals), 'enough': True,
        'win': round(sum(1 for v in vals if v > 0) / len(vals) * 100, 1),
        'avg': round(sum(vals) / len(vals), 2),
        'med': round(st.median(vals), 2),
        'p10': round(s[max(0, int(len(s) * 0.10) - 1)], 2),
        'p90': round(s[min(len(s) - 1, int(len(s) * 0.90))], 2),
    }


def run(folder):
    fmd = _load_score_fn()
    vix_by_date = {r[0]: r[3] for r in load_csv(folder, 'VIX')}
    recs = []
    for sym in SYMBOLS:
        rows = load_csv(folder, sym)
        dates = [r[0] for r in rows]
        highs = [r[1] for r in rows]
        lows = [r[2] for r in rows]
        closes = [r[3] for r in rows]
        vols = [r[4] for r in rows]
        for i in range(WARMUP, len(rows) - max(HORIZONS)):
            d = fmd.process_symbol(closes[:i + 1], vols[:i + 1],
                                   highs[:i + 1], lows[:i + 1], sym,
                                   vix_by_date.get(dates[i]))
            rec = {'sym': sym, 'date': dates[i], 'buy': d['buyScore'],
                   'gear': d['gear'], 'dev200': d['dev200']}
            for h in HORIZONS:
                rec[f'r{h}'] = (closes[i + h] - closes[i]) / closes[i] * 100
            recs.append(rec)
        print(f'  {sym}: {sum(1 for r in recs if r["sym"] == sym)}일', flush=True)
    return recs


def run_composite(folder):
    """화면 최상단의 숫자는 개별 종목 점수가 아니라 **종합 점수**다.
    buildTruth() 와 같은 가중치(QQQ 4 : VOO 3 : SOXX 3)로 합성한 점수를 쓰고,
    미래 수익률도 같은 가중치의 합성 수익률로 잰다.
    개별 종목으로 잰 기저율을 종합 점수 옆에 붙이면 다른 것을 재는 것이 된다."""
    fmd = _load_score_fn()
    vix_by_date = {r[0]: r[3] for r in load_csv(folder, 'VIX')}
    W = {'QQQ': 4, 'VOO': 3, 'SOXX': 3}
    per = {}
    for sym in SYMBOLS:
        rows = load_csv(folder, sym)
        per[sym] = {
            'dates': [r[0] for r in rows], 'high': [r[1] for r in rows],
            'low': [r[2] for r in rows], 'close': [r[3] for r in rows],
            'vol': [r[4] for r in rows],
        }
    # 세 종목이 모두 가진 날짜만 쓴다(휴장·상장 차이 방어)
    common = sorted(set(per['QQQ']['dates']) & set(per['VOO']['dates']) & set(per['SOXX']['dates']))
    idx = {s: {d: i for i, d in enumerate(per[s]['dates'])} for s in SYMBOLS}
    recs = []
    for ci in range(WARMUP, len(common) - max(HORIZONS)):
        day = common[ci]
        parts, rets, ok = [], {h: [] for h in HORIZONS}, True
        gear_w = 0
        dev_w = 0
        for sym in SYMBOLS:
            i = idx[sym].get(day)
            if i is None or i < WARMUP or i + max(HORIZONS) >= len(per[sym]['close']):
                ok = False
                break
            P = per[sym]
            d = fmd.process_symbol(P['close'][:i + 1], P['vol'][:i + 1],
                                   P['high'][:i + 1], P['low'][:i + 1], sym,
                                   vix_by_date.get(day))
            parts.append((W[sym], d['buyScore']))
            gear_w += W[sym] * (d['gear'] or 2)
            dev_w += W[sym] * (d['dev200'] or 0)
            for h in HORIZONS:
                fi = idx[sym][common[ci + h]] if common[ci + h] in idx[sym] else None
                if fi is None:
                    ok = False
                    break
                rets[h].append((W[sym], (P['close'][fi] - P['close'][i]) / P['close'][i] * 100))
            if not ok:
                break
        if not ok:
            continue
        tw = sum(w for w, _ in parts)
        rec = {'date': day, 'sym': 'COMP',
               'buy': round(sum(w * v for w, v in parts) / tw),
               'gear': round(gear_w / tw), 'dev200': dev_w / tw}
        for h in HORIZONS:
            rec[f'r{h}'] = sum(w * v for w, v in rets[h]) / tw
        recs.append(rec)
    print(f'  COMPOSITE: {len(recs)}일', flush=True)
    return recs


def devband(d):
    if d > 10:  return '>+10'
    if d > 2:   return '+2~+10'
    if d > -2:  return '-2~+2'
    if d > -10: return '-10~-2'
    return '<-10'


DEVBANDS = ('>+10', '+2~+10', '-2~+2', '-10~-2', '<-10')


def build(recs):
    dates = sorted(r['date'] for r in recs)
    out = {
        'generatedAt': datetime.now(timezone(timedelta(hours=9))).strftime('%Y-%m-%d %H:%M KST'),
        'period': {'from': dates[0], 'to': dates[-1]},
        'symbols': list(SYMBOLS),
        'warmupDays': WARMUP,
        'minSample': MIN_N,
        'note': ('과거 실측이지 미래 예측이 아니다. 표본이 %d일 미만인 칸은 숫자를 내지 않는다.' % MIN_N),
        'bands': list(BANDS),
        'horizons': list(HORIZONS),
        'byBand': {}, 'bySymbolBand': {}, 'byBandGear': {}, 'highScoreByDev': {},
        'composite': {},          # 화면 최상단 종합 점수용 (QQQ4:VOO3:SOXX3)
    }
    for h in HORIZONS:
        k = f'r{h}'
        out['byBand'][str(h)] = {
            b: summarize([r[k] for r in recs if band_of(r['buy']) == b]) for b in BANDS}
        out['bySymbolBand'][str(h)] = {
            s: {b: summarize([r[k] for r in recs if r['sym'] == s and band_of(r['buy']) == b])
                for b in BANDS} for s in SYMBOLS}
        out['byBandGear'][str(h)] = {
            b: {str(g): summarize([r[k] for r in recs
                                   if band_of(r['buy']) == b and r['gear'] == g])
                for g in (1, 2, 3)} for b in BANDS}
        hi = [r for r in recs if r['buy'] >= 65]
        out['highScoreByDev'][str(h)] = {
            d: summarize([r[k] for r in hi if devband(r['dev200']) == d]) for d in DEVBANDS}
    return out


def build_composite(recs):
    out = {'weights': {'QQQ': 4, 'VOO': 3, 'SOXX': 3}, 'byBand': {}, 'byDev': {}}
    dates = sorted(r['date'] for r in recs)
    out['period'] = {'from': dates[0], 'to': dates[-1]}
    out['n'] = len(recs)
    for h in HORIZONS:
        k = f'r{h}'
        out['byBand'][str(h)] = {
            b: summarize([r[k] for r in recs if band_of(r['buy']) == b]) for b in BANDS}
        hi = [r for r in recs if r['buy'] >= 65]
        out['byDev'][str(h)] = {
            d: summarize([r[k] for r in hi if devband(r['dev200']) == d]) for d in DEVBANDS}
    return out


def main():
    folder = sys.argv[1] if len(sys.argv) > 1 else '.'
    write = '--write' in sys.argv
    print(f'백테스트: {folder} (워밍업 {WARMUP}일, 지평 {HORIZONS})')
    recs = run(folder)
    res = build(recs)
    res['composite'] = build_composite(run_composite(folder))
    print(f'\n기간 {res["period"]["from"]} ~ {res["period"]["to"]} · 표본 {len(recs)}일\n')
    for h in HORIZONS:
        print(f'-- 매수점수 구간별 {h}거래일 뒤 (3종목 합산) --')
        for b in BANDS:
            s = res['byBand'][str(h)][b]
            if s['enough']:
                print(f'  {b:<8} n={s["n"]:<5} 승률 {s["win"]:>5.1f}%  평균 {s["avg"]:+6.2f}%  중앙 {s["med"]:+6.2f}%')
            else:
                print(f'  {b:<8} n={s["n"]:<5} 표본 부족')
        print()
    print('== 종합 점수(화면 최상단과 같은 가중치) ==')
    for hz in HORIZONS:
        print(f'-- 종합 매수점수 구간별 {hz}거래일 뒤 --')
        for b in BANDS:
            s2 = res['composite']['byBand'][str(hz)][b]
            if s2['enough']:
                print(f'  {b:<8} n={s2["n"]:<5} 승률 {s2["win"]:>5.1f}%  평균 {s2["avg"]:+6.2f}%  중앙 {s2["med"]:+6.2f}%')
            else:
                print(f'  {b:<8} n={s2["n"]:<5} 표본 부족')
        print()

    print('-- 매수 65+ 안에서 200일선 위치별 (20거래일) --')
    for d in DEVBANDS:
        s = res['highScoreByDev']['20'][d]
        if s['enough']:
            print(f'  dev200 {d:<8} n={s["n"]:<5} 승률 {s["win"]:>5.1f}%  평균 {s["avg"]:+6.2f}%')
        else:
            print(f'  dev200 {d:<8} n={s["n"]:<5} 표본 부족')
    if write:
        os.makedirs(os.path.dirname(OUT), exist_ok=True)
        with open(OUT, 'w', encoding='utf-8') as f:
            json.dump(res, f, ensure_ascii=False, indent=1)
        print(f'\n기록: {OUT}')
    else:
        print('\n(--write 를 주면 data/base-rates.json 을 덮어쓴다)')


if __name__ == '__main__':
    main()
