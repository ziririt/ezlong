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
    lifeline='이 생명선은 백테스트에서 2022년 1월 28일 QQQ 352에 발동해 바닥(254)까지의 추가 하락을 통째로 피하게 했고, 2021~2026 구간 최대낙폭을 −20.7%에서 −16.0%로 줄였습니다. 대신 2020·2023·2025년의 휩쏘로 연 1.4%p가량을 보험료로 냈습니다 — 더 비싸게 다시 사는 비용까지가 이 규칙의 가격입니다',
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


def advance(state, day, price, buy, sell, gear, dev200, cap=None):
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
    if cap is not None and cap < target:
        target, why = cap, 'lifeline'
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
    if state.get('targetWhy') == 'lifeline' and state.get('target', 1) <= 0.2 \
            and state.get('exposure', 0) > state.get('target', 0):
        return 'risk_off', '생명선 발동 — 계획 축소 진행 구간'
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


def lifeline_status():
    """생명선 — 마켓사이클 주봉(30주선) 판정. 확정된 주봉만 사용 (진행 중인 주 제외).
    2026-07-31 백테스트 채택: 3개 지수 중 2개 이탈 → 노출 상한 20%, 3개 전부 → 0%.
    브레드스(RSP-SPY) 캡은 OOS 성과 저하로 보류. 데이터 14일 이상 정체 시 미적용."""
    now_ts = datetime.now(timezone.utc).timestamp()
    detail = []
    newest = 0.0
    for sym, name in (('SPY', 'S&P500'), ('QQQ', '나스닥100'), ('SOXX', '반도체')):
        d = load(os.path.join(HERE, '..', 'data', f'mc-ohlcv-{sym}-weekly.json'))
        if not d or not d.get('ohlcv'):
            return None
        try:
            newest = max(newest, datetime.fromisoformat(
                d['updatedAt'].replace('Z', '+00:00')).timestamp())
        except Exception:
            pass
        closes = [b['c'] for b in d['ohlcv']
                  if b.get('c') and b['t'] + 6 * 86400 <= now_ts]   # 확정 주봉만
        if len(closes) < 31:
            return None
        sma30 = sum(closes[-30:]) / 30
        detail.append((name, closes[-1] < sma30))
    stale = bool(newest) and (now_ts - newest) > 14 * 86400
    return dict(count=sum(1 for _, b in detail if b), detail=detail, stale=stale)


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


MEGA = ['MSFT', 'AAPL', 'GOOGL', 'AMZN', 'META', 'NVDA', 'TSLA', 'AVGO', 'NFLX']

def postmarket_context():
    """포스트마켓 — 큰 이벤트가 있는 날에만 언급한다 (2026-07-31 유저 확정).
    기준: 빅테크 시간외 ±2.5% 이상(실적 쇼크급) 또는 지수 ETF 시간외 ±1.0% 이상
    (FOMC·지정학·대통령 담화급). 평소의 미미한 시간외 등락은 침묵 — 언급 자체가 노이즈.
    데이터 2시간 이상 정체 시 미표시."""
    d = load(os.path.join(HERE, '..', 'data', 'stocks-prices.json'))
    if not d or not d.get('prices'):
        return None
    try:
        upd = datetime.fromisoformat(d['updatedAt'])
        if (datetime.now(timezone.utc) - upd) > timedelta(hours=2):
            return None
    except Exception:
        return None
    p = d['prices']
    ups, dns = [], []
    for s in MEGA:
        v = p.get(s) or {}
        if v.get('extSession') == 'post' and v.get('extPct') is not None and abs(v['extPct']) >= 2.5:
            (ups if v['extPct'] > 0 else dns).append(f"{s} {v['extPct']:+.1f}%")
    qqq = p.get('QQQ') or {}
    idx_big = (qqq.get('extSession') == 'post' and qqq.get('extPct') is not None
               and abs(qqq['extPct']) >= 1.0)
    if not ups and not dns and not idx_big:
        return None          # 이벤트 없는 평범한 시간외 — 침묵
    parts = []
    if ups:
        parts.append('급등 ' + '·'.join(ups))
    if dns:
        parts.append('급락 ' + '·'.join(dns))
    body = ', '.join(parts)
    idx_txt = ''
    if qqq.get('extSession') == 'post' and qqq.get('extPct') is not None \
            and (idx_big or ups or dns):
        idx_txt = f" 지수(QQQ) 시간외 {qqq['extPct']:+.1f}% — 다음 정규장 갭 방향의 단서."
    if body:
        return f'장 마감 뒤 시간외 거래에서 큰 움직임이 나왔습니다 — {body}.' + idx_txt
    return f'장마감 뒤 지수가 크게 움직였습니다.{idx_txt} 매크로급 재료 발생 가능성 — 재료 균형 갱신분 확인 대상.'


_SESSION_DATE = None

