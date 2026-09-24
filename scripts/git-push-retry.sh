#!/usr/bin/env bash
# 봇 커밋 경합용 push 재시도 (2026-09-23 신설)
#
# 무엇이 문제였나
#   봇 워크플로가 스무 개 넘게 같은 main 에 데이터를 커밋한다. 분이 겹치면
#   한쪽 push 가 'fetch first' 로 거부된다. 대부분의 워크플로는
#   `git push || (fetch && merge -X ours && push)` 로 **한 번만** 다시 밀었고,
#   그 사이 세 번째 봇이 또 밀면 그대로 실패했다. 실측(2026-09-21~23):
#   시간외 수집 2회, 한국주식 차트분석 1회, 감시견 1회, swing-view 1회가
#   전부 이 이유로 빨갛게 끝났다. 데이터가 틀린 게 아니라 못 올린 것이다.
#
# 무엇을 하나
#   밀어 보고, 막히면 원격을 받아 얹은 뒤 다시 민다. 기본 다섯 번, 사이에
#   2~6초를 무작위로 쉰다(같은 순간에 다시 부딪히지 않게).
#   - 작업트리가 깨끗하면 rebase: 내 커밋이 원격 커밋 뒤로 간다
#   - 손대지 않은 변경이 남아 있으면 rebase 가 위험하므로 merge -X ours
#     (기존 워크플로들이 쓰던 방식 그대로)
#   reset --hard 도, force push 도 쓰지 않는다(CLAUDE.md 1절 가드레일).
#
# 사용: 커밋을 마친 뒤 `bash scripts/git-push-retry.sh`
#       횟수를 바꾸려면 PUSH_ATTEMPTS=8 bash scripts/git-push-retry.sh
set -uo pipefail
ATTEMPTS="${PUSH_ATTEMPTS:-5}"

for i in $(seq 1 "$ATTEMPTS"); do
  if git push origin main; then
    [ "$i" -gt 1 ] && echo "push 성공 (${i}번째 시도)"
    exit 0
  fi
  echo "push 거부됨 — 원격을 받아 다시 얹는다 (${i}/${ATTEMPTS})"
  git fetch origin main || true
  # 얹는 방법은 둘이다. 깨끗하면 rebase(이력이 곧게 남는다), 충돌하거나 작업트리에
  # 변경이 남아 있으면 merge -X ours.
  #
  # 2026-09-23 실패에서 배운 것: 같은 파일을 두 워크플로가 고치면 rebase 는 충돌한다
  # (data/market-signals.json 은 'ATMR 시장 데이터 수집'과 '시간외 전용 수집'이 함께 쓴다).
  # 첫 판에서는 그때 바로 실패로 끝냈는데, 그건 예전 동작(merge -X ours)보다 나쁘다 -
  # 만들어 둔 데이터를 못 올리고 메일만 간다. 충돌하면 예전 방식으로 떨어진다.
  # -X ours 는 '충돌한 조각만' 내 것을 쓴다. 상대 워크플로가 만든 다른 파일은
  # 그대로 살아남는다(머지 자체는 양쪽을 합친다).
  rebased=""
  if git diff --quiet && git diff --cached --quiet; then
    if git rebase origin/main; then
      rebased=1
    else
      git rebase --abort || true
      echo "rebase 충돌 - 같은 파일을 둘이 고쳤다. merge -X ours 로 떨어진다"
    fi
  fi
  if [ -z "$rebased" ]; then
    git merge -X ours origin/main --no-edit || {
      echo "::error::merge 실패 - 수동 확인 필요"; exit 1
    }
  fi
  sleep $(( (RANDOM % 5) + 2 ))
done

echo "::error::push ${ATTEMPTS}회 재시도 실패 — 봇 커밋 경합이 계속된다"
exit 1
