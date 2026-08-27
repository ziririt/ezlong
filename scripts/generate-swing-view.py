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
import re as _re
from datetime import datetime, timezone, timedelta

# 80항 — 화면 문구의 em dash(—)를 하이픈으로. 저장 직전 한 번만 훑는다.
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    from ez_text import scrub as _ez_scrub
except Exception:                      # 모듈이 없어도 본 기능은 죽지 않는다
    def _ez_scrub(o):
        return o

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
    warn='매도압력 60선 돌파 이후 그 평균은 +0.4%까지, 60거래일 기준으로는 +0.1% 수준까지 하락한 이력',
    gear3='200일선 위 구간의 20거래일 승률 70%',
    tsla_extreme='TSLA 매수점수 80 이상 구간은 표본 61일, 이후 20거래일 평균 +15.3%·승률 69%',
    tsla_hot='TSLA는 매도압력 75 돌파 이후에도 20거래일 평균 +7.5%로 더 오른 이력 다수 — 과열을 기계적으로 파는 문법은 이 종목에서 손실 누적',
    nvda_trend='NVDA는 200일선 위(기어3) 20거래일 승률 69%, 아래 56%로 분기 — 추세 유지가 판단의 중심',
    rebound='약세 구간(RSI 45 미만)의 하루 +2.5% 이상 급반등은 지난 11년 49차례, 반등 자체만으로는 이후 5거래일 승률 52%로 동전던지기 수준',
    follow='진위는 이틀 안에 판명 — 2거래일 내 반등일 종가 위 재마감 시 이후 20거래일 평균 +3.2%·승률 63%, 실패 시 −1.1%·승률 38%',
    lifeline='이 생명선은 백테스트에서 2022년 1월 28일 QQQ 352에 발동, 바닥(254)까지의 추가 하락을 통째로 회피. 2021~2026 구간 최대낙폭을 −20.7%에서 −16.0%로 축소. 대신 2020·2023·2025년의 휩쏘로 연 1.4%p가량을 보험료로 지출 — 더 비싸게 다시 사는 비용까지가 이 규칙의 가격',
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


def _streak_line(word, stance, days, chg):
    """같은 판단이 이어질 때 쓰는 한 줄. 그 구간의 등락을 반드시 함께 말한다.

    2026-08-08 개정 — 이전 판은 판단이 시장에 뒤처지면 '너무 보수적이었음을
    인정한다' 같은 반성문을 붙였다. 그건 내부에서 오간 지적을 그대로 화면에
    옮긴 것이고, 스탠스가 며칠 이어지면 같은 반성문이 며칠 연속 걸린다.
    독자가 이 줄에서 얻어야 하는 건 사과가 아니라 "지금 시장이 어디에 있고
    다음에 무엇을 보는가"다. 숫자는 그대로 공개한다 — 성적을 숨기지 않는다.
    다만 자책·변명·사과는 쓰지 않는다."""
    base = f"'{word}' 판단 {days}일째"
    if chg is None:
        return base + '.'
    passive = stance in ('hold', 'wait', 'accumulate_wait')
    if passive and chg >= 3:
        return base + f' — 그 사이 {chg:+.1f}%. 추세 진행 구간, 남은 차수는 조건 충족 시 집행.'
    if passive and chg <= -3:
        return base + f' — 그 사이 {chg:+.1f}%. 하락 구간 방어 유효.'
    if not passive and chg >= 3:
        return base + f' — 그 사이 {chg:+.1f}%. 방향 일치 구간.'
    if not passive and chg <= -3:
        return base + f' — 그 사이 {chg:+.1f}%. 방향 불일치 — 손절 기준 재확인 구간.'
    return base + f' — 그 사이 {chg:+.1f}%.'


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
        # 2026-08-05 운영 피드백 — "며칠째 똑같은 '보유 유지 구간'은 너무 게으르다.
        # 아무것도 안 하면 틀리지 않으니 버티는 소리 하지 마라."
        # 1배수를 이미 목표까지 채운 상태에서 '보유'는 맞는 판단이다. 문제는 그 다음에
        # 할 말이 없다는 것 — 1배수가 꽉 찼으면 다음 카드는 레버리지다.
        # 제목이 그 다음 카드를 가리키게 한다. 매일 같은 네 글자만 반복하지 않는다.
        # 2026-08-05 운영 피드백 — 처음엔 '1배수 만재'라고 썼는데 '만재(滿載)'는
        # 화물선 용어다. 투자 화면에서 쓸 말이 아니라 바로 쉬운 말로 바꿨다.
        if expo >= 0.95 and gear >= 3 and buy >= 60 and sell < 70:
            return 'hold', '1배수 목표 비중 채움 — 다음 카드는 레버리지'
        if expo >= 0.95 and gear >= 3:
            return 'hold', '1배수 목표 비중 채움 — 신호 강화 시 레버리지 검토'
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
        return (f'5거래일 전 노출 유지·확대 판단 이후 {chg:.1f}%. '
                f'전제였던 200일선 위 추세는 여전히 유효, 손절선 관리로 대응하는 구간.')
    if bearish and chg >= 4:
        return (f'5거래일 전 노출 축소 판단 이후 +{chg:.1f}%. '
                f'방어의 대가로 상승분 일부 미확보 — 폭락 방어를 우선하는 구조의 상시 비용.')
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
        return f'장 마감 뒤 시간외 거래에서 큰 움직임 발생 — {body}.' + idx_txt
    return f'장마감 뒤 지수 급변동.{idx_txt} 매크로급 재료 발생 가능성 — 재료 균형 갱신분 확인 대상.'


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


def us_session_now():
    """지금 미국 시장이 어느 국면인지 — 'pre' | 'open' | 'post' | 'closed'.
    ET 기준. 3월 둘째 일요일~11월 첫째 일요일 EDT(-4), 그 밖 EST(-5)."""
    u = datetime.now(timezone.utc)
    y = u.year

    def _nth_sun(month, nth):
        d = datetime(y, month, 1, tzinfo=timezone.utc)
        d += timedelta(days=(6 - d.weekday()) % 7)
        return d + timedelta(days=7 * (nth - 1))

    edt = _nth_sun(3, 2) <= u < _nth_sun(11, 1)
    et = u.astimezone(timezone(timedelta(hours=-4 if edt else -5)))
    if et.weekday() >= 5:
        return 'closed'
    m = et.hour * 60 + et.minute
    if 240 <= m < 570:
        return 'pre'
    if 570 <= m < 960:
        return 'open'
    if 960 <= m < 1200:
        return 'post'
    return 'closed'


def prev_session_tag():
    """장 국면에 맞는 라벨. 2026-08-05 운영 피드백 — "지금이 8월5일 01시인데
    8월4일을 직전 장이라고 하면, 지금 펼쳐지는 장이라 헷갈린다." 데이터는 오늘
    장 것인데 문구만 '직전 장'으로 고정돼 있었다. 이제 국면을 보고 부른다."""
    lbl = session_date_label()
    if not lbl:
        return '직전 장'
    ph = us_session_now()
    if ph == 'pre':
        return f'오늘 프리마켓({lbl})'
    if ph == 'open':
        return f'오늘 장({lbl}) 장중'
    if ph == 'post':
        return f'오늘 장({lbl}) 마감'
    return f'직전 장({lbl})'


_EN_MON = ('', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
           'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec')


def session_date_label_en():
    """session_date_label()의 영어 형제 — 'Aug 4'."""
    try:
        d = et_day_of((load(SIGNALS) or {}).get('generatedAt'))
        return f'{_EN_MON[int(d[5:7])]} {int(d[8:10])}'
    except Exception:
        return ''


def _ctx_tag():
    """market_context 전용 장 국면 라벨 — prev_session_tag()와 달리 뒤에
    '마감했습니다' 같은 서술어가 붙기 때문에, post 국면에서 '마감'을 두 번
    말하지 않도록 꼬리말을 뺀 형태로 돌려준다."""
    lbl = session_date_label()
    if not lbl:
        return '직전 장'
    ph = us_session_now()
    if ph == 'pre':
        return f'오늘 프리마켓({lbl})'
    if ph == 'open':
        return f'오늘 장({lbl}) 장중'
    if ph == 'post':
        return f'오늘 장({lbl})'
    return f'직전 장({lbl})'


