#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""배포 전 프라이버시 가드.

배경 — 2026-08-06. 화면에 렌더되는 문자열 안에 운영자 개인을 지칭하는 표현이
들어간 채로 라이브에 나간 사고가 있었다(레버리지 카드의 RSI 근거 문구).
그때는 사람이 눈으로 훑어서 잡았는데, 그 방식은 다음에 또 놓친다.

이 스크립트가 하는 일
  · 배포되는 파일(html/js/css/json)에서 주석을 제거한 뒤 남은 "실제 코드"에
    개인 지칭 표현이 있는지 본다 → 있으면 종료코드 1 (배포 차단)
  · 주석 안에 남은 표현도 차단한다 (2026-08-07 강화) → 배포되는 js/html 은
    누구나 원문을 그대로 내려받는다. "화면에 안 보이니 괜찮다"가 아니다.
    경고로 두었더니 실제로 한 건이 며칠 동안 라이브에 남아 있었다.

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

# 독자가 읽는 글에 나가면 안 되는 "내부 사정" 표현.
# 2026-08-06 사고: TSLA 카드 헤드라인이 "규칙은 매수 — 차트 미확인이라 1차를 절반으로"
# 로 나갔다. 방문자에게 우리 내부의 작업 상태(무엇을 확인했고 못 했는지, 엔진이 몇
# 개인지)를 보고하는 문장이다. 손님 앞에서 직원끼리 하는 말을 그대로 노출한 격.
# 판단이 갈리는 상황은 시장 언어로만 쓴다 — "지표는 진입 구간이나 차트 패턴은 아직".
INTERNAL = re.compile(
    r'규칙\s*엔진|차트\s*엔진|분석\s*엔진|두\s*엔진|엔진\s*판독|엔진의\s|'
    r'차트\s*미확인|미확인이라|이\s*시스템(은|의|이)|초안에\s*따르면|'
    r'아직\s*확인\s*(못|안)\s*'
)

# 쓰지 않기로 한 문구. 브랜드 패키지 기본 카피에 들어 있어서, 새 에셋을
# 받을 때마다 다시 딸려 들어오기 쉽다 — 배포 전에 기계로 막는다.
# 2026-08-06 사고: 공유카드 이미지와 time/manifest 설명에 들어간 채 배포됐다.
# 주의 — 이 검사는 텍스트만 본다. **이미지 안의 글자는 못 잡는다.**
# 공유카드·스플래시를 새로 받으면 눈으로 한 번 확인할 것.
BANNED_COPY = re.compile(r'오래\s*두면\s*편해진다')

# firebase.json 에서 /icons/** · /splash/** 를 1년 immutable 로 걸어 두었다.
# 그 자산은 URL 에 버전이 없으면 내용을 바꿔도 브라우저·엣지가 1년 동안 옛것을
# 계속 쓴다. 2026-08-06 실제로 심볼을 바꿨는데 파비콘만 옛 그림으로 남았다.
# 그래서 참조에는 반드시 ?v=… 를 붙인다 — 붙이는 건 build-web-brand.py 가 아니라
# 사람이 하는 일이므로 여기서 막는다.
# 절대경로만 대상이다. time/ 은 자기 폴더의 icons/ 를 상대경로로 쓰는데
# firebase 의 /icons/** 규칙은 루트만 매칭하므로 1년 캐시 대상이 아니다.
IMMUTABLE_REF = re.compile(r'(?:href|src)"?\s*[:=]\s*"(/(?:icons|splash)/[^"?]+\.(?:png|ico|svg))"')

SERVED_EXT = ('.html', '.js', '.css', '.json', '.webmanifest')
SKIP_DIRS = {'.git', 'node_modules', 'mobile', 'analyst-pipeline'}

# 생성 카피(파이프라인 산출물) — 독자가 읽는 문장이 그대로 들어 있다
COPY_JSON = ('swing-view.json', 'analysis-', 'market-scorecard.json')


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
    rendered, commented, banned_copy, unversioned = [], [], [], []

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
            for i, line in enumerate(src.split('\n'), 1):
                if BANNED_COPY.search(line):
                    banned_copy.append((rel, i, line.strip()[:160]))
                for m in IMMUTABLE_REF.finditer(line):
                    unversioned.append((rel, i, m.group(1)))
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
        print('[차단] 주석 안 개인 지칭 %d건 — 화면에 안 보여도 파일째 공개된다:'
              % len(only_cmt))
        for rel, i, txt in only_cmt[:40]:
            print('  %s:%d  %s' % (rel, i, txt))
        print('  ※ 배포되는 js/html 은 누구나 원문을 내려받는다. 주석도 공개 문서다.')
        print()

    # ── 2차: 생성 카피의 내부 사정 노출 검사 ──────────────────────────────
    internal = []
    data_dir = os.path.join(root, 'data')
    if os.path.isdir(data_dir):
        for f in sorted(os.listdir(data_dir)):
            if not f.endswith('.json'):
                continue
            if not any(k in f for k in COPY_JSON):
                continue
            p = os.path.join(data_dir, f)
            try:
                src = open(p, encoding='utf-8').read()
            except (OSError, UnicodeDecodeError):
                continue
            for m in INTERNAL.finditer(src):
                a = max(0, m.start() - 30)
                internal.append(('data/' + f, src[a:m.end() + 50].replace('\n', ' ')))

    if internal:
        print('[경고] 생성 카피에 내부 사정 표현 %d건 — 다음 파이프라인 실행에서 갱신되어야 한다:'
              % len(internal))
        seen = set()
        for rel, txt in internal:
            k = txt[:60]
            if k in seen:
                continue
            seen.add(k)
            print('  %s  …%s…' % (rel, txt))
        print()

    if unversioned:
        print('[차단] 1년 캐시 자산인데 URL 에 버전이 없는 참조 %d건:' % len(unversioned))
        seen = set()
        for rel, i, u in unversioned:
            if u in seen:
                continue
            seen.add(u)
            print('  %s:%d  %s   → %s?v=YYYYMMDD 를 붙일 것' % (rel, i, u, u))
        print()

    if banned_copy:
        print('[차단] 쓰지 않기로 한 문구 %d건:' % len(banned_copy))
        for rel, i, txt in banned_copy:
            print('  %s:%d  %s' % (rel, i, txt))
        print()

    if rendered:
        print('[차단] 렌더되는 문자열에 개인 지칭 %d건:' % len(rendered))
        for rel, i, txt in rendered:
            print('  %s:%d  %s' % (rel, i, txt))
        print('\n화면 문구에서 개인 호칭·지시 출처 표기를 제거한 뒤 다시 배포하세요.')
        return 1

    if banned_copy or unversioned or only_cmt:
        return 1

    print('[통과] 개인 지칭·금지 문구 없음, 캐시 자산 버전 표기 정상.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