def session_date_label():
    """직전 장 날짜 라벨 — '7월30일' (ET 기준, market-signals generatedAt에서 산출).
    유저 확정(2026-07-31): '직전 장'은 반드시 '직전 장(7월30일)'처럼 날짜를 병기한다."""
    global _SESSION_DATE
    if _SESSION_DATE is None:
        try:
            d = et_day_of((load(SIGNALS) or {}).get('generatedAt'))
            _SESSION_DATE = f'{int(d[5:7])}월{int(d[8:10])}일'
        except Exception:
            _SESSION_DATE = ''
    return _SESSION_DATE


def prev_session_tag():
    """'직전 장(7월30일)' — 날짜 산출 실패 시 '직전 장'으로 폴백"""
    lbl = session_date_label()
    return f'직전 장({lbl})' if lbl else '직전 장'


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

    pm = postmarket_context()
    sc = load_scorecard()
    move_txt = None
    if chg is not None:
        if chg >= 2.0:
            move_txt = f'{prev_session_tag()}에서 시장이 {chg:+.1f}% 급반등으로 마감했습니다'
        elif chg <= -2.0:
            move_txt = f'{prev_session_tag()}에서 시장이 {chg:+.1f}% 급락으로 마감했습니다'
        elif abs(chg) >= 0.8:
            move_txt = f'{prev_session_tag()}은 {chg:+.1f}%로 마감했습니다'
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
    if pm:
        p.append(pm)

    # 급반등 터닝포인트 관문 (판정 → 신규 설정 순서)
    watch = state.get('reboundWatch')
    if advanced and watch:
        if price is not None and price > watch['price']:
            p.append(f"급반등의 첫 관문 — QQQ가 반등일 종가인 {int(watch['price'])}달러 선 위에서 재마감 — 은 "
                     f'통과됐습니다. {STATS["follow"]}. 통계는 이 반등을 진짜 쪽에 두기 시작했습니다.')
            state['reboundWatch'] = None
        else:
            watch['daysLeft'] -= 1
            if watch['daysLeft'] <= 0:
                p.append(f"급반등의 첫 관문(QQQ 종가의 {int(watch['price'])}달러 선 재돌파)은 기한 안에 "
                         f'통과되지 못했습니다. {STATS["follow"]}. 이 반등을 추세 전환으로 승격하지 않습니다.')
                state['reboundWatch'] = None
    if advanced and chg is not None and chg >= 2.5 and (rsi_prev is None or rsi_prev < 45)             and not state.get('reboundWatch'):
        state['reboundWatch'] = dict(day=state.get('lastDay'), price=price, daysLeft=2)
    # 활성 관문은 (같은 날 재실행 포함) 항상 서술 — 상태 기반이라 하루 여러 번 갱신에도 유지
    watch = state.get('reboundWatch')
    if watch:
        p.append(f'급반등이 추세의 터닝포인트인지는 아직 단정하지 않습니다. {STATS["rebound"]}. '
                 f'{STATS["follow"]}. 그래서 지금 관문은 하나입니다 — 남은 {watch["daysLeft"]}거래일 '
                 f'안에 QQQ 종가가 반등일 종가인 {int(watch["price"])}달러 선 위에서 다시 마감하는지 확인 중입니다.')
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
        # 'N/5' 분수 표기는 일반 방문자에게 낯설다 — 퍼센트로 변환 (2026-08-01 유저 지시)
        raw = str(conf.get('score', '') or '')
        pct = raw
        if '/' in raw:
            try:
                a, b = raw.split('/')
                pct = f'충족 {round(int(a) / int(b) * 100)}%'
            except Exception:
                pass
        bits.append(f"반등 신뢰도 체크는 '{verdict}'({pct})")
    if not bits:
        return None
    line = '. '.join(bits) + '.'
    bullish_st = st in ('accumulate', 'hold')
    cautious_ca = any(k in (str(act) + str(verdict)) for k in ('관망', '주의', '위장', '매도'))
    if bullish_st and cautious_ca:
        line += ' 이 판단과 결이 다른 부분인데, 이럴 때 원칙은 보수적인 쪽입니다 — 보유는 유지하되 신규 증액은 이 모순이 풀린 뒤로 미룹니다.'
    elif not bullish_st and not cautious_ca:
        line += ' 차트 쪽이 더 낙관적이지만, 노출 판단은 이 시스템의 규율을 따릅니다.'
    else:
        line += ' 이 판단과 같은 방향입니다.'
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
    return f'{prev_session_tag()} {chg:+.1f}% {tone}. '


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
                nums=dict(buy=buy, sell=sell, gear=gear, rsi=rsi),
                audience=_audience(st, buy, sell, gear, rsi, 'ignore', 'wait', '매수점수 80 이상 극단 과매도'))


