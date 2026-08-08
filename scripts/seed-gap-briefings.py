#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""글이 없던 구간의 빈 거래일을 브리핑으로 채운다.

무엇을 채우나
  네이버 채널 글이 시작되기 전 구간은 날짜축이 통째로 비어 있다. 특히
  2022년 1~2월(약세장의 시작)과 2022년 11월~2023년 1월 초(바닥과 반등의
  갈림길)는 차트에서 가장 많이 들여다보는 구간인데 카드가 거의 없었다.
  그 구간의 **모든 거래일**에 '그날 주가를 움직인 재료'를 얹는다.

무엇을 근거로 쓰나
  각 날짜의 미국 증시 마감 정리 기사(로이터·CNBC·야후파이낸스·Zacks 등)를
  찾아 거기 실린 수치만 옮겼다. 기억으로 수치를 만들지 않았고, 확인하지
  못한 날은 확인된 사실만 남겼다. 지수 등락(moves)은 서술이 아니라
  data/brief-history-chart.json 에서 계산한다 — 기사와 우리 차트의 기준이
  다를 수 있으므로 화면에 뜨는 숫자는 항상 우리 데이터에서 나온다.

멱등성
  이미 카드가 있는 날은 건너뛴다. 몇 번을 돌려도 결과가 같다.

사용
  python3 scripts/seed-gap-briefings.py            # 적용
  python3 scripts/seed-gap-briefings.py --dry      # 미리보기
  python3 scripts/seed-gap-briefings.py --file X   # 다른 입력 파일로
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, '..', 'data')
EVENTS = os.path.join(DATA, 'brief-history.json')
CHART = os.path.join(DATA, 'brief-history-chart.json')
SEED = os.path.join(DATA, 'seed', 'gap-briefings.json')

MOVE_SYMBOLS = [('QQQ', 'QQQ'), ('SPY', 'SPY(VOO)'), ('SOXX', 'SOXX')]
CATS = {
    'fed_policy', 'geopolitics', 'trade_tariff', 'macro_data',
    'earnings_bellwether', 'vix_risk_sentiment', 'oil_energy', 'dollar_fx',
    'rates_treasury', 'ai_tech_valuation', 'supply_chain', 'company_specific',
    'other',
}
TONES = {'pos', 'neg', 'neu'}


def load(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def build_moves(chart, date_str):
    try:
        i = chart['dates'].index(date_str)
    except ValueError:
        return None
    if i == 0:
        return {}
    out = {}
    for key, label in MOVE_SYMBOLS:
        series = chart.get(key)
        if not series or i >= len(series) or not series[i - 1]:
            continue
        out[label] = round((series[i] / series[i - 1] - 1) * 100, 2)
    return out


def main():
    argv = sys.argv[1:]
    dry = '--dry' in argv
    src = argv[argv.index('--file') + 1] if '--file' in argv else SEED

    rows = load(src)
    events = load(EVENTS)
    chart = load(CHART)
    have = {e['date'] for e in events}

    added, skipped, missing, bad = [], 0, [], []
    for r in rows:
        d = r['date']
        if d in have:
            skipped += 1
            continue
        moves = build_moves(chart, d)
        if moves is None:
            missing.append(d)
            continue
        groups = []
        for g in r['groups']:
            if g['tone'] not in TONES or g['cat'] not in CATS:
                bad.append((d, g.get('tone'), g.get('cat')))
                continue
            groups.append({
                'heading': g['heading'],
                'tone': g['tone'],
                'cat': g['cat'],
                'points': list(g['points']),
            })
        if not groups:
            bad.append((d, 'no-groups', ''))
            continue
        added.append({
            'date': d,
            'title': r['title'],
            'summary': '',
            'summaryGroups': groups,
            'cats': sorted({g['cat'] for g in groups}),
            'importance': 2,
            'moves': moves,
            'link': None,
            'source': 'external_knowledge',
        })

    if bad:
        print('::error::허용되지 않은 값 — 중단')
        for b in bad[:10]:
            print('  ', b)
        return 1

    merged = events + added
    merged.sort(key=lambda e: e['date'])
    print(f'추가 {len(added)}일 · 이미 있어 건너뜀 {skipped} · 차트에 없는 날짜 {len(missing)}')
    if missing:
        print('  차트에 없음:', ' '.join(missing[:10]))
    print(f'이슈 총 {len(merged)}건')

    if dry:
        print('--dry — 파일을 쓰지 않았다')
        return 0
    with open(EVENTS, 'w', encoding='utf-8') as f:
        json.dump(merged, f, ensure_ascii=False, indent=1)
    return 0


if __name__ == '__main__':
    sys.exit(main())
