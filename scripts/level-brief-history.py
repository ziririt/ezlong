#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""소사 자동 기록(own_archive)에 '핵심·주요·기록' 등급을 매긴다.

왜 필요한가 (2026-11-13)
  등급 2·3(주요·핵심)은 지금까지 손으로 쓴 소사(own_article)에서만 나왔다.
  merge-naver-archive.py 가 만드는 자동 기록은 무조건 1(기록)이다. 그래서
  손 큐레이션이 7월 말에 끊기자 8월 이후 석 달 넘게 달력 전체가 회색 점이
  됐다. QQQ -6.5%, SOXX -12% 였던 11월 5일조차 '기록'이었다.
  등급을 사람의 손에 걸어 두면 손이 멈출 때 같이 멈춘다. 그날 지수가 얼마나
  움직였는지로 기계가 매긴다.

기준 (손 큐레이션 85건에서 역산)
  핵심(3): |QQQ| >= 2.0% 또는 |SOXX| >= 5.0%
  주요(2): |QQQ| >= 1.2% 또는 |SOXX| >= 3.0%
  나머지는 기록(1).
  손으로 고른 핵심 23건은 이 기준으로도 23건 모두 핵심이다. 주요 62건은
  41건 일치, 12건은 한 단계 위, 9건은 한 단계 아래(편집 판단으로 고른 날).

무엇을 건드리나
  source == 'own_archive' 항목의 importance 만. 손으로 쓴 항목(own_article,
  external_knowledge*)은 손대지 않는다. 등락은 data/brief-history-chart.json
  에서 계산한다(그날 차트가 아직 없으면 1로 두고, 다음 실행에서 다시 본다).

순서
  merge-naver-archive.py 가 매번 own_archive 를 등급 1로 새로 만든다. 그러니
  이 스크립트는 반드시 merge 바로 뒤에, 매 실행 돈다(멱등).

사용
  python3 scripts/level-brief-history.py
  python3 scripts/level-brief-history.py --dry
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, '..', 'data')
EVENTS = os.path.join(DATA, 'brief-history.json')
CHART = os.path.join(DATA, 'brief-history-chart.json')

GEN_SOURCE = 'own_archive'
LANGS = ('en', 'ja', 'zh', 'es', 'pt')
CORE = {'QQQ': 2.0, 'SOXX': 5.0}
MAJOR = {'QQQ': 1.2, 'SOXX': 3.0}


def daily_changes(chart):
    """날짜 -> {심볼: 전일 대비 등락률(%)}"""
    dates = chart['dates']
    out = {}
    for i in range(1, len(dates)):
        row = {}
        for sym in ('QQQ', 'SOXX'):
            a = chart.get(sym) or []
            if i < len(a) and a[i] is not None and a[i - 1]:
                row[sym] = (a[i] / a[i - 1] - 1) * 100
        if row:
            out[dates[i]] = row
    return out


def level_of(row):
    if not row:
        return 1
    if any(abs(row.get(s, 0)) >= t for s, t in CORE.items()):
        return 3
    if any(abs(row.get(s, 0)) >= t for s, t in MAJOR.items()):
        return 2
    return 1


def main():
    dry = '--dry' in sys.argv
    with open(EVENTS, encoding='utf-8') as f:
        events = json.load(f)
    with open(CHART, encoding='utf-8') as f:
        chg = daily_changes(json.load(f))

    changed = 0
    tally = {1: 0, 2: 0, 3: 0}
    for e in events:
        if e.get('source') != GEN_SOURCE:
            continue
        lv = level_of(chg.get(e.get('date')))
        tally[lv] += 1
        if e.get('importance') != lv:
            e['importance'] = lv
            changed += 1

    print(f'[등급] 자동 기록 {sum(tally.values())}건: 핵심 {tally[3]} · 주요 {tally[2]} · 기록 {tally[1]} '
          f'(바뀐 항목 {changed}건)')

    # 안전망: 최근 60거래일에 크게 움직인 날이 있는데 등급 2 이상이 하나도 없으면
    # 어딘가 끊긴 것이다. 실패로 끝내지는 않고(다른 단계를 막지 않게) 경고만 남긴다.
    recent = sorted(chg)[-60:]
    big = [d for d in recent if level_of(chg[d]) >= 2]
    lvl_by_date = {}
    for e in events:
        lvl_by_date[e['date']] = max(lvl_by_date.get(e['date'], 0), e.get('importance', 1))
    if big and not any(lvl_by_date.get(d, 0) >= 2 for d in big):
        print(f'::warning::[등급] 최근 60거래일 큰 움직임 {len(big)}일인데 주요·핵심 0건 — 등급 단계 점검 필요')

    if dry:
        return
    if changed:
        with open(EVENTS, 'w', encoding='utf-8') as f:
            json.dump(events, f, ensure_ascii=False, indent=1)   # merge 와 같은 모양(끝 줄바꿈 없음)

    # 번역판에도 같은 등급을 싣는다. 번역 단계는 키가 없으면 통째로 건너뛰므로,
    # 거기에만 맡기면 언어판 달력이 한국어판과 다른 색이 된다.
    want = {e['date']: e['importance'] for e in events if e.get('source') == GEN_SOURCE}
    for lang in LANGS:
        path = os.path.join(DATA, f'brief-history-{lang}.json')
        if not os.path.exists(path):
            continue
        with open(path, encoding='utf-8') as f:
            tr = json.load(f)
        n = 0
        for e in tr:
            if e.get('source') == GEN_SOURCE and e.get('date') in want and e.get('importance') != want[e['date']]:
                e['importance'] = want[e['date']]
                n += 1
        if n:
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(tr, f, ensure_ascii=False, indent=1)
            print(f'[등급] {lang} 번역판 {n}건 맞춤')


if __name__ == '__main__':
    main()
