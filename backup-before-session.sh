#!/bin/bash
# ============================================================
# ezlong.com 세션 전 필수 백업 스크립트
# 사용법: 터미널에서 cd ~/Documents/Claude/Projects/미국주식투자자를\ 위한\ ezlong.com
#         그 다음 sh backup-before-session.sh
# ============================================================

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="$PROJECT_DIR/.backup/session_$TIMESTAMP"

echo "======================================"
echo " ezlong 세션 전 백업 시작: $TIMESTAMP"
echo "======================================"

mkdir -p "$BACKUP_DIR"

# 핵심 HTML 파일 목록
CORE_HTML=(
  "analyst-reports.html"
  "atmr-dashboard.html"
  "chart-analysis.html"
  "compound-calculator.html"
  "dca-simulator.html"
  "market-cycle.html"
  "portfolio-rebalancer.html"
  "tax-calculator.html"
  "retirement-calculator.html"
  "backtest.html"
  "investor-type.html"
  "dca-guide.html"
  "admin.html"
  "_template.html"
)

echo "→ HTML 파일 백업 중..."
for f in "${CORE_HTML[@]}"; do
  if [ -f "$PROJECT_DIR/$f" ]; then
    cp "$PROJECT_DIR/$f" "$BACKUP_DIR/"
    echo "  ✓ $f"
  fi
done

echo "→ scripts 폴더 백업 중..."
cp -r "$PROJECT_DIR/scripts" "$BACKUP_DIR/" 2>/dev/null && echo "  ✓ scripts/" || echo "  - scripts/ 없음"

echo "→ 핵심 이미지 백업 중..."
for img in wallstreet.png logo.png logo-darkmode.png; do
  if [ -f "$PROJECT_DIR/$img" ]; then
    cp "$PROJECT_DIR/$img" "$BACKUP_DIR/"
    echo "  ✓ $img"
  fi
done

echo "→ git 현재 커밋 기록..."
cd "$PROJECT_DIR"
git log --oneline -3 > "$BACKUP_DIR/git_state.txt" 2>/dev/null
git status --short >> "$BACKUP_DIR/git_state.txt" 2>/dev/null
echo "  ✓ git_state.txt 저장"

echo ""
echo "======================================"
echo " 백업 완료 → $BACKUP_DIR"
echo " 파일 수: $(ls "$BACKUP_DIR"/*.html 2>/dev/null | wc -l | tr -d ' ')개 HTML"
echo "======================================"
echo ""
echo "이제 Claude 세션을 시작하세요."
echo "문제 발생 시 이 폴더의 파일로 복구하세요."
