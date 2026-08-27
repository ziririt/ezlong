#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""모델 포트폴리오 주간 갱신 — 시세 · 52주 범위 · 주간 RSI(14).

무엇을 하는가
  · data/model-portfolio.json 의 holdings 를 읽어 각 종목의 최신 종가,
    52주 저점·고점, 주간 RSI(14) 를 다시 채운다.
  · 판정(초과매수권~초과매도권)은 페이지가 계산한다. 여기서는 재료만 넣는다.

무엇을 하지 않는가 — 중요
  · 비중(w)·테마·편입/편출·조정 권고는 **건드리지 않는다.** 그건 사람이
    월 1회 갱신하는 판단이다. 파이프라인이 판단을 덮어쓰면 안 된다.
  · 종목을 추가·삭제하지 않는다. 목록 자체가 판단이기 때문이다.

왜 주간 RSI 인가
  이 코너의 판정 기준은 주간 RSI(14) 다. 일간이 아니다. 스윙 호흡의
  코너에서 일간 RSI 는 하루짜리 소음까지 판정에 실어버린다.
  주간 봉이 부족한 종목(신규 상장 등)은 rsiW 를 null 로 두고, 화면이
  자동으로 52주 밴드 기준으로 폴백한다 — 부분 주입도 안전한 구조다.

실패에 대한 태도
  한 종목이 실패해도 나머지는 갱신한다. 실패한 종목은 이전 값을 그대로
  두고 로그에 남긴다. 통째로 실패하면 파일을 쓰지 않는다 — 반쯤 갱신된
  파일보다 지난주 값 그대로가 낫다.

사용
  python3 scripts/fetch-model-portfolio.py
  python3 scripts/fetch-model-portfolio.py --dry     # 파일 쓰지 않고 결과만
