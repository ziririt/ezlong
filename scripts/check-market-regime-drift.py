#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""과거가 통째로 흔들렸는지 본다.

왜 필요한가
  이 파이프라인은 원시 데이터를 저장소에 두지 않고 매일 전 구간을 다시 받는다
  (파케이를 커밋하면 하루 수 MB씩 저장소가 불어난다). 그 대가로, 공급자가
  과거 값을 손대거나 심볼 구성이 바뀌면 어제와 오늘의 히스토리가 통째로
  달라질 수 있다. 그건 갱신이 아니라 사고인데 **에러가 나지 않는다** —
  숫자만 조용히 바뀌고 화면은 멀쩡해 보인다.

무엇을 재나
  git 에 들어 있던 직전 히스토리와 방금 만든 히스토리를 겹치는 날짜에서
  비교한다. 마지막 하루는 뺀다(장이 끝나며 값이 확정되는 자리라 정상적으로
  바뀐다). 나머지에서 0.5% 넘게 달라진 날이 전체의 1%를 넘으면 멈춘다.

  기준을 0 으로 두지 않은 이유 — 수정주가는 배당락마다 과거가 조금씩
  다시 계산된다. 그건 정상이다. 우리가 잡으려는 건 '조금'이 아니라 '통째로'다.

사용
  python3 scripts/check-market-regime-drift.py
"""
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
REL = 'data/market-regime-history.json'
TOL = 0.005      # 하루치 허용 오차 — 0.5%
MAX_BAD = 0.01   # 이보다 많은 날이 흔들리면 사고로 본다 — 1%


def prev_version():
    r = subprocess.run(['git', 'show', f'HEAD:{REL}'], cwd=ROOT,
                       capture_output=True, text=True, timeout=60)
    if r.returncode != 0 or not r.stdout.strip():
        return None
    try:
        return json.loads(r.stdout)
    except ValueError:
        return None


def main():
    with open(os.path.join(ROOT, REL), encoding='utf-8') as f:
        cur = json.load(f)
    old = prev_version()
    if not old:
        print('직전 히스토리가 없다 — 첫 실행으로 보고 통과')
        return 0

    old_map = {d: i for i, d in enumerate(old['dates'])}
    keys = ('spy', 'qqq', 'soxx')
    checked = 0
    bad = []
    # 마지막 하루는 정상적으로 바뀐다 — 비교에서 뺀다
    for i, d in enumerate(cur['dates'][:-1]):
        j = old_map.get(d)
        if j is None:
            continue
        checked += 1
        for k in keys:
            a, b = cur[k][i], old[k][j]
            if a is None or b is None or not b:
                continue
            if abs(a - b) / abs(b) > TOL:
                bad.append((d, k, b, a))
                break

    if not checked:
        print('::warning::겹치는 날짜가 없다 — 비교를 건너뛴다')
        return 0

    ratio = len(bad) / checked
    print(f'겹치는 날 {checked:,}일 · 0.5% 넘게 달라진 날 {len(bad):,}일 ({ratio*100:.2f}%)')
    if ratio > MAX_BAD:
        print('::error::과거 값이 통째로 흔들렸다 — 이번 결과를 쓰지 않는다')
        for d, k, b, a in bad[:10]:
            print(f'  {d} {k}: {b} → {a}')
        return 1
    if bad:
        print('  예시:', ' / '.join(f'{d} {k} {b}→{a}' for d, k, b, a in bad[:3]))
    return 0


if __name__ == '__main__':
    sys.exit(main())
