#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""EZLong Swing AI 2.0 — Phase 1: 룰 엔진 + 7단계 상태기계 + Replay Engine.

개발기획서 v2(확률형 상태기계 + 집행 엔진)의 1차 과제 구현.

무엇이 우선인가
  AI 모델이 아니라 **2026-05-01~08-01 Replay Engine** 이다. 그날까지 존재했던
  데이터만으로 상태·신호를 하루씩 재현해, 시스템이 6월 22일 정점과 7월말 바닥
  국면을 어떻게 판정했을지 사후 검증한다. 이 재현이 실패하면 이후 어떤 AI 도
  무의미하다(기획서 12부).

설계 3원칙 (기획서 2부)
  · 과열(Heat)과 추세훼손(Distribution)을 분리한다 — 과매수는 매도 신호가
    아니라 위험 예고이고, 실제 매도는 Distribution 이 결정한다.
  · 투매(Capitulation)와 반등확인(Reversal)을 분리한다 — 과매도가 깊다는 것과
    반등이 시작됐다는 것은 다른 정보다.
  · 절대 임계치를 쓰지 않는다 — 모든 입력은 그 자산 자신의 **직전 5년
    percentile** 로 정규화한다(SOXX 와 SPY 에 같은 RSI 70 을 적용하지 않음).

Point-in-Time 원칙 (기획서 8부)
  모든 지표·백분위·상태는 해당일 종가까지의 데이터만 쓴다. 백분위 창은
  '직전 5년'이라 구조적으로 미래를 볼 수 없다. Replay 는 이 시계열을 그대로
  하루씩 읽는 것이므로 별도 재계산이 필요 없다 — 재계산 경로가 둘이면
  반드시 한쪽이 미래를 훔친다.

숫자에 대한 경고
  단계별 비중(12·22·27%)과 상태 전환·게이트 임계치는 전부 **백테스트용
  초기값**이다(기획서 Caveats). 하드코딩 최종값이 아니며, walk-forward 검증
  전에는 실거래 판단 근거로 쓰지 않는다.

사용
  python3 scripts/build-swing-ai.py --mkt <parquet 폴더> --out <json>