def prev_session_tag_en():
    """prev_session_tag()의 영어 형제 — 한쪽만 국면을 반영하면 국문·영문이
    어긋나므로 두 함수는 항상 같이 수정한다."""
    lbl = session_date_label_en()
    if not lbl:
        return 'Prior session'
    ph = us_session_now()
    if ph == 'pre':
        return f'Today\'s pre-market ({lbl})'
    if ph == 'open':
        return f'Today\'s session ({lbl}), intraday'
    if ph == 'post':
        return f'Today\'s close ({lbl})'
    return f'Prior session ({lbl})'


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
        # 2026-08-05 운영 피드백 두 가지:
        #  (1) 새벽 01:48, 장중인데 "급반등으로 마감했습니다"는 모순. 국면을 본다.
        #  (2) "시장이 +2.7%"는 뭐가 움직였는지 알 수 없다. 기준 지표를 밝힌다.
        #      이 문단의 등락률은 처음부터 QQQ(나스닥100 ETF) 하나였다.
        live = us_session_now() in ('pre', 'open')
        tag  = _ctx_tag()
        px   = f'({price:,.0f}달러)' if price is not None else ''
        mv   = '급반등' if chg >= 2.0 else ('급락' if chg <= -2.0 else None)
        if mv:
            move_txt = (f'{tag} QQQ(나스닥100 ETF) {chg:+.1f}%{px} {mv} 진행 중' if live
                        else f'{tag} QQQ(나스닥100 ETF) {chg:+.1f}%{px} {mv} 마감')
        elif abs(chg) >= 0.8:
            move_txt = (f'{tag} QQQ(나스닥100 ETF) {chg:+.1f}%{px} 진행 중' if live
                        else f'{tag} QQQ(나스닥100 ETF) {chg:+.1f}%{px} 마감')
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
            parts.append(f"직전까지 {neg_txt or lke}가 누르던 분위기(긍정 {low['positive_total']} 대 "
                         f"부정 {100 - low['positive_total']})가 {ke} 등으로 단시간에 반전. "
                         f'현재 재료 균형은 긍정 {pos} 대 부정 {neg}.')
        elif pos is not None:
            parts.append(f'재료 균형은 긍정 {pos} 대 부정 {neg} — 핵심 재료는 {ke}.')
        if cum5 is not None and abs(cum5) >= 3:
            parts.append(f'최근 5거래일 누적 {cum5:+.1f}%.')
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
            p.append(f"급반등의 첫 관문 통과 — QQQ가 반등일 종가인 {int(watch['price'])}달러 선 위에서 재마감. "
                     f'{STATS["follow"]}. 통계는 이 반등을 진짜 쪽으로 분류 시작.')
            state['reboundWatch'] = None
        else:
            watch['daysLeft'] -= 1
            if watch['daysLeft'] <= 0:
                p.append(f"급반등의 첫 관문(QQQ 종가의 {int(watch['price'])}달러 선 재돌파) 기한 내 미통과. "
                         f'{STATS["follow"]}. 이 반등을 추세 전환으로 승격하지 않음.')
                state['reboundWatch'] = None
    if advanced and chg is not None and chg >= 2.5 and (rsi_prev is None or rsi_prev < 45)             and not state.get('reboundWatch'):
        state['reboundWatch'] = dict(day=state.get('lastDay'), price=price, daysLeft=2)
    # 활성 관문은 (같은 날 재실행 포함) 항상 서술 — 상태 기반이라 하루 여러 번 갱신에도 유지
    watch = state.get('reboundWatch')
    if watch:
        p.append(f'급반등의 터닝포인트 여부는 아직 미확정. {STATS["rebound"]}. '
                 f'{STATS["follow"]}. 지금 관문은 하나 — 남은 {watch["daysLeft"]}거래일 '
                 f'안에 QQQ 종가가 반등일 종가인 {int(watch["price"])}달러 선 위에서 재마감하는지 확인 중.')
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
        bits.append(f"오늘 차트 패턴 '{act or trend}'")
    if verdict:
        # 'N/5' 분수 표기는 일반 방문자에게 낯설다 — 퍼센트로 변환 (2026-08-01 운영 지침)
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
        line += ' 지표와 결이 다른 지점 — 이럴 때 원칙은 보수적인 쪽. 보유는 유지, 신규 증액은 방향이 모일 때까지 유보.'
    elif not bullish_st and not cautious_ca:
        line += ' 차트 쪽이 더 낙관적. 다만 비중 판단은 원칙대로 보수적으로.'
    else:
        line += ' 지표와 같은 방향.'
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
        p.append(f'수익을 좇을 자리가 아니라 계좌를 지킬 자리. 종가가 200일선 아래 '
                 f'{dev200:.1f}%까지 하락, 이 정도 이탈 이후 관성적으로 더 밀린 사례 다수 — '
                 f'계획된 노출 축소를 진행하는 구간. 바닥을 맞히려 들지 않고 '
                 f'200일선 부근 회복 시 재진입하는 것이 이 분석의 원칙.')
    elif action == 'ADD':
        p.append(f'오늘은 계획된 분할 매수를 한 단계 진행할 자리. 200일선 '
                 f'{"위" if (dev200 or 0) > 0 else "부근"} 추세 유지 중이고 현재 노출이 목표보다 '
                 f'낮은 상태 — 추격이 아니라 계획의 이행.')
    elif action == 'TRIM':
        reason = '매도압력 점수가 경고선(60)을 넘어선 것' if why in ('warn', 'warn2') else '추세 기어가 한 단계 내려온 것'
        p.append(f'오늘은 일부를 덜어내는 쪽. 이유는 {reason} — 전량 청산이 아니라 '
                 f'계획된 부분 축소. 추세 자체가 꺾인 게 아니라면 남긴 물량으로 상승분 계속 확보.')
    elif action == 'INIT':
        p.append(f'오늘부터 판단 시작. 현재 추세와 신호를 기준으로 한 적정 노출에서 '
                 f'출발, 이후 증액·축소는 전부 조건 충족일에만 단계적으로 진행. '
                 f'매일 무언가를 하라는 신호가 아니라, 해야 할 날에만 나오는 신호.')
    # 2026-08-14 개정 — 이 문단이 두 가지 사고를 냈다(운영 제보).
    #
    # ① 분기 삼킴: 조건이 expo >= 0.5 였다. 목표 100%에 현재 60%인 날 —
    #    즉 아직 채울 칸이 40%p 남은 날에도 "더 사면 추격"이 나갔다. 그날 stance_of 는
    #    같은 상태를 'accumulate_wait(분할 매수 대기 구간)'로 판정하므로, 한 카드 안에서
    #    제목과 본문이 정반대를 말했다. 아래 target > expo 분기는 도달 자체가 불가능했다.
    #    → 목표를 실제로 다 채웠을 때(간격이 리밸런싱 최소폭 미만)만 이 문장을 쓴다.
    #
    # ② '새 조건 미충족'의 이중 의미: 여기서 말하는 조건은 "목표와 현재 비중의 차이가
    #    있는가"라는 기계적 조건이지 "시장에 매수 신호가 있는가"가 아니다. 그런데 그 말이
    #    시장 신호가 꺼졌다는 뜻으로 읽혔고, 데스크 LLM 이 그대로 받아 "다음 레버리지
    #    카드는 새 매수 조건 점등 이후"라는 헤드라인을 썼다 — 같은 시각 레버리지 카드는
    #    5조건 전부 충족이었다. 1배수가 꽉 찬 이유가 바로 시장 조건이 좋아서(Gear 3 →
    #    목표 100%)인데, 그걸 '조건 미충족'이라 쓰면 정확히 반대로 읽힌다.
    #    → 시장 조건 표현을 쓰지 않고 '채울 칸이 없다'로만 쓴다.
    #
    # ③ 스코프: 이 판단의 주어는 시장이 아니라 '1배수 칸'이다. 주어를 생략하면
    #    "살 자리가 아니다"가 시장 전체에 대한 선언으로 읽혀 레버리지 카드와 충돌한다.
    # 세 상태를 부호로 가른다. 이전 판은 target - expo 를 부호 없이 다뤄
    # "목표보다 덜 찬 상태"와 "목표를 초과해 축소 대기 중인 상태"를 같은 칸으로 봤다.
    # 그 결과 매도압력이 목표를 1.0→0.6 으로 깎은 바로 그날(= 위험을 줄이기 시작한 날)
    # "차이가 없어 추가 단계가 없다"는 거짓 문장과 함께 독자를 레버리지 칸으로 보냈다.
    elif expo >= 0.5 or target > 0:
        gap = target - expo
        if gap >= CFG['min_gap']:
            p.append(f'1배수 칸에 아직 채울 자리가 남은 상태 — 목표 {target * 100:.0f}% 대비 '
                     f'현재 {expo * 100:.0f}%. 다만 오늘은 증액일이 아님(간격·쿨다운 조건). '
                     f'분할의 가치는 사는 날이 아니라 기다리는 날에 형성.')
        elif gap <= -CFG['min_gap']:
            # 목표 초과 = 축소 대기. 이 구간에서 레버리지 안내는 절대 붙이지 않는다.
            p.append(f'1배수 칸이 목표를 넘어선 상태 — 목표 {target * 100:.0f}% 대비 '
                     f'현재 {expo * 100:.0f}%. 계획된 축소를 기다리는 구간이지 '
                     f'추가로 실을 자리가 아님.')
        else:
            # 레버리지 안내는 '모델이 원하는 목표 자체가 만재'일 때만. 매도압력 경고로
            # 목표가 깎여 내려온 상태(target 0.6 등)에서는 붙이지 않는다.
            nxt = (' 다음 자금이 갈 곳은 1배수 추가가 아니라 레버리지 칸 — 판단은 아래 '
                   '레버리지 카드에서.') if (target >= 0.95 and gear >= 3
                                             and buy >= 60 and sell < CFG['warn_sell']) else ''
            if expo >= 0.95 and target >= 0.95:
                p.append(f'1배수 칸은 계획한 목표 비중을 채운 상태. 마지막 조정 이후 '
                         f'{days}거래일째 목표와 현재 비중의 차이가 없어 추가 매수 단계 '
                         f'자체가 없는 구간 — 시장 신호가 꺼진 것이 아니라 이 칸에 채울 '
                         f'자리가 없는 것.{nxt}')
            else:
                p.append(f'1배수 칸은 목표 비중에 도달한 상태(목표 {target * 100:.0f}% · '
                         f'현재 {expo * 100:.0f}%). 남은 차이가 리밸런싱 최소폭'
                         f'({CFG["min_gap"] * 100:.0f}%p)에 못 미쳐 오늘은 조정 단계가 없는 구간.{nxt}')
    else:
        p.append(f'관망이 맞는 구간. 추세 신호와 노출 목표가 모두 낮은 상태로, '
                 f'아무것도 하지 않는 것이 오늘의 판단. 관망도 포지션.')

    # 2) 경고/통계 (검증된 것만)
    if sell >= CFG['warn_sell'] and not state.get('stopped'):
        p.append(f'가볍게 볼 수 없는 신호 하나 — 매도압력 점수 {sell}점. {STATS["warn"]}. '
                 f'이에 따라 목표 노출을 한 단계 하향 적용 중.')
    elif gear >= 3 and expo >= 0.5:
        p.append(f'근거 하나만 들자면 — {STATS["gear3"]}. 추세와 함께 가는 동안은 '
                 f'흔들림을 견디는 쪽이 통계적으로 유리했던 구간.')

    # 3) 자기 채점
    sr = self_review(state)
    if sr:
        p.append(sr)
    return p


def _blk(h, *items):
    """소제목 + 닷블릿 항목 한 묶음. 빈 항목은 자동으로 걸러낸다."""
    return {'h': h, 'items': [i for i in items if i]}


def _flat(blocks):
    """구버전 소비자(blocks를 모르는 렌더러)용 평문 폴백.
    blocks가 유일한 원본이고 이건 파생값이라 둘이 어긋날 수 없다."""
    return ' '.join(b['h'] + ' — ' + ' · '.join(b['items']) for b in blocks if b['items'])


def _px(s):
    """등락률 옆에 붙일 주가 표기. 소수점은 버리고 정수 달러만 — 등락률만
    있으면 '얼마짜리 주식이 그만큼 움직였는지'가 안 잡혀서 답답하다."""
    p = s.get('price')
    if p is None:
        return ''
    try:
        return f'({float(p):,.0f}달러)'
    except (TypeError, ValueError):
        return ''


def _px_en(s):
    p = s.get('price')
    if p is None:
        return ''
    try:
        return f'(${float(p):,.0f})'
    except (TypeError, ValueError):
        return ''


def _move_tone(chg):
    """등락 폭에 붙일 한 마디. 장중에 '마감'이라고 쓰면 모순이라 국면을 본다.
    ±0.8% 미만은 예전엔 아예 문구를 생략했지만, 그러면 주가도 같이 사라져서
    '지금 얼마짜리인지'를 알 수 없다 — 이제 '보합'으로 부르고 주가는 남긴다."""
    live = us_session_now() in ('pre', 'open')
    if chg >= 3:
        return '급반등'
    if chg <= -3:
        return '급락'
    if abs(chg) < 0.8:
        return '보합권' if live else '보합'
    return '진행 중' if live else '마감'


def _move_txt(s):
    """'+6.0%(416달러) 급반등' — 등락률·주가·한 마디."""
    chg = s.get('changePct')
    if chg is None:
        return ''
    return f'{chg:+.1f}%{_px(s)} {_move_tone(chg)}'


def _move_prefix(s):
    txt = _move_txt(s)
    return f'{prev_session_tag()} {txt}. ' if txt else ''


def _move_blk(s):
    """블록 렌더러용 — 소제목에 장 국면, 항목에 등락·주가.
    _move_prefix()가 평문에서 '오늘 장(8월4일) 장중'을 이미 말하는데 소제목까지
    같은 말을 반복하면 두 번 읽힌다. 소제목이 맥락, 항목이 숫자."""
    txt = _move_txt(s)
    return _blk(prev_session_tag(), txt) if txt else None


# ─── 스윙 철학 어댑터 (2026-08-05 신설) ──────────────────────────────
# 운영 지침: "니가 조사한 역대 통계는 내 스윙 철학 기반 위에서 보조적으로 써라."
# 아래는 새로 만든 규칙이 아니라, 이미 사이트에 적혀 있던 사이트 원칙을
# 판단부가 실제로 쓸 수 있게 코드로 옮긴 것이다.
#
#   · "스윙 매수의 진짜 타이밍 = 사람들이 가장 두려워할 때"   (S-CORE v3 핵심 철학)
#   · RSI는 레벨이 아니라 방향 — 35→55 과매도 탈출이 강력 매수  (S-CORE Delta 항)
#   · Gear 3 + RSI 40~60 = 추세 추종 분할 매수 타이밍            (사이트 FAQ 원문)
#   · Gear 3라도 RSI 70+ 는 추격 금지, 보유 유지
#   · Gear 1(200일선 아래) = 200일선 회복 확인 후 본대           (사이트 FAQ 원문)
#   · 3-3-4 — 1차 30%(지표 반등 확인) / 2차 30%(저항 돌파·지지 확인) / 3차 40%(추세 확정)
#   · 손절 = 200일선 하향 이탈 시 기계적 실행, 감정 배제

def _rally(s):
    """반등이 며칠째인지 + 공포에서 빠져나오는 중인지. 사이트 철학의 '지금 분위기'.
    2026-08-05 운영 피드백 — '4일 연속 반등인데 왜 이 분위기를 못 읽니.'
    데이터(upDays5·rsi5dAgo)는 처음부터 있었고, 판단부가 안 보고 있었을 뿐이다."""
    days = s.get('upDays5') or 0
    rsi_now, rsi_prev = s.get('rsi'), s.get('rsi5dAgo')
    escape = (rsi_prev is not None and rsi_now is not None
              and rsi_prev < 42 and rsi_now >= 45)   # 과매도 탈출 = 강력 매수 패턴
    return days, escape, rsi_prev


def _stage334(days):
    """반등 경과일 → 3-3-4 진행 단계. 매일 1차로 되돌아가지 않게 하는 장치."""
    if days >= 4:
        return 3, '3차(40%)'
    if days >= 2:
        return 2, '2차 본대(30%)'
    return 1, '1차 정찰대(30%)'


def _rally_txt(s):
    """'반등 4일째 · RSI 27→39 과매도 탈출' — 분위기 한 줄."""
    days, escape, rsi_prev = _rally(s)
    if days < 2:
        return ''
    txt = f'반등 {days}일째'
    if escape:
        txt += f' · RSI {rsi_prev:.0f}→{s["rsi"]:.0f} 과매도 탈출'
    return txt


