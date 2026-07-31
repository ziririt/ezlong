#!/usr/bin/env python3
"""스윙 수석 뷰 생성기 (섀도/베타 — atmr-dashboard_v2.html 전용)

data/market-signals.json(현행 점수 파이프라인 산출물)을 읽어
v4 노출 변조 모델을 '하루 1스텝' 진행시키고 두 파일을 쓴다:

  data/swing-ledger.json  내부 원장 (노출·액션·이력) — UI가 읽지 않는다
  data/swing-view.json    공개 뷰 (스탠스 + 애널리스트 논평) — v2 페이지가 읽는다

원칙 (2026-07-30 유저 확정 + 백테스트 리포트 backtest/REPORT-2026-07-31.md):
  - 원장 수치는 비공개. 공개는 스탠스 하나 + 논평문.
  - 확률·통계 문장은 백테스트로 검증된 것만 쓴다 (아래 STATS 상수).
  - 자기 채점: 과거 스탠스 vs 실현 수익 대조, 빗나가면 논평이 스스로 인정한다.
  - 기존 라이브 파이프라인·페이지는 일절 건드리지 않는다.
"""
import json
import os
from datetime import datetime, timezone, timedelta

HERE = os.path.dirname(os.path.abspath(__file__))
SIGNALS = os.path.join(HERE, '..', 'data', 'market-signals.json')
LEDGER = os.path.join(HERE, '..', 'data', 'swing-ledger.json')
VIEW = os.path.join(HERE, '..', 'data', 'swing-view.json')

# v4 파라미터 (백테스트 확정값 — 변경 시 재검증 필수)
CFG = dict(
    base_g3=1.00, base_g2=0.60, base_g1=0.00,
    g1_dip=0.20, dip_level=70,
    warn_sell=60, warn_cap_g3=0.60, warn2_sell=75, warn2_cap=0.35,
    hard_stop_dev=-5.0, hard_consec=2, reenter_dev=-2.0,
    step=0.20, min_gap=0.10, cooldown=2,
)

# 검증된 통계만 (2015.6~2026.7, backtest/REPORT-2026-07-31.md 4절)
STATS = dict(
    base20='지난 11년 이 시장 조합의 20거래일 평균 수익은 +1.5%',
    warn='매도압력 60선 돌파 뒤에는 그 평균이 +0.4%까지, 60거래일 기준으로는 +0.1% 수준까지 떨어졌던 이력이 있습니다',
    gear3='200일선 위 구간의 20거래일 승률은 70%였습니다',
    tsla_extreme='TSLA 매수점수 80 이상 구간은 표본 61일, 이후 20거래일 평균 +15.3%·승률 69%였습니다',
    tsla_hot='TSLA는 매도압력 75를 넘긴 뒤에도 20거래일 평균 +7.5%로 더 오른 이력이 많았습니다 — 과열을 기계적으로 파는 문법이 이 종목에선 돈을 잃어왔습니다',
    nvda_trend='NVDA는 200일선 위(기어3)에서 20거래일 승률 69%, 아래에서는 56%로 갈립니다 — 추세 유지가 판단의 중심입니다',
    rebound='약세 구간(RSI 45 미만)에서 나온 하루 +2.5% 이상 급반등은 지난 11년 49차례 있었고, 반등 자체만으로는 이후 5거래일 승률이 52%로 동전던지기였습니다',
    follow='다만 진위는 이틀 안에 갈렸습니다 — 2거래일 내 반등일 종가 위에서 다시 마감하면 이후 20거래일 평균 +3.2%·승률 63%, 못 하면 −1.1%·승률 38%였습니다',
)

KST = timezone(timedelta(hours=9))


def now_kst():
    return datetime.now(KST).strftime('%Y-%m-%d %H:%M KST')


def load(path, default=None):
    try:
        with open(path, encoding='utf-8') as f:
            return json.load(f)
    except Exception:
        return default


def et_day_of(generated_at_iso):
    """generatedAt(UTC ISO) → 미국 동부 기준 날짜 문자열 (서머타임 어림, 3~11월 EDT)"""
    dt = datetime.fromisoformat(generated_at_iso.replace('Z', '+00:00'))
    offset = -4 if 3 <= dt.month <= 11 else -5
    et = dt + timedelta(hours=offset)
    return et.strftime('%Y-%m-%d')


