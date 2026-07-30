"""v4 — 목표 노출 변조 모델 (인덱스 전용).

이벤트 스터디 결론 반영:
  · 인덱스(QQQ/VOO/SOXX 종합)에서 buy 점수의 단기 알파는 얇다 → '언제 사냐'보다 '얼마나 들고 있냐'
  · 유일하게 검증된 경고 신호 = sell 점수 60+ (20일 선행수익 급감)
  · 200일선 레짐(gear)은 평균수익이 아니라 '승률/일관성'을 높인다

구조: 매일 목표 노출(target)을 정하고, 실제 노출은 트랜치 단위로만 접근한다.
      트랜치 이동 자체가 캠페인 원장의 항목이 된다 (매수 k차 / 익절 k차 / 축소 / 복귀).
"""
import pandas as pd
import numpy as np

DEFAULT = dict(
    base_g3=1.00,        # 기어3 기본 노출
    base_g2=0.60,
    base_g1=0.00,
    g1_dip=0.20,         # 기어1이라도 buy>=dip_level이면 소량 저점 분할 (자제 원칙 유지, 소액)
    dip_level=70,
    warn_sell=60,        # 검증된 경고선 — 이 이상이면 노출 축소
    warn_cap_g3=0.60,
    warn2_sell=75,       # 극단 과열
    warn2_cap=0.35,
    hard_stop_dev=-5.0,  # 200일선 -5% 이탈 → 전량 (2연속 종가)
    hard_consec=2,
    reenter_dev=-2.0,    # 하드스톱 후 재진입 허용선 (dev200가 이 위로 복귀해야)
    step=0.20,           # 한 번의 액션(트랜치)으로 움직일 수 있는 최대 노출 폭
    min_gap=0.10,        # 목표와 실제 차이가 이 이상일 때만 액션
    cooldown=2,          # 액션 간 최소 거래일
)


def run(df, cfg=None):
    cfg = {**DEFAULT, **(cfg or {})}
    cash, shares = 1.0, 0.0
    eq = []
    log = []
    msgs = []
    last_action = -99
    stop_count = 0
    stopped = False   # 하드스톱 상태 (재진입선 복귀 전까지 목표 0 고정)

    for i, (date, r) in enumerate(df.iterrows()):
        price = r['close']
        buy, sell, gear, dev = int(r['buy']), int(r['sell']), int(r['gear']), r['dev200']
        equity = cash + shares * price
        expo = shares * price / equity if equity else 0.0

        # ── 하드스톱 상태 관리 ─────────────────────────────
        if dev is not None and dev <= cfg['hard_stop_dev']:
            stop_count += 1
        else:
            stop_count = 0
        if stop_count >= cfg['hard_consec']:
            stopped = True
        if stopped and dev is not None and dev > cfg['reenter_dev']:
            stopped = False   # 200일선 부근 복귀 — 재진입 허용

        # ── 목표 노출 결정 ────────────────────────────────
        if stopped:
            target = 0.0
        elif gear >= 3:
            target = cfg['base_g3']
            if sell >= cfg['warn2_sell']:
                target = min(target, cfg['warn2_cap'])
            elif sell >= cfg['warn_sell']:
                target = min(target, cfg['warn_cap_g3'])
        elif gear == 2:
            target = cfg['base_g2']
            if sell >= cfg['warn_sell']:
                target = min(target, 0.30)
        else:
            target = cfg['g1_dip'] if buy >= cfg['dip_level'] else cfg['base_g1']

        # ── 트랜치 이동 (스텝 제한 + 쿨다운) ───────────────
        msg = 'WAIT'
        gap = target - expo
        urgent = stopped and expo > 0   # 하드스톱만은 쿨다운 무시
        if (abs(gap) >= cfg['min_gap'] and (i - last_action) >= cfg['cooldown']) or urgent:
            move = np.clip(gap, -1.0 if urgent else -cfg['step'], cfg['step'])
            delta_val = move * equity
            if delta_val > 0:
                spend = min(cash, delta_val)
                shares += spend / price
                cash -= spend
                msg = 'ADD'
                log.append((str(date.date()), 'ADD', price, round(expo, 2), round(target, 2)))
            else:
                sell_val = min(shares * price, -delta_val)
                shares -= sell_val / price
                cash += sell_val
                msg = 'STOP' if urgent else 'TRIM'
                log.append((str(date.date()), msg, price, round(expo, 2), round(target, 2)))
            last_action = i
        equity = cash + shares * price
        eq.append((date, equity, shares * price / equity if equity else 0))
        msgs.append(msg)

    return log, eq, msgs
