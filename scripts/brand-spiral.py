#!/usr/bin/env python3
# 2026-08-06 — 복리 나선(시안 복원판)에서 모든 브랜드 자산을 다시 굽는다.
#
# 왜 직접 그리는가: 브랜드 패키지 v1.1/v1.2 의 나선은 성동님이 애초에 정한
# 시안과 다른 그림이었다(1.6바퀴 / 5.5배 성장). 시안 스크린샷을 실측해
# 파라미터를 복원했고, 여기서 나오는 모든 자산은 그 하나의 곡선에서 파생된다.
#
# 실측 복원값 — 이 값이 이제 브랜드의 기준이다:
#   회전 2.2바퀴 · 회전당 3.2배 성장 · 캔버스 점유 68% · 꼬리 끝 48도
#   굵기 8→18(t≈0.35에서 최대 도달, 끝에서 다시 가늘어짐) · 단색 #72C9C1
#
# SVG 렌더러(cairo) 없이 PIL 만으로 그린다 — 폴리곤 좌표를 직접 계산하고
# 4배 크기로 그린 뒤 줄여 가장자리를 매끄럽게 만든다. 맥에서도 그대로 돈다.
import math
import os

from PIL import Image, ImageDraw

TEAL = (114, 201, 193)          # #72C9C1 — 시안 실측
NAVY_HI = (16, 50, 82)          # #103252 navy600
NAVY_LO = (4, 18, 31)           # #04121F navy900
NAVY_FLAT = (10, 37, 64)        # #0A2540 navy700
CORNER = 0.2237                 # 브랜드 규격 corner_radius_ratio
SS = 4                          # supersampling

TURNS, GROWTH, OCC, END_ANGLE = 2.2, 3.2, 0.68, 48.0
W_START, W_END = 8.0, 18.0
RAMP, TAPER_FROM, TIP = 0.35, 0.90, 0.25


def spiral_points(steps=1200):
    """가변 굵기 로그나선의 외곽 폴리곤을 -100..100 좌표계로 만든다."""
    b = math.log(GROWTH) / (2 * math.pi)
    th_max = 2 * math.pi * TURNS
    r_start = 82.0 / math.exp(b * th_max)
    phi = math.radians(END_ANGLE) - th_max

    def pt(t):
        th = th_max * t
        r = r_start * math.exp(b * th)
        a = th + phi
        return r * math.cos(a), -r * math.sin(a)

    def w(t):
        v = W_START + (W_END - W_START) * min(1.0, t / RAMP)
        if t > TAPER_FROM:
            k = (t - TAPER_FROM) / (1.0 - TAPER_FROM)
            v *= 1.0 - (1.0 - TIP) * k
        return max(0.6, v)

    pts = [pt(i / steps) for i in range(steps + 1)]
    ws = [w(i / steps) for i in range(steps + 1)]
    left, right = [], []
    for i, (x, y) in enumerate(pts):
        if i == 0:
            dx, dy = pts[1][0] - x, pts[1][1] - y
        elif i == steps:
            dx, dy = x - pts[-2][0], y - pts[-2][1]
        else:
            dx, dy = pts[i + 1][0] - pts[i - 1][0], pts[i + 1][1] - pts[i - 1][1]
        n = math.hypot(dx, dy) or 1.0
        nx, ny = -dy / n, dx / n
        h = ws[i] / 2
        left.append((x + nx * h, y + ny * h))
        right.append((x - nx * h, y - ny * h))

    def cap(c, frm, to, rad, n=28):
        a0 = math.atan2(frm[1] - c[1], frm[0] - c[0])
        a1 = math.atan2(to[1] - c[1], to[0] - c[0])
        d = (a1 - a0) % (2 * math.pi)
        if d < math.pi:
            d = d - 2 * math.pi if d != 0 else -math.pi
        return [(c[0] + rad * math.cos(a0 + d * k / n),
                 c[1] + rad * math.sin(a0 + d * k / n)) for k in range(1, n)]

    ring = (left + cap(pts[-1], left[-1], right[-1], ws[-1] / 2)
            + list(reversed(right)) + cap(pts[0], right[0], left[0], ws[0] / 2))

    # 궤적 바운딩을 캔버스 중앙에 놓고 점유율에 맞춘다
    xs = [p[0] for p in ring]
    ys = [p[1] for p in ring]
    cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
    scale = 200.0 * OCC / max(max(xs) - min(xs), max(ys) - min(ys))
    return [((x - cx) * scale, (y - cy) * scale) for x, y in ring]


RING = spiral_points()


def gradient(size, flat=False):
    g = Image.new("RGB", (size, size))
    if flat:
        return Image.new("RGB", (size, size), NAVY_FLAT)
    d = ImageDraw.Draw(g)
    for i in range(size):
        t = i / max(1, size - 1)
        d.line([(0, i), (size, i)],
               fill=tuple(round(NAVY_HI[c] + (NAVY_LO[c] - NAVY_HI[c]) * t) for c in range(3)))
    return g


def draw_spiral(size, color=TEAL, scale=1.0):
    """나선만 그린 RGBA 이미지(투명 배경)."""
    S = size * SS
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    k = S / 200.0 * scale
    d.polygon([(x * k + S / 2, y * k + S / 2) for x, y in RING], fill=color + (255,))
    return im.resize((size, size), Image.LANCZOS)


def mask(size, shape):
    S = size * SS
    m = Image.new("L", (S, S), 0)
    d = ImageDraw.Draw(m)
    if shape == "circle":
        d.ellipse((0, 0, S - 1, S - 1), fill=255)
    elif shape == "squircle":
        d.rounded_rectangle((0, 0, S - 1, S - 1), radius=int(S * CORNER), fill=255)
    else:
        d.rectangle((0, 0, S - 1, S - 1), fill=255)
    return m.resize((size, size), Image.LANCZOS)


def icon(size, shape="squircle", flat=False, spiral_scale=1.0, alpha=True):
    base = gradient(size, flat).convert("RGBA")
    sp = draw_spiral(size, scale=spiral_scale)
    base.alpha_composite(sp)
    if shape != "square":
        base.putalpha(mask(size, shape))
    elif not alpha:
        return base.convert("RGB")
    return base if alpha else base.convert("RGB")


def svg_symbol(fill="#72C9C1", bg=None, corner=None):
    d = "M " + " L ".join(f"{x:.2f} {y:.2f}" for x, y in RING) + " Z"
    parts = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="-100 -100 200 200">']
    if bg:
        rr = f' rx="{corner * 200:.2f}"' if corner else ""
        parts.append(f'<rect x="-100" y="-100" width="200" height="200"{rr} fill="{bg}"/>')
    parts.append(f'<path d="{d}" fill="{fill}"/></svg>')
    return "".join(parts)


def save(im, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    im.save(path)
    return path