def comp_scores(syms):
    parts = [(syms.get('QQQ'), 4), (syms.get('VOO'), 3), (syms.get('SOXX'), 3)]
    parts = [(s, w) for s, w in parts if s]
    tw = sum(w for _, w in parts)
    buy = round(sum((s.get('buyScore') or 50) * w for s, w in parts) / tw)
    sell = round(sum((s.get('sellScore') or 50) * w for s, w in parts) / tw)
    gear = round(sum((s.get('gear') or 2) * w for s, w in parts) / tw)
    return buy, sell, gear


def target_exposure(buy, sell, gear, stopped):
    if stopped:
        return 0.0, 'stop'
    if gear >= 3:
        t, why = CFG['base_g3'], 'g3'
        if sell >= CFG['warn2_sell']:
            t, why = min(t, CFG['warn2_cap']), 'warn2'
        elif sell >= CFG['warn_sell']:
            t, why = min(t, CFG['warn_cap_g3']), 'warn'
        return t, why
    if gear == 2:
        t, why = CFG['base_g2'], 'g2'
        if sell >= CFG['warn_sell']:
            t, why = 0.30, 'warn'
        return t, why
    if buy >= CFG['dip_level']:
        return CFG['g1_dip'], 'g1dip'
    return CFG['base_g1'], 'g1'


def advance(state, day, price, buy, sell, gear, dev200):
    """원장 1일 진행. 반환: action(None|'ADD'|'TRIM'|'STOP')"""
    # 하드스톱 카운트
    if dev200 is not None and dev200 <= CFG['hard_stop_dev']:
        state['stopCount'] = state.get('stopCount', 0) + 1
    else:
        state['stopCount'] = 0
    if state['stopCount'] >= CFG['hard_consec']:
        state['stopped'] = True
    if state.get('stopped') and dev200 is not None and dev200 > CFG['reenter_dev']:
        state['stopped'] = False

    target, why = target_exposure(buy, sell, gear, state.get('stopped', False))
    expo = state.get('exposure', None)
    if expo is None:                      # 첫 가동 — 현재 목표로 초기화 (가상 포지션)
        state['exposure'] = target
        state['initDay'] = day
        action = 'INIT'
    else:
        gap = target - expo
        cooled = state.get('daysSince', 99) >= CFG['cooldown']
        urgent = state.get('stopped') and expo > 0
        action = None
        if (abs(gap) >= CFG['min_gap'] and cooled) or urgent:
            move = max(-1.0 if urgent else -CFG['step'], min(CFG['step'], gap))
            state['exposure'] = round(max(0.0, min(1.0, expo + move)), 2)
            action = 'STOP' if urgent else ('ADD' if move > 0 else 'TRIM')
            state['lastAction'] = dict(day=day, type=action, price=price,
                                       frm=round(expo, 2), to=state['exposure'])
            state['daysSince'] = 0
    if action in (None,):
        state['daysSince'] = state.get('daysSince', 0) + 1
    state['target'] = round(target, 2)
    state['targetWhy'] = why
    state['lastDay'] = day
    hist = state.setdefault('history', [])
    hist.append(dict(d=day, price=price, buy=buy, sell=sell, gear=gear,
                     dev=round(dev200, 2) if dev200 is not None else None,
                     target=round(target, 2), expo=state['exposure'],
                     act=action or 'WAIT'))
    del hist[:-60]
    return action


def stance_of(state, action, buy, sell, gear):
    if action == 'STOP' or state.get('stopped'):
        return 'risk_off', '위험 관리 구간 — 노출 축소'
    if action == 'ADD':
        return 'accumulate', '분할 매수 유리 구간'
    if action == 'TRIM':
        return 'trim', '부분 익절·축소 권고 구간'
    expo, target = state.get('exposure', 0), state.get('target', 0)
    if target > expo + 0.05:
        return 'accumulate_wait', '분할 매수 대기 구간 (조건 충족 시 증액)'
    if expo >= 0.5:
        return 'hold', '보유 유지 구간'
    return 'wait', '관망 구간'


