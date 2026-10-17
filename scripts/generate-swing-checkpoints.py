#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""스윙 시그널 '다음 장 체크포인트' - 가격 기준선을 긋고, 다음 장에 채점한다.

왜 만들었나 (2026-10-18)
  일일 장마감 리포트(외부 모델 작성)의 가장 쓸모 있는 부분은 "이 가격이 깨지면 판이
  바뀐다"는 선이었다. 그런데 그 리포트의 숫자는 틀릴 때가 있었다(10-16: 테슬라 장중
  200일선 도달이라 썼지만 고가 370.50 은 200일선 387.99 에 닿지 않았다).
  그래서 선은 코드가 긋고, 다음 장이 끝나면 코드가 채점한다. 모델을 부르지 않는다.

기준선 후보 (전부 완결된 일봉에서만)
  · 20·50·200일 이동평균(종가)
  · 최근 60장 안의 전환점 저점·고점: 앞뒤 3장보다 낮은(높은) 장중 저가(고가). 날짜를 이름으로 쓴다.
  · 52주 저점·고점: 위아래에 다른 후보가 없을 때의 마지막 기준
  0.25% 안에 붙은 후보는 하나로 합친다(이름은 함께 적는다).

고르는 법
  위 저항 1개(가장 가까운 것), 아래 지지 2개(가장 가까운 것, 그보다 1% 이상 아래의 다음 것).
  종가에서 0.5% 안의 선은 고르지 않는다(실측: 0.01% 거리 선은 다음 장 이탈 확률 47% - 동전 던지기).

기저율 (91항)
  기준선까지의 거리를 그 종목의 최근 500장 하루 수익률 분포에 대 본다.
  "이 거리를 하루에 넘은 날이 평소 몇 %였나". 선이 쓸모 있는지는 이 숫자와 견줘야 보인다.

채점 (다음 완결 장 하나로)
  지지: 종가 >= 선 → 지킴(장중 저가가 선 아래였으면 '장중 이탈 후 회복')
        종가 <  선 → 이탈
  저항: 종가 <= 선 → 막힘(장중 고가가 선 위였으면 '장중 돌파 후 밀림')
        종가 >  선 → 돌파

소급 계산
  처음 실행할 때 지난 BACKFILL 장을 같은 규칙으로 소급해 채점해 둔다. 기준선은 그날까지의
  데이터만 쓰므로 미래 정보가 섞이지 않는다. 소급분은 `bf: true` 로 표시하고 화면도 밝힌다.

산출
  data/swing-checkpoints.json         지금 기준선 + 직전 채점 + 누적 성적
  data/swing-checkpoints-ledger.json  장별 기준선과 채점 원장 (최근 LEDGER_MAX 장)

사용
  python3 scripts/generate-swing-checkpoints.py
  python3 scripts/generate-swing-checkpoints.py --dry
