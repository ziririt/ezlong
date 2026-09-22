#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""이슈(A Brief History) 차트 데이터 갱신 — data/brief-history-chart.json

무엇이 문제였나
  이슈 목록은 매일 갱신되는데 정작 그 밑에 깔린 가격 곡선은 정적 파일이었다.
  2026-07-30 에서 멈춰 있었고, 그 뒤 날짜의 이슈는 차트에 점도 안 찍히고
  등락 수치도 못 붙었다. 코너의 절반이 조용히 낡고 있었던 셈이다.

무엇을 하는가
  원래 정적 곡선(ANCHOR 2026-07-30 까지)은 단 하나도 다시 계산하지 않는다 -
  정규화 기준이나 배당 조정 방식이 조금만 달라도 6년치 곡선이 통째로 흔들린다.
  ANCHOR 뒤의 꼬리는 매 실행마다 **뉴욕 확정 종가로 처음부터 다시 잇는다**
  (2026-09-22 개정, main() 주석). 종가의 비율만 쓴다:
  새값 = 직전값 × (그날종가 / 직전날종가). 장이 끝나지 않은 날은 붙이지 않는다.

무엇으로 받나
  yfinance. 이 저장소의 다른 시세 파이프라인과 같은 경로를 쓴다(19항). 야후의
  공개 chart 엔드포인트를 직접 부르는 방식도 만들어 봤지만 쿠키·crumb 없이는
  429 로 막힌다 — 그 우회를 여기서 또 만들지 않는다.

실패에 대한 태도
  다섯 종목 중 하나라도 새 날짜 값이 비면 그 날짜는 통째로 건너뛴다. 배열
  길이가 어긋나면 화면이 엉뚱한 날짜에 값을 그린다 — 빠지는 것보다 나쁘다.

사용
  python3 scripts/fetch-brief-history-chart.py
  python3 scripts/fetch-brief-history-chart.py --dry
