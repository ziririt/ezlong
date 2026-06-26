#!/usr/bin/env python3
"""
한국 주식 실시간 가격 수집 — yfinance
data/kr-prices.json 에 현재가·등락률 저장 (스파크라인 없음)
GitHub Actions fetch-kr-prices.yml 에서 10분마다 실행 (KRX 장중 시간: KST 09:00~15:30 = UTC 00:00~06:30)

실행: python3 scripts/fetch-kr-prices.py
"""

import json
import os
import sys
import time
from datetime import datetime, timezone, timedelta

try:
    import yfinance as yf
except ImportError:
    print("yfinance가 설치되지 않았습니다. pip install yfinance --quiet")
    sys.exit(1)

# ─── 대상 티커 ────────────────────────────────────────────────────────────────
KR_TICKERS = [
    "069500.KS",   # KODEX 200
    "396500.KS",   # TIGER FN 반도체Top10
    "102110.KS",   # TIGER 200
    "122630.KS",   # KODEX 레버리지
    "005930.KS",   # 삼성전자
    "000660.KS",   # SK하이닉스
]

OUTPUT_PATH = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "data", "kr-prices.json")
)

# ─── KRX 장 상태 판별 ─────────────────────────────────────────────────────────
def get_krx_session():
    """현재 UTC 기준으로 KRX 장 상태 반환 ('REGULAR' | 'CLOSED')"""
    now_utc = datetime.now(timezone.utc)
    kst = now_utc + timedelta(hours=9)
    weekday = kst.weekday()  # 0=월 ... 4=금, 5=토, 6=일
    total_min = kst.hour * 60 + kst.minute
    # KRX 정규장: 평일 09:00~15:30 KST
    if weekday <= 4 and 540 <= total_min < 930:
        return "REGULAR"
    return "CLOSED"


# ─── 단일 티커 가격 수집 ──────────────────────────────────────────────────────
def fetch_price(symbol: str) -> dict | None:
    """yfinance fast_info로 현재가 + 전일종가 수집"""
    try:
        ticker = yf.Ticker(symbol)
        fi = ticker.fast_info

        # fast_info 가 None / 속성 없는 경우 대비
        current   = getattr(fi, "last_price",      None)
        prev_close = getattr(fi, "previous_close", None)

        if current is None or prev_close is None or prev_close == 0:
            return None

        change     = round(current - prev_close, 2)
        change_pct = round((change / prev_close) * 100, 2)

        return {
            "price":      round(current, 2),
            "change":     change,
            "changePct":  change_pct,
            "prevClose":  round(prev_close, 2),
        }

    except Exception as e:
        print(f"  {symbol} 수집 실패: {e}", file=sys.stderr)
        return None


# ─── 메인 ────────────────────────────────────────────────────────────────────
def main():
    session = get_krx_session()
    now_utc = datetime.now(timezone.utc)
    kst_str  = (now_utc + timedelta(hours=9)).strftime("%Y-%m-%d %H:%M KST")

    print(f"KR 가격 수집 시작 | {kst_str} | 장 상태: {session}")

    prices = {}
    success = 0

    for sym in KR_TICKERS:
        result = fetch_price(sym)
        if result:
            prices[sym] = result
            print(f"  {sym}: {result['price']:,.0f} ({result['changePct']:+.2f}%)")
            success += 1
        else:
            print(f"  {sym}: 데이터 없음 — 스킵")
        time.sleep(0.3)   # yfinance 요청 간격

    if success == 0:
        print("수집된 데이터 없음 — 파일 미갱신", file=sys.stderr)
        sys.exit(0)

    output = {
        "updatedAt": now_utc.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "session":   session,
        "prices":    prices,
    }

    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, separators=(",", ":"))

    print(f"저장 완료 → {OUTPUT_PATH} ({success}/{len(KR_TICKERS)}개)")


if __name__ == "__main__":
    main()
