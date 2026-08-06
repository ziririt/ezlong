#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""번역 반영 점검 — 한국어 원본이 바뀌었는데 번역본이 안 따라왔는지 본다.

배경 — 2026-08-07. ezlong.com 은 en·ja·zh·es·pt 다섯 벌의 번역본을 갖고 있는데,
한국어 페이지를 고칠 때 번역본은 자주 잊힌다. 잊혀도 아무 신호가 없다 —
페이지는 멀쩡히 뜨고, 다만 내용이 몇 주 전 것이다. 사람이 기억으로 관리하면
반드시 새는 자리라서 기계에 맡긴다.

무엇을 보는가 (git 커밋 시각 기준)
  · 번역본이 아예 없는 한국어 페이지  → [없음]
  · 한국어가 번역본보다 N일 이상 최근  → [뒤처짐]

무엇을 못 보는가 — 솔직히 적어둔다
  내용이 실제로 달라졌는지는 모른다. 오타 하나 고쳐도 "뒤처짐"으로 잡힌다.
  반대로 번역본을 형식만 손대면 최신으로 보인다. 완벽한 판정이 아니라
  "여기를 한번 보라"는 신호다. 그래도 지금처럼 아무 신호도 없는 것보다 낫다.

사용
  python3 scripts/check-i18n.py            # 기본 7일
  python3 scripts/check-i18n.py --days 3
  python3 scripts/check-i18n.py --strict   # 뒤처짐이 있으면 종료코드 1
"""
import os
import subprocess
import sys

LANGS = ('en', 'ja', 'zh', 'es', 'pt')

# 번역 대상이 아닌 것들 — 내부 도구·템플릿·실험용·한국 전용 제도
SKIP = {
    '_og-render.html', '_template.html', 'admin.html', 'write.html', 'post.html',
    'board.html', 'ez-style-guide.html', 'gauge-preview.html',
    'swing-signal-mockup.html', 'atmr-dashboard_legacy.html', 'atmr-dashboard_v2.html',
    'chart-analysis_v2.html', 'index.html', 'market-cycle_v2.html',
    'market-scorecard_v2.html', 'stocks_v2.html', 'tv-inbox.html',
    # 한국 세법·제도 전용 — 번역해도 다른 나라 방문자에게 의미가 없다
    'tax-account-simulator.html', 'isa-irp-us-stock-tax-comparison.html',
    'dc-rebalance.html', 'job.html', 'lucky.html', 'life-signal.html',
}


def last_commit_ts(root, rel):
    """파일의 마지막 커밋 시각(epoch). 커밋 이력이 없으면 None."""
    try:
        out = subprocess.run(
            ['git', 'log', '-1', '--format=%ct', '--', rel],
            cwd=root, capture_output=True, text=True, timeout=20)
        v = out.stdout.strip()
        return int(v) if v else None
    except (OSError, ValueError, subprocess.SubprocessError):
        return None


def main():
    root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    days = 7
    if '--days' in sys.argv:
        days = int(sys.argv[sys.argv.index('--days') + 1])
    strict = '--strict' in sys.argv
    gap = days * 86400

    pages = sorted(f for f in os.listdir(root)
                   if f.endswith('.html') and f not in SKIP and not f.startswith('.'))

    missing, behind = [], []
    for f in pages:
        ko = last_commit_ts(root, f)
        if ko is None:
            continue
        have = [l for l in LANGS if os.path.isfile(os.path.join(root, l, f))]
        if not have:
            missing.append(f)
            continue
        late = []
        for l in have:
            t = last_commit_ts(root, os.path.join(l, f))
            if t is not None and ko - t > gap:
                late.append((l, int((ko - t) / 86400)))
        # 번역본이 있는 언어 중 하나라도 뒤처지면 보고
        if late:
            behind.append((f, late, [l for l in LANGS if l not in have]))

    if missing:
        print('[없음] 번역본이 하나도 없는 페이지 %d개:' % len(missing))
        for f in missing:
            print('   ', f)
        print()

    if behind:
        print('[뒤처짐] 한국어가 %d일 이상 앞선 페이지 %d개:' % (days, len(behind)))
        for f, late, absent in behind:
            tail = '  (없는 언어: %s)' % ','.join(absent) if absent else ''
            print('   %-42s %s%s' % (
                f, ' '.join(f'{l}+{d}일' for l, d in late), tail))
        print()

    if not missing and not behind:
        print('[통과] 최근 %d일 기준 번역 뒤처짐 없음 (검사 %d개 페이지).' % (days, len(pages)))
        return 0

    print('검사 %d개 페이지 · 없음 %d · 뒤처짐 %d' % (len(pages), len(missing), len(behind)))
    print('※ 커밋 시각 비교라 "내용이 실제로 달라졌는지"까지는 모른다. 확인 신호로만 쓸 것.')
    return 1 if strict else 0


if __name__ == '__main__':
    sys.exit(main())
