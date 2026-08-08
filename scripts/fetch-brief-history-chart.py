#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""이슈(A Brief History) 차트 데이터 갱신 — data/brief-history-chart.json

무엇이 문제였나
  이슈 목록은 매일 갱신되는데 정작 그 밑에 깔린 가격 곡선은 정적 파일이었다.
  2026-07-30 에서 멈춰 있었고, 그 뒤 날짜의 이슈는 차트에 점도 안 찍히고
  등락 수치도 못 붙었다. 코너의 절반이 조용히 낡고 있었던 셈이다.

무엇을 하는가
  마지막 날짜 이후의 일봉만 받아 **이어 붙인다**(append-only). 과거 값은
  단 하나도 다시 계산하지 않는다 — 정규화 기준이나 배당 조정 방식이 조금만
  달라도 6년치 곡선이 통째로 흔들리기 때문이다. 이어 붙일 때는 종가의 비율만
  쓴다: 새값 = 직전값 × (오늘종가 / 직전날종가).

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


def main():
    dry = '--dry' in sys.argv
    with open(CHART, encoding='utf-8') as f:
        doc = json.load(f)

    dates = doc['dates']
    last = dates[-1]
    last_dt = datetime.strptime(last, '%Y-%m-%d').replace(tzinfo=timezone.utc)

    # 마지막 날짜를 포함해서 받아야 이어 붙일 기준 종가가 생긴다.
    start = (last_dt - timedelta(days=10)).strftime('%Y-%m-%d')

    try:
        import yfinance  # noqa: F401
    except ImportError:
        print('::error::yfinance 가 없다 — 갱신 중단')
        return 1

    series = {}
    for key, ticker in SYMBOLS:
        series[key] = fetch_daily(ticker, start)
        if last not in series[key]:
            print(f'::error::{key}({ticker}) 에 기준일 {last} 종가가 없다 — 이어 붙일 수 없다')
            return 1

    # 새로 붙일 날짜 = 다섯 종목이 모두 값을 가진, 기준일 이후의 날짜
    new_dates = sorted(d for d in series['QQQ'] if d > last)
    complete = [d for d in new_dates if all(d in series[k] for k, _ in SYMBOLS)]
    dropped = [d for d in new_dates if d not in complete]
    if dropped:
        print('::warning::일부 종목 값이 비어 건너뛴 날짜 — ' + ', '.join(dropped))

    if not complete:
        print(f'붙일 새 거래일이 없다 (마지막 {last})')
        return 0

    for d in complete:
        for key, _ in SYMBOLS:
            base_close = series[key][last]
            doc[key].append(round(doc[key][-1] * (series[key][d] / base_close), 3))
        # 다음 날짜는 방금 붙인 날 기준으로 이어야 한다
        last = d
        doc['dates'].append(d)

    # 길이 검증 — 어긋난 채로 저장하면 화면이 엉뚱한 날짜에 값을 그린다
    n = len(doc['dates'])
    for key, _ in SYMBOLS:
        if len(doc[key]) != n:
            print(f'::error::{key} 배열 길이 불일치 ({len(doc[key])} vs {n}) — 파일을 쓰지 않는다')
            return 1

    doc['generatedAt'] = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
    doc['updatedKST'] = datetime.now(KST).strftime('%Y-%m-%d %H:%M KST')

    print(f'{len(complete)}거래일 추가 → {doc["dates"][-1]} (총 {n}일)')
    for key, _ in SYMBOLS:
        print(f'  {key} {doc[key][-1]}')

    if dry:
        print('--dry — 파일을 쓰지 않았다')
        return 0
    with open(CHART, 'w', encoding='utf-8') as f:
        json.dump(doc, f, ensure_ascii=False)
    return 0


if __name__ == '__main__':
    sys.exit(main())
