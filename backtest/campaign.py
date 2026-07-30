"""캠페인 원장(Campaign Ledger) — 내역을 기억하는 상태 기반 스윙 알고리즘 프로토타입.

현행 시스템: 매일 f(지표) → 문구  (무기억 → 과매도 시즌 내내 "1차 진입" 반복)
신규 시스템: 이벤트 + 상태머신 → "지금 몇 차까지 했고, 다음 행동의 정확한 조건" 을 매일 갱신

상태(phase): IDLE → ACCUM(분할 진입 중) → HOLD → DISTRIB(분할 익절 중) → IDLE
             어느 국면에서든 손절 조건 발동 시 STOP(전량 정리) → IDLE
"""
from dataclasses import dataclass, field


DEFAULT = dict(
    n_entries=6,            # 분할 진입 트랜치 수
    n_exits=4,              # 분할 익절 트랜치 수
    open_cross=65,          # compBuy가 이 값을 '상향 돌파'하면 캠페인 시작 (레벨 아님, 이벤트)
    open_rearm=58,          # 이 값 이하로 내려와야 다음 돌파가 다시 이벤트로 인정 (히스테리시스)
    min_gear=2,             # 진입 허용 최소 기어
    add_drop_atr=1.0,       # 다음 트랜치: 마지막 체결가 − ATR×이 배수 이하
    add_drop_min_pct=1.5,   # ATR가 작아도 최소 이만큼 아래
    add_score_jump=8,       # 또는 점수가 직전 체결 대비 +8 강화 (단, 추격 상한 내에서)
    chase_cap_pct=3.0,      # 점수 강화 매수 허용 상한: 마지막 체결가 +3% 이내
    cooldown_days=2,        # 트랜치 간 최소 거래일 간격
    stop_dev200=-2.0,       # 종가 200일선 대비 −2% 이하가
    stop_consec=2,          #   2거래일 연속이면 → 전량 정리 + 캠페인 종료
    exit_cross=60,          # compSell 상향 돌파 → 분배 국면 시작
    exit_rearm=50,
    exit_rise_atr=1.0,      # 다음 익절: 마지막 익절가 + ATR×배수 이상
    exit_rise_min_pct=2.0,
    profit_arm_pct=None,    # 평단 +X% 도달 시 sell 신호 없어도 분배 국면 무장 (None=미사용)
)


@dataclass
class Ledger:
    cfg: dict
    phase: str = 'IDLE'
    pos: float = 0.0            # 투입 비중 (0~1)
    avg_cost: float = 0.0
    tranches: list = field(default_factory=list)
    exits: list = field(default_factory=list)
    buy_armed: bool = True      # 히스테리시스 무장 상태
    sell_armed: bool = True
    last_fill_price: float = None
    last_fill_score: int = None
    last_exit_price: float = None
    last_action_i: int = -99
    stop_count: int = 0
    # 성과 추적
    cash: float = 1.0
    shares: float = 0.0
    log: list = field(default_factory=list)

    def _buy(self, i, date, price, frac, score, kind):
        frac = min(frac, self.cash / price * price)  # cash 한도
        spend = min(self.cash, frac)
        if spend <= 1e-9:
            return
        self.shares += spend / price
        self.cash -= spend
        newpos = self.pos + spend
        self.avg_cost = ((self.avg_cost * self.pos) + price * spend) / newpos if newpos else price
        self.pos = newpos
        self.tranches.append(dict(i=i, date=str(date.date()), price=price, frac=round(spend, 4),
                                  score=score, kind=kind))
        self.last_fill_price = price
        self.last_fill_score = score
        self.last_action_i = i
        self.log.append((str(date.date()), f'ENTER{len(self.tranches)}', price, kind))

    def _sell(self, i, date, price, frac, score, kind):
        sell_val = min(self.shares * price, frac)
        if self.shares <= 1e-12 or sell_val <= 1e-9:
            return
        qty = sell_val / price
        qty = min(qty, self.shares)
        self.shares -= qty
        self.cash += qty * price
        self.pos = max(0.0, self.pos - sell_val)
        self.exits.append(dict(i=i, date=str(date.date()), price=price, frac=round(sell_val, 4),
                               score=score, kind=kind))
        self.last_exit_price = price
        self.last_action_i = i
        self.log.append((str(date.date()), f'EXIT{len(self.exits)}', price, kind))

    def equity(self, price):
        return self.cash + self.shares * price


