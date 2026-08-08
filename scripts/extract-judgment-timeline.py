#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""판단 원장을 날짜축으로 펴낸다 — data/brief-history-verdicts.json

무엇을 하는가
  AI 차트분석이 매일 남기는 판단 원장(data/judgment-history-us.json)에서
  QQQ 판단을 뽑아 날짜별 한 줄로 정리한다. 이슈 카드에 '그날 AI는 뭐라고
  했나'를 얹기 위한 것이다. 카드에는 이미 '그 뒤 5·20·60거래일 수익률'이
  붙어 있으므로, 둘을 나란히 놓으면 판단과 결과가 한 화면에서 대조된다.

왜 git 이력을 훑나
  원장 파일은 심볼당 15개로 prune 된다(CLAUDE.md 20항 — 파일 크기 영구 상한).
  그래서 지금 파일에는 사흘치밖에 없다. 그런데 이 파일은 매일 커밋되므로
  **git 이력 자체가 원장의 원장**이다. 커밋을 거슬러 올라가며 그때그때의
  판단을 모으면 몇 주치가 복원된다. 새 데이터 소스는 필요 없다.

무엇을 하지 않는가
  판단을 새로 만들지 않는다. 그때 실제로 화면에 나갔던 문자열만 옮긴다.
  하루에 여러 번 기록된 날은 **그날의 마지막 판단**을 쓴다 — 장 마감 뒤의
  판단이 그날의 결론이다.

사용
  python3 scripts/extract-judgment-timeline.py
  python3 scripts/extract-judgment-timeline.py --symbol QQQ --max-commits 400
"""
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
LEDGER = 'data/judgment-history-us.json'
OUT = os.path.join(ROOT, 'data', 'brief-history-verdicts.json')

# 판단 문자열에서 스탠스를 뽑는다. 원장의 k 는 사람이 읽는 한 줄이라
# 형식이 조금씩 달라도 이 단어들은 늘 들어간다.
STANCE_RE = re.compile(r'(강력매수|매수|보유|관망|비중축소|매도)')
SCORE_RE = re.compile(r'매수점수\s*(\d+)')
# 화면에 쓰는 말로 통일 — 원장에는 표현이 섞여 있다
STANCE_NORM = {
    '강력매수': '매수', '매수': '매수',
    '보유': '보유', '관망': '관망',
    '비중축소': '매도', '매도': '매도',
}


def git(*args, cwd=ROOT):
    r = subprocess.run(['git', *args], cwd=cwd, capture_output=True, text=True, timeout=60)
    return r.stdout if r.returncode == 0 else ''


def main():
    argv = sys.argv[1:]
    symbol = argv[argv.index('--symbol') + 1] if '--symbol' in argv else 'QQQ'
    max_commits = int(argv[argv.index('--max-commits') + 1] if '--max-commits' in argv else 600)

    revs = git('log', '--format=%H', f'-{max_commits}', '--', LEDGER).split()
    if not revs:
        print('::warning::원장 파일의 git 이력을 찾지 못했다 — 건너뜀')
        return 0
    print(f'커밋 {len(revs)}개를 훑는다 ({symbol})')

    # 날짜 → (시각, 판단문자열). 같은 날은 더 늦은 시각이 이긴다.
    best = {}
    seen_blobs = set()
    for rev in revs:
        raw = git('show', f'{rev}:{LEDGER}')
        if not raw:
            continue
        h = hash(raw)
        if h in seen_blobs:      # 내용이 그대로인 커밋은 다시 파싱하지 않는다
            continue
        seen_blobs.add(h)
        try:
            doc = json.loads(raw)
        except ValueError:
            continue
        for item in doc.get(symbol, []) or []:
            d, t, k = item.get('d'), item.get('t') or '', item.get('k') or ''
            if not d or not k:
                continue
            cur = best.get(d)
            if cur and cur[0] >= t:
                continue
            best[d] = (t, k)

    out = {}
    for d, (t, k) in best.items():
        m = STANCE_RE.search(k)
        if not m:
            continue
        s = SCORE_RE.search(k)
        out[d] = {'v': STANCE_NORM[m.group(1)], 'at': t}
        if s:
            out[d]['s'] = int(s.group(1))

    if not out:
        print('::warning::뽑아낸 판단이 없다 — 파일을 쓰지 않는다')
        return 0

    days = sorted(out)
    from collections import Counter
    dist = Counter(v['v'] for v in out.values())
    print(f'{len(out)}일 복원 · {days[0]} ~ {days[-1]} · ' +
          ' '.join(f'{k} {n}' for k, n in dist.most_common()))

    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump({'symbol': symbol, 'verdicts': out}, f, ensure_ascii=False, indent=1)
    return 0


if __name__ == '__main__':
    sys.exit(main())
