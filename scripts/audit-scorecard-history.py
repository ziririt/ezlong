#!/usr/bin/env python3
"""긍정vs부정 카드 교차 감사 — 여러 장을 나란히 놓아야 보이는 병을 찾는다 (61항)

왜 만들었나
  기존 검사 열다섯 개는 전부 **카드 한 장을 만드는 순간**에만 돈다. 그 순간에는
  안 보이고 여러 장을 나란히 놓아야 보이는 병이 따로 있다. 실제 사고(2026-08-17):

    8/16 23:20  'Fed의 관망세 유지'        부정 25점
    8/17 08:20  'Fed 금리 인상 관망 지속'  부정 10점
    8/17 16:31  'Fed 금리 인상 관망'       긍정 25점
    8/17 18:20  'Fed 금리 인상 관망 심리'  긍정 25점

  한 장씩 보면 넷 다 그럴듯하다. 넷을 나란히 놓아야 같은 주제가 편을 갈아탄 게 보인다.
  그날 그걸 찾은 건 코드가 아니라 사람이었다. 그 훑는 일을 코드가 하게 만든 것이 이 파일이다.

원장은 git 이력이다
  data/market-scorecard-data.json 은 최근 10장만 들고 있지만, 커밋 이력에는 게시된
  모든 카드가 남아 있다(2026-06-24부터 479커밋). 57항에서 TimesFM 예측을 git 이력으로
  채점하기로 한 것과 같은 발상 — 이미 있는 기록을 원장으로 쓴다. 새 저장소를 만들지 않는다.

주제 동일성은 문자열이 아니라 category 태그로 본다
  이름은 매번 다르게 쓰인다('Fed의 관망세 유지' vs 'Fed 금리 인상 관망 심리').
  2026-07-28에 도입한 고정 category 태그(fed_policy 등)가 이미 있으니 그걸 쓴다.

이 감사는 아무것도 고치지 않는다
  발견만 하고 리포트를 남긴다. 지나간 카드를 소급해 고치는 건 60항에서 정한 대로
  하지 않는다 — 게시된 판정을 나중에 조용히 바꾸는 쪽이 더 나쁘다. 여기서 나온 패턴은
  '다음 규칙'의 재료로 쓴다.
"""

import io
import json
import os
import re
import subprocess
import sys
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = 'data/market-scorecard-data.json'
OUT = os.path.join(ROOT, 'data', 'scorecard-audit.json')

WINDOW_DAYS = int(os.environ.get('AUDIT_WINDOW_DAYS', '14'))   # 교차 검사 창
LEDGER_DAYS = int(os.environ.get('AUDIT_LEDGER_DAYS', '45'))   # 원장 복원 범위
KST = timezone(timedelta(hours=9))

CATEGORY_KO = {
    'fed_policy': 'Fed·통화정책', 'geopolitics': '지정학', 'trade_tariff': '관세·무역',
    'macro_data': '경제지표', 'earnings_bellwether': '벨웨더 실적',
    'vix_risk_sentiment': 'VIX·위험선호', 'oil_energy': '유가·에너지',
    'dollar_fx': '달러·환율', 'rates_treasury': '국채금리',
    'ai_tech_valuation': 'AI·기술 밸류에이션', 'supply_chain': '공급망',
    'company_specific': '개별 기업', 'other': '기타',
}


# ─── 원장 복원 ────────────────────────────────────────────────────────────────

def sh(args):
    return subprocess.run(args, cwd=ROOT, capture_output=True, text=True).stdout


