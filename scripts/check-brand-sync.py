#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""브랜드 원본이 앱 저장소와 어긋났는지 본다 (2026-08-07 신설).

배경 — 2026-08-06 하루에 나선 심볼이 두 번 바뀌었다. 앱(flipzen-weather-app)이
`scripts/brand-spiral.py` 로 곡선을 확정하고, 웹(ezlong)은 그 파일의 사본으로
파비콘·PWA·스플래시·헤더 로고를 굽는다. 사본이므로 한쪽만 고치면 웹 파비콘과
앱 아이콘이 서로 다른 그림이 된다 — 그날 실제로 웹만 옛 나선으로 남았고,
브랜드 패키지 세 벌(v1/v1.1/v1.2)을 전수 대조하고 나서야 원인을 찾았다.
사람이 눈으로 비교하는 방식은 다음에 또 놓친다.

무엇을 보는가
  · 두 저장소의 brand-spiral.py 기하 파라미터(TURNS/GROWTH/W_START/W_END/
    OCC/END_ANGLE)와 색 상수가 같은지
  · 다르면 어느 쪽이 새것인지(파일 mtime)까지 같이 알려준다

앱 저장소가 없는 환경(깃허브 액션 등)에서는 조용히 통과한다 — 비교 대상이
없는 것은 실패가 아니다.

사용
  python3 scripts/check-brand-sync.py
  APP_REPO=/다른/경로 python3 scripts/check-brand-sync.py
"""
import os
import re
import sys

KEYS = ('TURNS', 'GROWTH', 'OCC', 'END_ANGLE', 'W_START', 'W_END',
        'RAMP', 'TAPER_FROM', 'TIP', 'TEAL', 'INK', 'CORNER')

DEFAULT_APP = os.path.expanduser('~/Developer/flipzen-weather-app')


def params(path):
    """brand-spiral.py 에서 기하·색 상수만 뽑는다. import 하지 않는다 —
    PIL 이 없는 환경에서도 돌아야 하고, 실행 부작용도 피한다."""
    src = open(path, encoding='utf-8').read()
    out = {}
    # 한 줄에 여러 개를 묶어 대입하는 형태(TURNS, GROWTH, ... = 2.15, 3.2, ...) 포함
    for m in re.finditer(r'^([A-Z_][A-Z0-9_, ]*)\s*=\s*(.+?)$', src, re.M):
        names = [n.strip() for n in m.group(1).split(',') if n.strip()]
        vals = m.group(2).split('#')[0].strip()
        if len(names) > 1:
            parts, depth, cur = [], 0, ''
            for ch in vals:
                if ch in '([': depth += 1
                if ch in ')]': depth -= 1
                if ch == ',' and depth == 0:
                    parts.append(cur.strip()); cur = ''
                else:
                    cur += ch
            parts.append(cur.strip())
            if len(parts) != len(names):
                continue
            for n, v in zip(names, parts):
                if n in KEYS:
                    out[n] = v
        elif names[0] in KEYS:
            out[names[0]] = vals
    return out


def main():
    here = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    mine = os.path.join(here, 'scripts', 'brand-spiral.py')
    app_root = os.environ.get('APP_REPO', DEFAULT_APP)
    theirs = os.path.join(app_root, 'scripts', 'brand-spiral.py')

    if not os.path.isfile(mine):
        print('[건너뜀] 이 저장소에 scripts/brand-spiral.py 가 없다.')
        return 0
    if not os.path.isfile(theirs):
        print('[건너뜀] 앱 저장소를 못 찾았다 — 비교 대상 없음: %s' % theirs)
        return 0

    a, b = params(mine), params(theirs)
    diff = [k for k in KEYS if a.get(k) != b.get(k)]
    if not diff:
        print('[통과] 브랜드 원본이 앱과 같다 (%s)' % ', '.join(
            f'{k}={a[k]}' for k in ('TURNS', 'W_END') if k in a))
        return 0

    newer = '웹' if os.path.getmtime(mine) > os.path.getmtime(theirs) else '앱'
    print('[불일치] 브랜드 원본이 앱과 어긋났다 — %d개 항목:' % len(diff))
    for k in diff:
        print('  %-11s 웹 %-24s 앱 %s' % (k, a.get(k, '(없음)'), b.get(k, '(없음)')))
    print('\n파일 수정 시각은 %s 쪽이 더 최신이다.' % newer)
    print('새것을 기준으로 맞춘 뒤 자산을 다시 구울 것:')
    print('  cp %s %s' % (theirs, mine))
    print('  python3 scripts/build-web-brand.py')
    print('※ 웹만 고치고 앱을 안 고치면 파비콘과 앱 아이콘이 서로 다른 그림이 된다.')
    return 1


if __name__ == '__main__':
    sys.exit(main())
