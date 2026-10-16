#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""모델 포트폴리오 '주요 일정' 자동 갱신 - 핵심 20종목의 다음 실적 발표일.

왜 만들었나 (2026-10-16)
  이 칸은 손으로 쓴 목록이었다. 10월 16일에 8월 26일 엔비디아 실적이 맨 위에
  떠 있었다. 지난 일정은 독자에게 아무 쓸모가 없다. 이제 매주 다시 만든다.

무엇을 읽나 - 출처 둘
  · Yahoo Finance(yfinance `info`): earningsTimestampStart · isEarningsDateEstimate.
    한국 종목은 earningsCallTimestampStart 를 쓴다.
  · TradingView 공개 스크리너(scanner.tradingview.com): earnings_release_next_date ·
    earnings_publication_type_next_fq · earnings_release_next_time.
    publication_type 12·13 = 회사가 날짜를 공지한 상태(실측: 12 는 TSLA·MSFT·AAPL 처럼
    공지된 미국 종목, 13 은 공지된 한국 종목).

'확정'은 TradingView 가 공지 상태(12·13)라고 할 때만 붙인다
  Yahoo 의 isEarningsDateEstimate 는 믿지 않는다. 2026-10-16 실측에서 Yahoo 가
  '추정 아님'이라고 한 엔비디아 11-17·아마존 10-29 는 둘 다 회사 공지 전이었다.
  반대로 SK하이닉스는 Yahoo 가 10-27(추정)이었고 실제 공지는 10-28 이었다.
  확정이 아닌 날짜는 화면에 '예상'을 단다. 틀린 확정보다 맞는 '예상'이 낫다.

날짜 고르기
  · TradingView 가 공지 상태면 그 날짜.
  · 아니면 Yahoo 가 '추정 아님'이라고 한 날짜(알파벳 10-28 처럼 Yahoo 가 먼저 반영하는
    경우가 있다) → 그것도 없으면 TradingView 추정 → Yahoo 추정 순.
  · 미국 종목은 뉴욕(ET) 날짜, 한국 종목은 한국 날짜다(89항: 시장을 밝힌다).

무엇을 건드리지 않나
  · `calendarFocus`(종목별 한 줄 해설)와 `calendarManual`(손으로 넣는 일정)은 사람이
    쓴다. 이 스크립트는 읽기만 한다.
  · 실패하면 `calendar` 를 그대로 둔다. 화면이 지난 일정을 스스로 걸러 낸다.

사용
  python3 scripts/fetch-mp-calendar.py
  python3 scripts/fetch-mp-calendar.py --dry