def rebuild_ledger():
    """git 이력에서 게시된 카드를 전부 되살린다. 커밋마다 그 시점의 최신 카드
    한 장(entries[0])을 꺼내 timestamp_kst 로 중복을 없앤다."""
    since = (datetime.now(timezone.utc) - timedelta(days=LEDGER_DAYS)).strftime('%Y-%m-%d')
    log = sh(['git', 'log', '--follow', f'--since={since}', '--format=%H', '--', DATA])
    shas = [x for x in log.split() if x]
    seen, cards = set(), []
    for sha in shas:
        raw = sh(['git', 'show', f'{sha}:{DATA}'])
        if not raw.strip():
            continue
        try:
            entries = json.loads(raw).get('entries') or []
        except json.JSONDecodeError:
            continue
        for e in entries[:2]:          # 최신 두 장만 — 그 아래는 이전 커밋에서 이미 봤다
            ts = e.get('timestamp_kst') or ''
            if ts and ts not in seen:
                seen.add(ts)
                cards.append(e)
    cards.sort(key=lambda e: parse_ts(e) or datetime.min.replace(tzinfo=KST))
    return cards


def parse_ts(entry):
    m = re.match(r'(\d{4})-(\d{2})-(\d{2})\([^)]*\)\s*(\d{2}):(\d{2})',
                 entry.get('timestamp_kst') or '')
    if not m:
        return None
    y, mo, d, h, mi = (int(x) for x in m.groups())
    return datetime(y, mo, d, h, mi, tzinfo=KST)


def scored(entry, side):
    return [f for f in (entry.get(side) or []) if int(f.get('score', 0) or 0) > 0]


def label(entry):
    return entry.get('timestamp_kst') or '?'


# ─── 교차 검사 ────────────────────────────────────────────────────────────────

FLIP_HOURS = 36          # 이 시간 안에 편이 바뀌면 '빠른 뒤집기'로 본다

# 재료 이름에서 주제를 식별할 때 버리는 상투어. 이 말들만 겹치는 건 같은 주제가 아니다
# ('긴장 고조'와 '기대 확대'가 '고조·기대'로 묶이면 감사가 소음이 된다).
_GENERIC_TOKENS = {
    '기대', '우려', '지속', '완화', '고조', '상승', '하락', '둔화', '강세', '약세',
    '심리', '전망', '확대', '축소', '압력', '리스크', '위험', '개선', '악화', '전반',
    '주요', '일부', '관련', '데이터', '신호', '가능성', '불확실성', '영향', '재료',
    '요인', '시장', '투자', '종목', '섹터', '발표', '유지', '전환', '반등', '조정',
    '전반적', '심화', '재부각', '부각', '경계', '논쟁', '해석', '엇갈림',
    # 카테고리 이름이나 다름없는 낱말 — 이게 겹치는 건 같은 주제라는 뜻이 아니다
    # ('AI CapEx 과열 우려'와 'AI 서버 수요 강세'는 둘 다 AI 이야기지만 다른 사건이다)
    'AI', '기업', '실적', '기술주',
}

def topic_tokens(name):
    """재료 이름에서 주제를 가리키는 낱말만 남긴다."""
    raw = re.findall(r'[가-힣]{2,}|[A-Za-z]{2,}', name or '')
    return {t for t in raw if t not in _GENERIC_TOKENS}

def same_topic(a, b):
    """두 재료가 같은 주제를 말하는가. 한쪽 낱말이 다른 쪽에 포함되는 경우까지 본다
    ('관망' ⊂ '관망세')."""
    ta, tb = topic_tokens(a), topic_tokens(b)
    for x in ta:
        for y in tb:
            if x == y or x in y or y in x:
                return True
    return False

