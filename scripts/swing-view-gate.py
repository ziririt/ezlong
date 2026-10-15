#!/usr/bin/env python3
"""스윙 판단(swing-view) 실행 관문 - 지금 돌 차례인가.

2026-10-16 신설. 그 전에는 예약 실행만 ET 시각으로 걸렀고 수동 실행(감시견의
되살리기)은 무조건 통과시켰다. 실측(9/25~10/15): 깃허브 예약 실행이 2~4시간씩
밀려 '개장 +15분'과 '마감 후' 슬롯이 거의 매일 창을 놓쳐 건너뛰어졌고, 그 공백을
감시견이 ET 14시대(KST 새벽 3시대)에 되살렸다. 결과적으로 평일 판단은
'프리마켓 + 장중 오후' 두 번이었다. 운영 지시는 정반대였다:
"장중은 한국 시각 12시까지만, 그 뒤로는 하지 마라. 마감 후에도 1번만."

규칙(평일, ET 기준):
  pre   04:00~09:29 ET
  open  09:30 ET ~ 한국 시각 자정(UTC 15:00) 전
  post  18:30~23:59 ET  (차트분석 엔진의 마감 후 갱신이 끝난 뒤)
그 밖의 시각은 돌지 않는다. 같은 ET 날짜에 같은 슬롯을 이미 돌았으면 돌지 않는다.
예약 실행이든 감시견의 수동 실행이든 똑같이 이 관문을 지난다.
주말은 스크립트가 forDay 로 중복을 막으므로 그대로 통과시킨다.

출력: GitHub step output 형식 'go=yes|no' 한 줄과 사람이 읽을 이유 한 줄(stderr).
"""
import json
import os
import sys
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

ET = ZoneInfo('America/New_York')
HERE = os.path.dirname(os.path.abspath(__file__))
VIEW = os.path.join(HERE, '..', 'data', 'swing-view.json')

PRE = (240, 569)
OPEN_START = 570
POST = (1110, 1439)
KST_MIDNIGHT_UTC_H = 15


def slot_of(t_utc):
    """그 시각이 어느 슬롯 창 안인가 - 'pre' | 'open' | 'post' | None (평일만)."""
    et = t_utc.astimezone(ET)
    if et.weekday() >= 5:
        return None
    m = et.hour * 60 + et.minute
    if PRE[0] <= m <= PRE[1]:
        return 'pre'
    if m >= OPEN_START and t_utc.astimezone(timezone.utc).hour < KST_MIDNIGHT_UTC_H \
            and t_utc.astimezone(timezone.utc).date() == et.date():
        return 'open'
    if POST[0] <= m <= POST[1]:
        return 'post'
    return None


def prev_slot_of(t_utc):
    """지난 실행이 어느 슬롯 몫이었나 - 창 밖에서 돈 실행도 국면으로 분류한다.
    (예: ET 14:49 에 돈 되살리기는 'open' 몫으로 친다 - 그날 개장 슬롯을 다시
    돌리지 않는다)"""
    et = t_utc.astimezone(ET)
    m = et.hour * 60 + et.minute
    if m < OPEN_START:
        return 'pre'
    if m < 960:
        return 'open'
    return 'post'


def decide(now_utc, event, force, prev):
    """(go, slot, 이유). prev 는 직전 swing-view.json 의 dict(없으면 None)."""
    if event == 'push':
        return 'yes', '', 'push 실행 - 코드 변경 확인용으로 그대로 진행(어느 슬롯 몫도 아니다)'
    if force == 'yes':
        return 'yes', '', '수동 강제 실행(force=yes) - 어느 슬롯 몫도 아니다'
    et = now_utc.astimezone(ET)
    if et.weekday() >= 5:
        return 'yes', '', '주말 - 새 주 전망 슬롯(스크립트가 forDay 로 중복을 막는다)'
    slot = slot_of(now_utc)
    if slot is None:
        return 'no', '', f'ET {et:%H:%M} - 도는 창 밖(장중은 한국 시각 자정까지만, 마감 후는 18:30 ET 부터)'
    if prev and prev.get('generatedAt'):
        try:
            g = str(prev['generatedAt'])
            pt = datetime.fromisoformat(g.replace('Z', '+00:00'))
            if pt.tzinfo is None:
                pt = pt.replace(tzinfo=timezone.utc)
            pe = pt.astimezone(ET)
            # 관문이 붙인 슬롯이 있으면 그것만 믿는다. push·강제 실행(None)은 어느
            # 슬롯도 채우지 않는다. gateSlot 키 자체가 없는 옛 파일만 시각으로 분류한다.
            prev_slot = prev['gateSlot'] if 'gateSlot' in prev else prev_slot_of(pt)
            if pe.date() == et.date() and prev_slot == slot:
                return 'no', '', f'ET {et:%m-%d} {slot} 슬롯은 이미 돌았다(직전 생성 {pe:%H:%M} ET)'
        except Exception as e:  # noqa: BLE001 - 읽기 실패는 '돈다'로 둔다
            print(f'직전 생성 시각을 못 읽었다({e}) - 그대로 진행', file=sys.stderr)
    return 'yes', slot, f'ET {et:%H:%M} - {slot} 슬롯'


def main():
    event = os.environ.get('EVENT', '')
    force = (os.environ.get('FORCE') or '').strip().lower()
    prev = None
    try:
        with open(VIEW, encoding='utf-8') as f:
            prev = json.load(f)
        if not isinstance(prev, dict):
            prev = None
    except Exception as e:  # noqa: BLE001
        print(f'swing-view.json 을 못 읽었다({e})', file=sys.stderr)
    go, slot, why = decide(datetime.now(timezone.utc), event, force, prev)
    print(why, file=sys.stderr)
    print(f'go={go}')
    print(f'slot={slot}')


if __name__ == '__main__':
    main()