# ─── TOP9 확장: 빅테크 7종 종목별 문법 (2026-08-03 신설, 성동님 승인) ───────
# 통계 출처: backtest/compute_scores.py로 라이브 calc_buy_score/calc_sell_score를
# 2015.6~2026.8 전 구간 재계산한 뒤 20거래일 선행수익 집계 (표본수 명기).
# TSLA buy80=61일 +15.3%/69%, NVDA gear3 69%/gear1 56%가 기존 STATS와 정확 일치해
# 엔진 검증 통과 확인 후 산출한 수치들이다. 상승장 편향 구간임을 유의 — base(전체
# 평균)와의 '차이'가 신호의 가치이지, 절대 수익률이 아니다.
MEGA_ORDER = ['AAPL', 'GOOG', 'MSFT', 'AMZN', 'TSM', 'AVGO', 'META']  # 시가총액순 (2026-07-29)

MEGA_CFG = {
    'AAPL': dict(
        label='애플',
        buy=None,  # buy80 +1.6%/62% ≈ base(+2.0%/63%) — 극단 신호에 반응 안 하는 종목
        buy_txt=None,
        hot='ignore',  # sell75 이후 20일 평균 +2.6%·승률 76% (n=72) — 과열 매도가 역효과
        hot_txt='AAPL은 과열 신호(매도압력 75+) 이후에도 20거래일 평균 +2.6%·승률 76%로 오히려 더 올랐던 종목입니다(표본 72일) — 기계적 익절이 이 종목에선 수익을 깎아왔습니다',
        down='insensitive',  # gear1 승률 59% vs gear3 64% — 추세 민감도 낮음
        down_txt='AAPL은 200일선 아래에서도 20거래일 승률 59%로 크게 무너지지 않았던 종목입니다(위 구간 64%) — 추세 신호에 둔감한 항공모함이라, 극단 구간 분할 대응보다 보유 지속이 통계의 방향입니다',
        base_txt='AAPL은 신호 민감도가 9종 중 가장 낮은 종목입니다 — 극단 매수점수도, 과열 매도도 통계적 우위가 없었습니다. 판단할 게 적다는 것 자체가 이 종목의 성격입니다'),
    'GOOG': dict(
        label='알파벳',
        buy='rsi30',  # RSI<30 이후 +5.5%/74% (n=34) vs base +2.1%/63%
        buy_txt='GOOG의 유효 매수 신호는 RSI 30 미만 패닉 구간 하나입니다 — 그 구간 이후 20거래일 평균 +5.5%·승률 74%였습니다(표본 34일, 전체 평균 +2.1%·63%)',
        hot='slow',  # sell75 이후 +0.7%/48% — 둔화
        hot_txt='GOOG은 과열(매도압력 75+) 이후 20거래일 평균 +0.7%·승률 48%로 확연히 쉬어갔습니다(표본 65일) — 여기서의 신규 매수는 통계적으로 불리합니다',
        down='insensitive',
        down_txt='GOOG은 하락 추세 구간 승률(59%)이 전체 평균(63%)과 큰 차이가 없었습니다 — 추세보다는 극단 패닉(RSI 30 미만) 신호를 기다리는 쪽이 이 종목의 문법입니다',
        base_txt='주의할 것 하나 — GOOG은 매수점수 80 이상 극단 구간이 오히려 역신호였습니다(이후 20거래일 평균 −0.1%·승률 46%, 표본 71일). 이 종목에서 점수 극단은 매수 근거가 아닙니다'),
    'MSFT': dict(
        label='마이크로소프트',
        buy='rsi30',  # +6.0%/77% (n=35)
        buy_txt='MSFT의 가장 강한 매수 신호는 RSI 30 미만 극단 과매도입니다 — 이후 20거래일 평균 +6.0%·승률 77%였습니다(표본 35일, 전체 평균 +1.8%·64%)',
        hot='trim',  # sell75 이후 −1.9%/45% (n=42) — 9종 중 유일하게 익절 유효
        hot_txt='MSFT는 9종 중 유일하게 기계적 익절이 통계로 검증된 종목입니다 — 과열(매도압력 75+) 이후 20거래일 평균 −1.9%·승률 45%(표본 42일)로 실제로 밀렸습니다. 분할 익절 검토가 데이터의 방향입니다',
        down='wait',  # gear3 67% vs gear1 51%
        down_txt='MSFT는 추세를 존중해야 하는 종목입니다 — 200일선 위 20거래일 승률 67%, 아래 51%로 갈립니다. 하락 추세에서는 극단 과매도(RSI 30 미만) 신호만 기다리는 구간입니다',
        base_txt='MSFT는 추세 위에서 꾸준하고(200일선 위 승률 67%), 과열이 켜지면 실제로 쉬는, 교과서에 가장 가까운 종목입니다'),
    'AMZN': dict(
        label='아마존',
        buy='both',  # buy80 +3.8%/62% (n=56), rsi30 +4.0%/76% (n=55)
        buy_txt='AMZN은 극단 신호 매수가 통하는 종목입니다 — RSI 30 미만 이후 20거래일 평균 +4.0%·승률 76%(표본 55일), 매수점수 80 이상 이후 +3.8%·승률 62%(표본 56일)',
        hot='ignore',  # sell75 +1.6%/64% ≈ base
        hot_txt='AMZN의 과열 신호는 판단 재료가 아니었습니다 — 과열 이후 성과(+1.6%·64%)가 전체 평균(+2.1%·64%)과 사실상 같습니다. 과열만으로 팔 이유도, 살 이유도 없습니다',
        down='insensitive',  # gear1 63% = base 64%
        down_txt='AMZN은 200일선 위든 아래든 20거래일 승률이 63~64%로 사실상 같았던, 추세 신호 무차별 종목입니다 — 추세 판단 대신 극단 과매도 분할 매수가 이 종목의 중심 문법입니다',
        base_txt='AMZN은 7종 중 유일하게 매수점수 80 이상 극단 구간까지 매수 신호로 검증된 종목입니다 — 추세는 따지지 않고 극단에서 나눠 사는 문법입니다'),
    'TSM': dict(
        label='TSMC',
        buy='rsi30',  # +6.7%/80% (n=66)
        buy_txt='TSM의 매수 신호는 패닉입니다 — RSI 30 미만 이후 20거래일 평균 +6.7%·승률 80%였습니다(표본 66일, 전체 평균 +2.5%·62%)',
        hot='slow',  # sell75 +1.0%/55%
        hot_txt='TSM은 과열(매도압력 75+) 이후 20거래일 평균 +1.0%·승률 55%로 눈에 띄게 둔화됐습니다(표본 77일) — 과열 구간 신규 진입은 통계적으로 불리합니다',
        down='insensitive',
        down_txt='TSM은 오히려 200일선 공방 구간(±2%)의 이후 성과가 +3.3%·승률 72%로 가장 좋았던 종목입니다 — 추세 이탈을 공포가 아니라 관찰 구간으로 대하는 것이 데이터의 방향입니다',
        base_txt='TSM은 반도체 사이클 종목답게 패닉 매수(RSI 30 미만, 승률 80%)의 보상이 9종 중 두 번째로 컸습니다'),
    'AVGO': dict(
        label='브로드컴',
        buy='rsi30',  # +8.9%/82% (n=38) — 9종 중 최강
        buy_txt='AVGO의 RSI 30 미만 극단 과매도는 승률 기준 9종 전체에서 가장 강한 매수 신호였습니다(수익률 크기로는 TSLA 매수점수 80+ 구간이 더 큼) — 이후 20거래일 평균 +8.9%·승률 82%(표본 38일, 전체 평균 +2.9%·63%)',
        hot='slow',  # sell75 −0.5%/56%
        hot_txt='AVGO는 과열(매도압력 75+) 이후 20거래일 평균 −0.5%·승률 56%로 쉬어갔습니다(표본 75일) — 과열 구간에서는 추격하지 않는 것이 통계의 방향입니다',
        down='opportunity',  # gear1 +6.8%/72% vs gear3 +2.2%/61% — 역발상 종목
        down_txt='AVGO는 역발상 종목입니다 — 200일선 아래 하락 추세 구간의 이후 20거래일이 평균 +6.8%·승률 72%로, 오히려 상승 추세 구간(+2.2%·61%)보다 좋았습니다. 낙폭이 기회였던 이력이 뚜렷하지만, 물론 분할 전제입니다',
        base_txt='AVGO는 "빠질 때 사서 과열에 쉬는" 문법이 9종 중 가장 선명하게 검증된 종목입니다'),
    'META': dict(
        label='메타',
        buy='rsi30',  # +6.3%/74% (n=78)
        buy_txt='META의 매수 신호는 패닉 데이입니다 — RSI 30 미만 이후 20거래일 평균 +6.3%·승률 74%였습니다(표본 78일, 전체 평균 +1.9%·61%)',
        hot='slow',  # sell75 +2.0%/50%
        hot_txt='META는 과열(매도압력 75+) 이후 승률이 50%로 동전던지기가 됐습니다(표본 70일) — 과열 구간의 추가 매수는 근거가 없습니다',
        down='wait',  # gear3 65% vs gear1 52%
        down_txt='META는 추세가 갈리는 종목입니다 — 200일선 위 20거래일 승률 65%, 아래 52%. 하락 추세에서는 RSI 30 미만 패닉 신호만 기다리는 것이 데이터의 방향입니다',
        base_txt='META는 급락이 잦지만 패닉 구간(RSI 30 미만) 반등의 통계(승률 74%)가 꾸준했던 종목입니다'),
}