def self_review(state):
    """과거 스탠스 vs 실현 수익 대조 — 빗나갔으면 인정 문장 생성"""
    hist = state.get('history', [])
    if len(hist) < 7:
        return None
    cur = hist[-1]['price']
    past = hist[-6]            # 5거래일 전
    chg = (cur / past['price'] - 1) * 100
    bullish = past['act'] in ('ADD', 'INIT') or (past['act'] == 'WAIT' and past['expo'] >= 0.8)
    bearish = past['act'] in ('TRIM', 'STOP') or past['expo'] <= 0.2
    if bullish and chg <= -4:
        return (f'짚고 갈 것이 있습니다. 5거래일 전 노출을 유지·확대하는 쪽에 섰던 판단은 '
                f'이후 {chg:.1f}%로 빗나갔습니다. 변명하지 않겠습니다 — 다만 그 판단의 전제였던 '
                f'200일선 위 추세는 아직 유효해서, 손절선 관리로 대응하는 것이 원칙에 맞다고 봅니다.')
    if bearish and chg >= 4:
        return (f'먼저 인정할 것이 있습니다. 5거래일 전 노출을 줄이는 쪽에 섰던 판단 이후 '
                f'가격은 오히려 +{chg:.1f}% 올랐습니다. 방어의 대가로 상승 일부를 놓친 셈입니다. '
                f'이 시스템은 폭락 방어를 우선하는 구조라 이런 비용이 주기적으로 발생합니다 — '
                f'그 트레이드오프까지가 판단입니다.')
    return None


def load_scorecard():
    d = load(os.path.join(HERE, '..', 'data', 'market-scorecard-data.json'))
    if not d or not d.get('entries'):
        return None
    try:
        upd = datetime.fromisoformat(d['updated_at'].replace('Z', '+00:00'))
        if (datetime.now(timezone.utc) - upd) > timedelta(hours=24):
            return None
    except Exception:
        return None
    return d['entries']


def load_chart_engine():
    a = load(os.path.join(HERE, '..', 'data', 'analysis-QQQ.json'))
    if not a:
        return None
    try:
        upd = datetime.fromisoformat(a['updatedAt'].replace('Z', '+00:00'))
        if (datetime.now(timezone.utc) - upd) > timedelta(hours=36):
            return None
    except Exception:
        return None
    return a.get('analysis') or None


def market_context(state, syms, advanced):
    """시황 문단 — 직전 장마감 등락 + 재료(스코어카드) + 급반등 터닝포인트 관문"""
    p = []
    qqq = syms.get('QQQ') or {}
    chg = qqq.get('changePct')
    price = qqq.get('price')
    rsi_prev = qqq.get('rsi5dAgo')   # 근사: 5일 전 RSI (약세 판단용)
    hist = state.get('history', [])

    cum5 = None
    if len(hist) >= 6:
        cum5 = (hist[-1]['price'] / hist[-6]['price'] - 1) * 100

    sc = load_scorecard()
    move_txt = None
    if chg is not None:
        if chg >= 2.0:
            move_txt = f'직전 장에서 시장이 {chg:+.1f}% 급반등으로 마감했습니다'
        elif chg <= -2.0:
            move_txt = f'직전 장에서 시장이 {chg:+.1f}% 급락으로 마감했습니다'
        elif abs(chg) >= 0.8:
            move_txt = f'직전 장은 {chg:+.1f}%로 마감했습니다'
    if sc:
        cur = sc[0]
        pos, neg = cur.get('positive_total'), cur.get('negative_total')
        ke = (cur.get('key_event') or {}).get('name', '')
        lows = [e for e in sc[1:6] if e.get('positive_total') is not None]
        low = min(lows, key=lambda e: e['positive_total']) if lows else None
        parts = []
        if move_txt:
            parts.append(move_txt + '.')
        if low and pos is not None and pos - low['positive_total'] >= 25:
            lke = (low.get('key_event') or {}).get('name', '')
            neg_names = [f.get('name') for f in (low.get('negative_factors') or [])][:2]
            neg_txt = '·'.join(n for n in neg_names if n)
            parts.append(f"불과 직전까지 {neg_txt or lke}가 누르던 분위기(긍정 {low['positive_total']} 대 "
                         f"부정 {100 - low['positive_total']})가 {ke} 등으로 짧은 시간에 뒤집혔습니다. "
                         f'지금 재료 균형은 긍정 {pos} 대 부정 {neg}.')
        elif pos is not None:
            parts.append(f'재료 균형은 긍정 {pos} 대 부정 {neg} — 핵심 재료는 {ke}.')
        if cum5 is not None and abs(cum5) >= 3:
            parts.append(f'최근 5거래일 누적으로는 {cum5:+.1f}%입니다.')
        if parts:
            p.append(' '.join(parts))
    elif move_txt:
        p.append(move_txt + '.')

    # 급반등 터닝포인트 관문 (판정 → 신규 설정 순서)
    watch = state.get('reboundWatch')
    if advanced and watch:
        if price is not None and price > watch['price']:
            p.append(f"급반등의 첫 관문 — 반등일 종가 {watch['price']:.2f} 위 재마감 — 은 "
                     f'통과됐습니다. {STATS["follow"]}. 통계는 이 반등을 진짜 쪽에 두기 시작했습니다.')
            state['reboundWatch'] = None
        else:
            watch['daysLeft'] -= 1
            if watch['daysLeft'] <= 0:
                p.append(f"급반등의 첫 관문(반등일 종가 {watch['price']:.2f} 위 재마감)은 기한 안에 "
                         f'통과되지 못했습니다. {STATS["follow"]}. 이 반등을 추세 전환으로 승격하지 않습니다.')
                state['reboundWatch'] = None
    if advanced and chg is not None and chg >= 2.5 and (rsi_prev is None or rsi_prev < 45)             and not state.get('reboundWatch'):
        state['reboundWatch'] = dict(day=state.get('lastDay'), price=price, daysLeft=2)
    # 활성 관문은 (같은 날 재실행 포함) 항상 서술 — 상태 기반이라 하루 여러 번 갱신에도 유지
    watch = state.get('reboundWatch')
    if watch:
        p.append(f'급반등이 추세의 터닝포인트인지는 아직 단정하지 않습니다. {STATS["rebound"]}. '
                 f'{STATS["follow"]}. 그래서 지금 관문은 하나입니다 — 남은 {watch["daysLeft"]}거래일 '
                 f'안에 종가가 {watch["price"]:.2f} 위에서 다시 마감하는지 확인 중입니다.')
    return p


