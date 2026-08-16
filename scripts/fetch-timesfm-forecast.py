#!/usr/bin/env python3
"""구글 TimesFM 2.5 제로샷 예측 대역 (2026-08-14 신설)

무엇을 만드나
  data/timesfm-forecast.json — 핵심 심볼들의 향후 21거래일 분위수 예측.
  구글 리서치의 시계열 파운데이션 모델 TimesFM 2.5(200M, 오픈소스 체크포인트)를
  파인튜닝 없이 제로샷으로 돌린다. 하루 1회, 장 마감 후.

왜 '대역'인가 — 이 파이프라인의 정직성 원칙 (제거·완화 금지)
  주가 일봉은 랜덤워크에 가깝다. 파운데이션 모델이라도 점(단일값) 예측은
  추세 연장선 이상이 되기 어렵다. 이 모델의 진짜 산출물은 분위수 헤드가 주는
  불확실성 구간이다 — "20거래일 뒤 하위 10% 시나리오는 어디까지인가".
  그래서 화면은 반드시 중앙값과 대역을 함께 보여주고, 단일 예측선만 뽑아
  쓰지 않는다. 블랙스완(실적 쇼크·거시 충격)은 어떤 분위수에도 없다.

실행 환경
  GitHub Actions ubuntu 러너(2코어 CPU, 7GB). torch는 CPU 휠로 설치(용량·시간 절약).
  200M 모델의 CPU 추론은 심볼 10개 × 21스텝에 수 초 수준 — GPU 불필요.
  체크포인트는 HuggingFace 허브에서 받는다(러너는 접근 가능).

안전장치
  - 심볼 하나가 실패해도 나머지는 산다(부분 성공 허용).
  - 분위수 역전은 모델 옵션(fix_quantile_crossing)으로 교정하고, 그래도
    비단조·비양수 값이 나오면 그 심볼을 버린다 — 틀린 대역보다 빈 자리가 낫다.
  - 전 심볼 실패 시 기존 파일을 건드리지 않고 종료코드 1 (감시견이 잡는다).
"""

import json
import os
import sys
import time
from datetime import datetime, timedelta, timezone

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'data', 'timesfm-forecast.json')

