#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""배포 전 프라이버시 가드.

배경 — 2026-08-06. 화면에 렌더되는 문자열 안에 운영자 개인을 지칭하는 표현이
들어간 채로 라이브에 나간 사고가 있었다(레버리지 카드의 RSI 근거 문구).
그때는 사람이 눈으로 훑어서 잡았는데, 그 방식은 다음에 또 놓친다.

이 스크립트가 하는 일
  · 배포되는 파일(html/js/css/json)에서 주석을 제거한 뒤 남은 "실제 코드"에
    개인 지칭 표현이 있는지 본다 → 있으면 종료코드 1 (배포 차단)
  · 주석 안에 남은 표현은 경고만 한다 → View Source 로 보이긴 하지만
    화면에 렌더되진 않으므로 차단 사유는 아니다

허용 목록
  · "김성동" — 저자 표기(meta author, JSON-LD, 출간 도서 인용 저자)는
    의도된 공개 정보다. 개인 지칭 금지 대상이 아니다.

사용
  python3 scripts/check-privacy.py          # 저장소 루트에서
"""
import os
import re
import sys

# 화면 문구에 절대 들어가면 안 되는 표현 — 개인 호칭, 지시/견해 출처 표기
BANNED = re.compile(
    r'성동님|유저\s*지시|사용자\s*지시|유저\s*제보|사용자\s*제보|'
    r'오너\s*지시|운영자\s*지시|유저\s*지적|사용자\s*지적'
)

SERVED_EXT = ('.html', '.js', '.css', '.json')
SKIP_DIRS = {'.git', 'node_modules', 'mobile', 'analyst-pipeline'}


def strip_js(s):
    """JS 주석 제거. 문자열/템플릿 리터럴 안의 // /* 는 건드리지 않는다."""
    out, i, n, st = [], 0, len(s), None
    while i < n:
        c = s[i]
        if st is None:
            if c == '/' and i + 1 < n and s[i + 1] == '/':
                j = s.find('\n', i)
                j = n if j < 0 else j
                out.append(' ' * (j - i))
                i = j
                continue
            if c == '/' and i + 1 < n and s[i + 1] == '*':
                j = s.find('*/', i + 2)
                j = n if j < 0 else j + 2
                out.append(re.sub(r'[^\n]', ' ', s[i:j]))
                i = j
                continue
            if c in '"\'`':
                st = c
            out.append(c)
            i += 1
            continue
        if c == '\\':
            out.append(s[i:i + 2])
            i += 2
            continue
        if c == st:
            st = None
        out.append(c)
        i += 1
    return ''.join(out)


def blank(m):
    return re.sub(r'[^\n]', ' ', m.group(0))


def strip_css(s):
    return re.sub(r'/\*.*?\*/', blank, s, flags=re.S)


def strip_html(s):
    s = re.sub(r'<!--.*?-->', blank, s, flags=re.S)
    s = re.sub(r'(<style[^>]*>)(.*?)(</style>)',
               lambda m: m.group(1) + strip_css(m.group(2)) + m.group(3),
               s, flags=re.S | re.I)
    s = re.sub(r'(<script[^>]*>)(.*?)(</script>)',
               lambda m: m.group(1) + strip_js(m.group(2)) + m.group(3),
               s, flags=re.S | re.I)
    return s


def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    rendered, commented = [], []

    for cur, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs
                   if d not in SKIP_DIRS and not d.startswith('.')]
        for f in files:
            if not f.endswith(SERVED_EXT):
                continue
            p = os.path.join(cur, f)
            rel = os.path.relpath(p, root)
            try:
                src = open(p, encoding='utf-8').read()
            except (OSError, UnicodeDecodeError):
                continue
            if not BANNED.search(src):
                continue
            if f.endswith('.html'):
                stripped = strip_html(src)
            elif f.endswith('.js'):
                stripped = strip_js(src)
            elif f.endswith('.css'):
                stripped = strip_css(src)
            else:
                stripped = src
            for i, line in enumerate(stripped.split('\n'), 1):
                if BANNED.search(line):
                    rendered.append((rel, i, line.strip()[:160]))
            for i, line in enumerate(src.split('\n'), 1):
                if BANNED.search(line):
                    commented.append((rel, i, line.strip()[:160]))

    ren_keys = {(a, b) for a, b, _ in rendered}
    only_cmt = [h for h in commented if (h[0], h[1]) not in ren_keys]

    if only_cmt:
        print('[경고] 주석 안 개인 지칭 %d건 — 렌더되진 않으나 View Source 로 보인다:'
              % len(only_cmt))
        for rel, i, txt in only_cmt[:40]:
            print('  %s:%d  %s' % (rel, i, txt))
        print()

    if rendered:
        print('[차단] 렌더되는 문자열에 개인 지칭 %d건:' % len(rendered))
        for rel, i, txt in rendered:
            print('  %s:%d  %s' % (rel, i, txt))
        print('\n화면 문구에서 개인 호칭·지시 출처 표기를 제거한 뒤 다시 배포하세요.')
        return 1

    print('[통과] 렌더되는 문자열에 개인 지칭 없음.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