def chart_engine_crosscheck(st):
    """차트분석 엔진(AI 차트분석 코너)과의 정합/모순 한 문단"""
    ca = load_chart_engine()
    if not ca:
        return None
    act = ca.get('action') or ca.get('stage') or ''
    trend = ca.get('trend') or ''
    conf = (ca.get('confluenceChecklist') or {})
    verdict = conf.get('verdict') or ''
    bits = []
    if act or trend:
        bits.append(f"차트분석 엔진의 오늘 판독은 '{act or trend}'입니다")
    if verdict:
        bits.append(f"반등 신뢰도 체크는 '{verdict}'({conf.get('score', '')})")
    if not bits:
        return None
    line = '. '.join(bits) + '.'
    bullish_st = st in ('accumulate', 'hold')
    cautious_ca = any(k in (str(act) + str(verdict)) for k in ('관망', '주의', '위장', '매도'))
    if bullish_st and cautious_ca:
        line += ' 수석 판단과 결이 다른 부분인데, 이럴 때 원칙은 보수적인 쪽입니다 — 보유는 유지하되 신규 증액은 이 모순이 풀린 뒤로 미룹니다.'
    elif not bullish_st and not cautious_ca:
        line += ' 차트 쪽이 더 낙관적이지만, 노출 판단은 수석 원장의 규율을 따릅니다.'
    else:
        line += ' 수석 판단과 같은 방향입니다.'
    return line