# ─── 두 엔진 화해 장치 (2026-08-05 신설, 운영 피드백) ────────────────────────
# 이슈 제보: 같은 TSLA 카드 안에서 위에서는 "확실한 바닥 신호 대기 — 매수점수
# 80 이상을 기다려라", 바로 아래 AI 차트분석에서는 "매수 전환"이 나란히 떠 있었다.
# 원인은 명확하다 — 규칙 엔진(이 파일)과 차트 엔진(generate-chart-analysis.js)이
# 서로를 전혀 모른 채 각자 결론만 찍어내고, 화면이 그 둘을 그냥 위아래로 붙였다.
# 실측(2026-08-05 07:48) 9종 중 6종이 이런 식으로 어긋나 있었다.
#
# 화해 원칙은 "다르면 무조건 보수적으로"가 아니다. 이건 스윙 트레이딩이고,
# 사이트 기준은 "진입은 남보다 빠르게, 익절은 남보다 확실하게"다.
#   · 둘 다 매수 쪽  → 확신을 갖고 3-3-4 차수를 말한다 (망설이지 않는다)
#   · 규칙 과열 + 차트 매수 → 전량 익절이 아니라 1차 30% 분할 익절. 추세는 남긴다
#   · 규칙 보유 + 차트 매수 → '들고 있으라'로 끝내지 않고 추가 차수를 연다
#   · 규칙 매수 + 차트 미확인 → 진입은 하되 1차를 절반으로 줄인다
# 그리고 어느 경우든 교차검증 결과를 카드 안에 명시한다 — 두 엔진이 서로 모르는
# 독립된 주장처럼 나란히 서는 일이 다시는 없도록.

CHART_FILE_SYM = {'GOOG': 'GOOGL'}   # 차트 엔진 파일명이 다른 종목


def _chart_of(sym):
    """종목별 AI 차트분석 판독. 없거나 낡았으면 None(화해 생략, 기존 판단 유지)."""
    f = CHART_FILE_SYM.get(sym, sym)
    d = load(os.path.join(HERE, '..', 'data', f'analysis-{f}.json'))
    if not d:
        return None
    try:
        upd = datetime.fromisoformat(d['updatedAt'].replace('Z', '+00:00'))
        if (datetime.now(timezone.utc) - upd) > timedelta(hours=36):
            return None
    except Exception:
        pass
    a = d.get('analysis') or {}
    if not a.get('action'):
        return None
    return dict(action=a.get('action'), stage=a.get('stage') or '',
                score=a.get('buyScore'), why=(a.get('scoreReason') or '').strip(),
                trend=a.get('trend') or '')


def _reconcile(sym, st, label, kb):
    """규칙 엔진 판단 + 차트 엔진 판독 → 하나의 결론. (st, label, kb) 반환."""
    ca = _chart_of(sym)
    if not ca:
        return st, label, kb
    act, sc = ca['action'], (ca['score'] if isinstance(ca['score'], (int, float)) else None)
    buy_side = act == '매수'
    strong = buy_side and sc is not None and sc >= 7
    line = f"차트 패턴 '{act}'" + (f" {sc}/10" if sc is not None else '')
    if ca['stage']:
        line += f" · {ca['stage']}"
    if ca['why']:
        line += f" · {ca['why']}"

    verdict = None
    if buy_side and st in ('watch', 'wait'):
        st = 'accumulate'
        label = '지표·차트 모두 매수 쪽 — 1차 정찰대(30%) 자리'
        verdict = '지표와 차트 패턴 방향 일치 — 망설일 자리가 아니라 1차를 넣는 자리. 3-3-4의 1차 30%.'
    elif buy_side and st == 'trim':
        label = '과열 신호 vs 차트 매수 — 1차 30%만 분할 익절'
        verdict = ('지표는 과열, 차트 패턴은 매수 — 방향이 갈린다. 전량 익절이 아니라 '
                   '보유분의 1차 30%만 덜어내고 나머지는 추세 이탈까지 들고 간다. '
                   '고점에서 확실히 덜어내되 추세를 통째로 버리지는 않는 자리.')
    elif strong and st == 'hold':
        label = '추세 양호 + 차트 매수 — 추가 1차(30%) 가능 구간'
        verdict = (f'차트 패턴 매수 신호 {sc}/10. 보유만 하고 끝낼 자리가 아니라 목표 비중이 '
                   f'덜 찼다면 1차 30%를 더 채우는 자리. 과열 신호가 켜지면 그때 익절로 전환.')
    elif st == 'accumulate' and not buy_side:
        label = '지표는 매수 자리 — 차트 패턴 미성숙, 1차는 절반으로'
        verdict = (f"지표는 진입 구간이지만 차트 패턴은 아직 '{act}'. "
                   f'판단이 갈릴 때는 크기로 답한다 — 1차 30%가 아니라 15% 선에서 시작하고, '
                   f'차트가 매수로 돌아서면 나머지를 채운다.')
    else:
        verdict = '차트 패턴도 같은 방향 — 조정 없이 그대로.'

    return st, label, kb + [_blk('차트 패턴 교차검증', line, verdict)]


def tsla_view(s):
    buy, sell, gear = s.get('buyScore') or 50, s.get('sellScore') or 50, s.get('gear') or 2
    rsi = s.get('rsi')
    if buy >= 80:
        st, label = 'accumulate', '많이 빠졌음 — 나눠서 사볼 만한 구간'
        body = (f'TSLA 극단 과매도 구간 진입(매수점수 {buy}). 이 종목에서 통계적으로 '
                f'믿을 만한 유일한 매수 신호가 이 구간 — {STATS["tsla_extreme"]}. '
                f'다만 변동성이 큰 종목이라 일시 진입이 아닌 분할 진입이 전제.')
        body_en = (f'TSLA has entered extreme oversold territory (buy score {buy}). This is the one zone '
                   f'on this stock with a statistically dependable buy signal — {STATS_EN["tsla_extreme"]}. '
                   f'Given the volatility, scaling in rather than entering all at once is the premise.')
    elif sell >= 75:
        st, label = 'hold', '많이 올랐지만 — 서둘러 팔 필요 없는 종목'
        body = (f'과열 신호 점등(매도압력 {sell}). 다만 이 종목에서는 그 신호를 액면 그대로 따르지 않음 — '
                f'{STATS["tsla_hot"]}. 익절 판단의 기준은 시점이 아니라 이탈(추세 붕괴).')
        body_en = (f'The overheating signal has flagged (sell pressure {sell}), but this stock is not one to '
                   f'follow it at face value. {STATS_EN["tsla_hot"]}. If profit-taking is needed, the right '
                   f'trigger is a trend break, not a moment in time.')
    elif gear <= 1:
        # 2026-08-05 운영 지침로 재작성 — 스윙 철학 기반.
        # 옛 문구는 '확실한 바닥 신호 대기'였다. 사이트 원칙에 '확실한 바닥'이라는
        # 항목은 없다. 있는 건 두 개다 — 200일선 회복(본대 조건)과 과매도 탈출
        # (공포 매수 = 1차 정찰대 조건). 정의되지 않은 말로 판단을 미루는 대신
        # 운영자가 이미 정해둔 두 트리거로 말한다.
        _dev = s.get('dev200')
        _days, _escape, _rsi_prev = _rally(s)
        _stage, _stage_word = _stage334(_days)
        _rt = _rally_txt(s)
        _devtxt = f'200일선 대비 {_dev:.0f}%' if _dev is not None else '200일선 아래'
        if _escape or _days >= 2:
            st, label = 'accumulate', f'공포 구간 탈출 진행 — 1차 정찰대(30%) 자리'
            body = (f'{_rt}. {_devtxt}, RSI {rsi:.0f}. '
                    f'이 분석의 매수 타이밍 원칙은 "사람들이 가장 두려워할 때"이고, '
                    f'RSI가 과매도에서 방향을 튼 구간이 그 자리 — 지금이 거기. '
                    f'다만 200일선 아래(Gear {gear})라 본대는 아직: 3-3-4의 1차 30%까지. '
                    f'2차 30%는 200일선 회복 확인 후, 3차 40%는 추세 확정 후. '
                    f'손절은 원칙대로 직전 저점 이탈 시 기계적으로 — 감정 배제.'
                    + (f' 반등 {_days}일째라 이미 1차는 들어가 있어야 할 시점 — 비어 있다면 지금이라도.'
                       if _stage >= 2 else ''))
            body_en = (f'A {_days}-day rebound with RSI at {rsi:.0f}, {_devtxt.replace("200일선 대비", "")} versus the '
                       f'200-day line. The buy timing in this framework is "when people are most afraid," and a turn '
                       f'up out of oversold is exactly that spot. Still below the 200-day line, so this is the first '
                       f'30% tranche only — the second 30% waits for a reclaim of the 200-day, the final 40% for trend '
                       f'confirmation. Cut mechanically on a break of the prior low.')
        else:
            st, label = 'watch', '내리막 — 공포 반전 첫 신호에 1차 정찰대'
            body = (f'{_devtxt}, RSI {rsi:.0f} — 아직 반등 전환 신호 없음. '
                    f'"확실한 바닥"을 기다리는 게 아니라 정해진 두 트리거를 기다린다: '
                    f'RSI가 과매도에서 방향을 트는 순간(공포 매수 자리) 1차 정찰대 30%, '
                    f'200일선 회복 시 2차 30%. 둘 중 앞의 것이 오면 그날 들어간다.')
            body_en = (f'RSI at {rsi:.0f} below the 200-day line with no turn yet. Not waiting for a "certain bottom" — '
                       f'waiting for two defined triggers: a turn up out of oversold (the fear-buying spot) for the '
                       f'first 30% tranche, and a reclaim of the 200-day for the second 30%.')
    else:
        st, label = 'hold', '들고 가는 구간 — 추세가 깨지는지만 확인'
        body = (f'추세 훼손 신호 없는 구간. TSLA는 예측보다 대응이 유리했던 종목 — '
                f'미리 팔거나 미리 사는 대신 200일선 이탈 여부 하나로 관리하는 자리.')
        body_en = ('No sign of trend damage here. TSLA has rewarded reacting over predicting — instead of '
                   'selling early or buying early, this is a zone managed by one criterion: whether the '
                   '200-day line breaks.')
    _mv = _move_prefix(s)
    _kb = ([_move_blk(s)] if _mv else []) + [
        _blk('지금 숫자',
             f'매수점수 {buy} · 매도압력 {sell} · RSI {rsi:.0f}' if rsi is not None
             else f'매수점수 {buy} · 매도압력 {sell}',
             f'추세 기어 {gear} — ' + ('200일선 위' if gear >= 3 else '200일선 근처' if gear == 2 else '200일선 아래')),
        _blk('판단 근거', body.strip()),
    ]
    st, label, _kb = _reconcile('TSLA', st, label, _kb)
    return dict(stance=st, stanceLabel=label, stanceLabelEn=_en(label),
                commentary=_mv + body,
                commentaryEn=_move_prefix_en(s) + body_en,
                blocks=_kb,
                nums=dict(buy=buy, sell=sell, gear=gear, rsi=rsi),
                audience=_audience(st, buy, sell, gear, rsi, 'ignore', 'wait', '매수점수 80 이상 극단 과매도'),
                audienceEn=_audience_en(st, buy, sell, gear, rsi, 'ignore', 'wait',
                                        'extreme oversold with a buy score above 80'))


