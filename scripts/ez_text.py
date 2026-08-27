# -*- coding: utf-8 -*-
"""화면에 나가는 문자열의 공통 표기 규칙 (80항, 2026-08-27).

성동님 지시: "'1배수 칸은 채운 채로 유지 — 레버리지 검토는 반등 관문' 같은 표현에서
' — '는 지양하고 ' - '으로 해라. 모든 텍스트에서 이렇게 해라."

em dash(—)는 한국어 본문에서 폭이 넓어 시선을 끊고, 복사해 다른 글에 붙이면 폰트에
따라 깨져 보인다. 하이픈은 어디서나 같은 모양으로 붙는다.

이 모듈은 두 곳에서 쓴다.
  1) 생성 스크립트가 JSON을 쓰기 직전 — 앞으로 나올 문장을 보증한다.
  2) `python3 scripts/ez_text.py <파일...>` 로 기존 파일 일괄 정리.
"""
import re
import sys

# 낱말 사이(양쪽에 글자가 있는 자리)의 대시 — 여백을 정리해 ' - '로.
_DASH_INLINE = re.compile(r'(?<=\S)[ \t]*—[ \t]*(?=\S)')
# 줄머리 대시 — 들여쓰기는 살리고 기호만 바꾼다.
_DASH_LEAD = re.compile(r'(^|\n)([ \t]*)—[ \t]*')


def fix_dash(text):
    """em dash를 하이픈으로. 들여쓰기와 줄바꿈은 건드리지 않는다."""
    if not text or '—' not in text:
        return text
    text = _DASH_INLINE.sub(' - ', text)
    text = _DASH_LEAD.sub(r'\1\2- ', text)
    return text.replace('—', '-')          # 줄 끝 등 남은 것


def scrub(obj):
    """dict·list·str 어디에 있든 재귀로 훑는다. 키 이름은 건드리지 않는다."""
    if isinstance(obj, str):
        return fix_dash(obj)
    if isinstance(obj, list):
        return [scrub(v) for v in obj]
    if isinstance(obj, dict):
        return {k: scrub(v) for k, v in obj.items()}
    return obj


def _selftest():
    cases = [
        ("1배수 칸은 채운 채로 유지 — 레버리지 검토는 반등 관문",
         "1배수 칸은 채운 채로 유지 - 레버리지 검토는 반등 관문"),
        ("큰 움직임 — 급등 NVDA +4.0%. 지수 +1.0% — 갭 방향의 단서.",
         "큰 움직임 - 급등 NVDA +4.0%. 지수 +1.0% - 갭 방향의 단서."),
        ("'보유' 판단 15일째 — 그 사이 -0.5%.",
         "'보유' 판단 15일째 - 그 사이 -0.5%."),
        ("    — 줄머리 대시", "    - 줄머리 대시"),
        ("앞줄\n— 뒷줄", "앞줄\n- 뒷줄"),
        ("금리 4.66%(+0.54%)", "금리 4.66%(+0.54%)"),      # 무변경
        ("2026-08-27 09:00", "2026-08-27 09:00"),          # 무변경
        ("A—B", "A - B"),
    ]
    bad = 0
    for src, want in cases:
        got = fix_dash(src)
        if got != want:
            bad += 1
            print(f"  !! {src!r}\n     기대 {want!r}\n     실제 {got!r}")
    print(f"자체 시험 {len(cases)}건 중 실패 {bad}건")
    return bad


if __name__ == '__main__':
    args = sys.argv[1:]
    if not args or args[0] == '--selftest':
        sys.exit(1 if _selftest() else 0)
    changed = 0
    for path in args:
        try:
            with open(path, encoding='utf-8') as f:
                src = f.read()
        except (OSError, UnicodeDecodeError):
            continue
        out = fix_dash(src)
        if out != src:
            with open(path, 'w', encoding='utf-8') as f:
                f.write(out)
            changed += 1
            print(f"  고침: {path}")
    print(f"총 {changed}개 파일 수정")