# ─── 4분류 맞춤 행동 진단 (2026-08-04 신설, 성동님 지시) ─────────────────────
# 스윙 전략 탭의 보유자/신규 진입/물타기/불타기 분류를 종목 단위로 제공.
# 전부 규칙 엔진 — LLM 비용 0. 문구는 진단형(행동 촉구 금지) 원칙 준수.
def _audience(stance, buy, sell, gear, rsi, hot, down, sig_label):
    """hot: 'ignore'|'slow'|'trim' — 과열 신호의 종목별 검증 결과
    down: 'wait'|'insensitive'|'opportunity' — 하락 추세의 종목별 의미
    sig_label: 이 종목의 유효 매수 신호 이름 (예: 'RSI 30 미만 극단 과매도')"""
    overheated = sell >= 75
    # 보유자
    if stance == 'trim':
        holder = '분할 익절 검토 구간 — 이 종목은 과열 신호가 통계로 검증된 드문 케이스. 1차 30% 수준 분할 전제.'
    elif overheated and hot == 'ignore':
        holder = '보유 유지 — 이 종목의 과열 신호는 검증력이 없음. 익절 기준은 시점이 아니라 추세 이탈.'
    elif overheated:
        holder = '보유 유지 가능 — 다만 과열 이후 수익률 둔화 이력이 있는 종목. 이탈 기준 재점검 권고.'
    elif gear <= 1 and down == 'wait':
        holder = '이탈 기준 재점검 구간 — 200일선 아래에서는 노출 축소 검토가 데이터의 방향.'
    elif gear <= 1 and down == 'opportunity':
        holder = '보유 유지 — 이 종목은 하락 추세 구간의 이후 성과가 오히려 좋았던 이력. 공포 매도 비권고.'
    elif gear <= 1:
        holder = '보유 유지 가능 — 이 종목은 추세 신호 민감도가 낮음. 이탈 기준만 관리.'
    else:
        holder = '보유 유지 구간 — 추세 훼손 신호 없음.'
    # 신규 진입
    if stance == 'accumulate':
        newbie = f'분할 진입 검토 유효 구간 — {sig_label} 발동. 1회차는 소량(30% 이내) 전제.'
    elif overheated:
        newbie = '신규 진입 자제 구간 — 과열. 추격 진입은 통계적으로 불리.'
    elif gear >= 3 and buy >= 65:
        newbie = f'소량 분할 진입 검토 가능 — 상승 추세 + 매수점수 {buy}. 다만 이 종목의 최적 진입은 {sig_label}.'
    elif gear <= 1:
        newbie = f'대기 구간 — 유효 신호({sig_label}) 발동 전에는 진입의 통계적 근거 없음.'
    else:
        newbie = '관망 구간 — 진입 신호 대기.'
    # 물타기 (손실 보유자의 추가 매수)
    if stance == 'accumulate':
        avgdown = f'1회차 물타기 검토 가능 — {sig_label} 발동 구간. 소량(30% 이내) + 출구 기준 사전 설정 전제.'
    elif gear <= 1 and down != 'opportunity':
        avgdown = '물타기 금지 구간 — 하락 추세 확인 상태. 바닥 확인 전 평단 낮추기는 손실 확대 이력.'
    elif gear <= 1:
        avgdown = f'역발상 이력이 있는 종목이나, 물타기는 {sig_label} 발동 시에만 — 현재는 대기.'
    elif overheated:
        avgdown = '물타기 대상 구간 아님 — 과열 상태에서 손실 중이라면 물타기가 아니라 이탈 기준 점검이 우선.'
    else:
        avgdown = '물타기 필요 신호 없음 — 현 포지션 유지 구간.'
    # 불타기 (수익 보유자의 추가 매수)
    if gear >= 3 and sell < 60 and buy >= 60 and (rsi is None or rsi < 65):
        pyramid = '소량 불타기 검토 가능 — 추세 유지 + 과열 아님 + 매수 신호 유지(3조건 충족). 총 노출 상한 관리 전제.'
    elif gear >= 3:
        pyramid = '불타기 자제 구간 — 과열 접근. 추격 추가 매수는 고점 물릴 위험.'
    elif gear == 2:
        pyramid = '불타기 보류 — 200일선 공방으로 방향 미확정. 추세 복귀 확인 후 검토 가능.'
    else:
        pyramid = '불타기 금지 구간 — 하락 추세에서의 추가 매수는 원칙 밖.'
    return dict(holder=holder, newbie=newbie, avgdown=avgdown, pyramid=pyramid)


