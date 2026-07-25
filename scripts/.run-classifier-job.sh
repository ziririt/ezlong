#!/bin/sh
# 분류기 관련 장시간 작업을 백그라운드로 띄우는 런처.
#
# 왜 필요한가: 맥 원격 실행(osascript do shell script)은 명령 문자열에 '&'가
# 들어가면 osascript 호출 자체가 백그라운드로 넘어가 실패한다. 또 do shell
# script는 기본 120초에서 타임아웃되는데, 20장×3회 판정은 그보다 오래 걸린다.
# 그래서 '&'를 이 파일 안에 가둬두고, 원격에서는 인자만 바꿔 호출한다.
#
# 사용법:
#   sh scripts/.run-classifier-job.sh validate            # 20장 검증
#   sh scripts/.run-classifier-job.sh import <폴더> [옵션...]  # 수동 사진 등록
#
# 로그는 항상 /tmp/classifier-job.log 에 쌓이고, 끝나면 마지막 줄에
# "JOB_DONE <종료코드>" 가 찍힌다(호출측이 완료를 판별하는 신호).

REPO="/Users/ziririt/Documents/Claude/Projects/미국주식투자자를 위한 ezlong.com"
NODE="/opt/homebrew/bin/node"
LOG="/tmp/classifier-job.log"

MODE="$1"
shift 2>/dev/null

cd "$REPO" || exit 1
rm -f "$LOG"

case "$MODE" in
  validate)
    nohup sh -c "\"$NODE\" scripts/validate-photo-classifier.mjs >> \"$LOG\" 2>&1; echo \"JOB_DONE \$?\" >> \"$LOG\"" >/dev/null 2>&1 &
    ;;
  import)
    DIR="$1"
    shift 2>/dev/null
    nohup sh -c "\"$NODE\" scripts/import-photos-r2.js --dir=\"$DIR\" $* >> \"$LOG\" 2>&1; echo \"JOB_DONE \$?\" >> \"$LOG\"" >/dev/null 2>&1 &
    ;;
  *)
    echo "알 수 없는 모드: $MODE" >&2
    exit 1
    ;;
esac

echo "launched: $MODE (로그: $LOG)"