# ─── TOP9 확장: 빅테크 7종 종목별 문법 (2026-08-03 신설, 운영 승인) ───────
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
        hot_txt='과열 신호(매도압력 75+) 이후에도 20거래일 평균 +2.6%·승률 76% — 표본 72일. 기계적 익절이 오히려 수익을 깎아온 종목',
        down='insensitive',  # gear1 승률 59% vs gear3 64% — 추세 민감도 낮음
        down_txt='200일선 아래에서도 20거래일 승률 59% — 위 구간은 64%. 추세 신호에 둔감한 항공모함. 극단 구간 분할 대응보다 보유 지속이 통계의 방향',
        base_txt='9종 중 신호 민감도 최저 — 극단 매수점수도, 과열 매도도 통계적 우위 없음. 판단할 게 적다는 것 자체가 이 종목의 성격'),
    'GOOG': dict(
        label='알파벳',
        buy='rsi30',  # RSI<30 이후 +5.5%/74% (n=34) vs base +2.1%/63%
        buy_txt='유효 매수 신호는 RSI 30 미만 패닉 구간 하나 — 이후 20거래일 평균 +5.5%·승률 74%. 표본 34일, 전체 평균 +2.1%·63%',
        hot='slow',  # sell75 이후 +0.7%/48% — 둔화
        hot_txt='과열(매도압력 75+) 이후 20거래일 평균 +0.7%·승률 48% — 표본 65일, 확연한 쉬어감. 여기서의 신규 매수는 통계적 열위',
        down='insensitive',
        down_txt='하락 추세 구간 승률 59%로 전체 평균 63%와 큰 차이 없음 — 추세보다 극단 패닉(RSI 30 미만) 대기가 이 종목의 문법',
        base_txt='주의 하나 — 매수점수 80 이상 극단 구간이 오히려 역신호. 이후 20거래일 평균 −0.1%·승률 46%, 표본 71일. 이 종목에서 점수 극단은 매수 근거 아님'),
    'MSFT': dict(
        label='마이크로소프트',
        buy='rsi30',  # +6.0%/77% (n=35)
        buy_txt='가장 강한 매수 신호는 RSI 30 미만 극단 과매도 — 이후 20거래일 평균 +6.0%·승률 77%. 표본 35일, 전체 평균 +1.8%·64%',
        hot='trim',  # sell75 이후 −1.9%/45% (n=42) — 9종 중 유일하게 익절 유효
        hot_txt='9종 중 유일하게 기계적 익절이 통계로 검증된 종목 — 과열(매도압력 75+) 이후 20거래일 평균 −1.9%·승률 45%, 표본 42일. 분할 익절 검토가 데이터의 방향',
        down='wait',  # gear3 67% vs gear1 51%
        down_txt='추세를 존중해야 하는 종목 — 200일선 위 20거래일 승률 67%, 아래 51%. 하락 추세에서는 극단 과매도(RSI 30 미만) 신호만 대기',
        base_txt='추세 위에서 꾸준(200일선 위 승률 67%), 과열이 켜지면 실제로 쉬어감 — 교과서에 가장 가까운 종목'),
    'AMZN': dict(
        label='아마존',
        buy='both',  # buy80 +3.8%/62% (n=56), rsi30 +4.0%/76% (n=55)
        buy_txt='극단 신호 매수가 통하는 종목 — RSI 30 미만 이후 20거래일 평균 +4.0%·승률 76%(표본 55일), 매수점수 80 이상 이후 +3.8%·승률 62%(표본 56일)',
        hot='ignore',  # sell75 +1.6%/64% ≈ base
        hot_txt='과열 신호는 판단 재료 아님 — 과열 이후 성과(+1.6%·64%)가 전체 평균(+2.1%·64%)과 사실상 동일. 과열만으로 팔 이유도, 살 이유도 없음',
        down='insensitive',  # gear1 63% = base 64%
        down_txt='200일선 위든 아래든 20거래일 승률 63~64%로 사실상 동일 — 추세 신호 무차별 종목. 추세 판단 대신 극단 과매도 분할 매수가 중심 문법',
        base_txt='7종 중 유일하게 매수점수 80 이상 극단 구간까지 매수 신호로 검증된 종목 — 추세를 따지지 않고 극단에서 나눠 사는 문법'),
    'TSM': dict(
        label='TSMC',
        buy='rsi30',  # +6.7%/80% (n=66)
        buy_txt='매수 신호는 패닉 — RSI 30 미만 이후 20거래일 평균 +6.7%·승률 80%. 표본 66일, 전체 평균 +2.5%·62%',
        hot='slow',  # sell75 +1.0%/55%
        hot_txt='과열(매도압력 75+) 이후 20거래일 평균 +1.0%·승률 55%로 눈에 띄는 둔화 — 표본 77일. 과열 구간 신규 진입은 통계적 열위',
        down='insensitive',
        down_txt='오히려 200일선 공방 구간(±2%)의 이후 성과가 +3.3%·승률 72%로 이 종목 구간 중 최고 — 추세 이탈을 공포가 아니라 관찰 구간으로 대하는 것이 데이터의 방향',
        base_txt='반도체 사이클 종목답게 패닉 매수(RSI 30 미만, 승률 80%)의 보상이 9종 중 두 번째로 큼'),
    'AVGO': dict(
        label='브로드컴',
        buy='rsi30',  # +8.9%/82% (n=38) — 9종 중 최강
        buy_txt='RSI 30 미만 극단 과매도가 승률 기준 9종 전체 최강 매수 신호 — 이후 20거래일 평균 +8.9%·승률 82%. 표본 38일, 전체 평균 +2.9%·63%. 수익률 크기로는 TSLA 매수점수 80+ 구간이 더 큼',
        hot='slow',  # sell75 −0.5%/56%
        hot_txt='과열(매도압력 75+) 이후 20거래일 평균 −0.5%·승률 56%로 쉬어감 — 표본 75일. 과열 구간에서는 추격하지 않는 것이 통계의 방향',
        down='opportunity',  # gear1 +6.8%/72% vs gear3 +2.2%/61% — 역발상 종목
        down_txt='역발상 종목 — 200일선 아래 하락 추세 구간의 이후 20거래일이 평균 +6.8%·승률 72%로, 상승 추세 구간(+2.2%·61%)보다 우위. 낙폭이 기회였던 이력이 뚜렷. 단 분할 전제',
        base_txt='"빠질 때 사서 과열에 쉬는" 문법이 9종 중 가장 선명하게 검증된 종목'),
    'META': dict(
        label='메타',
        buy='rsi30',  # +6.3%/74% (n=78)
        buy_txt='매수 신호는 패닉 데이 — RSI 30 미만 이후 20거래일 평균 +6.3%·승률 74%. 표본 78일, 전체 평균 +1.9%·61%',
        hot='slow',  # sell75 +2.0%/50%
        hot_txt='과열(매도압력 75+) 이후 승률 50%로 동전던지기 — 표본 70일. 과열 구간의 추가 매수는 근거 없음',
        down='wait',  # gear3 65% vs gear1 52%
        down_txt='추세가 갈리는 종목 — 200일선 위 20거래일 승률 65%, 아래 52%. 하락 추세에서는 RSI 30 미만 패닉 신호만 대기가 데이터의 방향',
        base_txt='급락이 잦지만 패닉 구간(RSI 30 미만) 반등의 통계(승률 74%)가 꾸준했던 종목'),
}



# ─── 스탠스 라벨 한→영 사전 (2026-08-04 운영 지침: 쉬운 말 + 글로벌 번역 대비) ───
# 원칙: "지금 상태 — 그래서 어떤 구간인지"를 일상어로. 행동 명령형 금지(진단형 유지).
# UI 다국어(en판·번역 프록시)가 이 En 라벨을 그대로 쓸 수 있도록 형제 필드로 내보낸다.
LABEL_EN = {
    '많이 빠졌음 — 나눠서 사볼 만한 구간': 'Deeply oversold — worth buying in parts',
    '강한 매수 신호 — 나눠서 사볼 만한 구간': 'Strong buy signal — worth buying in parts',
    '많이 올랐음 — 일부 이익실현 검토 구간': 'Overheated — worth taking some profit',
    '많이 올랐음 — 지금 새로 사기엔 불리': 'Overheated — a poor spot to start buying',
    '많이 올랐지만 — 서둘러 팔 필요 없는 종목': 'Overheated — but quick selling has not paid off here',
    '지표·차트 모두 매수 쪽 — 1차 정찰대(30%) 자리': 'Indicators and chart both lean buy — a first 30% tranche',
    '과열 신호 vs 차트 매수 — 1차 30%만 분할 익절': 'Overheated vs chart buy — trim just the first 30%',
    '추세 양호 + 차트 매수 — 추가 1차(30%) 가능 구간': 'Trend intact plus a chart buy — room for another 30%',
    '지표는 매수 자리 — 차트 패턴 미성숙, 1차는 절반으로': 'Indicators say buy, chart pattern immature — halve the first tranche',
    '내리막 — 반등 첫 신호에 정찰대': 'Downtrend — a scout position on the first rebound signal',
    '내리막이나 반등 진행 — 소량 정찰대': 'Downtrend but rebounding — a small scout position',
    '내리막이나 반등 진행 — 소량 진입 후보': 'Downtrend but rebounding — a candidate for a small entry',
    '많이 빠진 자리 — 소량 1차 진입 검토': 'Deeply sold off — worth a small first tranche',
    '내리막 — 이 종목엔 오히려 기회였던 자리': 'Downtrend — historically a buying zone for this stock',
    '내리막이지만 — 크게 겁낼 필요 없었던 종목': 'Downtrend — but this stock has held up fine',
    '많이 오른 상태 — 식는지 지켜보는 중': 'Getting hot — watching for cooling',
    '매수 기회에 가까워지는 중': 'Getting closer to a buy opportunity',
    '갈림길 근처 — 방향 확인 중': 'Near a crossroads — direction unclear',
    '흐름 좋음 — 그대로 들고 가는 구간': 'On track — a zone to keep holding',
    '들고 가는 구간 — 추세가 깨지는지만 확인': 'Keep-holding zone — just watch the trend line',
    '오르막 유지 — 들고 가는 구간': 'Uptrend intact — a zone to keep holding',
    '갈림길 — 200일선 공방 중': 'At a crossroads — battling the 200-day line',
    '오르막 꺾임 — 줄이기 검토 구간': 'Trend broken — worth considering a trim',
}


def _en(label):
    return LABEL_EN.get(label, label)


# ─── 영문판(en/) 논평 — 규칙 엔진 영어 형제 필드 (2026-08-04 신설, 운영 지침) ───
# 원칙: 한국어 본문과 "같은 분기"에서 생성한다(분기 로직을 복제하지 않는다).
# 아래 사전은 종목별 검증 문법의 영어 서술만 보관 — 통계 수치는 KR과 동일 출처.
# LLM 호출 없음(비용 0). en/atmr-dashboard.html이 이 필드를 그대로 렌더한다.
MEGA_EN = {
    'AAPL': dict(
        name='Apple',
        buy_txt=None,
        hot_txt='AAPL actually kept rising after overheating signals — following a sell-pressure reading of 75+, the next 20 sessions averaged +2.6% with a 76% win rate (72 samples). Mechanical profit-taking has cost money on this name',
        down_txt='AAPL held up even below its 200-day line, with a 59% win rate over the next 20 sessions versus 64% above it — a low trend-sensitivity mega-cap where simply holding has beaten tactical trading',
        base_txt='AAPL is the least signal-sensitive of the nine — neither extreme buy scores nor overheating readings carried a statistical edge. Having little to decide is precisely this stock\'s character'),
    'GOOG': dict(
        name='Alphabet',
        buy_txt='GOOG has exactly one validated buy signal: panic readings below RSI 30. Those were followed by +5.5% over 20 sessions with a 74% win rate (34 samples, versus +2.1% and 63% overall)',
        hot_txt='GOOG clearly stalled after overheating (sell pressure 75+) — the next 20 sessions averaged +0.7% with a 48% win rate (65 samples). Fresh buying here is statistically unfavorable',
        down_txt='GOOG\'s win rate in downtrends (59%) barely differs from its overall average (63%) — for this name the grammar is waiting for genuine panic (RSI below 30) rather than reading the trend',
        base_txt='One caution — for GOOG, buy scores above 80 have been a reverse signal (the next 20 sessions averaged −0.1% with a 46% win rate, 71 samples). Extreme scores are not a buy case on this stock'),
    'MSFT': dict(
        name='Microsoft',
        buy_txt='MSFT\'s strongest buy signal is extreme oversold territory below RSI 30 — followed by +6.0% over 20 sessions with a 77% win rate (35 samples, versus +1.8% and 64% overall)',
        hot_txt='MSFT is the only one of the nine where mechanical profit-taking is statistically validated — after sell pressure of 75+, the next 20 sessions averaged −1.9% with a 45% win rate (42 samples). Scaling out in parts is where the data points',
        down_txt='MSFT is a stock that respects its trend — a 67% win rate over 20 sessions above the 200-day line versus 51% below it. In downtrends the only signal worth waiting for is extreme oversold (RSI below 30)',
        base_txt='MSFT is the closest thing here to the textbook case: steady above its trend line (67% win rate) and genuinely cooling off when overheating flags'),
    'AMZN': dict(
        name='Amazon',
        buy_txt='AMZN is a stock where extreme-signal buying works — after RSI below 30, the next 20 sessions averaged +4.0% with a 76% win rate (55 samples); after buy scores above 80, +3.8% with 62% (56 samples)',
        hot_txt='AMZN\'s overheating signal has not been decision-grade — performance after overheating (+1.6%, 64%) is effectively identical to its overall average (+2.1%, 64%). It is neither a reason to sell nor to buy',
        down_txt='AMZN posted a 63–64% win rate over the next 20 sessions whether above or below its 200-day line — a trend-indifferent name where scaling into extremes matters more than reading the trend',
        base_txt='AMZN is the only one of the seven where buy scores above 80 are also validated as a buy signal — the grammar here is to ignore the trend and scale in at extremes'),
    'TSM': dict(
        name='TSMC',
        buy_txt='TSM\'s buy signal is panic — after RSI below 30, the next 20 sessions averaged +6.7% with an 80% win rate (66 samples, versus +2.5% and 62% overall)',
        hot_txt='TSM slowed markedly after overheating (sell pressure 75+), averaging +1.0% with a 55% win rate over the next 20 sessions (77 samples) — entering fresh here is statistically unfavorable',
        down_txt='TSM actually performed best around the 200-day battleground (within ±2%), averaging +3.3% with a 72% win rate afterward — the data suggests treating a trend break as an observation zone rather than a panic',
        base_txt='True to a semiconductor cycle name, TSM offered the second-largest payoff of the nine for panic buying (RSI below 30, 80% win rate)'),
    'AVGO': dict(
        name='Broadcom',
        buy_txt='AVGO\'s extreme oversold reading below RSI 30 was the strongest buy signal among all nine by win rate (TSLA\'s buy-score-80 zone is larger by return size) — the next 20 sessions averaged +8.9% with an 82% win rate (38 samples, versus +2.9% and 63% overall)',
        hot_txt='AVGO rested after overheating (sell pressure 75+), averaging −0.5% with a 56% win rate over the next 20 sessions (75 samples) — the data says not to chase this zone',
        down_txt='AVGO is the contrarian of the group — the 20 sessions following a downtrend below the 200-day line averaged +6.8% with a 72% win rate, better than uptrend stretches (+2.2%, 61%). Drawdowns have clearly been opportunities here, though scaling in remains the premise',
        base_txt='AVGO shows the "buy weakness, rest through strength" grammar more cleanly than any of the other nine'),
    'META': dict(
        name='Meta',
        buy_txt='META\'s buy signal is panic days — after RSI below 30, the next 20 sessions averaged +6.3% with a 74% win rate (78 samples, versus +1.9% and 61% overall)',
        hot_txt='META\'s win rate after overheating (sell pressure 75+) fell to a coin flip at 50% (70 samples) — there is no case for adding here',
        down_txt='META is a stock the trend divides — a 65% win rate over 20 sessions above the 200-day line, 52% below. In downtrends the data says to wait for a panic reading below RSI 30',
        base_txt='META drops sharply and often, but the statistics of its rebounds from panic zones (RSI below 30, 74% win rate) have been consistent'),
}

