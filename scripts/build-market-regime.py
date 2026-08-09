#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""BFRS 스냅샷을 화면이 읽을 두 파일로 나눈다.

왜 나누나
  엔진이 만드는 스냅샷은 2.2MB인데 그중 1.42MB가 장기 히스토리 한 덩어리다.
  나머지(오늘 판정·역할별 상태·점수·국면 변화 기록)는 다 합쳐 13KB밖에 안 된다.
  폰에서 2.2MB를 그대로 받게 두면 첫 화면이 늦다. 그래서
    · data/market-regime.json          — 오늘 판정. 작다. 먼저 그린다.
    · data/market-regime-history.json  — 차트용 장기 기록. 뒤이어 받는다.
  로 나눈다.

히스토리를 왜 배열로 바꾸나
  원본은 한 날짜가 객체 하나(키 12개)라 키 이름이 5,486번 반복된다. 같은
  데이터를 열별 배열로 세우면 200KB 안쪽이 된다. 브라우저에서 다시 조립한다.

무엇을 싣지 않나
  backtest — 화면에 노출하지 않기로 한 것이라 아예 내보내지 않는다.
  날짜별 signals 문자열도 싣지 않는다. 구간 요약(risk_episodes)에 이미 있고,
  5,486일치를 문자열로 실으면 그것만으로 히스토리가 다시 무거워진다.

사용
  python3 scripts/build-market-regime.py --snapshot .bfrs-work/bfrs-snapshot.json
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
OUT_TODAY = os.path.join(ROOT, 'data', 'market-regime.json')
OUT_HIST = os.path.join(ROOT, 'data', 'market-regime-history.json')

# 위험 등급 — 색과 순서를 화면과 한 곳에서 맞춘다.
LEVELS = ['정상', '선행 경고', '경계', '추세 붕괴', '투매']


def argof(name, default=None):
    argv = sys.argv[1:]
    return argv[argv.index(name) + 1] if name in argv and len(argv) > argv.index(name) + 1 else default


def main():
    src = argof('--snapshot', os.path.join(ROOT, '.bfrs-work', 'bfrs-snapshot.json'))
    with open(src, encoding='utf-8') as f:
        snap = json.load(f)

    hist = snap.get('market_risk_history') or []
    if len(hist) < 500:
        print(f'::error::히스토리가 너무 짧다({len(hist)}일) — 쓰지 않는다')
        return 1

    today = {
        'system': snap.get('system'),
        'asOf': snap.get('as_of'),
        'regime': snap.get('regime'),
        'regimeKo': snap.get('regime_ko'),
        'scores': snap.get('scores'),
        'components': snap.get('components'),
        'market': snap.get('market'),
        'roles': snap.get('market_roles'),
        'cross': snap.get('cross_market'),
        'nextConditions': snap.get('next_conditions'),
        'transitions': snap.get('transitions'),
        'episodes': snap.get('risk_episodes'),
        'dataQuality': snap.get('data_quality'),
        'levels': LEVELS,
    }

    # 열별 배열. 가격은 소수 둘째, 지수화 값은 소수 첫째까지면 화면에 충분하다.
    def col(key, nd):
        return [None if r.get(key) is None else round(float(r[key]), nd) for r in hist]

    history = {
        'asOf': snap.get('as_of'),
        'frequency': snap.get('market_risk_history_frequency', 'daily'),
        'dates': [r['date'] for r in hist],
        'spy': col('spy_price', 2),
        'qqq': col('qqq_price', 2),
        'soxx': col('soxx_price', 2),
        # 세 지수를 한 화면에 겹쳐 보려면 시작점을 100으로 맞춘 값이 필요하다
        'spyIdx': col('spy', 1),
        'qqqIdx': col('qqq', 1),
        'soxxIdx': col('soxx', 1),
        'severity': [int(r.get('severity') or 0) for r in hist],
    }

    os.makedirs(os.path.join(ROOT, 'data'), exist_ok=True)
    with open(OUT_TODAY, 'w', encoding='utf-8') as f:
        json.dump(today, f, ensure_ascii=False, indent=1)
    with open(OUT_HIST, 'w', encoding='utf-8') as f:
        json.dump(history, f, ensure_ascii=False, separators=(',', ':'))

    a = os.path.getsize(OUT_TODAY)
    b = os.path.getsize(OUT_HIST)
    print(f'기준일 {today["asOf"]} · 국면 {today["regimeKo"]}')
    print(f'오늘 판정 {a:,}바이트 · 히스토리 {len(hist):,}일 {b:,}바이트')
    return 0


if __name__ == '__main__':
    sys.exit(main())