"""
import json
import os
import sys
import urllib.request
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    from ez_text import scrub as _ez_scrub
except Exception:
    def _ez_scrub(o):
        return o

HERE = os.path.dirname(os.path.abspath(__file__))
VIEW = os.path.join(HERE, '..', 'data', 'model-portfolio.json')
ET = ZoneInfo('America/New_York')
KST = ZoneInfo('Asia/Seoul')
WD = '월화수목금토일'

WINDOW_DAYS = 75          # 이만큼 앞까지 싣는다 - 실적 시즌 한 바퀴(약 10주)
MAX_ITEMS = 22            # 핵심 20종목 + 손 일정. 비중 큰 종목이 잘리지 않게(12월 마이크론)
HOT_WEIGHT = 7.0          # 비중이 이 이상이면 강조(엔비디아·테슬라)
TV_CONFIRMED = (12, 13)   # TradingView publication_type: 회사 공지 상태
TV_URL = 'https://scanner.tradingview.com/global/scan'
TV_COLS = ['name', 'earnings_release_next_date', 'earnings_release_next_time',
           'earnings_publication_type_next_fq']


def tv_symbol(h):
    """JSON 의 sym 이 이미 TradingView 형식이다(NASDAQ:NVDA, KRX:000660)."""
    return h.get('sym') or h['tk']


def yf_symbol(h):
    return h['tk'] + '.KS' if h.get('c') == '₩' else h['tk']


def fetch_tv(syms):
    """{TV심볼: (ts, time_flag, pub_type)} - 실패하면 빈 사전."""
    body = json.dumps({'symbols': {'tickers': syms}, 'columns': TV_COLS}).encode()
    req = urllib.request.Request(TV_URL, data=body, method='POST', headers={
        'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 (ezlong.com calendar)'})
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            doc = json.load(r)
    except Exception as e:                                   # noqa: BLE001
        print(f'::warning::TradingView 스크리너 실패 - Yahoo 만으로 간다(전부 예상 표시): {e}')
        return {}
    out = {}
    try:
        rows = doc.get('data') if isinstance(doc, dict) else None
        for row in rows if isinstance(rows, list) else []:
            if not isinstance(row, dict):
                continue
            d = row.get('d')
            if not isinstance(d, list) or len(d) < 4:
                continue
            ts, tflag, ptype = d[1], d[2], d[3]
            if isinstance(ts, (int, float)) and ts > 0:
                out[row.get('s')] = (int(ts), tflag, ptype)
    except Exception as e:                                   # noqa: BLE001
        print(f'::warning::TradingView 응답 형식이 낯설다 - Yahoo 만으로 간다: {e}')
        return {}
    return out


def fetch_yahoo(yf, sym, kr):
    """(ts, is_estimate) 또는 None. 한국 종목은 컨퍼런스콜 시각이 실제 날짜와 맞았다."""
    try:
        info = yf.Ticker(sym).get_info() or {}
    except Exception as e:                                   # noqa: BLE001
        print(f'  Yahoo 실패 {sym}: {str(e)[:60]}')
        return None
    keys = ('earningsCallTimestampStart', 'earningsTimestampStart') if kr \
        else ('earningsTimestampStart', 'earningsTimestamp')
    for k in keys:
        ts = info.get(k)
        if isinstance(ts, (int, float)) and ts > 0:
            return int(ts), bool(info.get('isEarningsDateEstimate', True))
    return None


def local_date(ts, kr):
    return datetime.fromtimestamp(ts, timezone.utc).astimezone(KST if kr else ET).date()


def wd_label(d):
    return f'{d.month:02d}-{d.day:02d} ({WD[d.weekday()]})'


def time_phrase(ts, tflag, kr):
    """확정 일정에만 붙인다. 미국 종목은 한국 독자의 시계로 옮겨 적는다."""
    if kr or tflag not in (1, -1):
        return ''
    k = datetime.fromtimestamp(ts, timezone.utc).astimezone(KST)
    part = '새벽' if k.hour < 7 else '오전' if k.hour < 12 else '오후' if k.hour < 18 else '밤'
    when = '장 마감 후' if tflag == 1 else '장 시작 전'
    return f'{when}(한국 {k.month:02d}-{k.day:02d} {part})'


def main():
    dry = '--dry' in sys.argv
    with open(VIEW, encoding='utf-8') as f:
        doc = json.load(f)
    by_tk = {h['tk']: h for h in doc.get('holdings') or []}
    core = [by_tk[t] for t in (doc.get('top20') or []) if t in by_tk]
    if not core:
        print('::error::top20 이 비었다 - 일정 갱신 중단')
        return 1
    focus = doc.get('calendarFocus') or {}

    try:
        import yfinance as yf
    except ImportError:
        yf = None
        print('::warning::yfinance 없음 - TradingView 만으로 간다')

    tv = fetch_tv([tv_symbol(h) for h in core])
    today = {'US': datetime.now(ET).date(), 'KR': datetime.now(KST).date()}

    items, misses = [], []
    for h in core:
        kr = h.get('c') == '₩'
        mk = 'KR' if kr else 'US'
        t = tv.get(tv_symbol(h))
        y = fetch_yahoo(yf, yf_symbol(h), kr) if yf else None

        # 후보: (출처, 날짜, ts, 확정, 시각표시, Yahoo가 '추정 아님'이라 했나)
        cands = []
        if t:
            ts, tflag, ptype = t
            # KRX 는 시각 칸이 자리표시(08:00 ET)라 UTC 날짜가 곧 한국 날짜다.
            d = (datetime.fromtimestamp(ts, timezone.utc).date() if kr else local_date(ts, False))
            cands.append(('tv', d, ts, ptype in TV_CONFIRMED, tflag, False))
        if y:
            ts, est = y
            cands.append(('yf', local_date(ts, kr), ts, False, 0, not est))
        cands = [c for c in cands if c[1] >= today[mk]]
        if not cands:
            misses.append(h['tk'])
            continue
        pick = next((c for c in cands if c[0] == 'tv' and c[3]), None) \
            or next((c for c in cands if c[0] == 'yf' and c[5]), None) \
            or next((c for c in cands if c[0] == 'tv'), None) \
            or cands[0]
        src, d, ts, confirmed, tflag, _ = pick
        if (d - today[mk]).days > WINDOW_DAYS:
            continue
        name = (h['nm'] if h['nm'] == h['tk'] else f"{h['nm']}({h['tk']})") + ' 실적'
        tail = []
        if focus.get(h['tk']):
            name += ': ' + focus[h['tk']]
        tp = time_phrase(ts, tflag, kr) if confirmed else ''
        if tp:
            tail.append(tp)
        if kr:
            tail.append('한국 날짜')
        items.append({
            'iso': d.isoformat(), 'mkt': mk, 'd': wd_label(d),
            't': name + (' · ' + ' · '.join(tail) if tail else ''),
            'hot': bool((h.get('w') or 0) >= HOT_WEIGHT or h['tk'] in (doc.get('calendarHot') or [])),
            'est': not confirmed,
            'src': src,
        })

    # 손으로 넣는 일정(락업·인도량 등). until 이 지나면 저절로 빠진다.
    for m in doc.get('calendarManual') or []:
        iso, until = m.get('iso'), m.get('until') or m.get('iso')
        if not until or until < today['US'].isoformat():
            continue
        if iso and (date.fromisoformat(iso) - today['US']).days > WINDOW_DAYS:
            continue
        items.append({'iso': iso, 'until': until, 'mkt': m.get('mkt', 'US'),
                      'd': m.get('d') or (wd_label(date.fromisoformat(iso)) if iso else ''),
                      't': m['t'], 'hot': bool(m.get('hot')), 'est': True,   # 손 일정은 언제나 '예상'(확정은 TradingView 공지 상태만)
                      'src': 'manual'})

    # 날짜 없는 손 일정(기간만 아는 것)은 맨 뒤
    items.sort(key=lambda x: (x['iso'] or '9999', x['mkt']))
    items = items[:MAX_ITEMS]
    n_conf = sum(1 for x in items if not x['est'])
    print(f'일정 {len(items)}건(확정 {n_conf} · 예상 {len(items) - n_conf}) · '
          f'TradingView {len(tv)}종목 응답 · 범위 밖/없음: {", ".join(misses) or "-"}')
    for x in items:
        print(f"  {x['iso']} {x['mkt']} {'예상' if x['est'] else '확정'} [{x['src']}] {x['t'][:50]}")

    if len([x for x in items if x['src'] != 'manual']) < 3:
        print('::warning::자동 일정이 3건 미만 - 출처 장애로 보고 기존 일정을 유지한다')
        return 0
    doc['calendar'] = items
    doc['calendarMeta'] = {
        'updatedKST': datetime.now(KST).strftime('%Y-%m-%d %H:%M KST'),
        'sources': ['Yahoo Finance', 'TradingView'],
        'confirmedRule': 'TradingView 공지 상태(12·13)일 때만 확정',
    }
    if dry:
        print('--dry - 파일을 쓰지 않았다')
        return 0
    doc = _ez_scrub(doc)
    with open(VIEW, 'w', encoding='utf-8') as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
    return 0


if __name__ == '__main__':
    sys.exit(main())
