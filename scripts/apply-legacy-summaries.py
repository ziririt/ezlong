#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""옛 카드의 한 줄 요약을 다시 쓴다 — data/seed/legacy-summaries.json

왜 다시 쓰나
  손으로 쓴 옛 카드는 '~했다' 서술체다. 브리핑 카드는 전부 명사형 닷블릿이라,
  한 화면에서 두 문체가 갈렸다. 그리고 더 큰 문제 — 무슨 일이 있었는지는
  적혀 있는데 **그날 사람들이 어떤 상태였는지**가 빠져 있었다. 가격을 움직인
  건 결국 심리이고, 지나고 나면 그게 제일 안 남는다.

무엇을 바꾸나
  summary 한 줄만. 제목·importance·moves·source 는 건드리지 않는다.
  사실도 새로 만들지 않는다 — 있던 사실에 말끝과 심리 한 마디를 더한다.

멱등성
  같은 문장이면 건너뛴다. 몇 번을 돌려도 결과가 같다.

사용
  python3 scripts/apply-legacy-summaries.py
  python3 scripts/apply-legacy-summaries.py --dry
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, '..', 'data')
EVENTS = os.path.join(DATA, 'brief-history.json')
SEED = os.path.join(DATA, 'seed', 'legacy-summaries.json')


def main():
    dry = '--dry' in sys.argv
    with open(SEED, encoding='utf-8') as f:
        seed = {k: v for k, v in json.load(f).items() if not k.startswith('_')}
    with open(EVENTS, encoding='utf-8') as f:
        events = json.load(f)

    by_date = {}
    for e in events:
        by_date.setdefault(e['date'], []).append(e)

    changed, same, missing = 0, 0, []
    for d, text in seed.items():
        rows = by_date.get(d)
        if not rows:
            missing.append(d)
            continue
        # 그날 카드가 여럿이면 손으로 쓴 쪽(기록이 아닌 것)만 고친다
        targets = [e for e in rows if e.get('source') != 'own_archive'] or rows
        for e in targets:
            if (e.get('summary') or '') == text:
                same += 1
                continue
            e['summary'] = text
            changed += 1

    print(f'다시 쓴 요약 {changed} · 이미 같아 건너뜀 {same} · 카드 없는 날짜 {len(missing)}')
    if missing:
        print('  없음:', ' '.join(missing))
    if dry:
        print('--dry — 파일을 쓰지 않았다')
        return 0
    if changed:
        with open(EVENTS, 'w', encoding='utf-8') as f:
            json.dump(events, f, ensure_ascii=False, indent=1)
    return 0


if __name__ == '__main__':
    sys.exit(main())
