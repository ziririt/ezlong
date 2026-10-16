#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""이슈(A Brief History) — 네이버 채널 글 전체를 날짜축에 얹는다.

무엇을 하는가
  · data/naver-archive.json(전체 목록) + data/naver-content.json(최근분)을
    합쳐, 각 글을 '그 글이 다루는 장(場)의 날짜'에 매단다.
  · 손으로 고른 이슈(importance 2·3)가 이미 있는 날이면 그 카드에 그날의
    다른 글 링크만 덧붙이고, 없는 날이면 importance 1 '기록' 항목을 만든다.

무엇을 하지 않는가
  · 손으로 쓴 이슈(제목·요약·importance·moves)는 건드리지 않는다. 판단이
    들어간 문장이라 기계가 덮으면 안 된다.
  · 본문 요약(브리핑)을 만들지 않는다 — 그건 scripts/brief-history-briefings.mjs
    가 이 스크립트 뒤에 이어서 한다. 여기서는 날짜축에 얹는 일만 한다.

멱등성
  생성분은 source='own_archive' 로 표시하고, 매 실행 첫 단계에서 그걸 통째로
  걷어낸 뒤 다시 만든다. 몇 번을 돌려도 결과가 같다.

사용
  python3 scripts/merge-naver-archive.py
  python3 scripts/merge-naver-archive.py --dry