STATS_EN = dict(
    tsla_extreme='TSLA buy scores above 80 span 61 sample days, followed by +15.3% over the next 20 sessions with a 69% win rate',
    tsla_hot='TSLA has frequently kept climbing after crossing sell pressure 75, averaging +7.5% over the next 20 sessions — mechanically selling overheating has lost money on this name',
    nvda_trend='NVDA splits at its trend line: a 69% win rate over 20 sessions above the 200-day (Gear 3) versus 56% below — trend maintenance is the core of the judgment',
)


def _move_prefix_en(s):
    """_move_prefix()의 영어 형제 — 임계치·톤 분기를 KO와 1:1로 맞춘다."""
    chg = s.get('changePct')
    if chg is None:
        return ''
    live = us_session_now() in ('pre', 'open')
    if chg >= 3:
        tone = 'sharp rebound'
    elif chg <= -3:
        tone = 'sharp drop'
    elif abs(chg) < 0.8:
        tone = 'little changed'
    else:
        tone = 'in progress' if live else 'close'
    px = _px_en(s)
    return f'{prev_session_tag_en()}: {chg:+.1f}%{" " + px if px else ""}, {tone}. '


def _audience_en(stance, buy, sell, gear, rsi, hot, down, sig_label_en):
    """_audience()의 영어 형제 — 동일한 조건 분기를 그대로 미러링한다.
    한쪽만 고치면 국문·영문이 어긋나므로 두 함수는 항상 같이 수정한다."""
    overheated = sell >= 75
    if stance == 'trim':
        holder = 'Scaling out worth considering — one of the rare names where the overheating signal is statistically validated. A first tranche near 30% is the premise.'
    elif overheated and hot == 'ignore':
        holder = 'Holding intact — this stock\'s overheating signal has no predictive power. Exit criteria belong to a trend break, not to timing.'
    elif overheated:
        holder = 'Holding remains viable — but this name has a record of slowing after overheating. Reviewing exit criteria is advised.'
    elif gear <= 1 and down == 'wait':
        holder = 'Exit criteria worth re-checking — below the 200-day line, trimming exposure is where the data points.'
    elif gear <= 1 and down == 'opportunity':
        holder = 'Holding intact — this name has historically performed better after downtrend stretches. Panic selling is not advised.'
    elif gear <= 1:
        holder = 'Holding remains viable — this stock has low trend sensitivity. Manage exit criteria only.'
    else:
        holder = 'Holding zone — no sign of trend damage.'
    if stance == 'accumulate':
        newbie = f'Valid zone for scaling in — {sig_label_en} is active. A small first tranche (within 30%) is the premise.'
    elif overheated:
        newbie = 'New entries worth avoiding — overheated. Chasing here is statistically unfavorable.'
    elif gear >= 3 and buy >= 65:
        newbie = f'A small scaled entry is worth considering — uptrend plus a buy score of {buy}. That said, this stock\'s optimal entry is {sig_label_en}.'
    elif gear <= 1:
        newbie = f'Waiting zone — before the valid signal ({sig_label_en}) fires, there is no statistical basis for entry.'
    else:
        newbie = 'Watching zone — awaiting an entry signal.'
    if stance == 'accumulate':
        avgdown = f'A first averaging-down tranche is worth considering — {sig_label_en} is active. Small size (within 30%) with exit criteria set in advance.'
    elif gear <= 1 and down != 'opportunity':
        avgdown = 'Averaging down is off the table — downtrend confirmed. Lowering your average before a bottom is confirmed has a record of widening losses.'
    elif gear <= 1:
        avgdown = f'This name has a contrarian record, but averaging down applies only when {sig_label_en} fires — currently waiting.'
    elif overheated:
        avgdown = 'Not an averaging-down zone — if you are down while the stock is overheated, checking exit criteria comes before adding.'
    else:
        avgdown = 'No signal calling for averaging down — current positions stand.'
    if gear >= 3 and sell < 60 and buy >= 60 and (rsi is None or rsi < 65):
        pyramid = 'A small pyramid add is worth considering — trend intact, not overheated, buy signal holding (all three met). Total exposure caps still apply.'
    elif gear >= 3:
        pyramid = 'Pyramiding worth avoiding — approaching overheated. Chasing risks adding at the top.'
    elif gear == 2:
        pyramid = 'Pyramiding on hold — direction unresolved at the 200-day line. Worth revisiting once the trend is reclaimed.'
    else:
        pyramid = 'Pyramiding is off the table — adding into a downtrend is outside the principles.'
    return dict(holder=holder, newbie=newbie, avgdown=avgdown, pyramid=pyramid)


# ─── 4분류 맞춤 행동 진단 (2026-08-04 신설, 운영 지침) ─────────────────────
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
        holder = '비중 조절 구간 — 200일선 아래에서는 승률이 떨어지는 종목. 전량 정리가 아니라 목표 비중 축소로 대응, 200일선 회복 시 원복.'
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
        newbie = (f'소량 정찰대까지 가능 — 유효 신호({sig_label}) 전이라 통계적 우위는 없는 자리. '
                  f'우위가 없다는 건 사지 말라가 아니라 크게 걸지 말라는 뜻. 목표 비중의 10~20%로 '
                  f'시작하고 200일선 회복 시 증액, 직전 저점 이탈 시 철수.')
    else:
        newbie = '관망 구간 — 진입 신호 대기.'
    # 물타기 (손실 보유자의 추가 매수)
    if stance == 'accumulate':
        avgdown = f'1회차 물타기 검토 가능 — {sig_label} 발동 구간. 소량(30% 이내) + 출구 기준 사전 설정 전제.'
    elif gear <= 1 and down != 'opportunity':
        avgdown = ('물타기는 소량까지 — 하락 추세에서 평단 낮추기는 손실 확대 이력이 있는 자리. '
                   '넣는다면 기존 수량의 10% 이내, 철수선(직전 저점)을 먼저 정하고. 그게 부담이면 '
                   '물타기보다 비중 축소가 먼저.')
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


def _trigger_pt(cfg):
    """판단이 바뀌는 조건 — 명사형 항목. trigger_txt(서술형)와 같은 내용을 짧게."""
    if cfg['buy'] is None:
        return '200일선 이탈 하나뿐 — 그 전까지는 보유 지속이 통계의 방향'
    if cfg['buy'] == 'both':
        return 'RSI 30 이탈 또는 매수점수 80 돌파 시 분할 매수 구간 · 200일선 이탈 시 조심 구간'
    if cfg['down'] == 'wait':
        return 'RSI 30 이탈 시 분할 매수 구간 · 200일선 이탈 시 축소 검토 구간'
    return 'RSI 30 이탈 하나뿐 — 추세 흔들림은 이 종목에서 경계 대상 아님'