"""
import json
import os
import sys
from datetime import datetime, timedelta, timezone

# 80항 — 화면 문구의 em dash(—)를 하이픈으로. 저장 직전 한 번만 훑는다.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    from ez_text import scrub as _ez_scrub
except Exception:                      # 모듈이 없어도 본 기능은 죽지 않는다
    def _ez_scrub(o):
        return o

HERE = os.path.dirname(os.path.abspath(__file__))
VIEW = os.path.join(HERE, '..', 'data', 'model-portfolio.json')
KST = timezone(timedelta(hours=9))

# 한국 상장 종목은 yfinance 에서 .KS 접미사를 쓴다.
SUFFIX_KR = '.KS'
RSI_PERIOD = 14
# 주간 RSI 14 를 안정적으로 계산하려면 최소 이 정도 주봉이 필요하다.
MIN_WEEKS = RSI_PERIOD * 3


def yf_symbol(h):
    """JSON 의 티커를 yfinance 심볼로. 한국 종목만 접미사가 붙는다."""
    return h['tk'] + SUFFIX_KR if h.get('c') == '₩' else h['tk']


def rsi_wilder(closes, period=RSI_PERIOD):
    """와일더 평활 RSI. 단순평균 RSI 와 값이 다르므로 섞어 쓰지 않는다.
    (차트 프로그램들의 기본값이 와일더다 — 화면 숫자와 맞추기 위함)"""
    if len(closes) < period + 1:
        return None
    gains = losses = 0.0
    for i in range(1, period + 1):
        d = closes[i] - closes[i - 1]
        gains += max(d, 0.0)
        losses += max(-d, 0.0)
    ag, al = gains / period, losses / period
    for i in range(period + 1, len(closes)):
        d = closes[i] - closes[i - 1]
        ag = (ag * (period - 1) + max(d, 0.0)) / period
        al = (al * (period - 1) + max(-d, 0.0)) / period
    if al == 0:
        return 100.0
    rs = ag / al
    return 100.0 - (100.0 / (1.0 + rs))


def fetch_one(yf, sym):
    """(종가, 52주 저점, 52주 고점, 주간RSI14) — 실패 항목은 None."""
    t = yf.Ticker(sym)

    # 주봉 3년치 — 52주 범위와 주간 RSI 를 같은 소스에서 뽑는다.
    wk = t.history(period='3y', interval='1wk', auto_adjust=False)
    closes = [float(x) for x in wk['Close'].dropna().tolist()] if len(wk) else []
    rsi = rsi_wilder(closes) if len(closes) >= MIN_WEEKS else None

    # 종가는 일봉에서 — 주봉의 마지막 값은 '진행 중인 주'라 확정값이 아니다.
    dl = t.history(period='5d', interval='1d', auto_adjust=False)
    px = float(dl['Close'].dropna().iloc[-1]) if len(dl.get('Close', [])) else None

    lo = hi = None
    yr = t.history(period='1y', interval='1d', auto_adjust=False)
    if len(yr):
        lows, highs = yr['Low'].dropna(), yr['High'].dropna()
        if len(lows) and len(highs):
            lo, hi = float(lows.min()), float(highs.max())

    return px, lo, hi, rsi


def main():
    dry = '--dry' in sys.argv
    with open(VIEW, encoding='utf-8') as f:
        doc = json.load(f)

    try:
        import yfinance as yf
    except ImportError:
        print('::error::yfinance 가 없다 — 갱신 중단')
        return 1

    ok, failed, rsi_n = [], [], 0
    for h in doc['holdings']:
        sym = yf_symbol(h)
        try:
            px, lo, hi, rsi = fetch_one(yf, sym)
        except Exception as e:                       # noqa: BLE001 — 한 종목 실패가 전체를 막지 않는다
            failed.append((h['tk'], str(e)[:60]))
            continue
        if px is None or px <= 0:
            failed.append((h['tk'], '종가 없음'))
            continue

        h['px'] = round(px, 2) if h.get('c') != '₩' else round(px)
        # 52주 범위는 값이 온전할 때만 바꾼다. 반쯤 받은 범위로 밴드를
        # 계산하면 판정이 통째로 뒤집힌다.
        if lo and hi and hi > lo > 0:
            h['lo'] = round(lo, 2) if h.get('c') != '₩' else round(lo)
            h['hi'] = round(hi, 2) if h.get('c') != '₩' else round(hi)
        # 현재가가 범위를 벗어나면(신고가·신저가 갱신 직후) 범위를 넓힌다.
        if h['px'] > h['hi']:
            h['hi'] = h['px']
        if h['px'] < h['lo']:
            h['lo'] = h['px']

        h['rsiW'] = round(rsi, 1) if rsi is not None else None
        if h['rsiW'] is not None:
            rsi_n += 1
        ok.append(h['tk'])

    if not ok:
        print('::error::한 종목도 갱신하지 못했다 — 파일을 쓰지 않는다')
        return 1

    # 비중 합계 검증 — 기획 인수인계의 배포 중단 조건이다.
    total = round(sum(h['w'] for h in doc['holdings']), 3)
    if abs(total - 100) > 0.01:
        print(f'::error::비중 합계가 {total} 다 (100 이어야 함) — 파일을 쓰지 않는다')
        return 1

    # AI 차트분석 대상인지 표시 — 페이지의 '차트분석에서 보기' 링크가 이걸 본다.
    # 파일이 실제로 있는지로 판단한다. 목록을 손으로 관리하면 파이프라인에서
    # 종목이 빠져도 링크는 계속 살아 있어서, 눌렀을 때 엉뚱한 종목이 열린다.
    # 한국 종목은 차트분석 쪽 심볼이 '000660.KS' 이고 파일명은 '000660_KS' 다.
    # 페이지의 aiSymbol()/aiFile() 과 같은 규칙을 쓴다 — 어긋나면 링크가 헛돈다.
    ddir = os.path.join(HERE, '..', 'data')
    for h in doc['holdings']:
        sym = h['tk'] + '.KS' if h.get('c') == '₩' else h['tk']
        safe = sym.replace('.', '_').replace('-', '_')
        h['ai'] = os.path.isfile(os.path.join(ddir, f'analysis-{safe}.json'))
    print('AI 차트분석 연결: %d/%d 종목' %
          (sum(1 for h in doc['holdings'] if h['ai']), len(doc['holdings'])))

    # 판정 기준은 52주 밴드로 둔다 — 2026-08-08 실측 결과다.
    #
    # 인수인계 문서는 주간 RSI(14) 기준(80/70/30/20)으로 올리라고 했는데,
    # 실제로 26종목을 채워보니 **전부 30~70 사이**에 들어왔다(최저 테슬라 39.1,
    # 최고 이튼 66.9). 5단계가 통째로 '적정권' 한 칸으로 무너져서 판정 열이
    # 아무것도 말하지 않는 상태가 된다. 주간 봉의 RSI 는 일간보다 훨씬 덜
    # 흔들려서, 대형주가 70·30을 넘는 일 자체가 드물기 때문이다.
    #
    # 더 결정적인 건 본문과의 충돌이다. 비중 조정 권고 글이 밴드 수치를 직접
    # 인용한다 — "이튼은 밴드 94%로 이미 초과매수권이라 여기엔 추가하지 않는다".
    # 판정만 RSI 로 바꾸면 배지는 '적정권'인데 바로 아래 글은 '초과매수권'이라고
    # 말하는 화면이 된다. 방문자가 먼저 보는 건 그 모순이다.
    #
    # 그래서 밴드를 판정 기준으로 유지하고, 주간 RSI 는 같은 줄에 숫자로 함께
    # 보여준다(버리지 않는다 — 방향 판단의 재료로 쓸모가 있다).
    # 임계값 자체를 주간 RSI 분포에 맞게 다시 잡는 건 기획 쪽 판단 영역이라
    # 여기서 임의로 바꾸지 않는다.
    doc['meta']['signalSource'] = 'band'
    doc['meta']['rsiCoverage'] = f'{rsi_n}/{len(doc["holdings"])}'
    doc['meta']['rsiNote'] = ('주간 RSI(14)는 참고 수치로 함께 표기. '
                              '판정 기준은 52주 밴드 위치.')

    now = datetime.now(KST)
    doc['meta']['asOf'] = now.strftime('%Y-%m-%d')
    doc['meta']['asOfLabel'] = now.strftime('%Y-%m-%d') + ' 기준 · 직전 정규장 종가'
    doc['meta']['updatedKST'] = now.strftime('%Y-%m-%d %H:%M KST')
    doc['meta']['priceSource'] = 'Yahoo Finance (yfinance)'
    iso = datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
    doc['meta']['generatedAt'] = iso
    # 최상위에도 둔다 — 감시견(watchdog.js)이 최상위 필드만 읽는다.
    doc['generatedAt'] = iso

    print(f'갱신 {len(ok)}종목 · 주간RSI {rsi_n}종목 · 판정기준 {doc["meta"]["signalSource"]}')
    if failed:
        print('::warning::갱신 실패(이전 값 유지) — ' +
              ', '.join(f'{t}({e})' for t, e in failed))

    if dry:
        print('--dry — 파일을 쓰지 않았다')
        return 0
    doc = _ez_scrub(doc)            # 80항 — ' — ' → ' - '
    with open(VIEW, 'w', encoding='utf-8') as f:
        json.dump(doc, f, ensure_ascii=False, indent=1)
    return 0


if __name__ == '__main__':
    sys.exit(main())
