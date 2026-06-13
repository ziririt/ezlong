#!/bin/bash
# ============================================================
#  ezlong.com — 세션 전 즉시 백업 스크립트
#  사용법: sh backup-before-session.sh
#  저장 위치: ~/Documents/ezlong-backups/  (iCloud 자동 동기화)
# ============================================================

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_ROOT="$HOME/Documents/ezlong-backups"
BACKUP_DIR="$BACKUP_ROOT/session_$TIMESTAMP"

echo "======================================"
echo " ezlong 세션 전 백업: $TIMESTAMP"
echo " 저장: $BACKUP_DIR"
echo "======================================"

mkdir -p "$BACKUP_DIR"

# 핵심 HTML 파일 (중복 사본 제외)
echo "→ HTML 백업 중..."
COPIED=0
for f in "$PROJECT_DIR"/*.html; do
  FILENAME=$(basename "$f")
  # 중복 사본 건너뜀
  [[ "$FILENAME" == *" (1)"* ]] && continue
  [[ "$FILENAME" == *" (2)"* ]] && continue
  [[ "$FILENAME" == *" 2."* ]] && continue
  [[ "$FILENAME" == *" 3."* ]] && continue
  [[ "$FILENAME" == *" copy"* ]] && continue
  cp "$f" "$BACKUP_DIR/"
  COPIED=$((COPIED + 1))
done
echo "  ✓ HTML $COPIED개 복사"

# scripts 폴더
echo "→ scripts 백업 중..."
if [ -d "$PROJECT_DIR/scripts" ]; then
  cp -r "$PROJECT_DIR/scripts" "$BACKUP_DIR/"
  echo "  ✓ scripts/ 복사"
fi

# 핵심 이미지
echo "→ 이미지 백업 중..."
for img in wallstreet.png logo.png logo-darkmode.png; do
  if [ -f "$PROJECT_DIR/$img" ]; then
    cp "$PROJECT_DIR/$img" "$BACKUP_DIR/"
    echo "  ✓ $img"
  fi
done

# git 상태 기록
echo "→ git 상태 기록 중..."
cd "$PROJECT_DIR"
{
  echo "=== git log (최근 5커밋) ==="
  git log --oneline -5 2>/dev/null || echo "git 없음"
  echo ""
  echo "=== git status ==="
  git status --short 2>/dev/null || echo "git 없음"
} > "$BACKUP_DIR/git_state.txt"
echo "  ✓ git_state.txt"

# 10일 이상 된 백업 자동 삭제
echo "→ 오래된 백업 정리 중..."
if [ -d "$BACKUP_ROOT" ]; then
  find "$BACKUP_ROOT" -maxdepth 1 -name "session_*" -type d -mtime +10 | while read old; do
    rm -rf "$old"
    echo "  → 삭제: $(basename "$old")"
  done
fi

echo ""
echo "======================================"
echo " ✅ 백업 완료!"
echo " 위치: $BACKUP_DIR"
echo " HTML: $COPIED개 | iCloud 자동 동기화 중"
echo "======================================"
echo ""
echo " 복구 방법:"
echo "   특정 파일: cp \"$BACKUP_DIR/analyst-reports.html\" \"$PROJECT_DIR/\""
echo "   전체 복구: cp -r \"$BACKUP_DIR\"/*.html \"$PROJECT_DIR/\""
echo ""
echo " 이제 Claude 세션을 시작하세요."