def mega_view(sym, s):
    """빅테크 7종 공용 뷰 — MEGA_CFG의 종목별 검증 문법으로 분기.
    tsla_view/nvda_view와 동일한 출력 형태(stance/stanceLabel/commentary/nums)."""
    cfg = MEGA_CFG[sym]
    cfe = MEGA_EN[sym]          # 영어 형제 문법 — 같은 분기에서 함께 생성
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
            st, label = 'accumulate', '많이 빠졌음 — 나눠서 사볼 만한 구간'
            trigger = f'많이 빠진 자리(RSI {rsi:.0f}, 매수점수 {buy})'
            trigger_en = f'a deeply sold-off level (RSI {rsi:.0f}, buy score {buy})'
        else:
            st, label = 'accumulate', '강한 매수 신호 — 나눠서 사볼 만한 구간'
            trigger = f'강한 매수 신호 자리(매수점수 {buy})'
            trigger_en = f'a strong buy-signal level (buy score {buy})'
        body = (f'{cfg["label"]}({sym}) {trigger} 도달. {cfg["buy_txt"]}. '
                f'다만 일시 전량 매수가 아니라 분할 매수가 전제.')
        kb = [_blk('지금 자리', f'{cfg["label"]}({sym}) — {trigger} 도달'),
              _blk('이 종목의 검증 문법', cfg['buy_txt']),
              _blk('전제', '한 번에 전량 아님 — 분할 매수가 조건')]
        body_en = (f'{cfe["name"]} ({sym}) has reached {trigger_en}. {cfe["buy_txt"]}. '
                   f'The premise, though, is scaling in rather than buying all at once.')
    # 2) 과열
    elif sell >= 75:
        if cfg['hot'] == 'trim':
            st, label = 'trim', '많이 올랐음 — 일부 이익실현 검토 구간'
        elif cfg['hot'] == 'slow':
            st, label = 'hold', '많이 올랐음 — 지금 새로 사기엔 불리'
        else:
            st, label = 'hold', '많이 올랐지만 — 서둘러 팔 필요 없는 종목'
        body = f'단기간 급등 구간(매도압력 {sell}). {cfg["hot_txt"]}.'
        kb = [_blk('지금 자리', f'단기 급등 구간 — 매도압력 {sell}'),
              _blk('이 종목의 검증 문법', cfg['hot_txt'])]
        body_en = f'The stock has run up sharply in a short stretch (sell pressure {sell}). {cfe["hot_txt"]}.'
    # 3) 하락 추세
    elif gear <= 1:
        # 2026-08-05 운영 지침로 재작성 — TSLA 분기와 같은 철학, 같은 트리거.
        # Gear 1에서 본대는 200일선 회복 후, 1차 정찰대는 공포 반전 시.
        _days, _escape, _rsi_prev = _rally(s)
        _stage, _stage_word = _stage334(_days)
        _rt = _rally_txt(s)
        _rsitxt = f'{rsi:.0f}' if rsi is not None else '측정 불가'
        if cfg['down'] == 'opportunity':
            st, label = 'watch', '내리막 — 이 종목엔 오히려 기회였던 자리'
        elif _escape or _days >= 2:
            st, label = 'accumulate', '공포 구간 탈출 진행 — 1차 정찰대(30%) 자리'
        else:
            st, label = 'watch', '내리막 — 공포 반전 첫 신호에 1차 정찰대'
        body = (f'{(_rt + ". ") if _rt else ""}200일선 아래 내리막 구간, RSI {_rsitxt}. {cfg["down_txt"]}. '
                f'매수 타이밍 원칙은 "사람들이 가장 두려워할 때" — RSI가 과매도에서 방향을 트는 순간이 '
                f'3-3-4의 1차 정찰대(30%) 자리. 2차 30%는 200일선 회복 확인 후, 3차 40%는 추세 확정 후. '
                f'철수는 직전 저점 이탈 시 기계적으로.')
        kb = [_blk('지금 자리', ((_rt + ' · ') if _rt else '') + '200일선 아래 내리막 구간'),
              _blk('이 종목의 검증 문법', cfg['down_txt']),
              _blk('3-3-4 진행', '1차 30% — 과매도 방향 전환 시',
                   '2차 30% — 200일선 회복 확인 후', '3차 40% — 추세 확정 후',
                   '철수 — 직전 저점 이탈 시 기계적')]
        body_en = f'Below its 200-day line in a downtrend (RSI {_rsitxt}). {cfe["down_txt"]}.'
    # 4) 평상시 — "특이 신호 없음" 표현 금지 (2026-08-04 운영 지침). 극단 신호가
    # 아니어도 AI는 좌표를 짚는다: 현재 위치, 다음 유효 신호까지의 거리, 판단이
    # 바뀌는 트리거를 항상 명시. 단 검증 안 된 확률은 여전히 만들어내지 않는다.
    else:
        dev = s.get('dev200')
        rsi_txt = f'{rsi:.0f}' if rsi is not None else '측정 불가'
        dev_txt = f'{dev:+.1f}%' if dev is not None else '—'
        # 이 종목의 유효 신호까지 남은 거리
        watch, watch_en = [], []
        if cfg['buy'] in ('rsi30', 'both') and rsi is not None:
            watch.append(f'"많이 빠졌다" 신호(RSI 30)까지 {max(0.0, rsi - 30):.0f}점')
            watch_en.append(f'{max(0.0, rsi - 30):.0f} points to the deeply-oversold signal (RSI 30)')
        if cfg['buy'] == 'both':
            watch.append(f'강한 매수 신호(매수점수 80)까지 {max(0, 80 - buy)}점')
            watch_en.append(f'{max(0, 80 - buy)} points to the strong buy signal (buy score 80)')
        watch.append(f'과열선(매도압력 75)까지 {max(0, 75 - sell)}점')
        watch_en.append(f'{max(0, 75 - sell)} points to the overheating line (sell pressure 75)')
        watch_txt = ' · '.join(watch)
        watch_txt_en = ' · '.join(watch_en)
        # 판단이 바뀌는 트리거 — 종목 문법별
        if cfg['buy'] is None:
            trigger_txt = ('주가가 200일선 아래로 내려갈 때 하나뿐 — 그 전까지는 '
                           '그냥 들고 가는 쪽이 유리했던 종목')
            trigger_txt_en = ('a single one: the price slipping below its 200-day line. Until then, '
                              'simply holding has been the favorable side on this stock')
        elif cfg['buy'] == 'both':
            trigger_txt = ('많이 빠지거나(RSI 30 아래) 매수점수 80 돌파 시 "나눠 사볼 자리"로, '
                           '200일선 이탈 시 "조심 모드"로 전환')
            trigger_txt_en = ('a deep sell-off (RSI below 30) or a buy score above 80 turning this into '
                              'a scale-in zone, or a break below the 200-day line turning it cautious')
        elif cfg['down'] == 'wait':
            trigger_txt = ('많이 빠지면(RSI 30 아래) "나눠 사볼 자리"로, '
                           '200일선 이탈 시 "줄이기 검토"로 전환')
            trigger_txt_en = ('a deep sell-off (RSI below 30) turning this into a scale-in zone, or a break '
                              'below the 200-day line turning it into a trim review')
        else:
            trigger_txt = ('많이 빠질 때(RSI 30 아래) 하나뿐 — 추세 흔들림은 이 종목에서 '
                           '크게 겁낼 사안이 아니었던 이력')
            trigger_txt_en = ('only a deep sell-off (RSI below 30) — a wobbling trend has not been much '
                              'to fear on this particular stock')
        # 라벨 — 지금 어느 쪽에 가까운지로 차등 (쉬운 말, "이렇다"는 상태 서술)
        if sell >= 60 or (rsi is not None and rsi >= 62):
            st, label = 'hold', '많이 오른 상태 — 식는지 지켜보는 중'
        elif (cfg['buy'] in ('rsi30', 'both') and rsi is not None and rsi <= 38) or \
             (cfg['buy'] == 'both' and buy >= 72):
            st, label = 'hold', '매수 기회에 가까워지는 중'
        elif dev is not None and 0 <= dev <= 4:
            st, label = 'hold', '갈림길 근처 — 방향 확인 중'
        else:
            st, label = 'hold', '흐름 좋음 — 그대로 들고 가는 구간'
        body = (f'{cfg["base_txt"]}. 현재 숫자는 매수점수 {buy}·매도압력 {sell}·RSI {rsi_txt}, '
                f'주가는 200일선 대비 {dev_txt} 위치. 다음 신호까지 {watch_txt} 잔여. '
                f'이 판단이 바뀌는 조건은 {trigger_txt}.')
        kb = [_blk('지금 숫자',
                   f'매수점수 {buy} · 매도압력 {sell} · RSI {rsi_txt}',
                   f'200일선 대비 {dev_txt}'),
              _blk('이 종목의 검증 문법', cfg['base_txt']),
              _blk('다음 신호까지', *watch),
              _blk('판단이 바뀌는 조건', _trigger_pt(cfg))]
        rsi_txt_en = f'{rsi:.0f}' if rsi is not None else 'n/a'
        body_en = (f'{cfe["base_txt"]}. On today\'s numbers: buy score {buy}, sell pressure {sell}, '
                   f'RSI {rsi_txt_en}, with the price sitting {dev_txt} versus its 200-day line. '
                   f'Distance to the next signal: {watch_txt_en}. What would change this call is '
                   f'{trigger_txt_en}.')
    sig_label = ('RSI 30 미만 극단 과매도 또는 매수점수 80 이상' if cfg['buy'] == 'both'
                 else 'RSI 30 미만 극단 과매도' if cfg['buy'] == 'rsi30'
                 else '뚜렷한 검증 신호 없음(신호 둔감 종목)')
    sig_label_en = ('extreme oversold below RSI 30 or a buy score above 80' if cfg['buy'] == 'both'
                    else 'extreme oversold below RSI 30' if cfg['buy'] == 'rsi30'
                    else 'no clearly validated signal (a signal-insensitive stock)')
    mv = _move_prefix(s)
    if mv:
        kb = [_move_blk(s)] + kb
    st, label, kb = _reconcile(sym, st, label, kb)
    return dict(stance=st, stanceLabel=label, stanceLabelEn=_en(label),
                commentary=mv + body,
                commentaryEn=_move_prefix_en(s) + body_en,
                blocks=kb,
                nums=dict(buy=buy, sell=sell, gear=gear, rsi=round(rsi, 1) if rsi is not None else None),
                audience=_audience(st, buy, sell, gear, rsi, cfg['hot'], cfg['down'], sig_label),
                audienceEn=_audience_en(st, buy, sell, gear, rsi, cfg['hot'], cfg['down'], sig_label_en))


