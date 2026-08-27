#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""주간 위험 진단 데이터를 만든다.

무엇을 답하는 화면인가
  "지금 위험이 **어디에서** 커지고 있나." 시장 국면 진단(/market-regime.html)이
  '지금 어느 단계인가'를 판정한다면, 이 화면은 그 단계를 만드는 네 축을 따로
  떼어 **일주일 사이 어느 쪽이 나빠졌는지**를 본다. 판정이 아니라 변화가 주인공이다.

네 축 — 엔진이 이미 계산한 값을 그대로 쓴다
  · 시장 과열(exuberance)     — 가격이 실제 흐름보다 얼마나 앞서 달렸나
  · 내부 취약성(fragility)    — 겉은 멀쩡해도 속이 약해졌나
  · 추세 붕괴(breakdown)      — 실제로 무너지기 시작한 신호가 몇 개 켜졌나
  · 회복 부진(100 − repair)   — 무너진 뒤 되돌아오지 못한 정도

  네 값을 하나로 합치지 않는다. 합치는 순간 "무엇이 나빠졌나"가 사라지고 숫자
  하나만 남는다 — 이 화면이 존재하는 이유가 바로 그 분해다.

네 축의 방향을 하나로 맞춘다
  엔진의 repair 는 '높을수록 좋다'라서 혼자만 반대였다. 화면에서는 뒤집어
  **회복 부진**(100 − repair)으로 싣는다. 넷 다 '오르면 위험'이 되므로 숫자의
  부호와 색이 언제나 같이 움직인다 — 읽는 사람이 축마다 방향을 외울 필요가 없다.

몇 개가 동시에 켜졌나 — 과열만 시계가 다르다
  각 축이 제 분포의 상위 20% 안에 들면 '켜짐'으로 본다(축마다 분포가 달라 절대
  기준 하나로는 못 잰다). 그런데 과열은 붕괴와 상관 −0.68 이다. 꼭대기에서
  켜지고 나머지 셋은 무너진 뒤에 켜져서, **같은 주에 넷이 켜지는 일은 없다**
  (1,138주 중 0주).

  그렇다고 과열을 빼면 안 된다 — 실측하면 셋이 동시 점등된 15개 구간 중 14개가
  **직전 52주 안에 과열 점등을 거쳤다**(26주 기준 10개). 폭락은 과열 끝에 온다.
  반대로 과열 단독은 예보력이 약하다(과열 점등 66회 중 26주 안에 위기가 온 건
  23%). 즉 과열은 동시 신호가 아니라 **선행 조건**이다.

  그래서 과열만 `LOOKBACK_WEEKS`(26주) 안에 한 번이라도 점등했으면 켜진 것으로
  본다. 이 기준에서 네 축 동시 점등은 48주(4.2%)·11개 구간이고, 전부 실제
  위기다 — 2007-08 신용경색, 2008-01~03, 2010-05 유럽, 2011-08 신용등급 강등,
  2012-05, 2015-12~2016-02, 2020-02~03 코로나, 2025-04. 잡음 구간이 없다.
  그래서 판정선은 **넷**이고, 셋은 그 앞자리(경계)다.

  한계도 같이 적어 둔다 — 무너지는 국면이 반년을 넘기면 과열 기억이 만료된다.
  2008년 9~11월(리먼)은 마지막 과열 점등이 26주를 넘겨 3/4 로 잡힌다. 넷이
  안 켜졌다고 안전하다는 뜻이 아니다.

주간 표본
  각 ISO 주의 **마지막 거래일**을 그 주의 값으로 삼는다. 미국장은 금요일에
  닫히므로 사실상 금요일 종가다. 주 1회 갱신(한국시각 일요일 아침)과 표본이
  일치해야 "지난주 대비"가 말이 된다.

역사적 위치
  2004년 이후 같은 축의 주간 값 분포에서 지금이 어디쯤인지(백분위). 동점이
  많은 값(붕괴 신호 개수는 0 이 대부분)에서도 흔들리지 않도록 동점의 절반을
  세는 방식을 쓴다.