def comp_commentary(state, action, buy, sell, gear, dev200, price):
    p = []
    expo = state.get('exposure', 0)
    target = state.get('target', 0)
    why = state.get('targetWhy', '')
    la = state.get('lastAction')
    days = state.get('daysSince', 0)

    # 1) 오늘의 판단
    if state.get('stopped') or action == 'STOP':
        p.append(f'지금은 수익을 좇을 자리가 아니라 계좌를 지킬 자리입니다. 종가가 200일선 아래 '
                 f'{dev200:.1f}%까지 밀렸고, 이 선을 이 정도로 이탈한 뒤에는 관성적으로 더 밀린 '
                 f'사례가 많아 계획된 노출 축소를 진행하는 구간입니다. 바닥을 맞히려 들지 않고, '
                 f'200일선 부근을 되찾을 때 다시 들어가는 것이 이 시스템의 원칙입니다.')
    elif action == 'ADD':
        p.append(f'오늘은 계획된 분할 매수를 한 단계 진행하는 것이 맞다고 봅니다. 200일선 '
                 f'{"위" if (dev200 or 0) > 0 else "부근"} 추세가 유지되는 가운데 현재 노출이 목표보다 '
                 f'낮아, 추격이 아니라 계획의 이행에 해당합니다.')
    elif action == 'TRIM':
        reason = '매도압력 점수가 경고선(60)을 넘어선 것' if why in ('warn', 'warn2') else '추세 기어가 한 단계 내려온 것'
        p.append(f'오늘은 일부를 덜어내는 쪽입니다. {reason}이 이유인데, 이는 전량 청산이 아니라 '
                 f'계획된 부분 축소입니다. 추세 자체가 꺾인 게 아니라면 남긴 물량으로 상승을 계속 탑니다.')
    elif action == 'INIT':
        p.append(f'오늘부터 이 판단 체계를 가동합니다. 현재 추세와 신호를 기준으로 한 적정 노출에서 '
                 f'출발하며, 이제부터의 증액·축소는 전부 조건 충족일에만, 단계적으로만 이뤄집니다. '
                 f'매일 무언가를 하라는 시스템이 아니라, 해야 할 날에만 말하는 시스템입니다.')
    elif state.get('exposure', 0) >= 0.5 and gear >= 3:
        p.append(f'지금은 새로 사거나 팔 자리가 아니라 버틸 자리입니다. 이번 구간에서 계획된 분할 매수는 '
                 f'{"대부분" if expo >= 0.8 else "상당 부분"} 진행된 상태이고, 마지막 조정 이후 '
                 f'{days}거래일째 새 조건이 충족되지 않았습니다. 여기서 더 사는 건 분할이 아니라 추격입니다.')
    elif target > expo + 0.05:
        p.append(f'방향은 매수 쪽이지만 오늘은 아닙니다. 조건(간격·쿨다운)이 아직 충족되지 않아 '
                 f'다음 증액을 기다리는 구간입니다 — 분할의 가치는 사는 날이 아니라 기다리는 날에 만들어집니다.')
    else:
        p.append(f'관망이 맞는 구간입니다. 추세 신호와 노출 목표가 모두 낮아, 아무것도 하지 않는 것이 '
                 f'오늘의 판단입니다. 관망도 포지션입니다.')

    # 2) 경고/통계 (검증된 것만)
    if sell >= CFG['warn_sell'] and not state.get('stopped'):
        p.append(f'가볍게 볼 수 없는 신호가 하나 있습니다 — 매도압력 점수 {sell}점. {STATS["warn"]}. '
                 f'그래서 목표 노출을 한 단계 낮춰 잡고 있습니다.')
    elif gear >= 3 and expo >= 0.5:
        p.append(f'근거를 하나만 들자면 이렇습니다. {STATS["gear3"]}. 추세와 함께 가는 동안은 '
                 f'흔들림을 견디는 편이 통계적으로 유리했습니다.')

    # 3) 자기 채점
    sr = self_review(state)
    if sr:
        p.append(sr)
    return p


def _move_prefix(s):
    chg = s.get('changePct')
    if chg is None or abs(chg) < 0.8:
        return ''
    tone = '급반등' if chg >= 3 else ('급락' if chg <= -3 else '마감')
    return f'직전 장 {chg:+.1f}% {tone}. '


