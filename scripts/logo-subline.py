# -*- coding: utf-8 -*-
"""서브라인 'ezlong.com' 자간 축소 + 색 분리.

락업이 v1.2에서 글자를 전부 패스로 아웃라인 처리했기 때문에 letter-spacing 을
CSS/SVG 속성으로 못 고친다. 대신 패스를 글자 단위로 쪼개서 각 글자를 왼쪽으로
당겨 붙인다 — 서체 모양은 원본 그대로 두고 간격만 바꾸는 방식이다.
"""
import re, sys

NUM = re.compile(r'-?\d*\.?\d+(?:[eE][-+]?\d+)?')

def subpaths(d):
    """M 으로 시작하는 서브패스 단위로 자른다."""
    idx = [m.start() for m in re.finditer(r'[Mm]', d)]
    return [d[a:b] for a, b in zip(idx, idx[1:] + [len(d)])]

def xrange_of(sp):
    """절대 명령(M/L/H/V/C/Z)만 쓰는 패스의 x 최소·최대."""
    xs = []
    for m in re.finditer(r'([MLHVCSQTAZmlhvcsqtaz])([^A-Za-z]*)', sp):
        cmd, args = m.group(1), m.group(2)
        n = [float(x) for x in NUM.findall(args)]
        if cmd == 'M' or cmd == 'L':
            xs += n[0::2]
        elif cmd == 'H':
            xs += n
        elif cmd == 'C':
            xs += n[0::2]
        # V, Z 는 x 를 바꾸지 않는다
    return (min(xs), max(xs)) if xs else None

def shift_x(sp, dx):
    """x 좌표만 dx 만큼 이동."""
    out = []
    for m in re.finditer(r'([MLHVCSQTAZmlhvcsqtaz])([^A-Za-z]*)', sp):
        cmd, args = m.group(1), m.group(2)
        if cmd in 'VZ':
            out.append(cmd + args)
            continue
        n = [float(x) for x in NUM.findall(args)]
        if cmd == 'H':
            n = [v + dx for v in n]
        else:
            n = [(v + dx) if i % 2 == 0 else v for i, v in enumerate(n)]
        out.append(cmd + ' '.join(f'{v:.4f}' for v in n))
    return ''.join(out)

def regroup(d, tighten):
    """서브패스를 글자로 묶고, 글자 사이 간격을 tighten 만큼 줄인다."""
    sps = subpaths(d)
    items = [(xrange_of(sp), sp) for sp in sps]
    items = [it for it in items if it[0]]
    items.sort(key=lambda it: it[0][0])

    # x 구간이 겹치면 같은 글자(예: 'e' 바깥/안쪽 윤곽)
    glyphs = []
    for (x0, x1), sp in items:
        if glyphs and x0 <= glyphs[-1]['x1'] + 0.2:
            glyphs[-1]['x1'] = max(glyphs[-1]['x1'], x1)
            glyphs[-1]['sps'].append(sp)
        else:
            glyphs.append({'x0': x0, 'x1': x1, 'sps': [sp]})

    out, shift = [], 0.0
    for i, g in enumerate(glyphs):
        if i > 0:
            shift -= tighten
        out += [shift_x(sp, shift) for sp in g['sps']]
    return ''.join(out), len(glyphs)

if __name__ == '__main__':
    SRC = '/home/claude/brand12/longtime-easylife-brand/05-logo/'
    K = 2.552            # 심볼 하단선까지 키운 배율 (직전 커밋에서 확정)
    SUB_X0, SUB_Y0, SUB_Y1 = 185.5, 112.2, 126.5
    TOP = 112.0
    TIGHTEN = float(sys.argv[1]) if len(sys.argv) > 1 else 3.2   # 원본 단위 기준 자간 축소량
    COLORS = {'#7A8798': sys.argv[2] if len(sys.argv) > 2 else '#0E9384',
              '#BFCBD4': sys.argv[3] if len(sys.argv) > 3 else '#4FD1C5'}
    tx, ty = SUB_X0 * (1 - K), TOP - SUB_Y0 * K
    for name in ('logo-h-longname-color.svg', 'logo-h-longname-white.svg'):
        s = open(SRC + name, encoding='utf-8').read()
        P = list(re.finditer(r'<path\b[^>]*?/>', s, re.S))
        sub = P[2].group(0)
        d = re.search(r'\sd="([^"]*)"', sub).group(1)
        of = re.search(r'fill="(#[0-9A-Fa-f]{6})"', sub).group(1)
        nd, ng = regroup(d, TIGHTEN)
        newsub = f'<path d="{nd}" fill="{COLORS[of]}"/>'
        wrapped = f'<g transform="translate({tx:.3f},{ty:.3f}) scale({K})">{newsub}</g>'
        open('/home/claude/logo-build/rs-' + name, 'w', encoding='utf-8').write(
            s[:P[2].start()] + wrapped + s[P[2].end():])
        print(name, '글자 수', ng, of, '→', COLORS[of])
