#!/usr/bin/env bash
# 워크플로가 도는 사이에 사람이 같은 파일을 밀어넣었을 때의 합류 절차.
#
# 왜 필요한가
#   이 워크플로는 실행에 20분 넘게 걸린다(브리핑·번역). 그 사이 세션에서
#   data/brief-history.json 이나 언어판 페이지를 고쳐 push 하면, 워크플로가
#   들고 있는 건 이미 옛 기준으로 만들어진 파일이다. 예전 폴백은
#   `git merge -X ours` 였는데, 그건 충돌 난 파일을 **워크플로 것으로 덮는다** —
#   사람이 방금 손으로 쓴 이슈 63건이 에러 하나 없이 사라질 수 있는 자리였다.
#
# 어떻게 바꿨나
#   충돌은 **원격(사람이 쓴 것) 우선**으로 합치고, 기계가 만드는 부분은
#   그 위에서 다시 굽는다. 생성기는 전부 멱등하고 캐시가 있으므로 재실행이
#   싸다 — 사람 손으로 쓴 것만 살리면 나머지는 저절로 복원된다.
#     · merge-naver-archive.py  — own_archive 만 새로 만든다(손으로 쓴 것 보존)
#     · brief-history-briefings.mjs — 글 URL 기준 캐시라 재호출이 거의 없다
#     · extract-judgment-timeline.py / translate / build-i18n — 전부 재생성 가능
#
# 되돌릴 수 없는 명령은 쓰지 않는다: reset --hard 없음, force push 없음,
# git add 는 파일 명시.
set -uo pipefail

git fetch origin main
# 충돌 시 원격(사람이 쓴 쪽)을 남긴다. 기계 산출물은 아래에서 다시 만든다.
git merge -X theirs origin/main --no-edit || {
  echo "::error::원격과 합류하지 못했다 — 이번 실행분은 커밋하지 않는다"
  exit 1
}

python3 scripts/merge-naver-archive.py || true
node scripts/brief-history-briefings.mjs --limit 100 || true
python3 scripts/extract-judgment-timeline.py || true
node scripts/translate-brief-history.mjs || true
python3 scripts/build-brief-history-i18n.py || true

git add data/naver-archive.json data/brief-history.json data/brief-history-*.json \
        data/brief-history-chart.json data/brief-history-verdicts.json \
        en/brief-history.html ja/brief-history.html zh/brief-history.html \
        es/brief-history.html pt/brief-history.html \
        data/.cache/brief-history-i18n.json data/.cache/brief-history-briefings.json \
        data/naver-content.json
if ! git diff --staged --quiet; then
  git commit -m "chore: naver content sync 재적용 $(TZ='Asia/Seoul' date +'%Y-%m-%d %H:%M KST')"
fi
git push origin main
