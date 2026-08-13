#!/usr/bin/env python3
"""브리프 히스토리 순위 배지 데이터 생성 (2026-08-14 신설)

무엇을 만드나
  data/brief-history-ranks.json — QQQ 등락률 기준 상승 상위 20일 · 하락 상위 20일,
  그리고 각 날짜의 '반대 방향 이웃'(±5거래일 안에 있는 반대편 상위 20일).

왜 40일만 하나
  596개 이벤트 전부에 순위를 붙이면 순위가 아무 말도 안 하게 된다. 40일만
  특별해야 그 40일이 특별해진다. 배지가 붙지 않은 날은 그냥 안 붙는다.

왜 이웃을 같이 보나
  이 코너가 하려는 말이 "폭락과 폭등은 붙어 다닌다"이기 때문이다. 하락 1위
  2020-03-16 은 바로 앞 거래일이 상승 2위, 바로 뒤 거래일이 상승 4위다.
  숫자 하나로는 안 보이고 이웃을 같이 놔야 보인다. 앞뒤 ±5거래일을 다 본다.

동결 규칙
  화면 순위는 매번 다시 계산한다 — 새 폭락일이 생겼는데 화면이 옛 순위를 들고
  있으면 그게 거짓말이다. 대신 책 인용용으로 data/brief-history-ranks-snapshot.json
  을 딱 한 번 만들고 그 뒤로는 절대 덮어쓰지 않는다. 책에는 스냅샷의 기준일을
  함께 적으면 나중에 순위가 바뀌어도 인용이 틀리지 않는다.
"""

import json
import os
from datetime import datetime, timezone, timedelta

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EVENTS = os.path.join(ROOT, 'data', 'brief-history.json')
CHART = os.path.join(ROOT, 'data', 'brief-history-chart.json')
OUT = os.path.join(ROOT, 'data', 'brief-history-ranks.json')
SNAPSHOT = os.path.join(ROOT, 'data', 'brief-history-ranks-snapshot.json')

TOP_N = 20          # 각 방향 상위 몇 일까지 배지를 다나
NEAR_DAYS = 5       # 이웃으로 인정하는 거래일 간격 (앞뒤 모두)
NEAR_MAX = 2        # 한 카드에 붙이는 이웃 개수 상한 — 한 줄을 넘기지 않게


def load(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def qqq_move(ev):
    """순위 기준은 QQQ 하나로 고정한다.

    SPY 나 SOXX 로 보조하면 날마다 잣대가 달라져 순위가 비교 불가능해진다.
    QQQ 가 없는 이벤트는 순위에서 아예 뺀다(현재 596건 중 25건, 모두 2020년
    초반 항목이고 상·하위 20위권에는 하나도 걸리지 않는다).
    """
    moves = ev.get('moves') or {}
    v = moves.get('QQQ')
    return v if isinstance(v, (int, float)) else None


def build():
    events = load(EVENTS)
    chart = load(CHART)
    trading_days = chart.get('dates') or []
    tidx = {d: i for i, d in enumerate(trading_days)}

    # 같은 날짜에 이벤트가 둘 이상일 수 있다 — 순위는 날짜 단위이므로 하나로 접는다.
    by_date = {}
    for ev in events:
        v = qqq_move(ev)
        if v is None:
            continue
        by_date.setdefault(ev['date'], v)

    rows = sorted(by_date.items(), key=lambda kv: kv[1])
    downs = rows[:TOP_N]                      # 낙폭이 큰 순
    ups = list(reversed(rows[-TOP_N:]))       # 상승폭이 큰 순

    down_rank = {d: i + 1 for i, (d, _) in enumerate(downs)}
    up_rank = {d: i + 1 for i, (d, _) in enumerate(ups)}

    def gap(a, b):
        """a 기준으로 b 가 몇 거래일 떨어져 있나. 양수면 b 가 뒤."""
        if a not in tidx or b not in tidx:
            return None
        return tidx[b] - tidx[a]

    def neighbors(date, opposite_rank):
        out = []
        for od, orank in opposite_rank.items():
            g = gap(date, od)
            if g is None or g == 0 or abs(g) > NEAR_DAYS:
                continue
            out.append({'date': od, 'rank': orank, 'gap': g})
        # 가까운 것부터. 같은 거리면 순위가 높은(숫자가 작은) 쪽을 먼저 — 더 센 사건이다.
        out.sort(key=lambda x: (abs(x['gap']), x['rank']))
        return out[:NEAR_MAX]

    ranks = {}
    for date, pct in downs:
        ranks[date] = {
            'dir': 'down',
            'rank': down_rank[date],
            'pct': round(pct, 2),
            'near': [dict(n, dir='up') for n in neighbors(date, up_rank)],
        }
    for date, pct in ups:
        ranks[date] = {
            'dir': 'up',
            'rank': up_rank[date],
            'pct': round(pct, 2),
            'near': [dict(n, dir='down') for n in neighbors(date, down_rank)],
        }

    now = datetime.now(timezone.utc)
    payload = {
        'basis': 'QQQ 일간 등락률',
        'topN': TOP_N,
        'nearDays': NEAR_DAYS,
        'from': trading_days[0] if trading_days else None,
        'to': trading_days[-1] if trading_days else None,
        'sampleDays': len(by_date),
        'generatedAt': now.strftime('%Y-%m-%dT%H:%M:%SZ'),
        'updatedKST': (now + timedelta(hours=9)).strftime('%Y-%m-%d %H:%M KST'),
        'ranks': ranks,
    }

    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, separators=(',', ':'))
    print(f"  순위 데이터: 하락 {len(downs)}일 + 상승 {len(ups)}일 = {len(ranks)}일")
    near_cnt = sum(1 for v in ranks.values() if v['near'])
    print(f"  이웃이 붙는 날: {near_cnt}일 / {len(ranks)}일")

    # 책 인용용 동결 스냅샷 — 한 번 만들면 다시 건드리지 않는다.
    if not os.path.exists(SNAPSHOT):
        snap = dict(payload)
        snap['frozen'] = True
        snap['frozenAt'] = payload['updatedKST']
        snap['note'] = ('책·인쇄물 인용용 동결본. 화면(brief-history-ranks.json)은 '
                        '새 데이터가 들어오면 다시 계산되지만 이 파일은 갱신하지 않는다.')
        with open(SNAPSHOT, 'w', encoding='utf-8') as f:
            json.dump(snap, f, ensure_ascii=False, indent=1)
        print(f"  동결 스냅샷 생성: {SNAPSHOT}")
    else:
        print("  동결 스냅샷 이미 존재 — 건드리지 않음")


if __name__ == '__main__':
    print("=== 브리프 히스토리 순위 배지 생성 ===")
    build()
    print("=== 완료 ===")