def c1_side_flip(cards):
    """같은 주제가 **짧은 시간 안에** 긍정과 부정을 오갔다.
    이게 이 감사의 존재 이유다 — 8/17 '관망' 사고를 잡는 검사.

    창 전체에서 양쪽에 등장했다는 것만으로는 신호가 아니다. 지정학은 사흘에 걸쳐
    나아지다 나빠질 수 있고, 그건 시장이 실제로 그런 것이다. 수상한 것은 **반나절 만에
    편이 바뀌는 것**이다 — 그 사이에 새 사실이 생겼을 리 없으니, 부호가 없는 재료를
    빈 칸에 갖다 쓴 흔적이다. 실제로 그날 'Fed 관망'은 여덟 시간 만에 부정에서
    긍정으로 넘어갔다."""
    seq = defaultdict(list)
    for e in cards:
        t = parse_ts(e)
        if not t:
            continue
        for side, ko in (('positive_factors', '긍정'), ('negative_factors', '부정')):
            for f in scored(e, side):
                seq[f.get('category') or 'other'].append(
                    (t, ko, label(e), f.get('score'), f.get('name')))
    out = []
    for cat, rows in seq.items():
        rows.sort(key=lambda r: r[0])
        flips = []
        for a, b in zip(rows, rows[1:]):
            if a[1] == b[1]:
                continue
            gap = (b[0] - a[0]).total_seconds() / 3600.0
            # 같은 카드 안에서 한 카테고리가 양쪽에 있는 건 뒤집기가 아니다 —
            # 넓은 카테고리(개별 기업·AI)에서는 서로 다른 종목·논점이라 정상이다.
            if gap <= 0:
                continue
            if gap > FLIP_HOURS:
                continue
            # 카테고리가 같아도 말하는 대상이 다르면 뒤집힌 게 아니다.
            # ('기술주 전반 상승' → 'AMD 실적 하회'는 서로 다른 이야기다)
            if not same_topic(a[4], b[4]):
                continue
            flips.append((gap, a, b))
        if not flips:
            continue
        fastest = min(f[0] for f in flips)
        out.append({
            'check': 'C1',
            'severity': 'high' if (len(flips) >= 2 and fastest <= 6) else 'info',
            'category': cat,
            'title': (f"{CATEGORY_KO.get(cat, cat)} — {FLIP_HOURS}시간 안에 편이 바뀐 적 "
                      f"{len(flips)}회 (가장 빠른 것 {fastest:.0f}시간)"),
            'detail': ("반나절 만에 같은 주제가 긍정에서 부정으로(또는 반대로) 넘어갔다면 "
                       "그 사이에 새 사실이 생겼을 리 없다. 방향 없는 재료를 편이 필요할 때마다 "
                       "갖다 쓴 흔적일 수 있다(60항)."),
            'samples': [{'gapHours': round(g, 1),
                         'from': {'side': a[1], 'at': a[2], 'score': a[3], 'name': a[4]},
                         'to':   {'side': b[1], 'at': b[2], 'score': b[3], 'name': b[4]}}
                        for g, a, b in sorted(flips, key=lambda x: x[0])[:3]],
        })
    return sorted(out, key=lambda x: (x['severity'] != 'high', -len(x['samples'])))