def tsla_view(s):
    buy, sell, gear = s.get('buyScore') or 50, s.get('sellScore') or 50, s.get('gear') or 2
    rsi = s.get('rsi')
    if buy >= 80:
        st, label = 'accumulate', '극단 과매도 — 분할 매수 검토 유효'
        body = (f'TSLA가 극단 과매도 구간(매수점수 {buy})에 들어왔습니다. 이 종목에서 유일하게 '
                f'통계적으로 믿을 만한 매수 신호가 바로 이 구간입니다 — {STATS["tsla_extreme"]}. '
                f'다만 변동성이 큰 종목이라 한 번에 들어가지 않고 나눠 들어가는 것이 전제입니다.')
    elif sell >= 75:
        st, label = 'hold', '과열이지만 기계적 익절 비권고'
        body = (f'과열 신호(매도압력 {sell})가 켜졌지만, 이 종목에서는 그 신호를 그대로 따르지 않습니다. '
                f'{STATS["tsla_hot"]} 익절이 필요하다면 시점이 아니라 이탈(추세 붕괴)을 기준으로 잡는 것이 '
                f'맞다고 봅니다.')
    elif gear <= 1:
        st, label = 'wait', '하락 추세 — 극단 신호 대기'
        body = (f'200일선 아래 하락 추세입니다. TSLA는 중간 점수대(50~79)의 매수 신호가 사실상 '
                f'동전던지기였던 종목이라, 어중간한 자리에서 잡지 않고 극단 신호(매수점수 80 이상)를 '
                f'기다리는 것이 데이터가 가리키는 방향입니다.')
    else:
        st, label = 'hold', '보유 유지 — 이탈 관리 중심'
        body = (f'추세 훼손 신호가 없는 구간입니다. TSLA는 예측보다 대응이 유리했던 종목입니다 — '
                f'미리 팔거나 미리 사는 대신, 200일선 이탈 여부 하나를 기준으로 관리하는 구간입니다.')
    return dict(stance=st, stanceLabel=label, commentary=_move_prefix(s) + body,
                nums=dict(buy=buy, sell=sell, gear=gear, rsi=rsi))


def nvda_view(s):
    buy, sell, gear = s.get('buyScore') or 50, s.get('sellScore') or 50, s.get('gear') or 2
    rsi = s.get('rsi')
    if gear >= 3:
        st, label = 'hold', '추세 유지 — 보유 중심'
        body = (f'NVDA는 추세가 전부인 종목입니다. {STATS["nvda_trend"]} 지금은 200일선 위 구간이라 '
                f'보유를 유지하는 쪽이고, 과열 신호(매도압력 {sell})는 이 종목에서 검증력이 없어 '
                f'그 이유만으로 덜어내지는 않습니다.')
    elif gear == 2:
        st, label = 'hold', '경계 — 200일선 공방 구간'
        body = (f'NVDA가 200일선 부근 공방에 들어왔습니다. 이 종목의 판단 기준은 추세 하나입니다. '
                f'{STATS["nvda_trend"]} 아직 추세가 꺾였다고 확정할 단계는 아니라 보유를 유지하되, '
                f'200일선을 종가 기준으로 명확히 이탈하면 그때는 축소가 판단이 됩니다. 미리 팔지도, '
                f'무작정 버티지도 않는 구간입니다.')
    else:
        st, label = 'trim', '추세 이탈 — 축소 검토 구간'
        body = (f'NVDA의 판단 기준은 하나, 추세입니다. {STATS["nvda_trend"]} 200일선 아래로 추세가 '
                f'무너진 지금 같은 구간에서는 노출 축소를 검토하는 것이 데이터의 방향입니다. '
                f'추세 복귀가 확인되면 다시 싣는 것이 원칙입니다.')
    return dict(stance=st, stanceLabel=label, commentary=_move_prefix(s) + body,
                nums=dict(buy=buy, sell=sell, gear=gear, rsi=rsi))