"""
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    from ez_text import scrub as _ez_scrub
except Exception:
    def _ez_scrub(o):
        return o

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, '..', 'data')
OUT = os.path.join(DATA, 'swing-checkpoints.json')
LEDGER = os.path.join(DATA, 'swing-checkpoints-ledger.json')
ET = ZoneInfo('America/New_York')
KST = ZoneInfo('Asia/Seoul')

# 시장 탭은 세 지수(이 사이트는 S&P500 대표로 VOO 를 쓴다), TOP9 탭은 아홉 종목.
GROUPS = {
    'market': [('QQQ', '나스닥100'), ('VOO', 'S&P500'), ('SOXX', '반도체')],
    'top9': [('TSLA', '테슬라'), ('NVDA', '엔비디아'), ('AAPL', '애플'), ('GOOG', '알파벳'),
             ('MSFT', '마이크로소프트'), ('AMZN', '아마존'), ('TSM', 'TSMC'),
             ('AVGO', '브로드컴'), ('META', '메타')],
}
PIVOT_WIN = 3          # 전환점: 앞뒤 3장
PIVOT_LOOKBACK = 60    # 최근 60장 안의 전환점만
MERGE_PCT = 0.25       # 이 안에 붙은 후보는 합친다
S2_GAP_PCT = 1.0       # 둘째 지지는 첫째보다 이만큼 이상 아래
MIN_DIST_PCT = 0.5     # 종가에 이보다 붙은 선은 고르지 않는다 - 하루 흔들림 안이라 동전 던지기다
RET_WINDOW = 500       # 기저율에 쓰는 하루 수익률 표본
BACKFILL = 120         # 첫 실행 소급 채점 장 수
LEDGER_MAX = 260       # 약 1년. 한 장이 한 줄이라 git 차분이 작다


# ── 데이터 ────────────────────────────────────────────────────────────────
def load_bars(yf, sym, now_et):
    """완결된 일봉만 [(date_iso, o, h, l, c)]. 진행 중인 오늘 봉은 16:20 ET 전이면 버린다."""
    df = yf.Ticker(sym).history(period='3y', interval='1d', auto_adjust=False)
    if df is None or df.empty:
        return []
    bars = []
    for idx, r in df.iterrows():
        try:
            o, h, l, c = float(r['Open']), float(r['High']), float(r['Low']), float(r['Close'])
        except Exception:
            continue
        if not (c > 0 and h >= l > 0):
            continue
        bars.append((idx.tz_convert(ET).date().isoformat() if idx.tzinfo else idx.date().isoformat(),
                     o, h, l, c))
    if bars and bars[-1][0] == now_et.date().isoformat() and \
            (now_et.hour, now_et.minute) < (16, 20):
        bars.pop()
    return bars


# ── 기준선 ────────────────────────────────────────────────────────────────
def sma(vals, n):
    return sum(vals[-n:]) / n if len(vals) >= n else None


def md_label(iso):
    d = datetime.strptime(iso, '%Y-%m-%d')
    return f'{d.month}월 {d.day}일'


def candidates(bars):
    """bars[-1] 이 기준일. 그날까지의 데이터만 쓴다."""
    closes = [b[4] for b in bars]
    out = []
    for n, name in ((20, '20일선'), (50, '50일선'), (200, '200일선')):
        v = sma(closes, n)
        if v:
            out.append((v, name, 'ma'))
    last = len(bars) - 1
    lo_i = max(PIVOT_WIN, last - PIVOT_LOOKBACK)
    for i in range(lo_i, last - PIVOT_WIN + 1):
        win = bars[i - PIVOT_WIN:i + PIVOT_WIN + 1]
        if bars[i][3] == min(b[3] for b in win):
            out.append((bars[i][3], md_label(bars[i][0]) + ' 저점', 'pivot'))
        if bars[i][2] == max(b[2] for b in win):
            out.append((bars[i][2], md_label(bars[i][0]) + ' 고점', 'pivot'))
    yr = bars[-252:]
    out.append((min(b[3] for b in yr), '52주 저점', 'ext'))
    out.append((max(b[2] for b in yr), '52주 고점', 'ext'))
    return out


def merge(cands):
    """0.25% 안의 후보를 하나로. 값은 먼저 온(이동평균 우선) 것을 쓴다."""
    order = {'ma': 0, 'pivot': 1, 'ext': 2}
    cands = sorted(cands, key=lambda x: (order[x[2]], x[0]))
    merged = []
    for v, name, kind in cands:
        for m in merged:
            if abs(v / m['v'] - 1) * 100 <= MERGE_PCT:
                if name not in m['names']:
                    m['names'].append(name)
                break
        else:
            merged.append({'v': v, 'names': [name], 'kind': kind})
    return merged


def base_rate(closes, dist_pct, side):
    """그 종목의 최근 하루 수익률로 본, 하루에 이 거리를 넘은 날의 비율(%)."""
    rets = [(closes[i] / closes[i - 1] - 1) * 100 for i in range(max(1, len(closes) - RET_WINDOW), len(closes))]
    if len(rets) < 100:
        return None
    if side == 'support':
        hit = sum(1 for r in rets if r < dist_pct)
    else:
        hit = sum(1 for r in rets if r > dist_pct)
    return hit / len(rets) * 100


def levels_for(bars):
    close = bars[-1][4]
    closes = [b[4] for b in bars]
    m = merge(candidates(bars))
    far = lambda x: abs(x['v'] / close - 1) * 100 >= MIN_DIST_PCT
    above = sorted([x for x in m if x['v'] > close and far(x)], key=lambda x: x['v'])
    below = sorted([x for x in m if x['v'] < close and far(x)], key=lambda x: -x['v'])
    # 52주 극값은 다른 후보가 없을 때만 쓴다
    above = [x for x in above if x['kind'] != 'ext'] or above[:1]
    below_ne = [x for x in below if x['kind'] != 'ext']
    picks = []
    if above:
        picks.append(('resistance', above[0]))
    s = below_ne or below[:1]
    if s:
        picks.append(('support', s[0]))
        nxt = [x for x in below if x['v'] <= s[0]['v'] * (1 - S2_GAP_PCT / 100)]
        if nxt:
            picks.append(('support', nxt[0]))
    out = []
    for side, x in picks:
        dist = (x['v'] / close - 1) * 100
        br = base_rate(closes, dist, side)
        out.append({'side': side, 'v': round(x['v'], 2), 'name': ' · '.join(x['names']),
                    'dist': round(dist, 2), 'base': None if br is None else round(br),
                    'baseRaw': None if br is None else round(br, 3)})
    return out


def score(level, bar):
    _, o, h, l, c = bar
    v = level['v']
    if level['side'] == 'support':
        if c >= v:
            return 'held_wick' if l < v else 'held'
        return 'broken'
    if c <= v:
        return 'capped_wick' if h > v else 'capped'
    return 'broken'


# ── 원장 ──────────────────────────────────────────────────────────────────
def load_json(path, default):
    try:
        with open(path, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


def item_for(bars, upto_iso):
    cut = [b for b in bars if b[0] <= upto_iso]
    if len(cut) < 220 or cut[-1][0] != upto_iso:
        return None
    return {'close': round(cut[-1][4], 2), 'levels': levels_for(cut)}


def entry_for(bars_by, upto_iso, bf=False):
    """upto_iso(포함)까지의 데이터로 그날의 기준선을 만든다."""
    e = {'session': upto_iso, 'bf': bf, 'items': {}}
    fill_entry(e, bars_by)
    return e


def fill_entry(e, bars_by):
    """이번 회차에 시세를 받았는데 그날 항목이 없는 종목을 채운다(앞 회차에서 받기 실패).
    그날까지의 데이터로만 만들므로 미래 정보는 섞이지 않는다."""
    n = 0
    for sym, bars in bars_by.items():
        if sym in e['items']:
            continue
        it = item_for(bars, e['session'])
        if it:
            e['items'][sym] = it
            n += 1
    return n


def split_guard(it, bars, session):
    """액면분할 뒤에는 과거 가격이 소급 조정된다. 저장해 둔 그날 종가와 지금 받은
    그날 종가가 1% 넘게 다르면 저장값을 같은 비율로 맞춘다(배당은 auto_adjust=False 라 무관)."""
    b = next((x for x in bars if x[0] == session), None)
    if not b or not it.get('close'):
        return
    ratio = b[4] / it['close']
    if abs(ratio - 1) > 0.01:
        it['close'] = round(it['close'] * ratio, 2)
        for lv in it['levels']:
            lv['v'] = round(lv['v'] * ratio, 2)
        it['adj'] = round(ratio, 6)


def score_entry(e, bars_by):
    """종목마다 따로, e 다음의 첫 완결 장으로 채점한다. 한 종목의 실패가 나머지를 막지 않는다.
    시세를 받은 종목이 전부 채점되면 그 장을 채점 완료로 본다."""
    changed = False
    for sym, it in e['items'].items():
        if it.get('next') or sym not in bars_by:
            continue
        split_guard(it, bars_by[sym], e['session'])
        nb = next((b for b in bars_by[sym] if b[0] > e['session']), None)
        if not nb:
            continue
        it['next'] = {'session': nb[0], 'close': round(nb[4], 2), 'high': round(nb[2], 2), 'low': round(nb[3], 2)}
        for lv in it['levels']:
            lv['result'] = score(lv, nb)
        changed = True
    live = [it for s, it in e['items'].items() if s in bars_by]
    if not e.get('scoredWith') and live and all(it.get('next') for it in live):
        e['scoredWith'] = min(it['next']['session'] for it in live)
        changed = True
    return changed


def record(entries, syms):
    rec = {'support': {'n': 0, 'held': 0, 'exp': 0.0}, 'resistance': {'n': 0, 'held': 0, 'exp': 0.0},
           'from': None, 'to': None, 'sessions': 0, 'bfSessions': 0}
    for e in entries:
        scored = [it for s, it in e['items'].items() if s in syms and it.get('next')]
        if not scored:
            continue
        rec['sessions'] += 1
        rec['bfSessions'] += 1 if e.get('bf') else 0
        rec['from'] = rec['from'] or e['session']
        rec['to'] = e['session']
        for it in scored:
            for lv in it['levels']:
                if not lv.get('result'):
                    continue
                r = rec[lv['side']]
                r['n'] += 1
                r['held'] += 1 if lv['result'] in ('held', 'held_wick', 'capped', 'capped_wick') else 0
                b = lv.get('baseRaw', lv.get('base'))
                if b is not None:
                    r['exp'] += 1 - b / 100
    for k in ('support', 'resistance'):
        r = rec[k]
        r['rate'] = round(r['held'] / r['n'] * 100) if r['n'] else None
        r['expRate'] = round(r['exp'] / r['n'] * 100) if r['n'] else None
        del r['exp']
    return rec


def main():
    dry = '--dry' in sys.argv
    force = '--force' in sys.argv
    try:
        import yfinance as yf
    except ImportError:
        print('::error::yfinance 없음')
        return 1
    now_et = datetime.now(ET)
    bars_by, failed = {}, []
    for group in GROUPS.values():
        for sym, _ in group:
            try:
                b = load_bars(yf, sym, now_et)
            except Exception as e:                           # noqa: BLE001
                b = []
                print(f'  {sym} 실패: {str(e)[:60]}')
            if len(b) >= 260:
                bars_by[sym] = b
            else:
                failed.append(sym)
    if not bars_by:
        print('::error::시세를 하나도 못 받았다 - 기존 파일 유지')
        return 1
    if failed:
        print('::warning::시세 부족(이번 회차 제외): ' + ', '.join(failed))

    # 기준일 = 세 지수가 함께 가진 마지막 완결 장
    mk = [s for s, _ in GROUPS['market'] if s in bars_by]
    session = min(bars_by[s][-1][0] for s in mk) if mk else max(b[-1][0] for b in bars_by.values())

    ledger = load_json(LEDGER, {'entries': []})
    entries = ledger.get('entries') or []

    if not entries:
        # 첫 실행: 지난 BACKFILL 장을 소급
        days = [b[0] for b in bars_by[mk[0] if mk else next(iter(bars_by))]]
        days = [d for d in days if d < session][-BACKFILL:]
        for d in days:
            entries.append(entry_for(bars_by, d, bf=True))
        print(f'소급 기준선 {len(entries)}장 생성')

    # 빠진 장 메우기: 마지막 원장 장 다음부터 이번 기준일까지(실행이 하루 이틀 빠졌을 때)
    have = {e['session'] for e in entries}
    ref_days = [b[0] for b in bars_by[mk[0] if mk else next(iter(bars_by))]]
    last_have = entries[-1]['session'] if entries else ''
    gap = [d for d in ref_days if last_have < d <= session and d not in have]
    if force and session in have:
        entries = [e for e in entries if e['session'] != session]
        gap = sorted(set(gap) | {session})
    for d in gap:
        entries.append(entry_for(bars_by, d))
    if len(gap) > 1:
        print(f'빠진 장 {len(gap) - 1}개를 메웠다: {", ".join(gap[:-1])}')
    entries.sort(key=lambda e: e['session'])

    filled = sum(fill_entry(e, bars_by) for e in entries)
    if filled:
        print(f'앞 회차에 빠졌던 종목 항목 {filled}개를 채웠다')
    for e in entries:
        score_entry(e, bars_by)
    entries = entries[-LEDGER_MAX:]

    cur = entries[-1]
    prev = next((e for e in reversed(entries[:-1]) if e.get('scoredWith')), None)
    names = {s: n for g in GROUPS.values() for s, n in g}
    view = {
        'session': cur['session'],
        'groups': {g: [{'sym': s, 'name': names[s], **cur['items'][s]}
                       for s, _ in lst if s in cur['items']] for g, lst in GROUPS.items()},
        'last': None,
        'record': {g: record(entries, {s for s, _ in lst}) for g, lst in GROUPS.items()},
        'generatedAt': datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'),
        'generatedKST': datetime.now(KST).strftime('%Y-%m-%d %H:%M KST'),
        'method': '기준선과 채점은 코드가 완결 일봉으로 계산한다. 모델을 쓰지 않는다.',
    }
    if prev:
        view['last'] = {'session': prev['session'], 'scoredWith': prev['scoredWith'],
                        'items': {s: {'close': it['close'], 'next': it.get('next'),
                                      'levels': it['levels']} for s, it in prev['items'].items()}}

    r = view['record']['market']
    print(f"기준일 {view['session']} · 종목 {len(cur['items'])} · 누적 {r['sessions']}장"
          f"(소급 {r['bfSessions']}) · 지지 유지 {r['support']['rate']}% (거리 기저 {r['support']['expRate']}%)"
          f" · 저항 막힘 {r['resistance']['rate']}% (거리 기저 {r['resistance']['expRate']}%)")
    for g, lst in view['groups'].items():
        for it in lst:
            print(f"  {it['sym']:5} {it['close']:>9} " + ' | '.join(
                f"{'R' if l['side'] == 'resistance' else 'S'} {l['v']} {l['name']} ({l['dist']:+.2f}%, {l['base']}%)"
                for l in it['levels']))
    if dry:
        print('--dry - 파일을 쓰지 않았다')
        return 0
    # 같은 장을 다시 돌았을 뿐이면(감시견 재실행 등) 파일을 건드리지 않는다
    old = load_json(OUT, {})
    same = {k: v for k, v in old.items() if k not in ('generatedAt', 'generatedKST')} == \
        {k: v for k, v in _ez_scrub(json.loads(json.dumps(view))).items() if k not in ('generatedAt', 'generatedKST')}
    if same and not force and os.path.exists(LEDGER):
        print('바뀐 것 없음 - 파일 유지')
        return 0
    # 한 장 = 한 줄. 매일 한두 줄만 바뀌므로 저장소가 날마다 통째로 불어나지 않는다.
    with open(LEDGER, 'w', encoding='utf-8') as f:
        f.write('{"_설명":"스윙 시그널 다음 장 체크포인트 원장. scripts/generate-swing-checkpoints.py",\n"entries":[\n')
        f.write(',\n'.join(json.dumps(e, ensure_ascii=False, separators=(',', ':')) for e in entries))
        f.write('\n]}\n')
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(_ez_scrub(view), f, ensure_ascii=False, indent=1)
    return 0


if __name__ == '__main__':
    sys.exit(main())