"""
import json
import os
import sys
from datetime import datetime, timezone, timedelta

import numpy as np
import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')

STATES = ['UPTREND', 'OVERHEAT', 'DISTRIBUTION', 'CORRECTION', 'CAPITULATION', 'REVERSAL_PROBE', 'RECOVERY']
STATE_KO = {
    'UPTREND': '정상 추세', 'OVERHEAT': '과열', 'DISTRIBUTION': '분배',
    'CORRECTION': '조정', 'CAPITULATION': '투매', 'REVERSAL_PROBE': '반등 탐색',
    'RECOVERY': '회복',
}
# 7단계 온도 — 기존 스윙 인덱스 온도색 체계와 매핑(기획서 2부)
STATE_TEMP = {'UPTREND': 2, 'OVERHEAT': 0, 'DISTRIBUTION': 1, 'CORRECTION': 3,
              'CAPITULATION': 6, 'REVERSAL_PROBE': 5, 'RECOVERY': 4}

PCT_WIN = 1260      # 백분위 창 — 직전 5년 거래일
PCT_MIN = 252       # 최소 1년 쌓여야 점수를 낸다

REPLAY_START, REPLAY_END = '2026-05-01', '2026-08-01'

# ── 집행 초기값 (전부 백테스트용 — 기획서 5부) ─────────────────────────────
SELL_STAGES = {'S1': 12, 'S2': 22, 'S3': 27, 'S4': 25}   # S4 는 잔여의 %
BUY_STAGES = {'B1': 12, 'B2': 22, 'B3': 27}              # B4 는 잔여 전부
PROBE_STOP_ATR = 0.5     # 무효화 — 전저점 − 0.5×ATR 종가 이탈
WHIPSAW_STOPOUTS = 2     # 10거래일 내 stop-out 이 횟수를 넘으면 Whipsaw Mode
GATE2 = {'reversal': 60, 'whipsaw': 55}
GATE3 = {'reversal': 70, 'whipsaw': 35}


def argof(name, default=None):
    argv = sys.argv[1:]
    return argv[argv.index(name) + 1] if name in argv and len(argv) > argv.index(name) + 1 else default


def load(mkt, sym):
    f = pd.read_parquet(os.path.join(mkt, f'{sym}.parquet')).sort_values('date').reset_index(drop=True)
    f['date'] = pd.to_datetime(f['date'])
    # 수정주가 기준으로 O/H/L 도 같은 배율로 맞춘다 — ATR·갭 계산이 배당락에 흔들리지 않게
    k = f['adjusted_close'] / f['close']
    for c in ('open', 'high', 'low'):
        f[c] = f[c] * k
    f['close'] = f['adjusted_close']
    return f[['date', 'open', 'high', 'low', 'close', 'volume']]


def rsi(close, n=14):
    d = close.diff()
    up = d.clip(lower=0).ewm(alpha=1 / n, min_periods=n).mean()
    dn = (-d.clip(upper=0)).ewm(alpha=1 / n, min_periods=n).mean()
    return 100 - 100 / (1 + up / dn)


def atr(df, n=14):
    tr = pd.concat([df['high'] - df['low'],
                    (df['high'] - df['close'].shift()).abs(),
                    (df['low'] - df['close'].shift()).abs()], axis=1).max(axis=1)
    return tr.ewm(alpha=1 / n, min_periods=n).mean()


def adx(df, n=14):
    up = df['high'].diff()
    dn = -df['low'].diff()
    plus = np.where((up > dn) & (up > 0), up, 0.0)
    minus = np.where((dn > up) & (dn > 0), dn, 0.0)
    tr = pd.concat([df['high'] - df['low'],
                    (df['high'] - df['close'].shift()).abs(),
                    (df['low'] - df['close'].shift()).abs()], axis=1).max(axis=1)
    atr_ = tr.ewm(alpha=1 / n, min_periods=n).mean()
    pdi = 100 * pd.Series(plus, index=df.index).ewm(alpha=1 / n, min_periods=n).mean() / atr_
    mdi = 100 * pd.Series(minus, index=df.index).ewm(alpha=1 / n, min_periods=n).mean() / atr_
    dx = 100 * (pdi - mdi).abs() / (pdi + mdi)
    return dx.ewm(alpha=1 / n, min_periods=n).mean()


def trailing_pct(s, win=PCT_WIN, mn=PCT_MIN):
    """직전 win 일(오늘 포함) 안에서 오늘 값의 백분위(0~100). point-in-time.

    엄격히 낮은 값의 비율 + 동점 절반. rolling rank 는 오늘 값을 포함한 순위라
    미래를 보지 않는다.
    """
    r = s.rolling(win, min_periods=mn).rank(pct=True)
    return r * 100


def streak(cond):
    """조건이 연속으로 참인 일수."""
    out = np.zeros(len(cond), dtype=float)
    run = 0
    vals = cond.to_numpy()
    for i, v in enumerate(vals):
        run = run + 1 if v else 0
        out[i] = run
    return pd.Series(out, index=cond.index)


def build_features(df, bench, breadth_pair):
    """한 자산의 점수 입력 전부. 모든 열이 그날 종가까지의 정보만 쓴다."""
    f = df.copy()
    c = f['close']
    f['ret1'] = c.pct_change()
    f['ret20'] = c.pct_change(20)
    f['rsi'] = rsi(c)
    f['atr'] = atr(f)
    f['atrp'] = f['atr'] / c
    for n in (10, 20, 50, 200):
        f[f'sma{n}'] = c.rolling(n).mean()
    f['slope20'] = f['sma20'].pct_change(5)
    f['ext20'] = (c - f['sma20']) / f['atr']
    f['ext50'] = (c - f['sma50']) / f['atr']
    mid, sd = c.rolling(20).mean(), c.rolling(20).std()
    f['bollb'] = (c - mid) / (2 * sd)
    f['upstreak'] = streak(f['ret1'] > 0)
    f['dnstreak'] = streak(f['ret1'] < 0)
    f['hi20'] = c.rolling(20).max()
    f['off_hi20'] = c / f['hi20'] - 1                      # 20일 고점 대비(음수)
    f['dd252'] = c / c.rolling(252).max() - 1              # 52주 고점 대비
    f['lo10_prev'] = f['low'].rolling(10).min().shift(1)   # 직전 10일 저가(오늘 제외)
    f['adx'] = adx(f)
    f['rv20'] = f['ret1'].rolling(20).std() * np.sqrt(252)

    # 거래량 — 상승일/하락일 거래량 배분과 고거래량 하락일
    vol50 = f['volume'].rolling(50).mean()
    upv = f['volume'].where(f['ret1'] > 0, 0.0)
    dnv = f['volume'].where(f['ret1'] < 0, 0.0)
    f['dnvol_share10'] = dnv.rolling(10).sum() / (upv + dnv).rolling(10).sum()
    f['upvol_share5'] = upv.rolling(5).sum() / (upv + dnv).rolling(5).sum()
    f['hv_down10'] = ((f['volume'] > vol50) & (f['ret1'] < -0.005)).rolling(10).sum()

    # 상대강도 — 벤치마크 대비 63일 모멘텀과 그 변화
    rel = c / bench['close'].reindex(f.index)
    f['rs63'] = rel.pct_change(63)
    f['rs63_chg'] = f['rs63'] - f['rs63'].shift(10)

    # breadth 프록시 — 시총가중 대비 동일가중 63일 모멘텀(오르는 종목이 넓은지)
    bp = breadth_pair.reindex(f.index)
    f['breadth63'] = bp
    f['breadth_chg'] = bp - bp.shift(10)

    # 휩쏘 재료 — 부호 교차·갭 리버설
    sign = np.sign(f['ret1'].fillna(0))
    f['flips10'] = (sign != sign.shift(1)).rolling(10).sum()
    gap = f['open'] / f['close'].shift(1) - 1
    f['gaprev10'] = (((gap > 0.004) & (f['ret1'] < 0)) | ((gap < -0.004) & (f['ret1'] > 0))).rolling(10).sum()

    # Confidence — 신호 계열 다섯이 같은 방향을 보는가(피드백 반영 항목).
    # Whipsaw(가격이 왔다갔다할 가능성)와 다른 축이다: 이건 '우리 신호끼리
    # 서로 동의하지 않는 정도'다. 불일치가 크면 억지로 한 상태로 단정하지
    # 말고 포지션 변경량을 줄인다.
    votes = pd.concat([
        np.sign((f['close'] > f['sma50']).astype(float) - 0.5 + f['slope20'].fillna(0) * 10).rename('trend'),
        np.sign(f['rsi'].diff(5)).rename('momentum'),
        np.sign(f['breadth_chg']).rename('breadth'),
        np.sign(f['rs63_chg']).rename('relstr'),
        np.sign(f['upvol_share5'] - 0.5).rename('volume'),
    ], axis=1)
    agree = votes.sum(axis=1).abs() / votes.notna().sum(axis=1).clip(lower=1)
    f['conf'] = (0.5 + 0.5 * agree).clip(0.5, 1.0)     # 0.5(완전 불일치) ~ 1.0(만장일치)
    return f


def build_scores(f, vix):
    """다섯 점수. 가중치는 전부 초기값 — 기획서 2부의 입력 목록을 따른다."""
    p = lambda s: trailing_pct(s)
    v = vix.reindex(f.index)

    heat = (0.25 * p(f['rsi']) + 0.25 * p(f['ext20']) + 0.15 * p(f['ext50'])
            + 0.15 * p(f['ret20']) + 0.10 * p(f['upstreak']) + 0.10 * p(f['bollb']))

    dist = (0.20 * p(-f['off_hi20'])          # 20일 고점에서 얼마나 밀렸나
            + 0.15 * p(-f['slope20'])         # 20일선 기울기 하락
            + 0.15 * p(-f['rs63_chg'])        # 상대강도 악화
            + 0.15 * p(f['dnvol_share10'])    # 하락일로 거래량 쏠림
            + 0.10 * p(f['hv_down10'])        # 고거래량 하락일
            + 0.15 * p(-f['breadth_chg'])     # breadth 악화
            + 0.10 * p(f['rv20'].pct_change(10)))   # 변동성 상승

    cap = (0.25 * p(-f['rsi']) + 0.20 * p(-f['dd252']) + 0.20 * p(v['vix'])
           + 0.15 * p(v['vixr']) + 0.10 * p(f['dnstreak']) + 0.10 * p(f['atrp']))

    rev = (0.20 * (f['close'] > f['sma10']).astype(float) * 100
           + 0.20 * p(f['rsi'] - f['rsi'].shift(5))
           + 0.20 * p(f['upvol_share5'])
           + 0.20 * p(-(v['vix'] / v['vix'].rolling(10).max()))
           + 0.10 * (f['low'] > f['lo10_prev']).astype(float) * 100    # 신저가 실패
           + 0.10 * p(f['breadth_chg']))

    whip = (0.25 * p(-f['adx']) + 0.15 * p(-f['slope20'].abs()) + 0.20 * p(f['atrp'])
            + 0.20 * p(f['flips10']) + 0.20 * p(f['gaprev10']))

    out = pd.DataFrame({'heat': heat, 'dist': dist, 'cap': cap, 'rev': rev, 'whip': whip})
    return out.clip(0, 100)


# ── 7단계 상태기계 ──────────────────────────────────────────────────────────
def candidate(row, prev_state):
    """그날 하루의 후보 상태. 확정은 2-of-3 지속성이 한다."""
    c, sc = row, row
    after_fall = prev_state in ('CORRECTION', 'CAPITULATION', 'REVERSAL_PROBE', 'RECOVERY')
    if sc['cap'] >= 72 or (sc['cap'] >= 62 and c['vixr'] > 1.0):
        return 'CAPITULATION'
    if after_fall and sc['rev'] >= 62 and c['close'] > c['sma20'] and c['slope20'] > 0:
        return 'RECOVERY'
    if prev_state in ('CAPITULATION', 'REVERSAL_PROBE', 'CORRECTION') and sc['rev'] >= 50 and sc['cap'] >= 40:
        return 'REVERSAL_PROBE'
    if sc['dist'] >= 60 and c['close'] < c['sma20'] and c['slope20'] < 0:
        return 'CORRECTION'
    if sc['dist'] >= 62:
        return 'DISTRIBUTION'
    if sc['heat'] >= 80 and sc['dist'] < 55:
        return 'OVERHEAT'
    if prev_state == 'RECOVERY' and not (c['close'] > c['sma50'] and sc['rev'] < 50):
        return 'RECOVERY'
    if c['close'] < c['sma50'] and c['slope20'] < 0:
        return 'CORRECTION'
    return 'UPTREND'


def is_shock(row):
    """Shock Transition — 2~3일 대기가 오히려 손실인 급변(기획서 2부)."""
    return bool(row['ret1'] <= -0.035 or (row['ret1'] <= -0.025 and row['vix_jump'] >= 0.15))


def run_state_machine(f):
    """2-of-3 지속성 + Shock 즉시 전환. 하루 지표로 상태를 바꾸지 않는다."""
    states, cands = [], []
    state = 'UPTREND'
    for i in range(len(f)):
        row = f.iloc[i]
        if pd.isna(row['heat']) or pd.isna(row['sma50']):
            cands.append(None)
            states.append(state)
            continue
        cand = candidate(row, state)
        cands.append(cand)
        if cand != state:
            recent = [x for x in cands[-3:] if x is not None]
            confirmed = recent.count(cand) >= 2
            shock = is_shock(row) and cand in ('CORRECTION', 'CAPITULATION')
            if confirmed or shock:
                state = cand
        states.append(state)
    return pd.Series(states, index=f.index), pd.Series(cands, index=f.index)


# ── 집행 엔진 — Replay 용 원장 ─────────────────────────────────────────────
ACTION_LABEL = {
    'S1': 'S1 과열 익절', 'S2': 'S2 분배 익절', 'S3': 'S3 조정 확정 축소', 'S4': 'S4 추세 훼손 축소',
    'B1': 'B1 투매 탐색 매수', 'B2': 'B2 반등 시도 매수', 'B3': 'B3 반등 확인 매수', 'B4': 'B4 회복 투입',
    'STOP': '탐색 물량 무효화 손절', 'WHIPSAW_ON': 'Whipsaw Mode 진입',
}


def replay(f, states, start, end):
    """상태 전환을 신호로 분할 매매를 재현한다. 신호 다음 거래일 시가 체결이
    원칙이나 Phase 1 은 당일 종가 체결로 근사한다(비교 기준이 상태 판정이라
    체결 시점 오차는 검증 목적에 영향이 작다 — Phase 3 백테스트에서 정밀화)."""
    win = f[(f['date'] >= start) & (f['date'] <= end)]
    position, cash = 100.0, 0.0        # 시작: 전량 보유(2026년 5월 실화 기준)
    nav, bh = 100.0, 100.0             # 전략/보유지속 순자산 — 전일 보유비중으로 그날 수익률을 먹는다
    done = set()
    probe = None                       # (진입가, 무효화선, 투입 cash%)
    stops = []                         # stop-out 날짜 인덱스
    whipsaw_mode = False
    days, events = [], []
    prev_state = None
    uptrend_run = 0                    # 사이클 종료 판정용
    b3_at = None                       # B3 실행 인덱스 — B4 는 3일 뒤부터
    cycle_no = 1

    for i in win.index:
        row = f.loc[i]
        st = states.loc[i]
        acts = []

        # 성과 추적 — 오늘 수익률은 어제 종가의 보유비중으로 먹는다(당일 체결분 제외)
        r1 = float(row['ret1']) if pd.notna(row['ret1']) else 0.0
        nav *= 1 + (position / 100.0) * r1
        bh *= 1 + r1

        # 매수 크기 배수 — 기본 크기 × Confidence × (1 − 0.5×Whipsaw).
        # 신호 불일치·휩쏘가 크면 '금지'가 아니라 '작게'로 답한다(기획서 3부 +
        # 피드백 공식). **매수에만 적용한다** — 다중 구간 검증에서 매도까지
        # 줄였더니 2022년형 약세장에서 방어 사다리가 부스러기가 됐다.
        # 불확실성이 크다는 것은 위험을 '덜 늘릴' 이유이지 '덜 줄일' 이유가
        # 아니다. 전부 초기값.
        conf = float(row['conf']) if pd.notna(row['conf']) else 0.75
        whip_adj = 1 - 0.5 * (float(row['whip']) / 100 if pd.notna(row['whip']) else 0.5)
        size_mult = conf * whip_adj
        # No-Trade Zone — 휩쏘가 높고 신호가 갈릴 때 신규 진입은 하지 않는다.
        # "항상 무언가를 하려는 시스템"을 막는 장치. 기존 보유의 손절·익절은 막지 않는다.
        no_trade = (pd.notna(row['whip']) and row['whip'] >= 70) and conf < 0.65

        # ── 사이클 리셋 — 정상 추세가 3일 지속되면 이번 사이클은 끝났다.
        #    리셋이 없으면 5월에 쓴 S2 가 7월 분배에서 다시 못 나간다(사이클
        #    기억은 '한 사이클 안에서' 한 번씩이지 영구 1회가 아니다).
        uptrend_run = uptrend_run + 1 if st == 'UPTREND' else 0
        if uptrend_run == 3 and done:
            cycle_no += 1
            done.clear()
            probe = None
            b3_at = None
            whipsaw_mode = False
            acts.append({'tag': 'CYCLE', 'label': f'사이클 종료 — 새 사이클 #{cycle_no} 시작',
                         'position': round(position, 1), 'cash': round(cash, 1)})

        def sell(tag, pct_of_position):
            nonlocal position, cash
            amt = position * pct_of_position / 100
            position -= amt
            cash += amt
            acts.append({'tag': tag, 'label': ACTION_LABEL[tag], 'size': round(amt, 1),
                         'position': round(position, 1), 'cash': round(cash, 1)})

        def buy(tag, pct_of_cash, leverage='1x'):
            nonlocal position, cash, probe
            amt = cash * (pct_of_cash * size_mult) / 100
            cash -= amt
            position += amt
            acts.append({'tag': tag, 'label': ACTION_LABEL[tag], 'size': round(amt, 1),
                         'position': round(position, 1), 'cash': round(cash, 1), 'lev': leverage})
            return amt

        entered = st != prev_state
        # ── 매도 사다리
        if entered and st == 'OVERHEAT' and 'S1' not in done and not whipsaw_mode:
            sell('S1', SELL_STAGES['S1']); done.add('S1')
        if entered and st == 'DISTRIBUTION' and 'S2' not in done:
            sell('S2', SELL_STAGES['S2']); done.add('S2')
        if entered and st == 'CORRECTION' and 'S3' not in done:
            sell('S3', SELL_STAGES['S3']); done.add('S3')
        if 'S4' not in done and 'S3' in done and row['close'] < row['sma50'] and st in ('CORRECTION', 'CAPITULATION'):
            sell('S4', SELL_STAGES['S4']); done.add('S4')

        # ── 매수 사다리 (1배 먼저 — 레버리지는 게이트)
        gate2 = row['rev'] >= GATE2['reversal'] and row['whip'] <= GATE2['whipsaw']
        gate3 = row['rev'] >= GATE3['reversal'] and row['whip'] <= GATE3['whipsaw'] and row['breadth_chg'] > 0
        if entered and no_trade and st in ('CAPITULATION', 'REVERSAL_PROBE') and cash > 1 and not whipsaw_mode:
            acts.append({'tag': 'NOTRADE', 'label': 'No-Trade — 신호 불일치·휩쏘 과다로 신규 진입 보류',
                         'position': round(position, 1), 'cash': round(cash, 1)})
        if not whipsaw_mode and not no_trade:
            if entered and st == 'CAPITULATION' and 'B1' not in done and cash > 1:
                amt = buy('B1', BUY_STAGES['B1'], '1x')
                # 탐색 물량은 B1·B2 를 합산해 한 무효화선으로 관리한다 —
                # 덮어쓰면 먼저 산 물량이 손절 대상에서 빠진다.
                probe = {'entry': row['close'], 'stop': row['lo10_prev'] - PROBE_STOP_ATR * row['atr'],
                         'amt': (probe['amt'] if probe else 0) + amt}
                done.add('B1')
            if entered and st == 'REVERSAL_PROBE' and 'B2' not in done and cash > 1:
                amt = buy('B2', BUY_STAGES['B2'], '1x')
                probe = {'entry': row['close'], 'stop': row['lo10_prev'] - PROBE_STOP_ATR * row['atr'],
                         'amt': (probe['amt'] if probe else 0) + amt}
                done.add('B2')
            if entered and st == 'RECOVERY' and 'B3' not in done and cash > 1:
                buy('B3', BUY_STAGES['B3'], '2x 허용' if gate2 else '1x (게이트 미충족)')
                done.add('B3')
                b3_at = i
            # B4 는 B3 로부터 3거래일 뒤 — 회복이 유지되는지 보고 잔여를 넣는다
            if (st == 'RECOVERY' and 'B3' in done and 'B4' not in done and cash > 1
                    and b3_at is not None and i - b3_at >= 3 and row['close'] > row['sma50']):
                buy('B4', 100, '3x 허용' if gate3 else ('2x 허용' if gate2 else '1x (게이트 미충족)'))
                done.add('B4')

        # ── 탐색 물량 무효화 (전저점 − 0.5ATR 종가 이탈)
        if probe and row['close'] < probe['stop']:
            position -= probe['amt']
            cash += probe['amt']
            acts.append({'tag': 'STOP', 'label': ACTION_LABEL['STOP'], 'size': round(probe['amt'], 1),
                         'position': round(position, 1), 'cash': round(cash, 1),
                         'stopAt': round(float(probe['stop']), 2)})
            stops.append(i)
            done.discard('B1'); done.discard('B2')   # 재진입 허용 — 손절은 보험료
            probe = None
            recent_stops = [s for s in stops if s >= i - 10]
            if len(recent_stops) >= WHIPSAW_STOPOUTS and not whipsaw_mode:
                whipsaw_mode = True
                acts.append({'tag': 'WHIPSAW_ON', 'label': ACTION_LABEL['WHIPSAW_ON'],
                             'note': '10거래일 내 stop-out 2회 — 레버리지 금지, 1배만'})

        days.append({
            'date': row['date'].date().isoformat(),
            'close': round(float(row['close']), 2),
            'state': st, 'stateKo': STATE_KO[st], 'temp': STATE_TEMP[st],
            'entered': bool(entered),
            'shock': is_shock(row),
            'scores': {k: round(float(row[k]), 1) for k in ('heat', 'dist', 'cap', 'rev', 'whip')},
            'position': round(position, 1), 'cash': round(cash, 1),
            'actions': acts,
        })
        if acts:
            events.append({'date': row['date'].date().isoformat(), 'state': STATE_KO[st], 'acts': acts})
        prev_state = st

    return {
        'start': start, 'end': end, 'days': days, 'events': events,
        'perf': {'nav': round(nav, 1), 'buyHold': round(bh, 1),
                 'navRet': round(nav - 100, 1), 'bhRet': round(bh - 100, 1)},
        'final': {'position': round(position, 1), 'cash': round(cash, 1),
                  'whipsawMode': whipsaw_mode, 'stopOuts': len(stops),
                  'cycles': cycle_no,
                  'sellsDone': sorted(t for t in done if t.startswith('S')),
                  'buysDone': sorted(t for t in done if t.startswith('B'))},
    }


TARGET_VOL = 0.22    # 연속 레버리지 예산의 목표 변동성(연율) — 초기값


def leverage_budget(row, gate2, gate3):
    """이산 게이트(1x/2x/3x)를 연속 위험 예산으로 보강(피드백 반영 항목).
    예산 = 목표 변동성 ÷ 실현 변동성. 게이트가 상한을 지정하고 예산이 그 안에서
    실제 배수를 정한다 — 방향이 맞아도 변동성이 극단이면 3배가 안 나온다."""
    rv = float(row['rv20']) if pd.notna(row['rv20']) and row['rv20'] > 0 else TARGET_VOL
    raw = TARGET_VOL / rv
    cap = 3.0 if gate3 else (2.0 if gate2 else 1.0)
    return round(float(min(max(raw, 0.5), cap)), 1)


def action_card(row, st):
    """현재 행동 카드 — 결론 한 장이 먼저(기획서 10부)."""
    gate2 = row['rev'] >= GATE2['reversal'] and row['whip'] <= GATE2['whipsaw']
    gate3 = row['rev'] >= GATE3['reversal'] and row['whip'] <= GATE3['whipsaw'] and row['breadth_chg'] > 0
    reco = {
        'UPTREND': '보유 유지. 신규 진입은 눌림에서 분할',
        'OVERHEAT': 'S1 익절 10~15%만 허용. 추가 매도 금지 — 과열은 예고이지 매도 신호 아님',
        'DISTRIBUTION': 'S2 추가 20~25% 익절 — 추세훼손이 진짜 매도 신호',
        'CORRECTION': 'S3 추가 25~30% 축소. 현금 확대, 신규 레버리지 금지',
        'CAPITULATION': '매도 중단. B1 탐색매수 10~15% — 반드시 1배 자산만',
        'REVERSAL_PROBE': 'B2 추가 20~25%. 거짓 반등 위험 상존 — 무효화선 필수',
        'RECOVERY': 'B3/B4 잔여 투입 구간. 게이트 충족 시에만 2·3배',
    }[st]
    inval = row['lo10_prev'] - PROBE_STOP_ATR * row['atr']
    chand = row['hi20'] if not pd.isna(row['hi20']) else row['close']
    conf = float(row['conf']) if pd.notna(row['conf']) else 0.75
    whip_adj = 1 - 0.5 * float(row['whip']) / 100
    no_trade = row['whip'] >= 70 and conf < 0.65
    if no_trade and st in ('CAPITULATION', 'REVERSAL_PROBE'):
        reco = 'No-Trade — 신호 불일치·휩쏘 과다. 신규 진입 보류, 기존 물량의 무효화선만 관리'
    return {
        'state': st, 'stateKo': STATE_KO[st], 'temp': STATE_TEMP[st],
        'close': round(float(row['close']), 2),
        'reco': reco,
        'confidence': round(conf * 100),
        'sizeMult': round(conf * whip_adj * 100),
        'noTrade': bool(no_trade),
        'levBudget': leverage_budget(row, gate2, gate3),
        'leverage': '3배 허용' if gate3 else ('2배 허용' if gate2 else '금지 (1배만)'),
        'gate2': bool(gate2), 'gate3': bool(gate3),
        'invalidation': round(float(inval), 2),
        'chandelier': {str(m): round(float(chand - m * row['atr']), 2) for m in (1.5, 2.0, 3.0)},
        'scores': {k: round(float(row[k]), 1) for k in ('heat', 'dist', 'cap', 'rev', 'whip')},
    }


# 다중 구간 검증(피드백 반영 항목) — 2026년 5~7월은 이 시스템의 철학을 만든
# 사건이라 더 이상 순수한 out-of-sample 이 아니다. 같은 파라미터를 한 글자도
# 바꾸지 않고 성격이 다른 역사 구간을 돌려, 특정 구간에 맞춘 룰이 아님을
# 확인한다. 진짜 OOS 는 오늘 이후의 Shadow 기록이다.
VALIDATION_WINDOWS = [
    ('2018 Q4 급락', '2018-09-01', '2019-03-01'),
    ('2020 코로나', '2020-01-15', '2020-06-30'),
    ('2022 약세 진입', '2021-11-01', '2022-06-30'),
    ('2022-10 바닥', '2022-08-01', '2023-02-01'),
    ('2023 AI 랠리', '2023-01-01', '2023-07-01'),
    ('2025 관세 급락·회복', '2025-02-01', '2025-07-01'),
]


def main():
    argv = sys.argv[1:]
    mkt = argv[argv.index('--mkt') + 1] if '--mkt' in argv else os.path.join(ROOT, '.bfrs-work', 'raw', 'market')
    out = argv[argv.index('--out') + 1] if '--out' in argv else os.path.join(ROOT, '_github-setup', 'swing-ai', 'swing-ai.json')

    spy = load(mkt, 'SPY'); qqq = load(mkt, 'QQQ'); soxx = load(mkt, 'SOXX')
    rsp = load(mkt, 'RSP'); qqqe = load(mkt, 'QQQE')
    vix_raw = load(mkt, 'VIX'); vix3 = load(mkt, 'VIX3M')

    # 날짜 축은 SOXX 기준으로 정렬
    base_dates = soxx['date']
    def align(f):
        return f.set_index('date').reindex(base_dates).reset_index()
    spy, qqq, rsp, qqqe, vix_raw, vix3 = map(align, (spy, qqq, rsp, qqqe, vix_raw, vix3))

    vix = pd.DataFrame({'vix': vix_raw['close'], 'vixr': vix_raw['close'] / vix3['close']})
    vix['vix_jump'] = vix['vix'].pct_change()

    # breadth 프록시 — QQQ/QQQE 63일 상대 모멘텀(값이 클수록 쏠림 = breadth 나쁨 →
    # 부호를 뒤집어 '넓을수록 크게')
    def relmom(a, b):
        r = a['close'] / b['close']
        return -(r.pct_change(63))
    breadth = relmom(qqq, qqqe)

    results = {}
    rep = None
    for sym, df, bench in (('SOXX', soxx, qqq), ('QQQ', qqq, spy), ('SPY', spy, rsp)):
        f = build_features(df, bench, breadth)
        sc = build_scores(f, vix)
        f = pd.concat([f, sc, vix.reindex(f.index)], axis=1)
        states, cands = run_state_machine(f)
        last = f.iloc[-1]
        results[sym] = {
            'card': action_card(last, states.iloc[-1]),
            'asOf': f['date'].iloc[-1].date().isoformat(),
        }
        # 차트는 세 지수 모두 — 화면이 탭으로 고른다.
        cw_all = f[f['date'] >= '2026-01-01']
        results[sym]['chart'] = {
            'dates': [d.date().isoformat() for d in cw_all['date']],
            'close': [round(float(v), 2) for v in cw_all['close']],
            'sma20': [None if pd.isna(v) else round(float(v), 2) for v in cw_all['sma20']],
            'sma50': [None if pd.isna(v) else round(float(v), 2) for v in cw_all['sma50']],
            'temp': [STATE_TEMP[s] for s in states.loc[cw_all.index]],
            'state': [s for s in states.loc[cw_all.index]],
        }
        if sym == 'SOXX':
            rep = replay(f, states, REPLAY_START, REPLAY_END)
            # 다중 구간 — 요약만 싣는다(하루치 전체는 2026 구간만)
            multi = []
            for name, ws, we in VALIDATION_WINDOWS:
                r = replay(f, states, ws, we)
                trans = sum(1 for k, d in enumerate(r['days']) if k and d['state'] != r['days'][k - 1]['state'])
                multi.append({
                    'name': name, 'start': ws, 'end': we,
                    'perf': r['perf'], 'final': r['final'], 'transitions': trans,
                    'events': [{'date': e['date'],
                                'acts': [a2['label'] + (' ' + str(a2['size']) + '%p' if a2.get('size') is not None else '')
                                         for a2 in e['acts']]} for e in r['events']],
                })
            results[sym]['multi'] = multi
            # 점수 히스토리 — 2026 창(개발용 상세 JSON 전용)
            results[sym]['scoreHist'] = {
                k: [None if pd.isna(v) else round(float(v), 1) for v in f.loc[cw_all.index, k]]
                for k in ('heat', 'dist', 'cap', 'rev', 'whip')
            }

    now = datetime.now(timezone.utc)
    payload = {
        'system': 'EZLong Swing AI 2.0 — Phase 1 (Rule Engine + Replay)',
        'generatedAt': now.replace(microsecond=0).isoformat().replace('+00:00', 'Z'),
        'generatedAtKST': (now + timedelta(hours=9)).strftime('%Y-%m-%d %H:%M KST'),
        'states': STATES, 'stateKo': STATE_KO, 'stateTemp': STATE_TEMP,
        'initialValues': {
            'sell': SELL_STAGES, 'buy': BUY_STAGES, 'probeStopATR': PROBE_STOP_ATR,
            'gate2': GATE2, 'gate3': GATE3, 'pctWindowDays': PCT_WIN,
        },
        'tickers': results,
        'replay': rep,
    }
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, 'w', encoding='utf-8') as fp:
        json.dump(payload, fp, ensure_ascii=False, separators=(',', ':'))

    # ── 공개 화면용 — 현재 진단이 주인공, 검증 기록은 요약만.
    pub = argof('--public-out')
    if pub:
        public = {
            'system': payload['system'],
            'generatedAt': payload['generatedAt'],
            'generatedAtKST': payload['generatedAtKST'],
            'asOf': results['SOXX']['asOf'],
            'stateKo': STATE_KO, 'stateTemp': STATE_TEMP,
            'initialValues': payload['initialValues'],
            'tickers': {
                sym: {'card': results[sym]['card'], 'chart': results[sym]['chart']}
                for sym in ('SOXX', 'QQQ', 'SPY')
            },
            'replay': {
                'start': rep['start'], 'end': rep['end'],
                'perf': rep['perf'], 'final': rep['final'],
                'events': rep['events'],
            },
            'multi': results['SOXX']['multi'],
        }
        os.makedirs(os.path.dirname(pub), exist_ok=True)
        with open(pub, 'w', encoding='utf-8') as fp:
            json.dump(public, fp, ensure_ascii=False, separators=(',', ':'))
        print(f'공개용 {pub} {os.path.getsize(pub):,}바이트')

    # ── 콘솔 검증 출력
    print(f"기준일 {results['SOXX']['asOf']} · SOXX {results['SOXX']['card']['stateKo']}"
          f" · QQQ {results['QQQ']['card']['stateKo']} · SPY {results['SPY']['card']['stateKo']}")
    print('Replay 상태 전환:')
    prev = None
    for d in rep['days']:
        if d['state'] != prev:
            print(f"  {d['date']} → {d['stateKo']:<6} (heat {d['scores']['heat']:.0f} dist {d['scores']['dist']:.0f} cap {d['scores']['cap']:.0f} rev {d['scores']['rev']:.0f})")
            prev = d['state']
    print('Replay 매매:')
    for e in rep['events']:
        for a in e['acts']:
            extra = f" {a.get('lev','')}" if a.get('lev') else ''
            print(f"  {e['date']} {a['label']} {a.get('size','')}%{extra} → 보유 {a.get('position','?')}% 현금 {a.get('cash','?')}%")
    print(f"최종: 보유 {rep['final']['position']}% 현금 {rep['final']['cash']}% · stop-out {rep['final']['stopOuts']}회 · 전략 {rep['perf']['navRet']:+.1f}% vs 보유지속 {rep['perf']['bhRet']:+.1f}%")
    print('다중 구간 검증(파라미터 동일):')
    for m in results['SOXX']['multi']:
        print(f"  {m['name']:<12} 전략 {m['perf']['navRet']:+6.1f}% vs 보유 {m['perf']['bhRet']:+6.1f}% · 전환 {m['transitions']}회 · 종료 보유 {m['final']['position']}%")
    print(f"{os.path.getsize(out):,}바이트")
    return 0


if __name__ == '__main__':
    sys.exit(main())