def nvda_view(s):
    buy, sell, gear = s.get('buyScore') or 50, s.get('sellScore') or 50, s.get('gear') or 2
    rsi = s.get('rsi')
    if gear >= 3:
        st, label = 'hold', '오르막 유지 — 들고 가는 구간'
        body = (f'NVDA는 추세가 전부인 종목. {STATS["nvda_trend"]}. 현재 200일선 위 구간이라 '
                f'보유 유지가 기본, 과열 신호(매도압력 {sell})는 이 종목에서 검증력이 없어 '
                f'그 이유만으로 축소하지 않음.')
        body_en = (f'On NVDA the trend is everything. {STATS_EN["nvda_trend"]}. The price sits above its '
                   f'200-day line, so holding is the side of the trade, and the overheating reading '
                   f'(sell pressure {sell}) has no predictive power here — not a reason on its own to trim.')
    elif gear == 2:
        st, label = 'hold', '갈림길 — 200일선 공방 중'
        body = (f'NVDA가 200일선 부근 공방 구간 진입. 이 종목의 판단 기준은 추세 하나. '
                f'{STATS["nvda_trend"]}. 아직 추세 훼손 확정 단계는 아니라 보유 유지, '
                f'200일선 종가 기준 명확한 이탈 시 축소로 전환. 미리 팔지도, '
                f'무작정 버티지도 않는 자리.')
        body_en = (f'NVDA has entered a battle around its 200-day line. There is exactly one criterion on '
                   f'this stock: the trend. {STATS_EN["nvda_trend"]}. It is too early to call the trend '
                   f'broken, so holding stands — but a clear close below the 200-day line makes trimming '
                   f'the call. Neither selling early nor holding blindly.')
    else:
        st, label = 'trim', '오르막 꺾임 — 줄이기 검토 구간'
        body = (f'NVDA의 판단 기준은 하나, 추세. {STATS["nvda_trend"]}. 200일선 아래로 추세가 '
                f'무너진 현 구간에서는 노출 축소 검토가 데이터의 방향. '
                f'추세 복귀 확인 시 재편입이 원칙.')
        body_en = (f'There is one criterion on NVDA: the trend. {STATS_EN["nvda_trend"]}. With the trend '
                   f'broken below the 200-day line, reviewing exposure downward is where the data points. '
                   f'Rebuilding once the trend is reclaimed is the principle.')
    _mv = _move_prefix(s)
    _kb = ([_move_blk(s)] if _mv else []) + [
        _blk('지금 숫자',
             f'매수점수 {buy} · 매도압력 {sell} · RSI {rsi:.0f}' if rsi is not None
             else f'매수점수 {buy} · 매도압력 {sell}',
             f'추세 기어 {gear} — ' + ('200일선 위' if gear >= 3 else '200일선 근처' if gear == 2 else '200일선 아래')),
        _blk('판단 근거', body.strip()),
    ]
    st, label, _kb = _reconcile('NVDA', st, label, _kb)
    return dict(stance=st, stanceLabel=label, stanceLabelEn=_en(label),
                commentary=_mv + body,
                commentaryEn=_move_prefix_en(s) + body_en,
                blocks=_kb,
                nums=dict(buy=buy, sell=sell, gear=gear, rsi=rsi),
                audience=_audience(st, buy, sell, gear, rsi, 'ignore', 'wait', '200일선 위 추세 복귀'),
                audienceEn=_audience_en(st, buy, sell, gear, rsi, 'ignore', 'wait',
                                        'a trend reclaim above the 200-day line'))


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
    # 장중 갱신을 켠 뒤로는 데스크가 "마감했습니다"를 쓰면 그대로 모순이 된다
    # (2026-08-05 새벽 01:48, 장중인데 '급반등 마감'으로 나간 사고).
    _ph = us_session_now()
    _SESSION_PHASE_KO = {
        'pre':    '미국 장 시작 전 프리마켓 시간대다',
        'open':   '미국 장이 지금 열려 있는 장중이다',
        'post':   '미국 장이 오늘 막 마감한 직후다',
        'closed': '미국 장이 닫혀 있는 시간대다',
    }[_ph]
    _FLOW_LINE = view.get('flow') or '연속성 정보 없음'
    _SESSION_PHASE_RULE = (
        '오늘 수치는 아직 확정값이 아니다 — "마감", "마감했다", "종가" 같은 완료형 표현 절대 금지. '
        '"장중", "진행 중" 같은 진행형으로 쓰라. 다만 **"현재", "지금"처럼 읽는 시점을 '
        '가리키는 말은 장 국면과 붙여 쓰지 마라** — 파이프라인이 늦으면 프리마켓에 쓴 글이 '
        '장중까지 걸려 "프리마켓 현재"라는 거짓말이 된다(2026-08-06 실제 사고). '
        '국면을 말할 땐 "프리마켓 기준", "장중 기준"처럼 기준점으로 쓴다.'
        if _ph in ('pre', 'open') else
        '오늘 장은 이미 끝났으므로 마감·종가 표현을 써도 된다.'
    )
    prompt = f"""너는 미국주식 분석 사이트 ezlong.com의 최종 데스크(주식 전문 매체 편집장이자 20년 경력 스윙 트레이더)다.
아래 초안·재료를 데스킹해 방문자용 최종 논평을 JSON으로 완성하라.

[오늘의 확정 스탠스 — 절대 변경 금지]
{comp['stanceLabel']} (매수점수 {n['buy']}, 매도압력 {n['sell']}, 기어 {n['gear']}, 200일선 {n['dev200']:+}%)

[지표 판단 초안]
{draft}

[뉴스 재료 (결과 재료 섞여 있을 수 있음)]
{factors}

[차트 패턴 판독]
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
- 문장 부호(80항): **긴 대시(em dash)를 쓰지 마라.** 항목과 설명, 부연, 한 줄 안의 다른
  문장을 잇는 자리에는 **콜론 ':'**을 쓴다. 하이픈은 마이너스와 구분이 안 된다.
  나쁜 예: "1배수 칸은 채운 채로 유지 - 레버리지 검토는 반등 관문".
  좋은 예: "1배수 칸은 채운 채로 유지: 레버리지 검토는 반등 관문".
  하이픈은 음수·범위·연산(-0.5%, RSI 40-60)과 줄머리 목록 표시에만.
- 가격 표기: 소수점은 버려라 — "$683.55"가 아니라 "683달러". 지수·종목가 공통.
- 가격·관문 언급 시 반드시 어느 종목/지수인지 명시하라 (예: "QQQ 종가 683달러 선"). 관문 기준가는 QQQ(나스닥100 ETF) 종가다.
- 색 강조 태그: 중요한 단어·구만 감싸라 — 긍정·상승·통과는 [G]…[/G], 부정·하락·경고는 [R]…[/R], 핵심 조건·가격·결론 포인트는 [B]…[/B].
  전체(core+sections 합쳐) 6~10곳 이내. 단어·구 단위만(문장 전체 금지). 알록달록 금지 — 간혹 가다 있는 약간의 색이 강조다.
- 임팩트: headline은 결론+핵심 조건 하나. 눈에 딱 들어오게.
- 단정 원칙: "A라면 X, B라면 Y, 확인 필요" 양다리 금지. 확인 가능한 것은 확인된 쪽으로 단정, 애매한 것만 검증 통계의 확률로.
- 틀리지 않으려고 애매하거나 하나마나한 소리("변동성 유의", "지켜볼 필요") 금지 — 모든 항목은 수치·조건·판단 중 하나를 반드시 담을 것. 담을 게 없는 섹션은 빼라.
- 결과 재료('VIX 하락', '지수 상승', '섹터 강세' 등)는 근거 인용 금지 — 원인 재료만.
- "~하세요" 행동 촉구 금지. 분석/진단형.
- [칸을 구분해서 쓴다 — 2026-08-14 운영 제보] 이 스탠스는 **1배수(QQQ·VOO·SOXX) 칸**에
  대한 판단이다. 같은 화면에는 2배수·3배수 레버리지 카드가 따로 있고, 그 카드는 지표
  조건으로 별도 판정한다. 그래서 **주어 없는 시장 선언을 쓰지 마라** — "새로 살 자리도
  팔 자리도 아니다", "지금은 사는 구간이 아니다" 같은 문장은 레버리지 카드가 "신규 진입
  가능"이라고 말하는 날 정면으로 충돌한다. 반드시 "1배수 칸은 …"처럼 주어를 밝혀라.
- [비중이 찬 것과 신호가 꺼진 것은 다르다] 1배수 목표 비중을 채워 추가 매수 단계가 없는
  상태를 **"매수 조건 미점등·신호 꺼짐"으로 쓰지 마라.** 목표 비중이 100%인 이유가 바로
  추세 조건이 좋아서(Gear 3)다 — 채울 칸이 없는 것이지 시장이 사지 말라는 것이 아니다.
  이걸 뒤집어 쓰면 레버리지 카드와 정반대의 헤드라인이 나간다(실제 사고: "다음 레버리지
  카드는 새 매수 조건 점등 이후" ↔ 같은 시각 레버리지 카드 "5조건 전부 충족").
- [내부 사정 노출 금지] 이 글은 독자가 읽는 완성된 분석이다. 제작 과정·시스템 구조·
  작업 상태를 절대 쓰지 마라. 금지어 예시 — "엔진", "규칙 엔진", "차트 엔진",
  "교차검증 결과 미확인", "차트 미확인", "아직 확인 못 했다", "데이터가 없어서",
  "이 시스템은", "초안에 따르면". 두 갈래 판단이 갈릴 때는 그 사실을 시장 언어로 쓴다 —
  "지표는 진입 구간이나 차트 패턴은 아직 매수로 돌아서지 않았다"처럼. 무엇을 확인했는지
  안 했는지가 아니라, 시장이 어떤 상태인지만 말한다.
- 포스트마켓은 초안에 등장할 때만 언급하라(큰 이벤트가 있는 날만 초안에 실린다). 초안에 없으면 절대 언급 금지.
- [주말을 '휴장'이라 부르지 않는다] 토·일에 미국장이 안 열리는 건 당연한 일이라 아무도
  '휴장'이라 부르지 않는다. 그렇게 쓰면 '평일에 장이 안 열린다'는 뜻으로 잘못 읽힌다.
  금요일 장이 끝나면 다음 장이 월요일이라는 건 독자가 이미 안다 — 언급 자체가 불필요.
  금지어: "주말 휴장", "휴장 중", "휴장일". 필요하면 "직전 장(금요일) 마감 기준"으로 쓴다.
  단, 추수감사절·크리스마스 같은 평일 공휴일 휴장은 '휴장'이라 써도 된다(알릴 값이 있다).
- 오늘 날짜와 직전 장 정보는 초안 서술을 따를 것. '직전 장'을 언급할 때는 초안처럼 반드시 날짜를 병기하라 — 예: "직전 장(7월30일)".
- [지금 장 국면] {_SESSION_PHASE_KO}. {_SESSION_PHASE_RULE}
- [판단 연속성] {_FLOW_LINE}
- [자기 평가 금지] 판단이 시장에 뒤처졌더라도 반성문·사과·자책을 쓰지 마라.
  금지어 예시 — "실책", "인정한다", "너무 보수적이었다", "놓쳤다", "솔직한 복기",
  "변명 없이". 반대로 자랑도 금지 — "적중", "예측대로"처럼 승리를 뽐내는 표현도 쓰지 마라.
  숫자는 그대로 적어라(성적은 숨기지 않는다). 다만 문장은 지금 시장 상태와 다음 조건으로
  쓴다 — 나쁨: "반등 초입에 더 못 실은 건 실책" / 좋음: "1배수는 채운 상태, 추가 차수는
  새 매수 조건 점등 이후". 자랑도 자책도 독자에게는 정보가 아니다.
- 쉬운 말만 쓴다. 어려운 한자어·업계 밖 용어 금지 — '만재(滿載)' 같은 화물 용어는
  실패 사례다. 일반 투자자가 한 번에 읽히는 단어로만.
- [단문] 한 문장에 주장 하나. '~이나/~지만'으로 두 주장을 잇지 말고 끊어라.
  독자가 해석에 신경 쓰면 실패다(65항).
- 등락률을 말할 때는 반드시 대상을 붙여라. 주어 없는 "시장 +x%" 표기 금지 —
  지수 등락은 "QQQ(나스닥100 ETF) +x%(683달러)"처럼 티커와 주가를 함께 적는다
  (x·주가는 초안의 실제 수치를 그대로 쓸 것, 새로 만들지 말 것).

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



# ── 주말 — 새 주 전망 (2026-08-08 신설) ────────────────────────────────────
# 구조적 문제였다. 미국장은 금요일 마감 후 월요일까지 열리지 않는데, 카드는
# 그 사이 내내 금요일에 쓴 글을 "오늘의 판단"이라고 걸고 있었다. 토요일에는
# 그게 자연스럽다 — 직전 장 마감 판단이니까. 그런데 일요일 오전을 넘기면
# 독자의 관심사는 지난주가 아니라 다음 주로 옮겨간다. 그때부터는 화면도
# 앞을 봐야 한다.
#
# 비용은 주말당 한 번. 감시견이 주말에도 워크플로를 여러 번 깨울 수 있으므로
# forDay(직전 장 기준일)로 이미 구운 게 있으면 그대로 재사용한다.

def us_market_weekend(now_utc=None):
    """미국장이 안 열리는 주말 구간인가 — 금요일 애프터마켓 종료(20:00 ET)
    이후부터 월요일 프리마켓 시작 전까지.
    (58항) 이 구간을 화면에서 '휴장'이라고 부르지 않는다 — 함수 이름과 주석까지
    그 단어를 지운 이유는, 프롬프트와 문구를 쓸 때 코드에 있는 말이 그대로
    옮겨붙기 때문이다."""
    now = now_utc or datetime.now(timezone.utc)
    et = now.astimezone(timezone(timedelta(hours=-4)))   # EDT 기준 근사(경계 판정용)
    d, m = et.weekday(), et.hour * 60 + et.minute        # 월=0 … 일=6
    if d in (5, 6):
        return True
    if d == 4 and m >= 1200:      # 금 20:00 ET 이후
        return True
    if d == 0 and m < 240:        # 월 04:00 ET(프리마켓 개시) 전
        return True
    return False


def desk_week_ahead(view, sc_entry, ca):
    """새 주 전망 한 벌. 지난주를 요약하는 글이 아니라 다음 장을 준비하는 글이다.
    실패하면 None — 화면은 직전 장 판단으로 폴백한다(파이프라인 불사불패)."""
    import urllib.request
    key = os.environ.get('ANTHROPIC_API_KEY', '').strip()
    if not key:
        return None
    comp = view['comp']
    n = comp['nums']
    factors = ''
    if sc_entry:
        f = lambda k: [x.get('name') for x in (sc_entry.get(k) or [])]
        factors = (f"긍정: {f('positive_factors')} / 부정: {f('negative_factors')} / "
                   f"혼조: {f('mixed_factors')}\n긍정 대 부정: {sc_entry.get('positive_total')} 대 "
                   f"{sc_entry.get('negative_total')}")
    ca_line = ''
    if ca:
        conf = ca.get('confluenceChecklist') or {}
        ca_line = f"추세 {ca.get('trend')} | 판정 {ca.get('action')} | 반등 신뢰도 {conf.get('verdict')}"
    stats_block = '\n'.join(f'- {v}' for v in STATS.values())
    prompt = f"""당신은 미국 주식 스윙 데스크다. 지금은 금요일 장이 끝난 뒤이고, 이 글은
**다음 주를 준비하는 독자**가 읽는다. 지난주 복기가 아니라 **다음 장에 무엇을 보고
무엇을 할 것인가**를 쓴다.

[직전 장({view.get('dataDay')}) 마감 상태]
- 스탠스: {comp.get('stanceLabel')} (연속 {view.get('stanceStreak')}거래일)
- 매수압력 {n.get('buy')} / 매도압력 {n.get('sell')} / Gear {n.get('gear')} / 200일선 괴리 {n.get('dev200')}%
- 목표 비중 {comp.get('target')} / 현재 비중 {comp.get('exposure')}
- 판단 연속성: {view.get('flow') or '정보 없음'}

[시장 재료]
{factors or '재료 정보 없음'}

[차트 판정]
{ca_line or '정보 없음'}

[검증 통계 — 이 안의 수치만 인용 가능]
{stats_block}

[쓰는 법]
- 개조식: 소제목으로 그룹핑, 각 항목은 닷블릿. 서술어 없이 명사형 종결.
  단, 의미가 흐려질 만큼 줄이지 말 것 — 수치·조건·이유를 담아 디테일하게.
- [단문] 한 항목 안에서도 주장 하나마다 끊어라. '~이나/~지만' 복문 금지(65항).
- 시제는 **앞**을 본다. "직전 장에서 ~했다"는 근거로만 짧게, 본론은 "다음 장에서
  무엇이 켜지면 무엇을 한다"의 조건문. 예 — "QQQ 종가 723달러 위 재마감 시 2차 집행,
  아래면 현 비중 유지".
- 관문·조건은 반드시 **숫자와 종목/지수 이름**을 붙인다. 주어 없는 "시장" 금지.
- 가격 표기는 소수점 버림 — "683달러".
- 다음 주에 예정된 일정을 임의로 만들어내지 마라. 위 재료에 없는 이벤트·날짜·지표
  발표는 언급 금지. 모르면 안 쓴다.