"""
import json
import os
import sys
import time
from datetime import datetime, timedelta, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
CHART = os.path.join(HERE, '..', 'data', 'brief-history-chart.json')

# 화면 범례와 같은 순서. SPY 는 VOO 로 프록시한다(기존 파일 주석과 동일 규칙).
SYMBOLS = [('QQQ', 'QQQ'), ('SPY', 'VOO'), ('SOXX', 'SOXX'), ('TSLA', 'TSLA'), ('NVDA', 'NVDA')]
KST = timezone(timedelta(hours=9))


def fetch_daily(ticker, start, tries=3):
    """일봉 종가 {날짜: 종가}. 조정 없는 원종가 — 비율만 쓰므로 충분하다."""
    import yfinance as yf
    last_err = None
    for attempt in range(tries):
        try:
            h = yf.Ticker(ticker).history(start=start, interval='1d', auto_adjust=False)
            closes = h['Close'].dropna()
            return {d.strftime('%Y-%m-%d'): float(v) for d, v in closes.items()}
        except Exception as e:                       # noqa: BLE001 — 재시도로 흡수
            last_err = e
            time.sleep(2 * (attempt + 1))
    print(f'::warning::{ticker} 수신 실패 — {last_err}')
    return {}


# 원래 정적 곡선의 마지막 날. 이 날까지는 손대지 않는다(6년치 정규화 곡선).
# 이 날 이후는 매 실행마다 **확정 종가로 처음부터 다시 잇는다.**
ANCHOR = '2026-07-30'
# 뉴욕 정규장 마감(16:00 ET) 뒤 여유. 이 시각 전의 '오늘' 일봉은 장중 값이다.
CLOSE_GRACE_ET = (16, 20)


def ny_closed_through():
    """확정 종가가 나온 마지막 뉴욕 날짜(YYYY-MM-DD). 오늘 장이 끝나기 전이면 어제."""
    from zoneinfo import ZoneInfo
    now_et = datetime.now(ZoneInfo('America/New_York'))
    today = now_et.date()
    if (now_et.hour, now_et.minute) >= CLOSE_GRACE_ET:
        return today.strftime('%Y-%m-%d')
    return (today - timedelta(days=1)).strftime('%Y-%m-%d')


def main():
    """2026-09-22 개정: append-only 를 버리고 ANCHOR 이후 꼬리를 매번 재구성한다.

    무엇이 틀렸나
      이 스크립트는 KST 23:01(뉴욕 10:01) 에도 돈다. 그때 yfinance 의 '오늘' 일봉은
      장중 가격이다. 그 값을 붙인 뒤 다음 실행은 "붙일 새 거래일이 없다"며 지나가,
      **장중 가격이 그 날의 값으로 영구히 굳었다.** 다음 날은 그 굳은 값에 비율을
      곱하므로 오차가 뒤로 계속 누적됐다. 2026-09-22 실측: 8/10 이후 36거래일 중
      다수가 장중 값, NVDA 곡선 끝값 +8.5% 과대, 일간 등락 최대 3.3%p 차이.
      이슈 카드의 '그날 지수 등락'(moves)과 상승·하락 순위가 이 곡선에서 나온다.

    어떻게 막나
      ① 뉴욕 장이 끝나지 않은 날짜는 아예 붙이지 않는다(ny_closed_through).
      ② ANCHOR 뒤의 꼬리는 누적하지 않고 확정 종가로 매번 새로 잇는다.
         한 번 틀린 값이 들어가도 다음 실행이 스스로 고친다.
      ANCHOR 이전(원래 정적 곡선)은 여전히 한 자리도 다시 계산하지 않는다.
    """
    dry = '--dry' in sys.argv
    with open(CHART, encoding='utf-8') as f:
        doc = json.load(f)

    dates = doc['dates']
    if ANCHOR not in dates:
        print(f'::error::기준일 {ANCHOR} 이 차트에 없다 - 재구성할 수 없다')
        return 1
    ai = dates.index(ANCHOR)
    old_tail = dates[ai + 1:]
    old_vals = {k: doc[k][ai + 1:] for k, _ in SYMBOLS}
    cutoff = ny_closed_through()

    start = (datetime.strptime(ANCHOR, '%Y-%m-%d') - timedelta(days=10)).strftime('%Y-%m-%d')
    try:
        import yfinance  # noqa: F401
    except ImportError:
        print('::error::yfinance 가 없다 - 갱신 중단')
        return 1

    series = {}
    for key, ticker in SYMBOLS:
        series[key] = fetch_daily(ticker, start)
        if ANCHOR not in series[key]:
            print(f'::error::{key}({ticker}) 에 기준일 {ANCHOR} 종가가 없다 - 파일을 쓰지 않는다')
            return 1

    cand = sorted(d for d in series['QQQ'] if ANCHOR < d <= cutoff)
    complete = [d for d in cand if all(d in series[k] for k, _ in SYMBOLS)]
    dropped = [d for d in cand if d not in complete]
    if dropped:
        print('::warning::일부 종목 값이 비어 건너뛴 날짜 - ' + ', '.join(dropped))

    # 꼬리가 줄어들면 데이터를 잃는다. 장중에 붙었던 마지막 하루가 빠지는 것만 허용한다.
    lost = [d for d in old_tail if d not in complete and d <= cutoff]
    if lost:
        print('::error::이미 있던 날짜가 새 수신에서 빠졌다 - 파일을 쓰지 않는다: ' + ', '.join(lost[:5]))
        return 1

    new_vals = {k: [] for k, _ in SYMBOLS}
    for key, _ in SYMBOLS:
        prev_v, prev_d = doc[key][ai], ANCHOR
        for d in complete:
            v = round(prev_v * (series[key][d] / series[key][prev_d]), 3)
            new_vals[key].append(v)
            prev_v, prev_d = v, d

    changed = (complete != old_tail) or any(new_vals[k] != old_vals[k] for k, _ in SYMBOLS)
    if not changed:
        print(f'바뀐 것이 없다 (확정 종가 기준 마지막 {complete[-1] if complete else ANCHOR})')
        return 0

    # 무엇을 고쳤는지 남긴다: 끝값 차이와 새로 붙은/빠진 날짜
    added = [d for d in complete if d not in old_tail]
    removed = [d for d in old_tail if d not in complete]
    if added:
        print('새로 붙인 날짜: ' + ', '.join(added))
    if removed:
        print('뺀 날짜(장이 끝나기 전에 붙었던 값): ' + ', '.join(removed))
    for key, _ in SYMBOLS:
        common = [i for i, d in enumerate(complete) if d in old_tail]
        if common:
            i = common[-1]
            o = old_vals[key][old_tail.index(complete[i])]
            print(f'  {key} {complete[i]} {o} -> {new_vals[key][i]} ({(new_vals[key][i] / o - 1) * 100:+.2f}%)')

    doc['dates'] = dates[:ai + 1] + complete
    for key, _ in SYMBOLS:
        doc[key] = doc[key][:ai + 1] + new_vals[key]

    n = len(doc['dates'])
    for key, _ in SYMBOLS:
        if len(doc[key]) != n:
            print(f'::error::{key} 배열 길이 불일치 ({len(doc[key])} vs {n}) - 파일을 쓰지 않는다')
            return 1

    doc['generatedAt'] = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
    doc['updatedKST'] = datetime.now(KST).strftime('%Y-%m-%d %H:%M KST')
    doc['closedThroughET'] = cutoff

    print(f'재구성 완료 -> {doc["dates"][-1]} (총 {n}일, 기준일 뒤 {len(complete)}일)')
    if dry:
        print('--dry - 파일을 쓰지 않았다')
        return 0
    with open(CHART, 'w', encoding='utf-8') as f:
        json.dump(doc, f, ensure_ascii=False)
    return 0


if __name__ == '__main__':
    sys.exit(main())