def mega_view(sym, s):
    """빅테크 7종 공용 뷰 — MEGA_CFG의 종목별 검증 문법으로 분기.
    tsla_view/nvda_view와 동일한 출력 형태(stance/stanceLabel/commentary/nums)."""
    cfg = MEGA_CFG[sym]
    buy, sell, gear = s.get('buyScore') or 50, s.get('sellScore') or 50, s.get('gear') or 2
    rsi = s.get('rsi')
    rsi_panic = rsi is not None and rsi < 30
    buy_extreme = buy >= 80

    # 1) 유효 매수 신호 발동
    if (cfg['buy'] == 'rsi30' and rsi_panic) or \
       (cfg['buy'] == 'both' and (rsi_panic or buy_extreme)):
        # 감사 지적(2026-08-03) 반영: ①rsi가 None인 경로(buy80 단독 발동) 방어,
        # ②비과매도 RSI를 "극단 과매도"로 오표기하지 않도록 실제 발동 신호로 서술.
        if rsi_panic:
            st, label = 'accumulate', '극단 과매도 — 분할 매수 검토 유효'
            trigger = f'극단 과매도 구간(RSI {rsi:.0f}, 매수점수 {buy})'
        else:
            st, label = 'accumulate', '극단 매수 신호 — 분할 매수 검토 유효'
            trigger = f'극단 매수점수 구간(매수점수 {buy})'
        body = (f'{cfg["label"]}({sym})가 {trigger}에 '
                f'들어왔습니다. {cfg["buy_txt"]}. 한 번에 들어가지 않고 나눠 들어가는 것이 전제입니다.')
    # 2) 과열
    elif sell >= 75:
        if cfg['hot'] == 'trim':
            st, label = 'trim', '과열 — 분할 익절 검토 구간'
        elif cfg['hot'] == 'slow':
            st, label = 'hold', '과열 — 신규 진입 자제 구간'
        else:
            st, label = 'hold', '과열이지만 기계적 익절 비권고'
        body = f'과열 신호(매도압력 {sell})가 켜졌습니다. {cfg["hot_txt"]}.'
    # 3) 하락 추세
    elif gear <= 1:
        if cfg['down'] == 'opportunity':
            st, label = 'watch', '하락 추세 — 역발상 관찰 구간'
        elif cfg['down'] == 'wait':
            st, label = 'wait', '하락 추세 — 극단 신호 대기'
        else:
            st, label = 'hold', '하락 추세 — 통계상 과민 반응 불필요'
        body = f'200일선 아래 하락 추세입니다. {cfg["down_txt"]}.'
    # 4) 평상시
    else:
        st, label = 'hold', '보유 유지 — 특이 신호 없음'
        body = (f'추세 훼손도, 유효 매수 신호도 없는 구간입니다. {cfg["base_txt"]}. '
                f'현재 매수점수 {buy}·매도압력 {sell} 수준에서는 포지션 변경의 통계적 근거가 없습니다.')
    sig_label = ('RSI 30 미만 극단 과매도 또는 매수점수 80 이상' if cfg['buy'] == 'both'
                 else 'RSI 30 미만 극단 과매도' if cfg['buy'] == 'rsi30'
                 else '뚜렷한 검증 신호 없음(신호 둔감 종목)')
    return dict(stance=st, stanceLabel=label, commentary=_move_prefix(s) + body,
                nums=dict(buy=buy, sell=sell, gear=gear, rsi=round(rsi, 1) if rsi is not None else None),
                audience=_audience(st, buy, sell, gear, rsi, cfg['hot'], cfg['down'], sig_label))


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
                nums=dict(buy=buy, sell=sell, gear=gear, rsi=rsi),
                audience=_audience(st, buy, sell, gear, rsi, 'ignore', 'wait', '200일선 위 추세 복귀'))