def main():
    sig = load(SIGNALS)
    if not sig:
        raise SystemExit('market-signals.json 없음')
    syms = sig.get('symbols', {})
    qqq = syms.get('QQQ') or {}
    price = qqq.get('price')
    dev200 = qqq.get('dev200')
    if not price:
        raise SystemExit('QQQ price 없음')
    day = et_day_of(sig.get('generatedAt'))
    buy, sell, gear = comp_scores(syms)

    # 신선도 가드 — 상류 파이프라인이 죽어 있으면 낡은 점수로 원장을 전진시키지 않는다
    stale = False
    try:
        gen = datetime.fromisoformat(sig['generatedAt'].replace('Z', '+00:00'))
        stale = (datetime.now(timezone.utc) - gen) > timedelta(days=3)
    except Exception:
        pass

    ledger = load(LEDGER, {}) or {}
    comp = ledger.setdefault('comp', {})
    advanced = False
    if comp.get('lastDay') != day and not stale:
        action = advance(comp, day, price, buy, sell, gear, dev200)
        advanced = True
    else:
        action = None   # 같은 거래일 재실행/신선도 실패 — 상태 진행 없이 뷰만 갱신

    st, label = stance_of(comp, action, buy, sell, gear)
    ctx_paras = market_context(comp, syms, advanced)

    # 스탠스 스트릭 (거래일 기준) + 오늘 변경 여부
    changed = False
    if advanced:
        if st == comp.get('lastStance'):
            comp['stanceStreak'] = comp.get('stanceStreak', 0) + 1
        else:
            comp['stanceStreak'] = 1
            changed = comp.get('lastStance') is not None
        comp['lastStance'] = st
        comp['changedDay'] = day if changed else comp.get('changedDay')
        if comp.get('history'):
            comp['history'][-1]['st'] = st
    streak = comp.get('stanceStreak', 1)

    # 판단 흐름 라인 — "관망 2일 → 보유(오늘, 4일째)"
    SHORT = dict(accumulate='분할매수', accumulate_wait='매수대기', hold='보유',
                 trim='축소', risk_off='위험관리', wait='관망')
    flow = None
    runs = []
    for h in comp.get('history', [])[-15:]:
        s2 = h.get('st')
        if not s2:
            continue
        if runs and runs[-1][0] == s2:
            runs[-1][1] += 1
        else:
            runs.append([s2, 1])
    if len(runs) >= 2:
        older = ' → '.join(f'{SHORT[s2]} {n}일' for s2, n in runs[-3:-1])
        flow = f'{older} → {SHORT[runs[-1][0]]}(오늘, {runs[-1][1]}일째)'
    elif runs:
        flow = f'{SHORT[runs[-1][0]]} {runs[-1][1]}일째 유지'

    # 성적 자기공개 — 방향 판단(강세/약세)만, 5거래일 후 수익률로 채점 (표본 15+부터 공개)
    grade = None
    hist = comp.get('history', [])
    if len(hist) >= 21:
        hits = n = 0
        for i in range(len(hist) - 5):
            s2 = hist[i].get('st')
            if s2 not in ('accumulate', 'hold', 'trim', 'risk_off'):
                continue
            fwd = hist[i + 5]['price'] / hist[i]['price'] - 1
            bull = s2 in ('accumulate', 'hold')
            n += 1
            if (bull and fwd > 0) or (not bull and fwd < 0):
                hits += 1
        if n >= 15:
            grade = dict(n=n, hits=hits, pct=round(hits / n * 100))
    commentary = comp_commentary(comp, action, buy, sell, gear, dev200, price)
    commentary = ctx_paras + commentary
    cross = chart_engine_crosscheck(st)
    if cross:
        commentary.append(cross)

    if grade:
        commentary.append(f'성적은 숨기지 않겠습니다. 최근 {grade["n"]}번의 방향 판단 중 '
                          f'{grade["hits"]}번이 5거래일 뒤 방향과 일치했습니다(적중률 {grade["pct"]}%). '
                          f'이 숫자는 매일 갱신되고, 나빠져도 그대로 공개합니다.')
    if stale:
        commentary.insert(0, '주의 — 상류 데이터가 3일 이상 갱신되지 않아 오늘은 판단을 전진시키지 '
                             '않았습니다. 아래 내용은 마지막 정상 데이터 기준입니다.')

    view = dict(
        generatedAtKST=now_kst(),
        dataDay=day,
        beta=True,
        stanceChangedToday=changed,
        stanceStreak=streak,
        flow=flow,
        stale=stale,
        comp=dict(stance=st, stanceLabel=label, commentary=commentary,
                  confidence=('상' if gear >= 3 and sell < CFG['warn_sell'] else
                              '중' if not comp.get('stopped') else '하'),
                  nums=dict(buy=buy, sell=sell, gear=gear,
                            dev200=round(dev200, 2) if dev200 is not None else None)),
        tsla=tsla_view(syms.get('TSLA') or {}),
        nvda=nvda_view(syms.get('NVDA') or {}),
    )

    with open(LEDGER, 'w', encoding='utf-8') as f:
        json.dump(ledger, f, ensure_ascii=False, indent=1)
    with open(VIEW, 'w', encoding='utf-8') as f:
        json.dump(view, f, ensure_ascii=False, indent=1)
    print(f'swing-view 생성: day={day} advanced={advanced} action={action} '
          f'stance={st} expo={comp.get("exposure")} target={comp.get("target")}')


if __name__ == '__main__':
    main()
