#!/bin/bash
# deploy.sh — ezlong 배포 스크립트
# 사용법: sh deploy.sh "커밋 메시지" 파일1 파일2 ...
# 예시:  sh deploy.sh "fix: 버그 수정" market-cycle.html
# 참고:  스크립트 위치 기준으로 자동 cd (심볼릭 링크 유무 무관)

set -e

MSG=${1:-"chore: 업데이트"}
shift
FILES=("$@")

cd "$(dirname "$0")"

# 0) .firebase 캐시 버림 (pull 전에 먼저 정리)
git checkout -- .firebase/ 2>/dev/null || true

# 1) 변경 파일 스테이징
if [ ${#FILES[@]} -gt 0 ]; then
  git add "${FILES[@]}"
else
  git add -u
fi

# 2) 로컬 커밋 먼저 (staged 변경사항이 있을 때만)
# ※ pull --rebase는 unstaged/staged 변경사항이 있으면 실패하므로 커밋을 먼저 함
if git diff --cached --quiet; then
  echo "커밋할 변경사항 없음. 배포만 진행합니다."
else
  git commit -m "$MSG"
fi

# 2-b) pull 전에 남은 unstaged 변경사항 전부 정리
# 원하는 파일은 위에서 이미 커밋됨. 잔여 변경사항은 버려도 안전.
git checkout -- . 2>/dev/null || true

# 3) 원격 동기화 (GitHub Actions 자동 커밋 통합)
echo ">>> 원격 동기화 중..."
git pull --rebase origin main

# 4) 푸시
if git status | grep -q "ahead"; then
  git push origin main
fi

# 5) Firebase 배포
firebase deploy --only hosting

echo ""
echo "✓ 배포 완료"
