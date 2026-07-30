"""신구 알고리즘 백테스트 비교.

베이스라인:
  B&H        — 첫날 전액 매수 후 보유
  LITERAL    — 현행 사이트 문구를 그대로 따르는 유저 모델:
               compBuy 65+ 밴드 '첫날'마다 30% 매수(현금 소진까지),
               compSell 65+ 밴드 첫날마다 보유분 30% 매도, 손절 없음
  CAMPAIGN   — 신규 캠페인 원장 (campaign.py)

지표: CAGR, MaxDD, 총 매매 횟수, 메시지 변화율(어제와 다른 안내가 나온 날 비율)
검증: 파라미터는 2014~2020 구간에서만 조정, 2021~ 구간은 아웃오브샘플로 고정 평가
"""
import json
import os
import sys
import pandas as pd
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import campaign

HERE = os.path.dirname(os.path.abspath(__file__))


def load_scores(name):
    df = pd.read_csv(os.path.join(HERE, 'scores', f'{name}.csv'),
                     parse_dates=['date'], index_col='date')
    return df


def metrics(eq, msgs=None):
    s = pd.Series({d: v for d, v in eq})
    yrs = (s.index[-1] - s.index[0]).days / 365.25
    cagr = (s.iloc[-1] / s.iloc[0]) ** (1 / yrs) - 1 if yrs > 0 else 0
    dd = (s / s.cummax() - 1).min()
    daily = s.pct_change().dropna()
    sharpe = daily.mean() / daily.std() * np.sqrt(252) if daily.std() > 0 else 0
    out = dict(final=round(float(s.iloc[-1]), 3), cagr=round(float(cagr) * 100, 2),
               maxdd=round(float(dd) * 100, 2), sharpe=round(float(sharpe), 2))
    if msgs is not None:
        changes = sum(1 for a, b in zip(msgs, msgs[1:]) if a != b)
        actionable = sum(1 for m in msgs if m != 'WAIT')
        out['msg_change_rate'] = round(changes / max(1, len(msgs) - 1) * 100, 1)
        out['action_days'] = actionable
    return out


def run_bh(df):
    price0 = df['close'].iloc[0]
    eq = [(d, r['close'] / price0) for d, r in df.iterrows()]
    return metrics(eq)


def run_literal(df, band=65):
    """현행 문구 추종 모델 — 무기억의 실제 비용을 측정한다."""
    cash, shares = 1.0, 0.0
    prev_b = prev_s = False
    eq = []
    trades = 0
    for d, r in df.iterrows():
        p = r['close']
        in_b = r['buy'] >= band
        in_s = r['sell'] >= band
        if in_b and not prev_b and cash > 1e-9:      # B밴드 첫날 30% 매수
            spend = min(cash, 0.30)
            shares += spend / p
            cash -= spend
            trades += 1
        if in_s and not prev_s and shares > 1e-12:   # 매도밴드 첫날 30% 매도
            qty = shares * 0.30
            shares -= qty
            cash += qty * p
            trades += 1
        prev_b, prev_s = in_b, in_s
        eq.append((d, cash + shares * p))
    m = metrics(eq)
    m['trades'] = trades
    return m


def run_campaign(df, cfg=None):
    L, eq, msgs = campaign.run(df, cfg)
    m = metrics(eq, msgs)
    m['trades'] = len([x for x in L.log])
    m['campaigns'] = sum(1 for x in L.log if x[1] == 'ENTER1')
    return m, L


def split(df, cut='2021-01-01'):
    return df[df.index < cut], df[df.index >= cut]


def main():
    results = {}
    for name in ['COMP', 'TSLA', 'NVDA']:
        df = load_scores(name)
        tune, valid = split(df)
        row = {}
        for label, part in [('IS(~2020)', tune), ('OOS(2021~)', valid), ('FULL', df)]:
            if len(part) < 300:
                continue
            r = {}
            r['BH'] = run_bh(part)
            r['LITERAL'] = run_literal(part)
            m, L = run_campaign(part)
            r['CAMPAIGN'] = m
            row[label] = r
        results[name] = row
        print(f"\n=== {name} ===")
        for label, r in row.items():
            print(f"  [{label}]")
            for k, v in r.items():
                print(f"    {k:9s} {v}")
    os.makedirs(os.path.join(HERE, 'results'), exist_ok=True)
    with open(os.path.join(HERE, 'results', 'summary.json'), 'w') as f:
        json.dump(results, f, ensure_ascii=False, indent=1)
    print('\nsaved → backtest/results/summary.json')


if __name__ == '__main__':
    main()
