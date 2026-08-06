#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""ezlong.com 브랜드 자산을 나선 하나에서 전부 다시 굽는다 (2026-08-06 신설).

원본은 scripts/brand-spiral.py 의 곡선 하나뿐이다. 파비콘·PWA 아이콘·
maskable·iOS 스플래시·공유카드·헤더 로고가 전부 여기서 파생된다. 아이콘을
바꿀 일이 생기면 brand-spiral.py 의 파라미터만 고치고 이걸 다시 돌린다 —
자산을 손으로 하나씩 갈아끼우지 말 것. 그렇게 하면 반드시 어딘가 빠진다.

★ 앱(flipzen-weather-app)도 같은 brand-spiral.py 를 쓴다. 두 사본이 어긋나면
  웹 파비콘과 앱 아이콘이 서로 다른 그림이 된다. 고칠 때 양쪽을 같이 고친다.

글자(워드마크·서브라인)는 브랜드 패키지에서 이미 패스로 아웃라인된 것을
assets/brand/*.svg 템플릿째 가져다 쓴다. 다시 조판하지 않으므로 폰트 설치가
필요 없고, 대신 SVG 를 그림으로 만들 렌더러가 필요하다(headless chromium).

사용:
  python3 scripts/build-web-brand.py              # 전체
  python3 scripts/build-web-brand.py --icons      # 아이콘만 (렌더러 불필요)
"""
import importlib.util
import json
import os
import re
import subprocess
import sys

import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
TPL = os.path.join(ROOT, 'assets', 'brand')

_spec = importlib.util.spec_from_file_location('bs', os.path.join(HERE, 'brand-spiral.py'))
bs = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(bs)

PWA_SIZES = (72, 96, 128, 144, 152, 180, 192, 384, 512)
SPLASH = ['1320x2868', '1290x2796', '1206x2622', '1179x2556', '1284x2778',
          '1170x2532', '1125x2436', '1242x2688', '828x1792', '750x1334',
          '2048x2732', '1668x2388', '1640x2360', '1536x2048']

# ── 서브라인 'ezlong.com' 조정값 (2026-08-06 확정) ─────────────────────────
# 락업 원본은 서브라인이 워드마크의 35% 라 헤더(24~38px)에서 글자가 3px 대로
# 뭉개졌다. 심볼 하단선까지 키우고(SCALE), 윗줄 길이에 맞추려던 늘린 자간을
# 걷어내고(TIGHTEN), 워드마크와 색을 갈라 두 줄이 한 덩어리로 안 보이게 한다.
SUB_BBOX = (185.5, 112.2, 299.2, 126.5)   # 원본 락업 좌표계에서 실측
SUB_TOP = 112.0                            # 워드마크 아래 간격
SUB_SCALE = 2.552                          # 서브라인 하단 = 심볼 하단
SUB_TIGHTEN = 3.8                          # 원본 트래킹 4.2 중 걷어낼 양
SUB_COLOR = {'color': '#0E9384', 'white': '#4FD1C5'}

NUM = re.compile(r'-?\d*\.?\d+(?:[eE][-+]?\d+)?')


def path(*p):
    q = os.path.join(ROOT, *p)
    os.makedirs(os.path.dirname(q), exist_ok=True)
    return q


# ─── 아이콘 ────────────────────────────────────────────────────────────────
def radius_ratio(im):
    a = np.array(im.convert('RGBA'))
    ys, xs = np.nonzero(a[:, :, 3] > 8)
    w = im.size[0]
    return float(np.hypot(xs - w / 2, ys - w / 2).max() / (w / 2))


def spiral_at(size, target):
    """나선 최대 반경이 캔버스 반폭의 target 비율이 되도록 그린다."""
    s, im = 1.0, None
    for _ in range(8):
        im = bs.draw_spiral(size, scale=s)
        cur = radius_ratio(im)
        if abs(cur - target) < 0.004:
            return im
        s *= target / cur
    return im


def build_icons():
    for s in (16, 32, 48):
        bs.icon(s, shape='squircle').save(path('icons', f'favicon-{s}.png'))
    for s in PWA_SIZES:
        bs.icon(s, shape='squircle').save(path('icons', f'pwa-{s}.png'))
    # maskable 은 플랫폼이 임의 모양으로 잘라낸다 — 안전원(반경 40%) 안에 가둔다
    for s in (192, 512):
        base = bs.gradient(s).convert('RGBA')
        base.alpha_composite(spiral_at(s, 0.40))
        base.convert('RGB').save(path('icons', f'maskable-{s}.png'))
    # .ico 에 16/32/48 을 같이 넣는다. 한 장만 넣으면 고해상도 탭에서 흐려진다
    ico = path('icons', 'favicon.ico')
    bs.icon(48, shape='squircle').convert('RGB').save(
        ico, sizes=[(16, 16), (32, 32), (48, 48)])
    open(path('icons', 'favicon.svg'), 'w', encoding='utf-8').write(
        bs.svg_symbol(bg='#0A2540', corner=bs.CORNER))
    # 루트 /favicon.ico — 브라우저가 경로 없이 자동으로 찾아가는 자리
    Image.open(ico).save(path('favicon.ico'), sizes=[(16, 16), (32, 32), (48, 48)])
    print('  아이콘  favicon 4종 · PWA 9종 · maskable 2종')


# ─── SVG 조작 ──────────────────────────────────────────────────────────────
def swap_spiral(svg):
    """템플릿의 나선 패스를 새 나선으로 교체.

    템플릿은 나선을 `<g transform="translate(...) scale(...)"><path .../>` 로
    갖고 있고 그 안이 -100..100 좌표계다. RING 을 그대로 넣으면 위치·크기가
    자동으로 맞는다.
    """
    m = re.search(r'(<g transform="translate\([^"]*\)[^"]*">)\s*(<path\b[^>]*?/>)', svg, re.S)
    if not m:
        raise SystemExit('나선 그룹을 못 찾았다')
    fill = re.search(r'fill="([^"]*)"', m.group(2)).group(1)
    d = 'M ' + ' L '.join(f'{x:.2f} {y:.2f}' for x, y in bs.RING) + ' Z'
    return svg[:m.start()] + m.group(1) + f'<path d="{d}" fill="{fill}"/>' + svg[m.end():]


def _subpaths(d):
    idx = [m.start() for m in re.finditer(r'[Mm]', d)]
    return [d[a:b] for a, b in zip(idx, idx[1:] + [len(d)])]


def _xrange(sp):
    xs = []
    for m in re.finditer(r'([MLHVCSQTAZmlhvcsqtaz])([^A-Za-z]*)', sp):
        c, n = m.group(1), [float(v) for v in NUM.findall(m.group(2))]
        if c in 'ML':
            xs += n[0::2]
        elif c == 'H':
            xs += n
        elif c == 'C':
            xs += n[0::2]
    return (min(xs), max(xs)) if xs else None


def _shift(sp, dx):
    out = []
    for m in re.finditer(r'([MLHVCSQTAZmlhvcsqtaz])([^A-Za-z]*)', sp):
        c, a = m.group(1), m.group(2)
        if c in 'VZ':
            out.append(c + a)
            continue
        n = [float(v) for v in NUM.findall(a)]
        n = ([v + dx for v in n] if c == 'H'
             else [(v + dx) if i % 2 == 0 else v for i, v in enumerate(n)])
        out.append(c + ' '.join(f'{v:.4f}' for v in n))
    return ''.join(out)


def tighten(d, amount):
    """글자 단위로 묶어 자간을 amount 만큼 줄인다."""
    items = sorted(((_xrange(sp), sp) for sp in _subpaths(d) if _xrange(sp)),
                   key=lambda it: it[0][0])
    glyphs = []
    for (x0, x1), sp in items:
        if glyphs and x0 <= glyphs[-1]['x1'] + 0.2:      # x 구간이 겹치면 같은 글자
            glyphs[-1]['x1'] = max(glyphs[-1]['x1'], x1)
            glyphs[-1]['sps'].append(sp)
        else:
            glyphs.append({'x1': x1, 'sps': [sp]})
    res, shift = [], 0.0
    for i, g in enumerate(glyphs):
        if i:
            shift -= amount
        res += [_shift(sp, shift) for sp in g['sps']]
    return ''.join(res), len(glyphs)


def fix_subline(svg, variant):
    """락업의 서브라인(세 번째 패스)을 키우고 자간·색을 조정."""
    P = list(re.finditer(r'<path\b[^>]*?/>', svg, re.S))
    sub = P[2].group(0)
    d = re.search(r'\sd="([^"]*)"', sub).group(1)
    nd, ng = tighten(d, SUB_TIGHTEN)
    k = SUB_SCALE
    tx, ty = SUB_BBOX[0] * (1 - k), SUB_TOP - SUB_BBOX[1] * k
    g = (f'<g transform="translate({tx:.3f},{ty:.3f}) scale({k})">'
         f'<path d="{nd}" fill="{SUB_COLOR[variant]}"/></g>')
    print(f'  서브라인 글자 {ng}자 · 자간 -{SUB_TIGHTEN} · {SUB_COLOR[variant]}')
    return svg[:P[2].start()] + g + svg[P[2].end():]


def render(svg, png, w, h, scale=1):
    tmp = '/tmp/brand-render'
    os.makedirs(tmp, exist_ok=True)
    html = os.path.join(tmp, 'r.html')
    open(html, 'w', encoding='utf-8').write(
        '<!doctype html><meta charset=utf-8>'
        '<style>html,body{margin:0;background:transparent}svg{display:block}</style>' + svg)
    js = os.path.join(tmp, 'r.mjs')
    open(js, 'w', encoding='utf-8').write(f"""
import {{ chromium }} from 'playwright';
const exe = process.env.CHROME_PATH;
const b = await chromium.launch(exe ? {{ executablePath: exe }} : {{}});
const ctx = await b.newContext({{ viewport: {{ width: {w}, height: {h} }}, deviceScaleFactor: {scale} }});
const p = await ctx.newPage();
await p.goto('file://{html}');
await p.waitForTimeout(250);
await p.screenshot({{ path: {json.dumps(png)}, omitBackground: true }});
await b.close();
""")
    subprocess.run(['node', js], check=True)


def build_lockup():
    """헤더 로고 — 라이트·다크. 두 벌을 같은 bbox 로 잘라야 모드 전환 시 안 흔들린다."""
    outs = {}
    for variant, dst in (('color', 'logo.png'), ('white', 'logo-darkmode.png')):
        svg = open(os.path.join(TPL, f'lockup-{variant}.svg'), encoding='utf-8').read()
        svg = fix_subline(swap_spiral(svg), variant)
        tmp = f'/tmp/lockup-{variant}.png'
        render(svg, tmp, 592, 200, scale=4)   # 헤더에서 축소해 쓰므로 4배로 뽑는다
        outs[dst] = Image.open(tmp).convert('RGBA')
    boxes = [im.getbbox() for im in outs.values()]
    box = (min(b[0] for b in boxes), min(b[1] for b in boxes),
           max(b[2] for b in boxes), max(b[3] for b in boxes))
    m = int((box[3] - box[1]) * 0.06)
    first = next(iter(outs.values()))
    box = (max(0, box[0] - m), max(0, box[1] - m),
           min(first.width, box[2] + m), min(first.height, box[3] + m))
    for dst, im in outs.items():
        im.crop(box).save(path(dst))
    print('  로고     logo.png · logo-darkmode.png', (box[2] - box[0], box[3] - box[1]))


def build_og():
    svg = swap_spiral(open(os.path.join(TPL, 'og-card.svg'), encoding='utf-8').read())
    render(svg, path('og', 'og-1200x630.png'), 1200, 630)
    Image.open(path('og', 'og-1200x630.png')).save(path('logo-preview.png'))
    print('  공유카드 og/og-1200x630.png')


def build_splash():
    """iOS 스플래시 14종. 각 해상도에서 직접 렌더한다 — 한 장을 확대·축소해
    돌려쓰면 그라디언트에 리샘플 잡음이 섞여 PNG 가 6배로 부풀고(24MB) 띠도
    보인다. viewBox 는 마스터 그대로 두고 slice 로 채워 잘라낸다."""
    master = swap_spiral(open(os.path.join(TPL, 'splash-master.svg'), encoding='utf-8').read())
    for name in SPLASH:
        w, h = (int(v) for v in name.split('x'))
        svg = re.sub(r'<svg\b[^>]*>',
                     f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" '
                     f'viewBox="0 0 1290 2796" preserveAspectRatio="xMidYMid slice">',
                     master, count=1)
        dst = path('splash', f'splash-{name}.png')
        render(svg, dst, w, h)
        im = Image.open(dst)
        if im.mode != 'RGB':                       # 불투명 화면이라 알파가 필요 없다
            bg = Image.new('RGB', im.size, (4, 18, 31))
            bg.paste(im, mask=im.split()[-1] if im.mode == 'RGBA' else None)
            im = bg
        im.save(dst, optimize=True)
    print(f'  스플래시 {len(SPLASH)}종')


def main():
    print('나선 하나에서 다시 굽는다 —', f'{bs.TURNS}바퀴 · {bs.GROWTH}배 성장')
    build_icons()
    if '--icons' in sys.argv:
        return
    build_lockup()
    build_og()
    build_splash()
    print('DONE')


if __name__ == '__main__':
    main()