DESK_MODEL = 'claude-fable-5'

def desk_with_fable(view, sc_entry, ca):
    """최종 데스크 — 개조식 구조(소제목+닷블릿·명사형 종결)로 논평을 다듬는다.
    API 키 없음/호출 실패/검증 실패 시 None 반환 → 규칙 논평 그대로 사용 (파이프라인 불사불패).
    문체 규격: 2026-07-31 유저 확정 — 임팩트·단정 원칙·하나마나한 소리 금지."""
    import urllib.request
    key = os.environ.get('ANTHROPIC_API_KEY', '').strip()
    if not key:
        return None
    comp = view['comp']
    draft = '\n\n'.join(comp['commentary'])
    factors = ''
    if sc_entry:
        f = lambda k: [x.get('name') for x in (sc_entry.get(k) or [])]
        factors = (f"긍정: {f('positive_factors')} / 부정: {f('negative_factors')} / 혼조: {f('mixed_factors')}\n"
                   f"긍정 대 부정: {sc_entry.get('positive_total')} 대 {sc_entry.get('negative_total')} | "
                   f"핵심 이벤트: {(sc_entry.get('key_event') or {}).get('name','')}")
    ca_line = ''
    if ca:
        conf = ca.get('confluenceChecklist') or {}
        ca_line = f"추세 {ca.get('trend')} | 판정 {ca.get('action')} | 반등 신뢰도 {conf.get('verdict')} ({conf.get('score')})"
    stats_block = '\n'.join(f'- {v}' for v in STATS.values())
    n = comp['nums']
    prompt = f"""너는 미국주식 분석 사이트 ezlong.com의 최종 데스크(주식 전문 매체 편집장이자 20년 경력 스윙 트레이더)다.
아래 초안·재료를 데스킹해 방문자용 최종 논평을 JSON으로 완성하라.

[오늘의 확정 스탠스 — 절대 변경 금지]
{comp['stanceLabel']} (매수점수 {n['buy']}, 매도압력 {n['sell']}, 기어 {n['gear']}, 200일선 {n['dev200']:+}%)

[규칙 엔진 초안]
{draft}

[뉴스 재료 (결과 재료 섞여 있을 수 있음)]
{factors}

[차트 엔진 판독]
{ca_line}

[사용 가능한 검증 통계 — 이것 외의 확률·통계 절대 금지]
{stats_block}

[구성 규격 — 핵심 30% / 상세 70%]
- core: 닷블릿 3~4개. 방문자 대부분이 이것만 보고 오늘 판단을 전부 파악할 수 있어야 한다.
  CNBC 앵커 멘트처럼 아주 쉽고 흥미롭게 — 전문용어는 풀어 쓰거나 괄호로 병기
  (예: "매도압력 30" 대신 "팔려는 힘은 약한 수준(30/100)"). 숫자·조건은 유지.
- sections: 나머지 70% 상세 — 근거·통계·교차검증. 눌러서 보는 사람용.

[문체 규격 — 반드시 지켜라]
- 개조식: 소제목으로 그룹핑, 각 항목은 닷블릿. 서술어 없이 명사형 종결. 단, 의미가 흐려질 만큼 줄이지 말 것 — 수치·조건·이유를 담아 디테일하게.
- 앵커의 인간미: CNBC 주식 코너 앵커처럼, 독자의 감정을 아는 사람의 말로. 폭락·연속 하락·오랜만의 반등·신고가 같은 날에는 명쾌한 비유나 속시원한 표현을 한 문장 넣어라
  (예: 급락 연속 뒤 반등 — "긴 터널 끝에 처음 보인 불빛, 다만 출구인지 마주 오는 기차인지는 이틀 안에 판명" / 연속 하락 — "계좌가 두들겨 맞은 한 주, 그래도 도망칠 자리와 버틸 자리는 구분해야 하는 시점").
  조건: 비유는 문단당 하나까지, 과장·사실 왜곡 금지, 숫자와 판단은 그대로, 유치한 말장난 금지. 감정 표현이 판단을 흐리면 실격.
- 가격 표기: 소수점은 버려라 — "$683.55"가 아니라 "683달러". 지수·종목가 공통.
- 가격·관문 언급 시 반드시 어느 종목/지수인지 명시하라 (예: "QQQ 종가 683달러 선"). 관문 기준가는 QQQ(나스닥100 ETF) 종가다.
- 색 강조 태그: 중요한 단어·구만 감싸라 — 긍정·상승·통과는 [G]…[/G], 부정·하락·경고는 [R]…[/R], 핵심 조건·가격·결론 포인트는 [B]…[/B].
  전체(core+sections 합쳐) 6~10곳 이내. 단어·구 단위만(문장 전체 금지). 알록달록 금지 — 간혹 가다 있는 약간의 색이 강조다.
- 임팩트: headline은 결론+핵심 조건 하나. 눈에 딱 들어오게.
- 단정 원칙: "A라면 X, B라면 Y, 확인 필요" 양다리 금지. 확인 가능한 것은 확인된 쪽으로 단정, 애매한 것만 검증 통계의 확률로.
- 틀리지 않으려고 애매하거나 하나마나한 소리("변동성 유의", "지켜볼 필요") 금지 — 모든 항목은 수치·조건·판단 중 하나를 반드시 담을 것. 담을 게 없는 섹션은 빼라.
- 결과 재료('VIX 하락', '지수 상승', '섹터 강세' 등)는 근거 인용 금지 — 원인 재료만.
- "~하세요" 행동 촉구 금지. 분석/진단형.
- 포스트마켓은 초안에 등장할 때만 언급하라(큰 이벤트가 있는 날만 초안에 실린다). 초안에 없으면 절대 언급 금지.
- 오늘 날짜와 직전 장 정보는 초안 서술을 따를 것. '직전 장'을 언급할 때는 초안처럼 반드시 날짜를 병기하라 — 예: "직전 장(7월30일)".

[출력 형식 — 이 JSON만 출력, 다른 텍스트 금지]
{{"headline": "…", "core": ["…", "…", "…"], "sections": [{{"title": "…", "bullets": ["…"]}}]}}
sections 3~5개: 직전 장 시황 / 터닝포인트 관문 / 오늘의 판단 / 교차검증·리스크 등."""
    try:
        body = json.dumps({'model': DESK_MODEL, 'max_tokens': 6000,
                           'messages': [{'role': 'user', 'content': prompt}]}).encode()
        req = urllib.request.Request('https://api.anthropic.com/v1/messages', data=body,
            headers={'x-api-key': key, 'anthropic-version': '2023-06-01',
                     'content-type': 'application/json'})
        r = json.load(urllib.request.urlopen(req, timeout=240))
        txt = ''.join(b.get('text', '') for b in r.get('content', []) if b.get('type') == 'text')
        d = json.loads(txt[txt.index('{'): txt.rindex('}') + 1])
        secs = d.get('sections') or []
        if not d.get('headline') or not secs:
            return None
        total = sum(len(b) for s in secs for b in (s.get('bullets') or []))
        if not (100 <= total <= 5000):
            return None
        # 숫자 환각 가드 — 출력의 %수치가 입력 재료에 없으면 폐기 (2개까지 허용: 조합·반올림 여지)
        import re as _re
        allowed = set(_re.findall(r'\d+(?:\.\d+)?(?=%)', prompt))
        unknown = [x for x in _re.findall(r'\d+(?:\.\d+)?(?=%)', json.dumps(d, ensure_ascii=False))
                   if x not in allowed]
        if len(set(unknown)) > 2:
            print(f'::warning::[데스크] 미검증 수치 {sorted(set(unknown))} — 폐기, 규칙 논평 사용')
            return None
        return dict(headline=d['headline'],
                    core=list(d.get('core') or [])[:5],
                    sections=[dict(title=s.get('title', ''), bullets=list(s.get('bullets') or []))
                              for s in secs][:6],
                    model=DESK_MODEL)
    except Exception as e:
        print(f'::warning::[데스크] 호출 실패 — 규칙 논평 사용: {e}')
        return None


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
    ll = lifeline_status()
    ll_cap = None
    if ll and not ll.get('stale'):
        if ll['count'] >= 3:
            ll_cap = 0.0
        elif ll['count'] >= 2:
            ll_cap = 0.2

    advanced = False
    if comp.get('lastDay') != day and not stale:
        action = advance(comp, day, price, buy, sell, gear, dev200, cap=ll_cap)
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
    # 의미가 생기기 전(전환 이력 없음 + 연속 3일 미만)엔 아예 숨긴다 — "보유 1일째 유지" 같은
    # 자기 자신도 설명 못 하는 라인 금지 (2026-07-31 유저 피드백). 표시할 땐 라벨 없이 자체로
    # 이해되는 완결 문장으로 쓴다.
    if len(runs) >= 2:
        prev_s, prev_n = runs[-2]
        cur_s, cur_n = runs[-1]
        if cur_n == 1:
            flow = f"오늘 판단이 바뀌었습니다 — {SHORT[prev_s]} {prev_n}일 → 오늘부터 '{SHORT[cur_s]}'."
        else:
            flow = f"'{SHORT[cur_s]}' 판단은 오늘로 {cur_n}일째입니다 (직전: {SHORT[prev_s]} {prev_n}일)."
    elif runs and runs[-1][1] >= 3:
        flow = f"'{SHORT[runs[-1][0]]}' 판단은 오늘로 {runs[-1][1]}일째입니다."

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
    ll_paras = []
    if ll and ll.get('stale'):
        ll_paras.append('참고 — 생명선(주봉 30주선) 데이터가 2주 이상 갱신되지 않아 오늘은 생명선 '
                        '판정을 적용하지 않았습니다. 마켓사이클 파이프라인 점검이 필요합니다.')
    elif ll and ll['count'] >= 2:
        broken = '·'.join(n for n, b in ll['detail'] if b)
        ll_paras.append(f'생명선이 끊겼습니다. {broken}이 주봉 기준 30주선 아래에서 마감했습니다. '
                        f'이 선 아래에서 강세장을 논하지 않는 것이 이 시스템의 헌법입니다. '
                        f'{STATS["lifeline"]}. 규칙에 따라 노출 상한을 '
                        f'{"0%" if ll["count"] >= 3 else "20%"}로 내립니다.')
    elif ll and ll['count'] == 1:
        first = next(n for n, b in ll['detail'] if b)
        ll_paras.append(f'생명선 경계 — 3개 지수 중 {first}가 먼저 주봉 30주선 아래로 내려왔습니다. '
                        f'단독 이탈은 발동 조건이 아니지만, 두 번째 지수가 무너지면 그날로 노출 상한을 '
                        f'20%로 내리는 것이 예약된 행동입니다. 지금은 감시 단계입니다.')
    commentary = ctx_paras + ll_paras + commentary
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
        lifeline=(dict(count=ll['count'], broken=[n for n, b in ll['detail'] if b]) if ll else None),
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
        # TOP9 확장 (2026-08-03): 빅테크 7종 — 시그널 데이터가 있는 종목만 포함.
        # 파이프라인이 아직 해당 심볼을 수집하지 않았으면 자연히 빠지고, UI는
        # 없는 심볼을 "데이터 수집 중"으로 표시한다 (폴백 안전).
        megaOrder=MEGA_ORDER,
        megas={sym: mega_view(sym, syms[sym]) for sym in MEGA_ORDER
               if syms.get(sym) and syms[sym].get('buyScore') is not None},
    )

    desked = desk_with_fable(view, (load_scorecard() or [None])[0], load_chart_engine())
    if desked:
        view['desked'] = desked

    with open(LEDGER, 'w', encoding='utf-8') as f:
        json.dump(ledger, f, ensure_ascii=False, indent=1)
    with open(VIEW, 'w', encoding='utf-8') as f:
        json.dump(view, f, ensure_ascii=False, indent=1)
    print(f'swing-view 생성: day={day} advanced={advanced} action={action} '
          f'stance={st} expo={comp.get("exposure")} target={comp.get("target")}')


if __name__ == '__main__':
    main()