- [자기 평가 금지] 반성문·사과·자책도, 자랑도 쓰지 마라. 금지어 — "실책",
  "인정한다", "너무 보수적이었다", "놓쳤다", "예측대로". 숫자는 그대로 적되
  문장은 시장 상태와 다음 조건으로 쓴다.
- [내부 사정 노출 금지] 제작 과정·시스템 구조·작업 상태를 쓰지 마라
  ("엔진", "데이터가 없어서", "아직 확인 못 했다" 등).
- [주말을 '휴장'이라 부르지 않는다] 토·일에 미국장이 안 열리는 건 당연한 일이라
  아무도 그걸 '휴장'이라 부르지 않는다. 그렇게 쓰면 오히려 '평일에 장이 안 열린다'로
  잘못 읽힌다. 금요일 장이 끝나면 다음 장이 월요일이라는 건 독자가 이미 안다 —
  주말이라는 사실 자체를 굳이 언급할 필요가 없다. 금지어: "주말 휴장", "휴장 중",
  "휴장일". 필요하면 "직전 장(금요일) 마감 기준"처럼 쓴다. 단, 추수감사절·크리스마스
  같은 평일 공휴일 휴장은 '휴장'이라고 써도 된다 — 그건 알릴 값이 있는 정보다.
- "~하세요" 행동 촉구 금지. 분석/진단형.
- 색 강조 태그: 긍정 [G]…[/G], 부정 [R]…[/R], 핵심 조건·가격 [B]…[/B].
  전체 4~7곳 이내, 단어·구 단위만.
- 확률·통계는 위 검증 통계 안의 수치만 인용. 새로 만들지 말 것.

[출력 형식 — 이 JSON만 출력, 다른 텍스트 금지]
{{"headline": "…", "core": ["…", "…", "…"]}}
headline 은 다음 주의 결론 한 줄(관문 조건 하나 포함). core 는 3~4개."""
    try:
        body = json.dumps({'model': DESK_MODEL, 'max_tokens': 3000,
                           'messages': [{'role': 'user', 'content': prompt}]}).encode()
        req = urllib.request.Request('https://api.anthropic.com/v1/messages', data=body,
            headers={'x-api-key': key, 'anthropic-version': '2023-06-01',
                     'content-type': 'application/json'})
        r = json.load(urllib.request.urlopen(req, timeout=240))
        txt = ''.join(b.get('text', '') for b in r.get('content', []) if b.get('type') == 'text')
        d = json.loads(txt[txt.index('{'): txt.rindex('}') + 1])
        core = [x for x in (d.get('core') or []) if x][:4]
        if not d.get('headline') or not core:
            return None
        allowed = set(_re.findall(r'\d+(?:\.\d+)?(?=%)', prompt))
        unknown = [x for x in _re.findall(r'\d+(?:\.\d+)?(?=%)', json.dumps(d, ensure_ascii=False))
                   if x not in allowed]
        if len(set(unknown)) > 2:
            print(f'::warning::[새 주 전망] 미검증 수치 {sorted(set(unknown))} — 폐기')
            return None
        return dict(headline=d['headline'], core=core, forDay=view.get('dataDay'),
                    generatedAtKST=view.get('generatedAtKST'), model=DESK_MODEL)
    except Exception as e:
        print(f'::warning::[새 주 전망] 호출 실패 — 직전 장 판단으로 폴백: {e}')
        return None


# ── 자책·자랑 문장 청소기 (2026-08-08 신설) ────────────────────────────────
# 이 글은 독자가 읽는 분석이다. "실책이었다", "인정한다" 같은 자기 평가는
# 내부에서 오갈 말이지 화면에 실을 말이 아니다. 스탠스가 며칠 이어지면 같은
# 반성문이 며칠 연속 걸린다는 게 실제 문제였다. 규칙 엔진 쪽 문장은 위에서
# 이미 고쳤고, 이건 데스크(LLM)가 프롬프트 지시를 어겼을 때를 막는 마지막 문이다.
# 문장 단위로만 걷어낸다 — 나머지 문장의 수치·판단은 손대지 않는다.
_BLAME_RE = _re.compile(
    r'실책|인정한다|인정함|인정\.|너무\s*보수적|보수적이었|더\s*실었어야|'
    r'못\s*실은|놓쳤|반성|솔직한\s*복기|변명\s*없이|먼저\s*인정|'
    r'예측대로|예상대로\s*적중|정확히\s*맞'
)


def _blame_free(text):
    """자기 평가 문장만 빼고 돌려준다. 남는 게 없으면 빈 문자열."""
    if not text or not _BLAME_RE.search(text):
        return text
    kept = [x for x in _re.split(r'(?<=[.!?])\s+', text) if not _BLAME_RE.search(x)]
    out = ' '.join(kept).strip()
    if not out:
        # 한 문장 안에 섞인 경우 — 대시 구획으로 한 번 더 잘라 살릴 수 있는 절을 남긴다
        segs = [x.strip() for x in _re.split(r'\s*—\s*', text) if x.strip()]
        out = ' — '.join(x for x in segs if not _BLAME_RE.search(x)).strip()
    return out if len(out) >= 12 else ''


def scrub_blame(node):
    if isinstance(node, str):
        return _blame_free(node)
    if isinstance(node, list):
        return [x for x in (scrub_blame(v) for v in node) if x not in ('', None)]
    if isinstance(node, dict):
        return {k: scrub_blame(v) for k, v in node.items()}
    return node


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
    _hist = [h for h in comp.get('history', [])[-15:] if h.get('st')]
    runs = []            # [스탠스, 일수, 시작 인덱스]
    for i, h in enumerate(_hist):
        if runs and runs[-1][0] == h['st']:
            runs[-1][1] += 1
        else:
            runs.append([h['st'], 1, i])

    # 연속 판단이 이어지는 동안 시장이 어디로 갔는지 — 이 숫자가 없으면
    # "'보유' 판단 오늘로 4일째"는 자랑도 반성도 아닌 무의미한 카운터다.
    # 2026-08-05 운영 피드백 원문: "니가 나흘째 보유라고 한 게 보는 이들로 하여금
    # 너에 대한 신뢰를 죽인다. 너무 보수적이었다고 반성 표현하는 게 나을 듯."
    # 맞다. 4일 연속 반등장에서 '보유 4일째'를 세고 있는 건 놓쳤다는 걸 광고하는
    # 것과 같다. 그래서 이제 그 구간의 등락을 같이 붙이고, 판단이 시장에 뒤처졌으면
    # 뒤처졌다고 먼저 말한다.
    def _run_chg(idx):
        try:
            p0 = _hist[idx].get('price')
            if p0 and price:
                return (price / p0 - 1) * 100
        except Exception:
            pass
        return None

    if len(runs) >= 2:
        prev_s, prev_n, _ = runs[-2]
        cur_s, cur_n, cur_i = runs[-1]
        if cur_n == 1:
            flow = f"오늘 판단 전환 — {SHORT[prev_s]} {prev_n}일 → 오늘부터 '{SHORT[cur_s]}'."
        else:
            flow = _streak_line(SHORT[cur_s], cur_s, cur_n, _run_chg(cur_i)) + \
                   f" (직전: {SHORT[prev_s]} {prev_n}일)"
    elif runs and runs[-1][1] >= 3:
        cur_s, cur_n, cur_i = runs[-1]
        flow = _streak_line(SHORT[cur_s], cur_s, cur_n, _run_chg(cur_i))

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
        ll_paras.append('참고 — 생명선(주봉 30주선) 데이터가 2주 이상 미갱신 상태로 오늘은 생명선 '
                        '판정 미적용. 마켓사이클 파이프라인 점검 필요.')
    elif ll and ll['count'] >= 2:
        broken = '·'.join(n for n, b in ll['detail'] if b)
        ll_paras.append(f'생명선 절단. {broken}이 주봉 기준 30주선 아래에서 마감. '
                        f'이 선 아래에서 강세장을 논하지 않는 것이 이 분석의 대원칙. '
                        f'{STATS["lifeline"]}. 규칙에 따라 노출 상한 '
                        f'{"0%" if ll["count"] >= 3 else "20%"}로 하향.')
    elif ll and ll['count'] == 1:
        first = next(n for n, b in ll['detail'] if b)
        ll_paras.append(f'생명선 경계 — 3개 지수 중 {first}가 먼저 주봉 30주선 아래로 하락. '
                        f'단독 이탈은 발동 조건이 아니나, 두 번째 지수 붕괴 시 그날로 노출 상한 '
                        f'20% 하향이 예약된 행동. 현재는 감시 단계.')
    commentary = ctx_paras + ll_paras + commentary
    cross = chart_engine_crosscheck(st)
    if cross:
        commentary.append(cross)

    if grade:
        commentary.append(f'성적 공개 — 최근 {grade["n"]}번의 방향 판단 중 '
                          f'{grade["hits"]}번이 5거래일 뒤 방향과 일치(적중률 {grade["pct"]}%). '
                          f'이 숫자는 매일 갱신, 악화돼도 그대로 공개.')
    if stale:
        commentary.insert(0, '주의 — 상류 데이터가 3일 이상 미갱신 상태로 오늘은 판단 미전진. '
                             '아래 내용은 마지막 정상 데이터 기준.')

    view = dict(
        generatedAtKST=now_kst(),
        # ISO(UTC) — 감시견이 신선도를 재는 필드. KST 문자열은 Date 파서가
        # 못 읽어서 감시 대상에 넣을 수가 없었다(2026-08-07 추가).
        generatedAt=datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
        dataDay=day,
        session=us_session_now(),
        beta=True,
        stanceChangedToday=changed,
        lifeline=(dict(count=ll['count'], broken=[n for n, b in ll['detail'] if b]) if ll else None),
        stanceStreak=streak,
        flow=flow,
        stale=stale,
        comp=dict(stance=st, stanceLabel=label, commentary=commentary,
                  confidence=('상' if gear >= 3 and sell < CFG['warn_sell'] else
                              '중' if not comp.get('stopped') else '하'),
                  # 2026-08-14 — 레버리지 카드가 "1배수 칸이 지금 몇 % 찼는가"를 말할 수
                  # 있게 내보낸다. 이 값이 없으면 레버리지 카드는 1배수 판단과 무관하게
                  # "신규 진입 가능"만 말하게 되고, 1배수 카드의 "더 사면 추격"과 충돌한다.
                  target=comp.get('target'), exposure=comp.get('exposure'),
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

    _sc = (load_scorecard() or [None])[0]
    _ca = load_chart_engine()
    desked = desk_with_fable(view, _sc, _ca)
    if desked:
        view['desked'] = desked

    # 주말이면 '새 주 전망'을 한 벌 더 굽는다. 주말당 한 번만 — 감시견이 주말에도
    # 워크플로를 여러 번 깨우므로, 직전 장 기준일(forDay)이 같으면 재사용한다.
    if us_market_weekend():
        _prev_wa = None
        try:
            with open(VIEW, encoding='utf-8') as _f:
                _prev_wa = (json.load(_f) or {}).get('weekAhead')
        except Exception:
            pass
        if _prev_wa and _prev_wa.get('forDay') == view.get('dataDay'):
            view['weekAhead'] = _prev_wa
            print('새 주 전망: 이번 주말 것 재사용 (forDay=%s)' % _prev_wa.get('forDay'))
        else:
            _wa = desk_week_ahead(view, _sc, _ca)
            if _wa:
                view['weekAhead'] = _wa
                print('새 주 전망: 새로 생성 (forDay=%s)' % _wa.get('forDay'))
            elif _prev_wa:
                view['weekAhead'] = _prev_wa

    # 자기 평가 문장 제거 — 데스크가 프롬프트를 어겨도 화면에는 못 나가게 한다.
    view = scrub_blame(view)
    _dk = view.get('desked') or {}
    if _dk and not _dk.get('headline'):
        # headline 이 통째로 자기 평가였던 경우 — 카드 제목이 비면 안 되므로
        # 스탠스 라벨로 대체한다(항상 존재하는 값).
        _dk['headline'] = (view.get('comp') or {}).get('stanceLabel') or '오늘의 판단'

    with open(LEDGER, 'w', encoding='utf-8') as f:
        json.dump(ledger, f, ensure_ascii=False, indent=1)
    view = _ez_scrub(view)          # 80항 — ' — ' → ' - '
    with open(VIEW, 'w', encoding='utf-8') as f:
        json.dump(view, f, ensure_ascii=False, indent=1)
    print(f'swing-view 생성: day={day} advanced={advanced} action={action} '
          f'stance={st} expo={comp.get("exposure")} target={comp.get("target")}')


if __name__ == '__main__':
    main()