"""
import json
import os
import re
import sys
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, '..', 'data')
ARCHIVE = os.path.join(DATA, 'naver-archive.json')
RECENT = os.path.join(DATA, 'naver-content.json')
EVENTS = os.path.join(DATA, 'brief-history.json')
CHART = os.path.join(DATA, 'brief-history-chart.json')

KST = ZoneInfo('Asia/Seoul')
ET = ZoneInfo('America/New_York')
GEN_SOURCE = 'own_archive'
# ── 인사이트 타임스(2026-10-16) ──────────────────────────────────────────
# 같은 필자가 운영하는 insightimes.com 을 이 코너의 근거 글로 쓴다(운영 지시:
# 네이버 프리미엄보다 자기 사이트로 잇는다). 인사이트 타임스에는 2026-09-01 부터
# 글이 있고, 2026-09-14 부터 매일 장 마감 정리(분류 '시황')가 올라온다.
#   IT_FROM      이날부터 그날 카드에 인사이트 타임스 글을 함께 싣는다.
#   IT_ONLY_FROM 이날부터는 인사이트 타임스 글만 근거로 쓴다(그날 글이 있으면).
#                그 전 2주는 시황이 없어 네이버 시황을 앞에 두고 인사이트 타임스를 뒤에 단다
#                - 카드 브리핑은 그날 장 마감 정리를 재료로 쓰기 때문이다.
IT_ARCHIVE = os.path.join(DATA, 'insightimes-archive.json')
IT_FROM = '2026-09-01'
IT_ONLY_FROM = '2026-09-14'
IT_WRAP_CAT = '시황'
IT_LISTEN = 'https://insightimes.com/listen/{}'
# 카드에 등락을 얹을 지수. 차트 범례와 같은 순서로 둔다.
MOVE_SYMBOLS = [('QQQ', 'QQQ'), ('SPY', 'SPY(VOO)'), ('SOXX', 'SOXX')]
ID_RE = re.compile(r'(\d{12})')


def load(path, default=None):
    try:
        with open(path, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


def article_id(url_or_id):
    """링크든 id든 네이버 콘텐츠 id(숫자12+꼬리)를 뽑는다."""
    s = str(url_or_id or '').rstrip('/')
    return s.rsplit('/', 1)[-1] if '/' in s else s


def published_kst(aid):
    """콘텐츠 id 앞 12자리가 발행 시각(KST)이다 — 260327194408 → 2026-03-27 19:44:08."""
    m = ID_RE.match(aid)
    if not m:
        return None
    s = m.group(1)
    try:
        return datetime(2000 + int(s[0:2]), int(s[2:4]), int(s[4:6]),
                        int(s[6:8]), int(s[8:10]), int(s[10:12]), tzinfo=KST)
    except ValueError:
        return None


def market_date(pub_kst, trading_days, last_day):
    """글이 다루는 장의 날짜 = **발행 시점의 뉴욕 날짜**(거래일로 스냅).

    필자는 한국에 있지만 글이 다루는 시계는 뉴욕이다. 발행 시각을 뉴욕으로
    옮기면 그날이 곧 그 글이 살고 있던 장이다.
      · 아침 08시대(KST) 시황 → ET 전날 저녁 → 전날 장. 의도대로.
      · 새벽 03시대(KST) 분석 → ET 같은 날 오후(장중) → 그날 장.
      · 밤 22시대(KST) 글   → ET 같은 날 오전(프리마켓) → 그날 장.

    예전에는 '이미 마감된 가장 최근 정규장'(16:00 ET 기준)을 골랐는데,
    그러면 장중·프리마켓에 쓴 글이 하루 뒤로 밀렸다. 실제로 8월 8일 새벽에
    쓴 테슬라 분석이 8월 7일이 아니라 8월 6일에 얹혀, 8월 7일 장에는 아무것도
    안 남았다. 검증된 시황 매핑(3/23·3/25·8/6)은 새 규칙에서도 그대로다.
    """
    et = pub_kst.astimezone(ET)
    cand = et.date()
    if cand > last_day:
        # 차트 데이터가 아직 못 따라온 최근 며칠 — 달력·목록에는 그대로 싣는다.
        return cand.isoformat()
    while cand.isoformat() not in trading_days:
        cand -= timedelta(days=1)
        if (last_day - cand).days > 3650:
            return None
    return cand.isoformat()


def it_published_kst(a):
    """인사이트 타임스 글의 발행 시각(KST). 시각이 없으면 편집 날짜 정오(KST)로 둔다
    - 그러면 뉴욕 기준 전날 밤이 되어, 아침 시황과 같은 쪽으로 기운다."""
    p = a.get('published')
    if p:
        try:
            return datetime.fromisoformat(str(p).replace('Z', '+00:00')).astimezone(KST)
        except ValueError:
            pass
    d = a.get('day')
    if d:
        try:
            return datetime.strptime(d, '%Y-%m-%d').replace(hour=12, tzinfo=KST)
        except ValueError:
            return None
    return None


def build_moves(chart, date_str):
    """그날 지수 등락(%) — 차트 데이터의 전일 대비. 없는 날이면 빈 dict."""
    try:
        i = chart['dates'].index(date_str)
    except ValueError:
        return {}
    if i == 0:
        return {}
    out = {}
    for key, label in MOVE_SYMBOLS:
        series = chart.get(key)
        if not series or i >= len(series):
            continue
        prev, cur = series[i - 1], series[i]
        if not prev:
            continue
        out[label] = round((cur - prev) / prev * 100, 2)
    return out


def main():
    dry = '--dry' in sys.argv
    events = load(EVENTS)
    chart = load(CHART)
    if not events or not chart:
        print('::error::이슈/차트 데이터를 읽지 못했다 — 중단')
        return 1

    archive = load(ARCHIVE, []) or []
    recent = (load(RECENT, {}) or {}).get('articles', []) or []

    # id 기준 합집합. 최근 목록이 제목을 더 정확히 들고 있는 경우가 있어 뒤에 덮는다.
    pool = {}
    for a in list(archive) + list(recent):
        aid = article_id(a.get('id') or a.get('url'))
        if not aid:
            continue
        title = (a.get('title') or '').strip()
        url = a.get('url') or f'https://contents.premium.naver.com/unis/something/contents/{aid}'
        if aid in pool and not title:
            continue
        pool[aid] = {'id': aid, 'title': title, 'url': url}

    # 목록 자체도 누적해 둔다. 채널 페이지는 최근 20건만 서버에서 내려주므로,
    # 주 1회 동기화가 새 글을 여기에 얹는 방식으로 전체 목록이 유지된다.
    # (처음 한 번은 scripts/naver-archive-cdp.mjs 로 전량을 긁어 채웠다)
    archive_out = sorted(pool.values(), key=lambda a: a['id'], reverse=True)
    if not dry and len(archive_out) != len(archive):
        with open(ARCHIVE, 'w', encoding='utf-8') as f:
            json.dump(archive_out, f, ensure_ascii=False, indent=1)
        print(f'목록 누적: {len(archive)} → {len(archive_out)}건')

    # 1) 생성분 제거 — 멱등성의 핵심.
    curated = [e for e in events if e.get('source') != GEN_SOURCE]
    for e in curated:
        e.pop('moreArticles', None)
        e.pop('listen', None)

    trading_days = set(chart['dates'])
    last_day = datetime.strptime(chart['dates'][-1], '%Y-%m-%d').date()

    # 2) 이미 손으로 실린 글은 건너뛴다(같은 글이 두 번 나오면 안 된다).
    linked = {article_id(e['link']) for e in curated if e.get('link')}
    by_date_curated = {}
    for e in curated:
        by_date_curated.setdefault(e['date'], []).append(e)

    grouped, skipped = {}, 0
    for a in pool.values():
        if a['id'] in linked:
            continue
        pub = published_kst(a['id'])
        if not pub:
            skipped += 1
            continue
        d = market_date(pub, trading_days, last_day)
        if not d:
            skipped += 1
            continue
        grouped.setdefault(d, []).append({'t': a['title'], 'u': a['url'], 'p': pub, 'src': 'naver'})

    # 인사이트 타임스 - 같은 장 날짜 규칙(발행 시각을 뉴욕으로 옮겨 거래일로 스냅)
    it_doc = load(IT_ARCHIVE, {}) or {}
    it_arts = it_doc.get('articles') or []
    linked_urls = {e.get('link') for e in curated if e.get('link')}
    it_wrap_day = {}              # slug -> 장 날짜 (시황만) - 음성 브리핑 연결에 쓴다
    it_n = 0
    for a in it_arts:
        if not a.get('url') or a['url'] in linked_urls:
            continue
        pub = it_published_kst(a)
        if not pub:
            skipped += 1
            continue
        d = market_date(pub, trading_days, last_day)
        if not d or d < IT_FROM:
            continue
        wrap = a.get('cat') == IT_WRAP_CAT
        grouped.setdefault(d, []).append({'t': a.get('title') or '', 'u': a['url'], 'p': pub,
                                          'src': 'it', 'wrap': wrap})
        if wrap:
            it_wrap_day[a.get('slug')] = d
        it_n += 1

    # 아침 편지의 음성 브리핑 - 그 편지가 묶은 '시황'이 다룬 장에 붙인다.
    # 편지 날짜(KST)가 아니라 장 날짜에 붙여야 카드와 같은 날을 가리킨다.
    listen_by_day = {}
    for ldate in sorted((it_doc.get('listen') or {}).keys()):
        days = sorted({it_wrap_day[s] for s in it_doc['listen'][ldate] if s in it_wrap_day})
        days = [x for x in days if x <= ldate]
        if days and days[-1] not in listen_by_day:
            listen_by_day[days[-1]] = IT_LISTEN.format(ldate)

    made, attached = [], 0
    for d, arts in grouped.items():
        arts.sort(key=lambda x: x['p'])
        nv = [x for x in arts if x['src'] == 'naver']
        it = [x for x in arts if x['src'] == 'it']
        # 인사이트 타임스는 장 마감 정리(시황)를 맨 앞에 - 카드 제목·대표 링크·브리핑 재료가 된다
        it = [x for x in it if x.get('wrap')] + [x for x in it if not x.get('wrap')]
        if d >= IT_ONLY_FROM and it:
            arts = it
        elif d >= IT_FROM and it:
            arts = nv + it
        else:
            arts = nv
        if not arts:
            continue
        items = [{'t': x['t'] or '제목 없음', 'u': x['u']} for x in arts]
        if d in by_date_curated:
            # 손으로 쓴 카드가 이미 있는 날 — 그 카드 아래에 링크만 붙인다.
            by_date_curated[d][0]['moreArticles'] = items
            if d in listen_by_day:
                by_date_curated[d][0]['listen'] = listen_by_day[d]
            attached += len(items)
            continue
        entry = {
            'date': d,
            'title': items[0]['t'] if len(items) == 1 else f'이 날의 글 {len(items)}건',
            'summary': '',
            'importance': 1,
            'moves': build_moves(chart, d),
            'link': items[0]['u'],
            'articles': items,
            'source': GEN_SOURCE,
            'publisher': 'insightimes' if arts[0]['src'] == 'it' else 'naver',
        }
        if d in listen_by_day:
            entry['listen'] = listen_by_day[d]
        made.append(entry)

    merged = curated + made
    merged.sort(key=lambda e: e['date'])

    print(f'인사이트 타임스 글 {it_n}건(장 날짜 {IT_FROM} 이후) · 음성 브리핑 {len(listen_by_day)}일')
    print(f'네이버 글 {len(pool)}건 · 신규 기록 {len(made)}일 · '
          f'기존 카드에 덧붙임 {attached}건 · 건너뜀 {skipped}건')
    print(f'이슈 총 {len(merged)}건 (손으로 쓴 것 {len(curated)} + 기록 {len(made)})')

    if dry:
        print('--dry — 파일을 쓰지 않았다')
        return 0
    with open(EVENTS, 'w', encoding='utf-8') as f:
        json.dump(merged, f, ensure_ascii=False, indent=1)
    return 0


if __name__ == '__main__':
    sys.exit(main())