# 스윙 대시보드·차트분석의 핵심 축과 동일한 축 (TOP9 + 지수/반도체)
# TOP9(TSLA·NVDA + 빅테크 7) 전부 + 지수 3종 — 스윙·TOP9 카드가 이 파일을 읽는다
SYMBOLS = ['QQQ', 'VOO', 'SOXX', 'TSLA', 'NVDA',
           'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'META', 'TSM', 'AVGO']
CONTEXT = 1024          # 약 4년치 일봉 — 모델 max_context와 일치
HORIZON = 21            # 약 1개월(거래일)
CHECKPOINT = 'google/timesfm-2.5-200m-pytorch'


def fetch_closes(symbol):
    """yfinance 일봉 종가. 실패 시 None — 해당 심볼만 건너뛴다."""
    import yfinance as yf
    try:
        h = yf.Ticker(symbol).history(period='6y', interval='1d', auto_adjust=True)
        if h.empty or len(h) < 300:
            print(f"  {symbol}: 데이터 부족({len(h)}일) — 건너뜀")
            return None, None
        closes = h['Close'].to_numpy(dtype=np.float32)
        last_date = h.index[-1].strftime('%Y-%m-%d')
        return closes[-CONTEXT:], last_date
    except Exception as e:
        print(f"  {symbol}: 수집 실패 {type(e).__name__}: {str(e)[:120]}")
        return None, None


def future_trading_days(last_date_str, n):
    """주말만 건너뛴 근사 거래일 달력. 미국 공휴일까지 정확히 맞출 필요는 없다 —
    이 날짜는 차트 x축 라벨용이고, 하루 이틀 밀려도 '몇 거래일 뒤'라는 의미는
    변하지 않는다. 공휴일 달력을 들여오는 순간 유지보수 대상이 하나 는다."""
    d = datetime.strptime(last_date_str, '%Y-%m-%d')
    out = []
    while len(out) < n:
        d += timedelta(days=1)
        if d.weekday() < 5:
            out.append(d.strftime('%Y-%m-%d'))
    return out


def sane(last, qrow):
    """분위수 행(q10..q90)이 믿을 만한가 — 양수·단조·상식적 폭."""
    if any((not np.isfinite(v)) or v <= 0 for v in qrow):
        return False
    if any(qrow[i] > qrow[i + 1] + 1e-6 for i in range(len(qrow) - 1)):
        return False
    # 21거래일에 ±60%를 넘는 대역은 데이터 오염 신호로 본다 (3배 레버리지도 아닌 현물)
    if qrow[0] < last * 0.4 or qrow[-1] > last * 1.6:
        return False
    return True


def main():
    print("=== TimesFM 2.5 예측 대역 생성 ===")
    t0 = time.time()
    import timesfm

    model = timesfm.TimesFM_2p5_200M_torch.from_pretrained(CHECKPOINT)
    model.compile(timesfm.ForecastConfig(
        max_context=CONTEXT, max_horizon=64,
        normalize_inputs=True,
        use_continuous_quantile_head=True,
        force_flip_invariance=True,
        infer_is_positive=True,
        fix_quantile_crossing=True,
    ))
    print(f"  모델 로드 {time.time() - t0:.0f}s")

    inputs, meta = [], []
    for sym in SYMBOLS:
        closes, last_date = fetch_closes(sym)
        if closes is None:
            continue
        inputs.append(closes)
        meta.append((sym, float(closes[-1]), last_date))
    if not inputs:
        print("ERROR: 수집된 심볼이 없다")
        sys.exit(1)

    t1 = time.time()
    point, quantiles = model.forecast(horizon=HORIZON, inputs=inputs)
    quantiles = np.asarray(quantiles)   # [n, horizon, 10] — 0=mean, 1..9=q10..q90
    print(f"  추론 {time.time() - t1:.1f}s ({len(inputs)}심볼 × {HORIZON}거래일)")

    symbols_out = {}
    for i, (sym, last, last_date) in enumerate(meta):
        q = quantiles[i]
        # 각 스텝의 q10~q90 단조성·상식 검증 — 하나라도 깨지면 심볼째 버린다
        if not all(sane(last, q[t, 1:10]) for t in range(HORIZON)):
            print(f"  {sym}: 분위수 검증 실패 — 제외")
            continue
        rnd = lambda a: [round(float(v), 2) for v in a]
        symbols_out[sym] = {
            'lastClose': round(last, 2),
            'lastDate': last_date,
            'dates': future_trading_days(last_date, HORIZON),
            'mean': rnd(q[:, 0]),
            'q10': rnd(q[:, 1]),
            'q30': rnd(q[:, 3]),
            'q50': rnd(q[:, 5]),
            'q70': rnd(q[:, 7]),
            'q90': rnd(q[:, 9]),
        }
        chg = (q[-1, 5] / last - 1) * 100
        band = ((q[-1, 1] / last - 1) * 100, (q[-1, 9] / last - 1) * 100)
        print(f"  {sym}: 21일 중앙값 {chg:+.1f}% · 대역 {band[0]:+.1f}% ~ {band[1]:+.1f}%")

    if not symbols_out:
        print("ERROR: 검증을 통과한 심볼이 없다 — 기존 파일 유지")
        sys.exit(1)

    now = datetime.now(timezone.utc)
    payload = {
        'model': 'google/timesfm-2.5-200m (zero-shot)',
        'horizonDays': HORIZON,
        'contextDays': CONTEXT,
        'note': ('구글 TimesFM 2.5 제로샷 분위수 예측. 점이 아니라 범위가 산출물이다 — '
                 '가운데 값(q50)과 q10~q90 구간을 함께 볼 것. 실적·거시 충격 같은 '
                 '이벤트는 어떤 분위수에도 반영되지 않는다.'),
        'generatedAt': now.strftime('%Y-%m-%dT%H:%M:%SZ'),
        'updatedKST': (now + timedelta(hours=9)).strftime('%Y-%m-%d %H:%M KST'),
        'symbols': symbols_out,
    }
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(payload, f, ensure_ascii=False, separators=(',', ':'))
    print(f"=== 완료 — {len(symbols_out)}심볼, 총 {time.time() - t0:.0f}s ===")


if __name__ == '__main__':
    main()