def run(df, cfg=None):
    """df: index=date, columns close/high/low/buy/sell/gear/dev200/atr_pct
    반환: (Ledger, equity_curve list, daily_msgs list)"""
    cfg = {**DEFAULT, **(cfg or {})}
    L = Ledger(cfg=cfg)
    eq = []
    msgs = []
    entry_frac = 1.0 / cfg['n_entries']
    prev_buy = None
    prev_sell = None

    for i, (date, r) in enumerate(df.iterrows()):
        price, buy, sell = r['close'], int(r['buy']), int(r['sell'])
        gear, dev200 = int(r['gear']), r['dev200']
        atr_pct = r['atr_pct']
        step_dn = max(cfg['add_drop_min_pct'], cfg['add_drop_atr'] * atr_pct) / 100
        step_up = max(cfg['exit_rise_min_pct'], cfg['exit_rise_atr'] * atr_pct) / 100
        msg = 'WAIT'

        # ── 히스테리시스 재무장 ────────────────────────────
        if buy <= cfg['open_rearm']:
            L.buy_armed = True
        if sell <= cfg['exit_rearm']:
            L.sell_armed = True

        # ── 손절 (모든 국면 공통) ──────────────────────────
        if L.shares > 0 and dev200 is not None and dev200 <= cfg['stop_dev200']:
            L.stop_count += 1
            if L.stop_count >= cfg['stop_consec']:
                L._sell(i, date, price, L.shares * price, sell, 'STOP-200SMA')
                L.phase = 'IDLE'
                L.tranches.clear(); L.exits.clear()
                L.avg_cost = 0.0; L.pos = 0.0
                msg = 'STOP'
                eq.append((date, L.equity(price))); msgs.append(msg)
                prev_buy, prev_sell = buy, sell
                continue
        else:
            L.stop_count = 0

        cooled = (i - L.last_action_i) >= cfg['cooldown_days']

        # ── IDLE → 캠페인 개시 (이벤트: 상향 돌파) ─────────
        if L.phase == 'IDLE':
            crossed = (L.buy_armed and buy >= cfg['open_cross']
                       and (prev_buy is None or prev_buy < cfg['open_cross'] or L.buy_armed))
            if crossed and gear >= cfg['min_gear']:
                L.phase = 'ACCUM'
                L.buy_armed = False
                L._buy(i, date, price, entry_frac, buy, 'OPEN-CROSS')
                msg = 'ENTER1'

        # ── ACCUM: 추가 트랜치 ─────────────────────────────
        elif L.phase == 'ACCUM':
            done = len(L.tranches)
            if done >= cfg['n_entries'] or L.cash <= 1e-9:
                L.phase = 'HOLD'
            elif cooled and gear >= cfg['min_gear']:
                dip_ok = price <= L.last_fill_price * (1 - step_dn)
                strengthen_ok = (buy >= (L.last_fill_score or 0) + cfg['add_score_jump']
                                 and price <= L.last_fill_price * (1 + cfg['chase_cap_pct'] / 100)
                                 and buy >= cfg['open_cross'])
                if dip_ok or strengthen_ok:
                    L._buy(i, date, price, entry_frac, buy,
                           'DIP' if dip_ok else 'STRENGTHEN')
                    msg = f'ENTER{len(L.tranches)}'

        # ── 분배 국면 진입 판단 (ACCUM/HOLD 공통) ──────────
        if L.phase in ('ACCUM', 'HOLD') and L.shares > 0:
            sell_cross = L.sell_armed and sell >= cfg['exit_cross']
            profit_arm = (cfg['profit_arm_pct'] is not None and L.avg_cost > 0
                          and price >= L.avg_cost * (1 + cfg['profit_arm_pct'] / 100))
            if sell_cross or profit_arm:
                L.phase = 'DISTRIB'
                L.sell_armed = False
                port_val = L.shares * price
                L._sell(i, date, price, port_val / cfg['n_exits'], sell,
                        'SELL-CROSS' if sell_cross else 'PROFIT-ARM')
                msg = 'EXIT1'

        # ── DISTRIB: 추가 익절 ─────────────────────────────
        elif L.phase == 'DISTRIB':
            if L.shares <= 1e-12:
                L.phase = 'IDLE'
                L.tranches.clear(); L.exits.clear(); L.avg_cost = 0.0; L.pos = 0.0
            elif cooled:
                rise_ok = price >= (L.last_exit_price or price) * (1 + step_up)
                worse_ok = sell >= cfg['exit_cross'] + cfg['add_score_jump']
                if rise_ok or worse_ok:
                    port_val = L.shares * price
                    remaining_exits = max(1, cfg['n_exits'] - len(L.exits))
                    L._sell(i, date, price, port_val / remaining_exits, sell,
                            'RISE' if rise_ok else 'WORSEN')
                    msg = f'EXIT{len(L.exits)}'
                # 재매집 전환: 분배 중 buy 재돌파 시 잔여 물량 유지한 채 HOLD 복귀
                elif L.buy_armed and buy >= cfg['open_cross'] and gear >= cfg['min_gear']:
                    L.phase = 'HOLD'
                    L.buy_armed = False

        eq.append((date, L.equity(price)))
        msgs.append(msg)
        prev_buy, prev_sell = buy, sell

    return L, eq, msgs