사용
  python3 scripts/build-weekly-risk.py
  python3 scripts/build-weekly-risk.py --parquet .bfrs-work/processed/bfrs_daily.parquet
"""
import json
import os
import sys
from datetime import datetime, timezone, timedelta

import pandas as pd

# 80항 — 화면 문구의 em dash(—)를 하이픈으로. 저장 직전 한 번만 훑는다.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    from ez_text import scrub as _ez_scrub
except Exception:                      # 모듈이 없어도 본 기능은 죽지 않는다
    def _ez_scrub(o):
        return o

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
OUT = os.path.join(ROOT, 'data', 'weekly-risk.json')

# 위험 등급 — 시장 국면 진단과 같은 값을 본다. 두 화면이 다른 색·다른 이름을
# 쓰면 같은 날을 두고 서로 다른 말을 하게 된다.
RISK_SEVERITY = {
    'TECH_LEADING_WARNING': 1,
    'GROWTH_WARNING': 2,
    'FRAGILE_BUBBLE': 2,
    'DISTRIBUTION': 2,
    'BREAKDOWN': 3,
    'PANIC': 4,
}
LEVELS = ['정상', '선행 경고', '경계', '추세 붕괴', '투매']

BREAKDOWN_MAX = 6

AXES = [
    {
        'key': 'exuberance', 'name': '시장 과열', 'col': 'exuberance_score', 'riskUp': True,
        'help': '가격이 실적·추세보다 얼마나 앞서 달렸는가',
        'note': '높다고 곧 하락은 아님. 취약성이 같이 높을 때만 위험 신호로 읽음',
        'parts': [
            ('e_price_explosiveness', '가격 과속', '200일선에서 얼마나 멀어졌나 · 12개월 상승폭'),
            ('e_momentum', '상승 탄력', '6개월 상승폭 · RSI'),
            ('e_concentration', '쏠림', '지수가 소수 대형주로 쏠린 정도'),
            ('e_speculation', '투기 열기', '3배 레버리지 ETF가 원지수를 앞서는 정도'),
        ],
    },
    {
        'key': 'fragility', 'name': '내부 취약성', 'col': 'fragility_score', 'riskUp': True,
        'help': '지수는 버텨도 속이 얼마나 약해졌는가',
        'note': '가격에 아직 안 나타난 균열. 이 축이 먼저 오르고 지수가 나중에 따라감',
        'parts': [
            ('f_breadth_divergence', '오르는 종목 축소', '동일가중 대비 시가총액가중 우위'),
            ('f_credit_stress', '회사채 압박', '고위험 회사채 약세 · 신용 스프레드'),
            ('f_volatility_stress', '변동성 압박', 'VIX 수준 · 단기가 장기보다 높은 역전'),
            ('f_liquidity_tightening', '돈줄 조임', '10년 실질금리 · 위험채권 대비 국채 우위'),
        ],
    },
    {
        'key': 'breakdown', 'name': '추세 붕괴', 'col': 'breakdown_count', 'riskUp': True,
        'flags': True,
        'help': '실제로 무너지기 시작한 신호가 몇 개 켜졌는가',
        'note': '여섯 개 중 켜진 개수. 3개 이상이면 시장 전체 방어 국면으로 전환',
        'parts': [
            ('b_below_sma50', '50일선 이탈', 'SPY가 50일 평균선 아래'),
            ('b_below_sma200', '200일선 이탈', 'SPY가 200일 평균선 아래'),
            ('b_death_cross', '데드크로스', '50일선이 200일선 아래'),
            ('b_drawdown_10', '고점 대비 10% 하락', '최근 1년 고점 기준'),
            ('b_credit_break', '회사채 붕괴', '고위험 회사채 비율이 50일 평균 아래'),
            ('b_vix_25', 'VIX 25 이상', '공포지수 경계선 돌파'),
        ],
    },
    {
        # 엔진의 repair(높을수록 좋다)를 뒤집어 싣는다. 네 축의 방향을 맞추면
        # 화면에서 부호와 색이 언제나 같이 움직인다.
        'key': 'norepair', 'name': '회복 부진', 'col': 'x_norepair', 'riskUp': True,
        'help': '무너진 뒤 되돌아오지 못한 정도',
        'note': '엔진 회복력 점수의 뒷면 — 회복력 80이면 여기서는 20',
        'parts': [
            ('x_price_reclaim', '가격 미회복', '20일 평균선 아래에 머무는 정도'),
            ('x_momentum_repair', '탄력 미회복', 'RSI가 낮은 구간에 머무는 정도'),
            ('x_volatility_relief', '변동성 재확대', '10일 전 대비 VIX 상승'),
            ('x_credit_repair', '회사채 미회복', '고위험 회사채 3개월 부진'),
        ],
    },
]

# 뒤집어 싣는 열 — 원본을 건드리지 않고 파생만 만든다.
INVERTED = {
    'x_norepair': 'repair_score',
    'x_price_reclaim': 'r_price_reclaim',
    'x_momentum_repair': 'r_momentum_repair',
    'x_volatility_relief': 'r_volatility_relief',
    'x_credit_repair': 'r_credit_repair',
}

# 축이 '켜졌다'고 볼 자리 — 축마다 분포가 완전히 달라(붕괴는 절반이 0) 절대
# 기준 하나로는 못 잰다. 제 분포의 상위 20% 안이면 켜진 것으로 본다.
HOT_Q = 0.80
# 비상 판정선. 과열을 되돌아보기(아래)까지 넣으면 넷이 실제로 켜진다 —
# 1,138주 중 48주(4.2%), 11개 구간이 전부 실제 위기였고 잡음 구간이 없다.
# 셋은 그 앞자리라 '경계'로 둔다(79주).
ALERT_AT = 4
WARN_AT = 3
# 과열만 되돌아본다. 꼭대기의 과열과 무너진 뒤의 나머지 셋은 시점이 어긋나
# 같은 주에 안 잡힌다 — 6개월 안에 있었으면 그 사이클 안으로 본다.
LOOKBACK_WEEKS = 26
LOOKBACK_KEYS = {'exuberance'}

# 이 폭보다 작은 주간 변화는 순위에 올리지 않는다. 0.3점짜리 움직임을
# '위험이 커진 곳'이라고 부르면 매주 아무 말이나 하게 된다.
MOVER_MIN = 1.5


def argof(name, default=None):
    argv = sys.argv[1:]
    return argv[argv.index(name) + 1] if name in argv and len(argv) > argv.index(name) + 1 else default


def r1(v):
    return None if v is None or pd.isna(v) else round(float(v), 1)


def pct_above(series, value):
    """지금보다 **엄격히 높았던** 주의 비율. 화면 문구가 곧 이 정의다.

    동점의 절반을 세는 보통의 백분위를 쓰면 문구와 값이 어긋난다 — 붕괴 신호는
    42%의 주가 지금과 같은 0 이고, 탄력 회복은 22%의 주가 지금과 같은 100 이다.
    그 경우 '지금보다 높았던 주 N%' 라는 문장이 사실이 아니게 된다. 역대 최고를
    찍은 주에 '상위 11%' 라고 적히면 그건 틀린 말이다.
    """
    if value is None or pd.isna(value):
        return None
    s = series.dropna()
    if s.empty:
        return None
    return round(float((s > value).sum()) / len(s) * 100, 1)


def weekly_frame(daily):
    """각 ISO 주의 마지막 거래일 **한 줄 통째로**.

    groupby().last() 를 쓰면 안 된다 — 그건 열마다 마지막 '결측이 아닌' 값을
    집어 오므로, 어떤 열은 금요일 값이고 어떤 열은 수요일 값인 줄이 만들어진다.
    에러는 안 나고 숫자만 섞인다. 행 자체를 골라야 한다.
    """
    frame = daily.copy()
    frame['date'] = pd.to_datetime(frame['date'])
    iso = frame['date'].dt.isocalendar()
    frame['_wk'] = iso['year'].astype(str) + '-' + iso['week'].astype(str).str.zfill(2)
    idx = frame.groupby('_wk')['date'].idxmax()
    weekly = frame.loc[idx].sort_values('date').reset_index(drop=True)
    for new, src in INVERTED.items():
        weekly[new] = 100.0 - weekly[src]
    return weekly


def axis_payload(wk, axis):
    col = axis['col']
    series = wk[col]
    n = len(series)
    cur = series.iloc[-1]

    def ago(k):
        return series.iloc[-1 - k] if n > k else None

    scale = (100.0 / BREAKDOWN_MAX) if axis.get('flags') else 1.0
    sign = 1.0 if axis['riskUp'] else -1.0

    def chg(k):
        prev = ago(k)
        return None if prev is None or pd.isna(prev) else float(cur) - float(prev)

    c1, c4, c13 = chg(1), chg(4), chg(13)

    threshold = float(series.quantile(HOT_Q))
    hot_now = float(cur) >= threshold
    hot_back, hot_ago = False, None
    if axis['key'] in LOOKBACK_KEYS and not hot_now:
        window = series.iloc[max(0, n - 1 - LOOKBACK_WEEKS):n - 1]
        lit = [k for k, v in enumerate(window) if float(v) >= threshold]
        if lit:
            hot_back = True
            hot_ago = int(len(window) - lit[-1])   # 몇 주 전에 마지막으로 켜졌나

    parts = []
    for pcol, pname, phelp in axis['parts']:
        ps = wk[pcol]
        pcur = ps.iloc[-1]
        pprev = ps.iloc[-2] if n > 1 else None
        pchg = None if pprev is None or pd.isna(pprev) else float(pcur) - float(pprev)
        parts.append({
            'key': pcol, 'name': pname, 'help': phelp,
            'value': r1(pcur), 'prev': r1(pprev),
            'chg': None if pchg is None else round(pchg, 1),
            'riskChg': None if pchg is None else round(pchg * sign, 1),
            'pct': pct_above(ps, pcur),
            'on': bool(pcur) if axis.get('flags') else None,
            'wasOn': None if pprev is None else bool(pprev),
        })

    return {
        'key': axis['key'], 'name': axis['name'], 'help': axis['help'], 'note': axis['note'],
        'riskUp': axis['riskUp'], 'flags': bool(axis.get('flags')),
        'value': r1(cur), 'prev': r1(ago(1)),
        'bar': round(min(100.0, max(0.0, float(cur) * scale)), 1),
        'chg1w': None if c1 is None else round(c1, 1),
        'chg4w': None if c4 is None else round(c4, 1),
        'chg13w': None if c13 is None else round(c13, 1),
        'riskChg': None if c1 is None else round(c1 * sign, 1),
        'pct': pct_above(series, cur),
        'hotAt': r1(threshold),
        'hotNow': bool(hot_now),
        'hot': bool(hot_now or hot_back),
        'lookback': LOOKBACK_WEEKS if axis['key'] in LOOKBACK_KEYS else 0,
        'hotAgo': hot_ago,
        'spark': [r1(v) for v in series.tail(52)],
        'parts': parts,
    }


def movers(axes):
    """위험 방향으로 정규화한 뒤 한 줄로 세운다. 축과 구성요소를 같이 놓는다.

    눈금을 맞춰서 비교한다 — 붕괴 신호는 0/1 이라 그대로 두면 변화폭이 1.0 이고,
    점수 항목은 0~100 이라 20씩 움직인다. 섞어 세우면 국면을 바꾸는 신호 하나가
    늘 꼴찌로 밀린다. 다른 곳에서 쓰는 환산(개수 → 0~100)을 여기서도 쓴다.
    """
    rows = []
    for a in axes:
        unit = (100.0 / BREAKDOWN_MAX) if a['flags'] else 1.0
        for p in a['parts']:
            if p['riskChg'] is None:
                continue
            flipped = a['flags'] and p['on'] != p['wasOn']
            if abs(p['riskChg']) < MOVER_MIN and not flipped:
                continue
            rows.append({
                'rank': round(p['riskChg'] * unit, 2),
                'axis': a['key'], 'axisName': a['name'], 'name': p['name'],
                # chg 는 실제 변화, riskChg 는 위험 방향으로 뒤집은 값.
                # 정렬은 riskChg 로, 화면 표시는 chg 로 한다 — 회복 항목에서
                # '78.6 인데 −32.2' 같은 뒤집힌 조합이 보이지 않게.
                'chg': p['chg'], 'riskChg': p['riskChg'], 'value': p['value'], 'pct': p['pct'],
                'flag': bool(a['flags']), 'on': p['on'], 'flipped': bool(flipped),
            })
    def cut(pool, limit):
        """상위 몇 개만 싣되, 켜짐/꺼짐이 바뀐 신호는 절대 자르지 않는다.
        그 한 줄이 국면을 바꾸는 사건이라 목록에서 빠지면 화면이 거짓말을 한다."""
        keep = pool[:limit]
        keep += [r for r in pool[limit:] if r['flipped']]
        return keep

    rows.sort(key=lambda r: r['rank'], reverse=True)
    up = cut([r for r in rows if r['rank'] > 0], 5)
    down = sorted([r for r in rows if r['rank'] < 0], key=lambda r: r['rank'])
    return {'up': up, 'down': cut(down, 4)}


def alert_history(wk, axes):
    """몇 개가 동시에 켜졌던 주가 얼마나 있었나, 그리고 어느 구간이었나.

    '넷이 다 켜지면 비상'은 듣기엔 자연스럽지만 실측으로는 성립하지 않는다 —
    과열은 꼭대기에서, 나머지 셋은 무너진 뒤에 켜져서 시점이 어긋난다.
    그래서 판정선을 셋에 두고, 그 근거인 분포와 지난 구간을 같이 싣는다.
    """
    import numpy as np
    lit = np.zeros(len(wk), dtype=int)
    now_lit = np.zeros(len(wk), dtype=int)
    for a in axes:
        spec = next(x for x in AXES if x['key'] == a['key'])
        col = spec['col']
        on = (wk[col] >= float(wk[col].quantile(HOT_Q))).astype(int)
        now_lit += on.to_numpy()
        if a['key'] in LOOKBACK_KEYS:
            # 6개월 안에 한 번이라도 켜졌으면 그 사이클 안으로 본다
            on = on.rolling(LOOKBACK_WEEKS + 1, min_periods=1).max().astype(int)
        lit += on.to_numpy()

    dist = {int(n): int((lit == n).sum()) for n in range(len(axes) + 1)}

    # 연속 구간으로 묶는다. 한두 주 끊긴 것은 같은 사건으로 본다.
    runs, cur = [], None
    for i, v in enumerate(lit):
        if v >= ALERT_AT:   # 넷이 다 켜진 구간만 묶는다
            cur = [i, i] if cur is None else [cur[0], i]
        elif cur is not None:
            runs.append(cur)
            cur = None
    if cur is not None:
        runs.append(cur)
    merged = []
    for r in runs:
        if merged and r[0] - merged[-1][1] <= 4:
            merged[-1][1] = r[1]
        else:
            merged.append(list(r))

    episodes = [
        {
            'start': pd.Timestamp(wk.iloc[a]['date']).date().isoformat(),
            'end': pd.Timestamp(wk.iloc[b]['date']).date().isoformat(),
            'weeks': int(b - a + 1),
            'peak': int(lit[a:b + 1].max()),
        }
        for a, b in merged if (b - a + 1) >= 2
    ]
    all_weeks = wk.loc[lit == len(axes), 'date']
    return {
        'at': ALERT_AT,
        'warnAt': WARN_AT,
        'quantile': int(HOT_Q * 100),
        'lookback': LOOKBACK_WEEKS,
        'count': int(lit[-1]),
        'countNow': int(now_lit[-1]),
        'dist': dist,
        'weeksAtOrAbove': int((lit >= ALERT_AT).sum()),
        'weeksAtWarn': int((lit == WARN_AT).sum()),
        'weeksAll': int((lit == len(axes)).sum()),
        'allYears': sorted(set(all_weeks.dt.year.astype(int).tolist())),
        'neverAllSameWeek': int((now_lit == len(axes)).sum()) == 0,
        'episodes': episodes[-6:],
        'episodeCount': len(episodes),
    }


def main():
    src = argof('--parquet', os.path.join(ROOT, '.bfrs-work', 'processed', 'bfrs_daily.parquet'))
    if not os.path.exists(src):
        print(f'::error::분석 결과가 없다 — analyze 를 먼저 돌린다: {src}')
        return 1

    daily = pd.read_parquet(src)
    daily = daily.dropna(subset=['exuberance_score', 'fragility_score', 'repair_score'])
    wk = weekly_frame(daily)
    if len(wk) < 200:
        print(f'::error::주간 표본이 너무 적다({len(wk)}주) — 쓰지 않는다')
        return 1

    last = wk.iloc[-1]
    regime = str(last['regime'])
    severity = int(RISK_SEVERITY.get(regime, 0))
    axes = [axis_payload(wk, a) for a in AXES]

    # 축 단위로 이번 주에 위험이 커진 쪽 / 줄어든 쪽. 구성요소 순위와 달리
    # 여기는 네 개 전부를 그대로 싣는다 — 화면이 골라 쓴다.
    risk_up = sum(1 for a in axes if (a['riskChg'] or 0) > 0.5)
    risk_dn = sum(1 for a in axes if (a['riskChg'] or 0) < -0.5)

    now = datetime.now(timezone.utc)
    payload = {
        'system': 'BFRS v0.3',
        'generatedAt': now.replace(microsecond=0).isoformat().replace('+00:00', 'Z'),
        'generatedAtKST': (now + timedelta(hours=9)).strftime('%Y-%m-%d %H:%M KST'),
        'asOf': pd.Timestamp(last['date']).date().isoformat(),
        'prevAsOf': pd.Timestamp(wk.iloc[-2]['date']).date().isoformat() if len(wk) > 1 else None,
        'regime': regime,
        'regimeKo': str(last['regime_ko']),
        'severity': severity,
        'level': LEVELS[severity],
        'levels': LEVELS,
        'axesRiskUp': risk_up,
        'axesRiskDown': risk_dn,
        'axes': axes,
        'alert': alert_history(wk, axes),
        'movers': movers(axes),
        'moverMin': MOVER_MIN,
        'breakdownMax': BREAKDOWN_MAX,
        'history': {
            'dates': [pd.Timestamp(d).date().isoformat() for d in wk['date']],
            'ex': [r1(v) for v in wk['exuberance_score']],
            'fr': [r1(v) for v in wk['fragility_score']],
            'bd': [r1(float(v) * 100.0 / BREAKDOWN_MAX) for v in wk['breakdown_count']],
            'nr': [r1(v) for v in wk['x_norepair']],
            'sev': [int(RISK_SEVERITY.get(str(g), 0)) for g in wk['regime']],
        },
        'coverage': {
            'weeks': int(len(wk)),
            'start': pd.Timestamp(wk.iloc[0]['date']).date().isoformat(),
            'end': pd.Timestamp(last['date']).date().isoformat(),
        },
    }

    os.makedirs(os.path.join(ROOT, 'data'), exist_ok=True)
    payload = _ez_scrub(payload)    # 80항 — ' — ' → ' - '
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, separators=(',', ':'))

    print(f'기준주 {payload["asOf"]}(직전 {payload["prevAsOf"]}) · {payload["regimeKo"]} · 주간 표본 {len(wk):,}주')
    for a in axes:
        print(f'  {a["name"]:<8} {a["value"]:>6}  지난주 대비 {a["chg1w"]:+.1f}  위험방향 {a["riskChg"]:+.1f}  역사적 {a["pct"]}%')
    al = payload['alert']
    print(f'  점등 {al["count"]}/4 (지금만 세면 {al["countNow"]}) · 판정선 {al["at"]} · '
          f'4개 {al["weeksAll"]}주 {al["episodeCount"]}구간 · 3개 {al["weeksAtWarn"]}주 · {al["allYears"]}')
    print(f'  위험 커진 구성요소 {len(payload["movers"]["up"])}건 · 줄어든 구성요소 {len(payload["movers"]["down"])}건')
    print(f'  {os.path.getsize(OUT):,}바이트')
    return 0


if __name__ == '__main__':
    sys.exit(main())
