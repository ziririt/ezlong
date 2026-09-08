"""89항 — 시장 날짜의 상대어 집행 (단일 출처).

발단: 2026-09-08 07:09 KST(= ET 09-07 18:09), 화면이 "오늘은 미국 휴장(Labor Day)"
이라고 썼다. 세션 판정은 ET로 옳았다. 틀린 것은 '오늘'이라는 낱말이다 — 상대어는
코드의 시계가 아니라 **보는 사람의 시계**로 읽힌다. 한국 독자의 오늘은 9월 8일이라
"9월 8일이 휴장"으로 오독됐다.

뉴욕 정규장은 한국 시각 22:30~05:00 이다. 즉 뉴욕장이 열려 있는 시간의 절반 이상은
한국 날짜가 이미 다음 날이다. '오늘'은 하루의 절반을 틀린다.

원칙: 시장 문맥의 날짜는 절대 날짜로 말하고 어느 시장인지 밝힌다.
      판정·행동을 말할 때만 '지금·이번 거래일·다음 장'을 쓴다.
집행: 프롬프트로 시켜도 새는 낱말이라 코드가 마지막에 바꾼다(88항 원칙 1).

왜 파일로 뺐나 (2026-09-09): 처음엔 fetch-market-scorecard.py 안에만 두었더니
generate-swing-view.py 가 만든 문장에 '오늘 매수점수가 61로'가 그대로 나갔다.
검문은 '있다'가 아니라 '모든 출구에 서 있다'여야 뜻이 있다. 규칙이 두 벌이면
반드시 갈라진다 — 88항 원칙 3(단일 진실값)을 문장 규칙에도 적용한다.
"""
import re

try:
    import ez_calendar as _cal
except Exception:                                    # 캘린더가 없으면 아무것도 안 바꾼다
    _cal = None

_DOW_KO = ('월', '화', '수', '목', '금', '토', '일')


def ny_label(d):
    """date -> '9월4일(금, 뉴욕)'. 시장 날짜의 표준 표기."""
    return f'{d.month}월{d.day}일({_DOW_KO[d.weekday()]}, 뉴욕)'


def rel_date_map(ref=None):
    """상대어 -> 절대 표기. 캘린더가 없으면 빈 dict(= 아무것도 안 바꾼다)."""
    if _cal is None:
        return {}
    try:
        import datetime as _dt
        d0 = ref or _cal.last_trading_day()
        d1 = d0 - _dt.timedelta(days=1)
        while not _cal.is_trading_day(d1):
            d1 -= _dt.timedelta(days=1)
        d2 = _cal.next_trading_day(d0)
        return {'오늘': ny_label(d0), '금일': ny_label(d0),
                '어제': ny_label(d1), '전일': ny_label(d1),
                '내일': ny_label(d2), '익일': ny_label(d2)}
    except Exception:
        return {}


# '오늘의 판단', '오늘 밤' 처럼 날짜가 아니라 시점·관용구인 자리는 건드리지 않는다.
_REL_KEEP = re.compile(r'오늘(?:의\s*(?:판단|시그널|전략|행동))|오늘\s*밤')
_REL_WORD = re.compile(r'오늘|금일|어제|전일|내일|익일')

# 값을 건드리면 안 되는 키(식별자·링크·라벨). 사람이 읽는 문장만 고친다.
SKIP_KEYS = ('sources', 'url', 'link', 'ticker', 'category', 'direction',
             'symbol', 'id', 'stance', 'action', 'at', 'ts', 'asOf',
             'dataDay', 'generatedAt', 'generatedAtKST', 'timestamp_kst', 'session')


def rewrite(text, m):
    """한 문장의 상대어를 절대 날짜로. 돌려주는 값은 (바뀐 문장, 걸린 낱말들)."""
    if not text or not m:
        return text, []
    hits = []

    def _sub(mo):
        st, en = mo.span()
        for k in _REL_KEEP.finditer(text):
            if k.start() <= st and en <= k.end():
                return mo.group(0)
        rep = m.get(mo.group(0))
        if not rep:
            return mo.group(0)
        hits.append(mo.group(0))
        return rep

    out = _REL_WORD.sub(_sub, text)
    if not hits:
        return text, []
    # '9월4일(금, 뉴욕) 프리마켓 및 9월4일(금, 뉴욕) 정규장' 처럼 한 구절에서 두 번
    # 반복되면 두 번째를 지운다. 같은 날짜를 두 번 말하는 문장은 읽기가 나쁘다.
    for v in set(m.values()):
        out = re.sub(re.escape(v) + r'(\s*[^,.]{1,24}?(?:및|과|와)\s*)' + re.escape(v),
                     lambda mo, _v=v: _v + mo.group(1), out)
    out = re.sub(r'(?<=\S)[ \t]{2,}(?=\S)', ' ', out)     # 중복 제거로 생긴 겹빈칸 정리
    out = re.sub(r'[ \t]+([,.:)])', r'\1', out)
    return out, hits


def enforce(obj, ref=None):
    """카드·보고서·스윙뷰의 시장 문맥 상대어를 절대 날짜로 바꾼다.
    판정·점수는 안 건드린다. 돌려주는 값은 (바뀐 자리, 원래 낱말) 목록 — 로그용."""
    m = rel_date_map(ref)
    if not m:
        return []
    fixed = []

    def _walk(node, path):
        if isinstance(node, dict):
            for k, v in list(node.items()):
                if k in SKIP_KEYS:
                    continue
                _walk(v, f'{path}.{k}' if path else k)
                if isinstance(v, str):
                    nv, hits = rewrite(v, m)
                    if hits:
                        node[k] = nv
                        fixed.append((f'{path}.{k}' if path else k, ','.join(sorted(set(hits)))))
        elif isinstance(node, list):
            for i, v in enumerate(node):
                _walk(v, f'{path}[{i}]')
                if isinstance(v, str):
                    nv, hits = rewrite(v, m)
                    if hits:
                        node[i] = nv
                        fixed.append((f'{path}[{i}]', ','.join(sorted(set(hits)))))

    _walk(obj, '')
    return fixed


if __name__ == '__main__':
    import datetime as _dt
    ref = _dt.date(2026, 9, 4)                       # 금요일
    m = rel_date_map(ref)
    assert m['오늘'] == '9월4일(금, 뉴욕)', m
    assert m['어제'] == '9월3일(목, 뉴욕)', m
    assert m['내일'] == '9월8일(화, 뉴욕)', m         # 9/7 노동절을 건너뛴다
    t, h = rewrite('오늘 프리마켓 및 오늘 정규장', m)
    assert t == '9월4일(금, 뉴욕) 프리마켓 및 정규장', repr(t)
    t, _ = rewrite('오늘의 판단은 유지, 오늘 QQQ +1.2%', m)
    assert t == '오늘의 판단은 유지, 9월4일(금, 뉴욕) QQQ +1.2%', repr(t)
    d = {'a': '어제 대비 상승', 'ticker': '오늘', 'b': ['내일 발표']}
    got = enforce(d, ref)
    assert d['ticker'] == '오늘', d                   # 식별자는 안 건드린다
    assert d['a'] == '9월3일(목, 뉴욕) 대비 상승', d
    assert d['b'][0] == '9월8일(화, 뉴욕) 발표', d
    print('selftest OK |', m['오늘'], '/', len(got), '건 교정')