def c2_frozen_score(cards, min_run=7):
    """점수는 못 박혀 있는데 그 점수를 채우는 카테고리만 계속 갈린다(51항 G7의 장기판).
    G7 은 생성 시점에 직전 몇 장만 본다 — 며칠에 걸친 고정은 여기서만 보인다."""
    out, run = [], []
    def flush():
        if len(run) < min_run:
            return
        sets = [frozenset((f.get('category') or 'other')
                          for s in ('positive_factors', 'negative_factors')
                          for f in scored(e, s)) for e in run]
        if len(set(sets)) < max(2, len(run) // 2):
            return                      # 재료도 그대로면 그냥 시장이 조용했던 것
        out.append({
            'check': 'C2', 'severity': 'high', 'category': 'score',
            'title': (f"{run[0]['positive_total']} 대 {run[0]['negative_total']} 가 "
                      f"{len(run)}장 연속인데 재료 구성은 {len(set(sets))}번 바뀌었다"),
            'detail': "숫자를 먼저 정하고 이유를 나중에 찾은 흔적일 수 있다(51항 G7).",
            'samples': [{'at': label(e),
                         'cats': sorted(CATEGORY_KO.get(c, c) for c in st)}
                        for e, st in list(zip(run, sets))[-6:]],
        })
    for e in cards:
        key = (e.get('positive_total'), e.get('negative_total'))
        if run and (run[-1].get('positive_total'), run[-1].get('negative_total')) == key:
            run.append(e)
        else:
            flush()
            run = [e]
    flush()
    return out


def c3_reheated(cards, min_days=3, min_hits=5):
    """같은 재료 이름이 며칠에 걸쳐 반복 등장. 24시간 혼조 정리 장치는 혼조만 본다."""
    hits = defaultdict(list)
    for e in cards:
        d = parse_ts(e)
        for side in ('positive_factors', 'negative_factors'):
            for f in scored(e, side):
                hits[(f.get('name') or '').strip()].append((d, label(e), f.get('score')))
    out = []
    for name, lst in hits.items():
        if len(lst) < min_hits or not name:
            continue
        days = {d.date() for d, _, _ in lst if d}
        if len(days) < min_days:
            continue
        out.append({
            'check': 'C3', 'severity': 'info', 'category': 'reheated',
            'title': f"'{name}' 가 {len(days)}일에 걸쳐 {len(lst)}번 등장",
            'detail': "글자 하나 안 바뀐 재료가 며칠째 점수를 싣고 있다면 오늘의 재료가 아니다.",
            'samples': [{'at': lb, 'score': sc} for _, lb, sc in lst[-5:]],
        })
    return sorted(out, key=lambda x: -len(x['samples']))


def c4_total_bias(cards):
    """총점이 특정 값에 쏠렸는가. 55:45 만 반복되면 판정이 아니라 습관이다."""
    if len(cards) < 8:
        return []
    cnt = Counter((e.get('positive_total'), e.get('negative_total')) for e in cards)
    (p, n), c = cnt.most_common(1)[0]
    share = c / len(cards)
    if share < 0.45:
        return []
    return [{
        'check': 'C4', 'severity': 'high' if share >= 0.6 else 'info', 'category': 'score',
        'title': f"최근 {len(cards)}장 중 {c}장({share*100:.0f}%)이 {p} 대 {n}",
        'detail': "같은 숫자가 과반이면 그날그날 판정한 것이 아니라 기본값으로 돌아간 것이다.",
        'samples': [{'at': label(e)} for e in cards if
                    (e.get('positive_total'), e.get('negative_total')) == (p, n)][-6:],
    }]


# 규칙이 마지막으로 크게 바뀐 시각(60항 배포). 이 뒤에 나온 카드가 현행 규칙에 걸리면
# 그건 '옛날 오염'이 아니라 **규칙이 실제로 안 먹고 있다**는 뜻이다 — 그것만 경고한다.
# 규칙을 또 크게 손볼 때 이 값을 함께 올린다.
RULES_SINCE = datetime(2026, 8, 17, 22, 0, tzinfo=KST)

def c5_rules_backtest(cards):
    """지금 규칙을 카드에 다시 적용해 본다.

    규칙 도입 **이전** 카드가 걸리는 건 당연하다(그때는 그 규칙이 없었다) — 세기만 한다.
    문제는 도입 **이후** 카드가 걸리는 경우다. 검사가 있는데도 새 카드가 걸린다면
    검사에 구멍이 있거나 집행 경로를 안 타는 것이다. 그것만 경고로 올린다."""
    try:
        import importlib.util
        spec = importlib.util.spec_from_file_location(
            'sc', os.path.join(ROOT, 'scripts', 'fetch-market-scorecard.py'))
        sc = importlib.util.module_from_spec(spec)
        sys.modules['sc'] = sc
        spec.loader.exec_module(sc)
    except Exception as ex:
        return [{'check': 'C5', 'severity': 'info', 'category': 'rules',
                 'title': '현행 규칙 소급 적용 실패', 'detail': f'{type(ex).__name__}: {ex}',
                 'samples': []}]
    old, new = [], []
    for e in cards:
        t = parse_ts(e)
        for _s, _f, why in sc.direction_offenders(json.loads(json.dumps(e)), None):
            (new if (t and t >= RULES_SINCE) else old).append(
                {'at': label(e), 'why': why[:180]})
    out = []
    if new:
        out.append({
            'check': 'C5', 'severity': 'high', 'category': 'rules',
            'title': f"규칙이 생긴 뒤에 나온 카드 {len(new)}건이 그 규칙에 걸린다",
            'detail': ("검사가 있는데도 새 카드가 걸렸다 — 검사에 구멍이 있거나 집행 경로를 "
                       "타지 않는다는 뜻이다. 규칙 자체를 봐야 한다."),
            'samples': new[-8:],
        })
    if old:
        out.append({
            'check': 'C5', 'severity': 'info', 'category': 'rules',
            'title': f"규칙 도입 이전 카드 {len(old)}건이 지금 규칙에 걸린다",
            'detail': ("게시 당시엔 없던 규칙이다. 지우거나 고치지 않고 남은 양만 센다(60항). "
                       "이 숫자는 시간이 지나 옛 카드가 창 밖으로 밀리면 저절로 줄어든다."),
            'samples': old[-4:],
        })
    return out


def c6_category_diet(cards):
    """특정 카테고리 편식 — 세상은 넓은데 카드가 같은 서랍만 연다."""
    if len(cards) < 8:
        return []
    cnt = Counter()
    for e in cards:
        cats = {(f.get('category') or 'other')
                for s in ('positive_factors', 'negative_factors') for f in scored(e, s)}
        cnt.update(cats)
    cat, c = cnt.most_common(1)[0]
    share = c / len(cards)
    if share < 0.9:
        return []
    return [{
        'check': 'C6', 'severity': 'info', 'category': cat,
        'title': f"{CATEGORY_KO.get(cat, cat)} 가 최근 {len(cards)}장 중 {c}장에 등장({share*100:.0f}%)",
        'detail': "한 주제가 거의 매번 나온다면 그게 진짜 주도 재료인지, 손에 익은 재료인지 봐야 한다.",
        'samples': [],
    }]


# ─── 실행 ────────────────────────────────────────────────────────────────────

def main():
    print('=== 긍정vs부정 카드 교차 감사 (61항) ===')
    cards = rebuild_ledger()
    print(f'  원장 복원: {len(cards)}장 (최근 {LEDGER_DAYS}일)')
    if not cards:
        print('ERROR: 복원된 카드가 없다 — git 이력이 얕은지 확인(fetch-depth: 0)')
        sys.exit(1)

    cut = datetime.now(KST) - timedelta(days=WINDOW_DAYS)
    win = [e for e in cards if (parse_ts(e) or datetime.min.replace(tzinfo=KST)) >= cut]
    print(f'  검사 창: {len(win)}장 (최근 {WINDOW_DAYS}일)')

    # 리포트가 길면 아무도 안 읽는다 — 검사마다 상한을 두고, 중요한 것부터 싣는다.
    CAP = {'C1': 4, 'C2': 3, 'C3': 5, 'C4': 1, 'C5': 2, 'C6': 1}
    findings = []
    for group in (c1_side_flip(win), c2_frozen_score(win), c5_rules_backtest(win),
                  c4_total_bias(win), c3_reheated(win), c6_category_diet(win)):
        if group:
            findings.extend(group[:CAP.get(group[0]['check'], 3)])
    high = [f for f in findings if f['severity'] == 'high']

    now = datetime.now(timezone.utc)
    payload = {
        'generatedAt': now.strftime('%Y-%m-%dT%H:%M:%SZ'),
        'updatedKST': (now + timedelta(hours=9)).strftime('%Y-%m-%d %H:%M KST'),
        'windowDays': WINDOW_DAYS, 'ledgerDays': LEDGER_DAYS,
        'cardsInLedger': len(cards), 'cardsInWindow': len(win),
        'firstCard': label(win[0]) if win else '', 'lastCard': label(win[-1]) if win else '',
        'highCount': len(high), 'findings': findings,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with io.open(OUT, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, separators=(',', ':'))

    for f in findings:
        mark = '::warning::' if f['severity'] == 'high' else '  · '
        print(f"{mark}[{f['check']}] {f['title']}")
    print(f"=== 완료 — 발견 {len(findings)}건 (주의 {len(high)}건) ===")


if __name__ == '__main__':
    main()
