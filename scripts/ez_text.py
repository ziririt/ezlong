# -*- coding: utf-8 -*-
"""화면에 나가는 문자열의 공통 표기 규칙 (80항, 2026-08-27).

성동님 지시 1차: "' — '는 지양하고 하이픈으로 해라. 모든 텍스트에서."
성동님 지시 2차(80-2항): "'-'을 쓰니까 마이너스(-)와 구분을 못하겠다.
  부연설명이나, 한 라인에 쓰지만 다른 문장일 때, 항목과 설명의 관계일 때는
  하이픈 대신 ':'(콜론)을 써라."

정리하면 자리마다 기호가 다르다.
  · 낱말 사이(항목 : 설명, 부연) ......... 콜론 ':'
  · 줄머리(목록 표시) .................... 하이픈 '- '
  · 음수·범위·연산 ....................... 하이픈 그대로 (건드리지 않는다)

이 모듈은 두 곳에서 쓴다.
  1) 생성 스크립트가 JSON을 쓰기 직전 - 앞으로 나올 문장을 보증한다.
  2) `python3 scripts/ez_text.py <파일...>` 로 기존 파일 일괄 정리.
"""
import re
import sys

# ── em dash ────────────────────────────────────────────────────────────────
# 낱말 사이의 대시는 '항목 : 설명'의 자리다.
_DASH_INLINE = re.compile(r'(?<=\S)[ \t]*—[ \t]*(?=\S)')
# 줄머리 대시는 목록 표시다. 들여쓰기는 살리고 기호만 바꾼다.
_DASH_LEAD = re.compile(r'(^|\n)([ \t]*)—[ \t]*')

# ── 이미 하이픈으로 바뀐 구분자 ─────────────────────────────────────────────
# 앞뒤가 '글자'일 때만 구분자로 본다. 숫자·부호가 뒤따르면 음수·범위·연산이므로
# 절대 건드리지 않는다("RSI 40 - 60", "(a) - 1", "-0.5%").
_SEP_HYPHEN = re.compile(
    r'(?<=[가-힣A-Za-z%)\]]) - (?=[가-힣A-Za-z])'      # 글자 - 글자
    r'|(?<=[가-힣]) - (?=\d)')                        # 한글 - 숫자 ("들자면 - 200일선")
# 숫자로 시작하는 쪽은 한글이 앞설 때만 본다. '(a) - 1', 'RSI 40 - 60'은 그대로 둔다.
# 수식으로 보이는 문자열은 통째로 면제한다 - "(price - low52w)/(high52w - low52w)*100"
_FORMULA = re.compile(r'[()].*/')


def fix_dash(text):
    """em dash를 자리에 맞는 기호로. 들여쓰기와 줄바꿈은 건드리지 않는다."""
    if not text or '—' not in text:
        return text
    text = _DASH_INLINE.sub(': ', text)
    text = _DASH_LEAD.sub(r'\1\2- ', text)
    return text.replace('—', '-')          # 줄 끝 등 남은 것


def fix_sep(text):
    """구분자로 쓰인 ' - '를 ': '로. 음수·범위·연산·수식은 손대지 않는다."""
    if not text or ' - ' not in text or _FORMULA.search(text):
        return text
    return _SEP_HYPHEN.sub(': ', text)


def fix_all(text):
    return fix_sep(fix_dash(text))


def scrub(obj, sep=True):
    """dict·list·str 어디에 있든 재귀로 훑는다. 키 이름은 건드리지 않는다."""
    fn = fix_all if sep else fix_dash
    if isinstance(obj, str):
        return fn(obj)
    if isinstance(obj, list):
        return [scrub(v, sep) for v in obj]
    if isinstance(obj, dict):
        return {k: scrub(v, sep) for k, v in obj.items()}
    return obj


def _selftest():
    cases = [
        # em dash - 낱말 사이는 콜론
        ("1배수 칸은 채운 채로 유지 — 레버리지 검토는 반등 관문",
         "1배수 칸은 채운 채로 유지: 레버리지 검토는 반등 관문"),
        ("'보유' 판단 15일째 — 그 사이 -0.5%.",
         "'보유' 판단 15일째: 그 사이 -0.5%."),
        # em dash - 줄머리는 목록 표시
        ("    — 줄머리 대시", "    - 줄머리 대시"),
        ("앞줄\n— 뒷줄", "앞줄\n- 뒷줄"),
        # 이미 하이픈이 된 구분자
        ("TOP9 집중분석 - 테슬라·엔비디아 등 빅테크", "TOP9 집중분석: 테슬라·엔비디아 등 빅테크"),
        ("긍정 vs 부정 몇대몇 - AI 시황 분석", "긍정 vs 부정 몇대몇: AI 시황 분석"),
        # 건드리면 안 되는 것
        ("근거 하나만 들자면 - 200일선 위 구간", "근거 하나만 들자면: 200일선 위 구간"),
        ("RSI 40 - 60 구간", "RSI 40 - 60 구간"),
        ("(a) - 1", "(a) - 1"),
        ("미10년 4.66%(+0.54%)", "미10년 4.66%(+0.54%)"),
        ("2026-08-27 09:00", "2026-08-27 09:00"),
        ("3-3-4 원칙", "3-3-4 원칙"),
        ("전일 대비 -0.5%", "전일 대비 -0.5%"),
        ("(price - low52w)/(high52w - low52w)*100", "(price - low52w)/(high52w - low52w)*100"),
        ("const n = (a) - 1;", "const n = (a) - 1;"),
    ]
    bad = 0
    for src, want in cases:
        got = fix_all(src)
        if got != want:
            bad += 1
            print(f"  !! {src!r}\n     기대 {want!r}\n     실제 {got!r}")
    print(f"자체 시험 {len(cases)}건 중 실패 {bad}건")
    return bad


if __name__ == '__main__':
    args = sys.argv[1:]
    if not args or args[0] == '--selftest':
        sys.exit(1 if _selftest() else 0)
    dash_only = '--dash-only' in args
    args = [a for a in args if not a.startswith('--')]
    fn = fix_dash if dash_only else fix_all
    changed = 0
    for path in args:
        try:
            with open(path, encoding='utf-8') as f:
                src = f.read()
        except (OSError, UnicodeDecodeError):
            continue
        out = fn(src)
        if out != src:
            with open(path, 'w', encoding='utf-8') as f:
                f.write(out)
            changed += 1
    print(f"총 {changed}개 파일 수정")
