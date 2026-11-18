#!/usr/bin/env python3
"""스윙 판정 규칙 간이 백테스트 (2026-11-19).

generate-swing-view.py 의 advance() 를 그대로 불러 backtest/scores/COMP_weekly.csv
(2015-06 ~ 2026-07, 일별 매수·매도 점수, 추세 단계, 200일선 이격, 30주선 이탈 지수 수)에 돌린다.
가정: 그날 종가에 판정하고 다음 거래일 수익률에 그날 비중을 곱한다. 현금 이자·수수료·세금 없음.
정식 백테스트(2026-07-31 보고서)와 체결 가정이 다를 수 있으므로, 숫자의 절대값보다 설정 간 차이를 본다.

쓰는 법: python3 scripts/backtest-swing-simple.py
"""
import csv, importlib.util, os

HERE = os.path.dirname(os.path.abspath(__file__))
sp = importlib.util.spec_from_file_location('gsv', os.path.join(HERE, 'generate-swing-view.py'))
G = importlib.util.module_from_spec(sp); sp.loader.exec_module(G)

rows = list(csv.DictReader(open(os.path.join(HERE, '..', 'backtest', 'scores', 'COMP_weekly.csv'))))


def run(base_g1, stop_floor, start=None, end=None):
    G.CFG['base_g1'], G.CFG['stop_floor'] = base_g1, stop_floor
    st, eq, peak, mdd, days, prev_close, expo = {}, 1.0, 1.0, 0.0, 0, None, 0.0
    first = last = None
    for r in rows:
        d = r['date']; close = float(r['close'])
        in_win = (start is None or d >= start) and (end is None or d <= end)
        if prev_close is not None and in_win:
            eq *= 1 + expo * (close / prev_close - 1)
            peak = max(peak, eq); mdd = min(mdd, eq / peak - 1); days += 1
            first = first or d; last = d
        bc = float(r['below_cnt'] or 0)
        cap = 0.0 if bc >= 3 else (0.2 if bc >= 2 else None)
        G.advance(st, d, close, int(float(r['buy'])), int(float(r['sell'])), int(float(r['gear'])),
                  float(r['dev200']) if r['dev200'] else None, cap=cap)
        expo, prev_close = st['exposure'], close
    cagr = eq ** (252 / days) - 1 if days else 0
    return cagr * 100, mdd * 100, eq, first, last


def hold(start=None, end=None):
    eq, peak, mdd, days, prev = 1.0, 1.0, 0.0, 0, None
    for r in rows:
        d = r['date']; c = float(r['close'])
        if prev is not None and (start is None or d >= start) and (end is None or d <= end):
            eq *= c / prev; peak = max(peak, eq); mdd = min(mdd, eq / peak - 1); days += 1
        prev = c
    return (eq ** (252 / days) - 1) * 100, mdd * 100, eq


for name, s, e in (('전체 2015-06~2026-07', None, None), ('2021-01~2026-07', '2021-01-01', None),
                   ('2022년', '2022-01-01', '2022-12-31')):
    print(f'[{name}]')
    c, m, q = hold(s, e)
    print(f'  QQQ 그냥 보유              연 {c:+.1f}%  최대낙폭 {m:.1f}%  {q:.2f}배')
    for lab, g1, sf in (('옛 규칙  (하락 0% · 손절 0%)', 0.0, 0.0), ('중간    (하락 20% · 손절 0%)', 0.2, 0.0),
                        ('새 규칙  (하락 20% · 손절 20%)', 0.2, 0.2)):
        c, m, q, _, _ = run(g1, sf, s, e)
        print(f'  {lab}  연 {c:+.1f}%  최대낙폭 {m:.1f}%  {q:.2f}배')
