#!/usr/bin/env python3
"""
오늘의 차트 — 자동 분석 스크립트 (GitHub Actions용)
SOXX·QQQ·SOXL·TQQQ·TSLA·NVDA 6종목의 1년치 시세를 수집해 이동평균(5/20/50/200일)·
RSI(14)·52주 고저·기간별 수익률을 계산하고, matplotlib 차트 이미지를 생성한 뒤
Gemini AI로 종목별 분석 글을 작성해 data/today-chart-data.json에 누적 저장한다.

스케줄: 하루 2회 (KST 06:30 / 22:35)
모델: gemini-2.5-flash-lite (차트 패턴 판독 — CLAUDE.md 비용 정책)
최대 항목 수: 24 (6종목 × 2회 × 2일치, 초과 시 오래된 것부터 삭제)

인수인계 문서(ezlong_주요차트분석_인수인계서.md, 2026-07-03) 기반 구현.
페이지 구조는 종목별 개별 URL 포스트가 아니라 market-vs.html과 동일한
'단일 누적 페이지' 패턴을 채택 (2026-07-04 유저 확정) — data 폴더 파일 폭발
위험(CLAUDE.md 12항)을 피하고 기존 파이프라인을 그대로 재사용하기 위함.
"""

import json
import os
import re
import sys
import time
import glob
from datetime import datetime, timezone, timedelta

import requests

try:
    import yfinance as yf
except ImportError:
    print("ERROR: yfinance 미설치. pip install yfinance 실행 필요.")
    sys.exit(1)

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from matplotlib import font_manager

# 80항 — 화면 문구의 em dash(—)를 하이픈으로. 저장 직전 한 번만 훑는다.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
try:
    from ez_text import scrub as _ez_scrub
except Exception:                      # 모듈이 없어도 본 기능은 죽지 않는다
    def _ez_scrub(o):
        return o

# ─── 한글 폰트 등록 (Noto Sans CJK) ───────────────────────────────────────────
# GitHub Actions ubuntu-latest 러너에 fonts-noto-cjk apt 패키지를 워크플로에서
# 미리 설치해 둬야 한다(.github/workflows/fetch-today-chart.yml 참고).
# 못 찾아도 스크립트 자체는 죽지 않고 matplotlib 기본 폰트로 폴백한다(글자 깨짐만 발생).
_FONT_CANDIDATES = [
    "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc",
    "/usr/share/fonts/opentype/noto/NotoSansCJKkr-Regular.otf",
    "/usr/share/fonts/opentype/noto/NotoSansCJKjp-Regular.otf",
]
for _fp in _FONT_CANDIDATES:
    if os.path.exists(_fp):
        try:
            font_manager.fontManager.addfont(_fp)
            plt.rcParams["font.family"] = font_manager.FontProperties(fname=_fp).get_name()
        except Exception as _e:
            print(f"  폰트 등록 실패({_fp}): {_e}")
        break
plt.rcParams["axes.unicode_minus"] = False


# ─── 설정 ───────────────────────────────────────────────────────────────────
GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '')
GEMINI_MODEL = 'gemini-2.5-flash-lite'   # 차트 패턴 판독 — CLAUDE.md 비용 정책(flash-lite 고정)


def _gemini_url(model):
    return f'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_API_KEY}'


SYMBOLS = ['SOXX', 'QQQ', 'SOXL', 'TQQQ', 'TSLA', 'NVDA']
SYMBOL_NAMES = {
    'SOXX': 'SOXX (iShares Semiconductor ETF)',
    'QQQ':  'QQQ (Invesco NASDAQ 100 ETF)',
    'SOXL': 'SOXL (Direxion Daily Semiconductor Bull 3X)',
    'TQQQ': 'TQQQ (ProShares UltraPro QQQ 3X)',
    'TSLA': 'TSLA (Tesla Inc.)',
    'NVDA': 'NVDA (NVIDIA Corp.)',
}
SYMBOL_NAMES_KR = {
    'SOXX': '반도체 ETF',
    'QQQ':  '나스닥100 ETF',
    'SOXL': '반도체 3배 레버리지 ETF',
    'TQQQ': '나스닥100 3배 레버리지 ETF',
    'TSLA': '테슬라',
    'NVDA': '엔비디아',
}

MAX_ENTRIES = 24  # 6종목 × 2회 × 2일치

BASE_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), '..'))
OUTPUT_PATH = os.path.join(BASE_DIR, 'data', 'today-chart-data.json')
LEDGER_PATH = os.path.join(BASE_DIR, 'data', 'judgment-history-today-chart.json')
IMG_DIR = os.path.join(BASE_DIR, 'data', 'today-chart-imgs')
IMG_WEB_PREFIX = '/data/today-chart-imgs'

LEDGER_MAX_PER_SYMBOL = 12  # 하루 2회 × 6일치

# 중복 실행 가드 — 같은 실행 슬롯이 여러 트리거(자체 cron + 감시견 등)로
# 겹쳐 도는 것을 방지 (market-scorecard.yml과 동일 원리, CLAUDE.md 참고)
MIN_GAP_MINUTES = 180


# ─── 시간 유틸 ──────────────────────────────────────────────────────────────

def get_kst_now():
    return datetime.now(timezone.utc) + timedelta(hours=9)


def kst_label(dt):
    weekday = ['월', '화', '수', '목', '금', '토', '일'][dt.weekday()]
    return dt.strftime(f'%Y-%m-%d({weekday}) %H:%M KST')


def kst_run_id(dt):
    """2026-07-04-06:30"""
    return dt.strftime('%Y-%m-%d-%H:%M')


def entry_id(symbol, dt):
    return f"{symbol}-{kst_run_id(dt)}"


# ─── 지표 계산 (인수인계서 analyze.py / make_charts.py 로직 이식) ────────────

def sma(vals, n):
    out = [None] * len(vals)
    for i in range(n - 1, len(vals)):
        window = vals[i - n + 1:i + 1]
        out[i] = sum(window) / n
    return out


def ema(vals, n):
    """지수이동평균(EMA). 2026-07-04: 5·20·50·200일선을 SMA에서 EMA로 전환.
    이유 — 트레이딩뷰 기본 이평선(및 유저가 대조하는 코파일럿 리포트)이 EMA 기준이라
    SMA 값이 크게 어긋나 보이는 문제가 실사용 중 발견됨. 시작 n개 구간은 단순평균으로
    시드(seed)한 뒤 표준 EMA 승수(2/(n+1))로 이어간다 — 트레이딩뷰 값과 소수점까지 검증됨."""
    out = [None] * len(vals)
    if len(vals) < n:
        return out
    seed = sum(vals[:n]) / n
    out[n - 1] = seed
    k = 2 / (n + 1)
    e = seed
    for i in range(n, len(vals)):
        e = vals[i] * k + e * (1 - k)
        out[i] = e
    return out


def rsi(vals, n=14):
    """단순 평균 gain/loss 방식 (Wilder 방식 아님 — 인수인계서 원본 로직 유지)"""
    out = [None] * len(vals)
    for i in range(n, len(vals)):
        window = vals[i - n:i + 1]
        deltas = [window[j] - window[j - 1] for j in range(1, len(window))]
        gains = [d for d in deltas if d > 0]
        losses = [-d for d in deltas if d < 0]
        avg_gain = sum(gains) / n
        avg_loss = sum(losses) / n
        if avg_loss == 0:
            out[i] = 100.0
        else:
            rs = avg_gain / avg_loss
            out[i] = 100 - 100 / (1 + rs)
    return out


def period_return(closes, trading_days_ago):
    """trading_days_ago 거래일 전 대비 등락률(%). 데이터 부족하면 None."""
    if len(closes) <= trading_days_ago:
        return None
    old = closes[-1 - trading_days_ago]
    new = closes[-1]
    if not old:
        return None
    return round((new - old) / old * 100, 2)


def ytd_return(dates, closes):
    """올해 첫 거래일 종가 대비 등락률(%)"""
    this_year = dates[-1].year
    for i, d in enumerate(dates):
        if d.year == this_year:
            old = closes[i]
            if old:
                return round((closes[-1] - old) / old * 100, 2)
            break
    return None


def bollinger_bands(closes, n=20, k=2.0):
    """중심선(SMA20)·상단·하단 밴드. 종가 기준(표준 방식)."""
    mid = sma(closes, n)
    upper = [None] * len(closes)
    lower = [None] * len(closes)
    for i in range(n - 1, len(closes)):
        window = closes[i - n + 1:i + 1]
        m = mid[i]
        var = sum((c - m) ** 2 for c in window) / n
        std = var ** 0.5
        upper[i] = m + k * std
        lower[i] = m - k * std
    return mid, upper, lower


def true_range_and_dm(highs, lows, closes):
    """True Range, +DM, -DM 시리즈 (ADX 계산용 원재료). highs/lows 필요."""
    n = len(closes)
    tr = [None] * n
    plus_dm = [None] * n
    minus_dm = [None] * n
    for i in range(1, n):
        high, low, prev_close = highs[i], lows[i], closes[i - 1]
        tr[i] = max(high - low, abs(high - prev_close), abs(low - prev_close))
        up_move = highs[i] - highs[i - 1]
        down_move = lows[i - 1] - lows[i]
        plus_dm[i] = up_move if (up_move > down_move and up_move > 0) else 0.0
        minus_dm[i] = down_move if (down_move > up_move and down_move > 0) else 0.0
    return tr, plus_dm, minus_dm


def adx(highs, lows, closes, n=14):
    """ADX(14) — Wilder 방식. highs/lows가 없으면 호출하지 않는다(근사 금지)."""
    tr, plus_dm, minus_dm = true_range_and_dm(highs, lows, closes)
    length = len(closes)
    adx_out = [None] * length
    if length < n * 2 + 1:
        return adx_out

    def wilder_smooth(vals, start, n):
        """Wilder 방식 지수평활 합계 시리즈"""
        out = [None] * len(vals)
        first_sum = sum(v for v in vals[start + 1:start + 1 + n] if v is not None)
        out[start + n] = first_sum
        for i in range(start + n + 1, len(vals)):
            out[i] = out[i - 1] - out[i - 1] / n + vals[i]
        return out

    tr_smooth = wilder_smooth(tr, 0, n)
    plus_smooth = wilder_smooth(plus_dm, 0, n)
    minus_smooth = wilder_smooth(minus_dm, 0, n)

    dx = [None] * length
    for i in range(n, length):
        if tr_smooth[i] and tr_smooth[i] > 0:
            plus_di = 100 * plus_smooth[i] / tr_smooth[i]
            minus_di = 100 * minus_smooth[i] / tr_smooth[i]
            denom = plus_di + minus_di
            dx[i] = 100 * abs(plus_di - minus_di) / denom if denom > 0 else 0.0

    # ADX = DX의 n기간 Wilder 평활
    valid_dx_start = next((i for i in range(length) if dx[i] is not None), None)
    if valid_dx_start is None or length - valid_dx_start < n:
        return adx_out
    first_adx_idx = valid_dx_start + n - 1
    adx_out[first_adx_idx] = sum(dx[valid_dx_start:valid_dx_start + n]) / n
    for i in range(first_adx_idx + 1, length):
        if dx[i] is not None and adx_out[i - 1] is not None:
            adx_out[i] = (adx_out[i - 1] * (n - 1) + dx[i]) / n
    return adx_out


def stochastic(highs, lows, closes, n=14, d=3, close_only=False):
    """스토캐스틱 %K/%D. close_only=True면 High/Low 없이 종가의 롤링 최고/최저로 근사(정확도 낮음, 라벨링 필수)."""
    length = len(closes)
    k = [None] * length
    for i in range(n - 1, length):
        if close_only:
            window_high = max(closes[i - n + 1:i + 1])
            window_low = min(closes[i - n + 1:i + 1])
        else:
            window_high = max(highs[i - n + 1:i + 1])
            window_low = min(lows[i - n + 1:i + 1])
        denom = window_high - window_low
        k[i] = 100 * (closes[i] - window_low) / denom if denom > 0 else 50.0
    d_line = [None] * length
    for i in range(length):
        window = [v for v in k[max(0, i - d + 1):i + 1] if v is not None]
        if len(window) == d:
            d_line[i] = sum(window) / d
    return k, d_line


def fibonacci_levels(swing_high, swing_low):
    """스윙 고점→저점 되돌림 레벨 (하락 조정 국면 기준, NVDA.md와 동일 관례)"""
    diff = swing_high - swing_low
    return {
        '0.236': round(swing_high - diff * 0.236, 2),
        '0.382': round(swing_high - diff * 0.382, 2),
        '0.5':   round(swing_high - diff * 0.5, 2),
        '0.618': round(swing_high - diff * 0.618, 2),
    }


def compute_indicators(dates, closes, highs=None, lows=None):
    has_hl = bool(highs) and bool(lows) and len(highs) == len(closes) and len(lows) == len(closes)

    # 2026-07-04: SMA → EMA 전환 (트레이딩뷰 기본 이평선과 일치시키기 위함, ema() 주석 참고)
    s5 = ema(closes, 5)
    s20 = ema(closes, 20)
    s50 = ema(closes, 50)
    s200 = ema(closes, 200)
    r = rsi(closes, 14)
    bb_mid, bb_upper, bb_lower = bollinger_bands(closes, 20, 2.0)

    if has_hl:
        adx_series = adx(highs, lows, closes, 14)
        stoch_k, stoch_d = stochastic(highs, lows, closes, 14, 3, close_only=False)
        stoch_is_approx = False
    else:
        adx_series = [None] * len(closes)
        stoch_k, stoch_d = stochastic(closes, closes, closes, 14, 3, close_only=True)
        stoch_is_approx = True

    window_1y = closes[-252:] if len(closes) >= 252 else closes
    window_1y_dates = dates[-252:] if len(dates) >= 252 else dates
    high52_idx = max(range(len(window_1y)), key=lambda i: window_1y[i])
    low52_idx = min(range(len(window_1y)), key=lambda i: window_1y[i])

    # 피보나치 되돌림 — 52주 고점 이후 형성된 최근 스윙 저점 기준 (NVDA.md와 동일 관례:
    # ATH → 그 이후 가장 낮은 종가). 고점이 배열 맨 끝(즉 아직 조정이 없음)이면 계산 생략.
    fib = None
    if high52_idx < len(window_1y) - 1:
        post_high = window_1y[high52_idx + 1:]
        if post_high:
            swing_low_val = min(post_high)
            fib = fibonacci_levels(window_1y[high52_idx], swing_low_val)

    return {
        'price': round(closes[-1], 2),
        'prev_close': round(closes[-2], 2) if len(closes) >= 2 else None,
        'ema5': round(s5[-1], 2) if s5[-1] is not None else None,
        'ema20': round(s20[-1], 2) if s20[-1] is not None else None,
        'ema50': round(s50[-1], 2) if s50[-1] is not None else None,
        'ema200': round(s200[-1], 2) if s200[-1] is not None else None,
        'rsi14': round(r[-1], 1) if r[-1] is not None else None,
        'bb_upper': round(bb_upper[-1], 2) if bb_upper[-1] is not None else None,
        'bb_mid': round(bb_mid[-1], 2) if bb_mid[-1] is not None else None,
        'bb_lower': round(bb_lower[-1], 2) if bb_lower[-1] is not None else None,
        'adx14': round(adx_series[-1], 1) if adx_series[-1] is not None else None,
        'stoch_k': round(stoch_k[-1], 1) if stoch_k[-1] is not None else None,
        'stoch_d': round(stoch_d[-1], 1) if stoch_d[-1] is not None else None,
        'stoch_is_approx': stoch_is_approx,
        'fib': fib,
        'high52': round(window_1y[high52_idx], 2),
        'high52_date': window_1y_dates[high52_idx].strftime('%Y-%m-%d'),
        'low52': round(window_1y[low52_idx], 2),
        'low52_date': window_1y_dates[low52_idx].strftime('%Y-%m-%d'),
        'returns': {
            '1d': period_return(closes, 1),
            '1w': period_return(closes, 5),
            '1m': period_return(closes, 21),
            '3m': period_return(closes, 63),
            '6m': period_return(closes, 126),
            'ytd': ytd_return(dates, closes),
        },
        # 2026-07-04: adx/stochastic 전체 시리즈 추가 — 차트 하단 보조지표 패널 렌더링용
        '_ma_series': {'ema5': s5, 'ema20': s20, 'ema50': s50, 'ema200': s200, 'rsi': r,
                        'bb_upper': bb_upper, 'bb_lower': bb_lower,
                        'adx': adx_series, 'stoch_k': stoch_k, 'stoch_d': stoch_d},
    }


def sanity_check(symbol, closes, ind, change_pct=None):
    """이상치 발견 시 이 종목은 이번 실행에서 발행 보류 (CLAUDE.md 인수인계서 6항 권장 안전장치)"""
    errors = []
    if not closes or len(closes) < 60:
        errors.append(f"{symbol}: 데이터 부족({len(closes)}개 봉)")
    price = ind.get('price')
    if price is None or price <= 0:
        errors.append(f"{symbol}: 가격 이상치({price})")
    rsi14 = ind.get('rsi14')
    if rsi14 is not None and not (0 <= rsi14 <= 100):
        errors.append(f"{symbol}: RSI 이상치({rsi14})")
    # 하루 40% 초과 급변은 정상 시세보다 데이터 결측/스플릿 오류일 가능성이 높다
    # (SOXL·TQQQ 3배 레버리지 포함해도 단일 세션 40% 초과는 극히 드묾).
    if change_pct is not None and abs(change_pct) > 40:
        errors.append(f"{symbol}: 등락률 이상치({change_pct}%) — 데이터 결측/스플릿 의심")
    return errors


# 문체·형식 위반 사후 검증 (프롬프트 지시만으로는 100% 보장 안 되므로 사후 필터 추가)
STYLE_FORBIDDEN = ['하세요', '•', '▶', '■', '☞']


def content_style_errors(result, symbol):
    errors = []
    text_all = (result.get('headline', '') or '') + ' ' + ' '.join(result.get('paragraphs') or [])
    for kw in STYLE_FORBIDDEN:
        if kw in text_all:
            errors.append(f"금지 표현 '{kw}' 포함")
    if '|' in text_all and text_all.count('|') >= 3:
        errors.append("마크다운 표 형태(| 반복) 의심")
    if symbol == 'TSLA':
        musk_bad_kw = ['머스크의 정치', '머스크 SNS', '머스크의 발언 논란']
        for kw in musk_bad_kw:
            if kw in text_all:
                errors.append(f"TSLA/머스크 취급 원칙 위반 의심: '{kw}'")
    return errors


# ─── 데이터 수집 ─────────────────────────────────────────────────────────────

def fetch_history(symbol):
    """2년치 일봉 — auto_adjust=False로 야후 파이낸스 표시값과 일치 (CLAUDE.md 19항).
    High/Low도 함께 반환 — ADX·스토캐스틱 정확 계산에 필요(2026-07-04 추가).
    Volume도 반환 — 차트 하단 거래량 바 표시용(2026-07-04 추가)."""
    t = yf.Ticker(symbol)
    hist = t.history(period='2y', interval='1d', auto_adjust=False)
    if hist.empty:
        return [], [], [], [], []
    dates = [d.to_pydatetime() for d in hist.index]
    closes = [float(c) for c in hist['Close'].tolist()]
    highs = [float(c) for c in hist['High'].tolist()]
    lows = [float(c) for c in hist['Low'].tolist()]
    volumes = [float(v) for v in hist['Volume'].tolist()]
    return dates, closes, highs, lows, volumes


def fetch_news(symbol, max_items=4, max_age_hours=20):
    """종목별 최신 뉴스 헤드라인 (2회/일 스케줄에 맞춰 20시간 이내만)"""
    headlines = []
    try:
        t = yf.Ticker(symbol)
        news = t.news or []
        now_ts = time.time()
        cutoff_ts = now_ts - max_age_hours * 3600
        for item in news:
            if len(headlines) >= max_items:
                break
            if not isinstance(item, dict):
                continue
            content = item.get('content', {})
            title = content.get('title') if isinstance(content, dict) else None
            if not title:
                title = item.get('title')
            if not title:
                continue
            pub_ts = None
            if isinstance(content, dict) and content.get('pubDate'):
                try:
                    pub_dt = datetime.fromisoformat(content['pubDate'].replace('Z', '+00:00'))
                    pub_ts = pub_dt.timestamp()
                except Exception:
                    pass
            if pub_ts is None:
                pub_ts = item.get('providerPublishTime')
            if pub_ts and pub_ts < cutoff_ts:
                continue
            if pub_ts:
                hours_ago = (now_ts - pub_ts) / 3600
                age = f"({int(hours_ago * 60)}분 전)" if hours_ago < 1 else f"({hours_ago:.1f}시간 전)"
                title = f"{title} {age}"
            headlines.append(title)
    except Exception as e:
        print(f"    뉴스 수집 실패({symbol}): {e}")
    return headlines


# ─── 차트 이미지 생성 ────────────────────────────────────────────────────────

COLORS = {"price": "#1f3864", "ema5": "#e07b39", "ema20": "#c0392b", "ema50": "#7d3c98", "ema200": "#2e8b57"}


def render_chart(symbol, dates, closes, ind, out_path, volumes=None):
    """가격+EMA+볼린저+거래량(주가 패널 하단, 트레이딩뷰 스타일) / RSI / 스토캐스틱 / ADX
    4단 구성. 2026-07-04: 거래량·스토캐스틱·ADX 패널 신설(요청 반영)."""
    s = ind['_ma_series']
    window = 180
    dts = dates[-window:]
    ps = closes[-window:]
    s5 = s['ema5'][-window:]
    s20 = s['ema20'][-window:]
    s50 = s['ema50'][-window:]
    s200 = s['ema200'][-window:]
    r = s['rsi'][-window:]
    bb_u = s['bb_upper'][-window:]
    bb_l = s['bb_lower'][-window:]
    adx_v = s['adx'][-window:]
    k_v = s['stoch_k'][-window:]
    d_v = s['stoch_d'][-window:]
    vol = (volumes or [])[-window:]

    fig, (ax1, ax2, ax3, ax4) = plt.subplots(
        4, 1, figsize=(10, 10.4), sharex=True,
        gridspec_kw={"height_ratios": [3.2, 1, 1, 0.8]}, dpi=150)
    fig.patch.set_facecolor("white")

    # ── 1) 가격 + EMA + 볼린저 + 거래량(하단 오버레이) ──────────────────────
    if any(v is not None for v in bb_u):
        ax1.plot(dts, bb_u, color="#9aa5b1", linewidth=0.9, linestyle="--", label="볼린저 상단")
        ax1.plot(dts, bb_l, color="#9aa5b1", linewidth=0.9, linestyle="--", label="볼린저 하단")
        ax1.fill_between(dts, bb_l, bb_u, color="#9aa5b1", alpha=0.06)

    if vol and any(v is not None for v in vol):
        vol_ax = ax1.twinx()
        # 국내 관례(양봉=빨강/상승, 음봉=파랑/하락)에 맞춰 배치
        vol_colors = ["#d9534f" if (i == 0 or ps[i] >= ps[i - 1]) else "#2e6da4"
                      for i in range(len(ps))]
        vol_ax.bar(dts, vol, color=vol_colors, alpha=0.35, width=0.8, zorder=1)
        vmax = max((v for v in vol if v is not None), default=1)
        vol_ax.set_ylim(0, vmax * 4.2)  # 거래량 바가 패널 하단 ~25%만 차지하도록 스케일 압축
        vol_ax.set_yticks([])
        vol_ax.set_zorder(ax1.get_zorder() - 1)
        ax1.patch.set_visible(False)

    ax1.plot(dts, ps, color=COLORS["price"], linewidth=1.6, label=f"{symbol} 종가", zorder=3)
    # 2026-07-04: 범례에 (EMA) 명시 — SMA로 오해하지 않도록 최소 한 번은 표기
    if any(v is not None for v in s5):
        ax1.plot(dts, s5, color=COLORS["ema5"], linewidth=1.0, label="5일선(EMA)", zorder=3)
    if any(v is not None for v in s20):
        ax1.plot(dts, s20, color=COLORS["ema20"], linewidth=1.0, label="20일선(EMA)", zorder=3)
    if any(v is not None for v in s50):
        ax1.plot(dts, s50, color=COLORS["ema50"], linewidth=1.1, label="50일선(EMA)", zorder=3)
    if any(v is not None for v in s200):
        ax1.plot(dts, s200, color=COLORS["ema200"], linewidth=1.3, label="200일선(EMA)", zorder=3)

    last_price = ps[-1]
    last_date = dts[-1]
    ax1.scatter([last_date], [last_price], color="red", zorder=5, s=25)
    ax1.annotate(f"{last_price:,.2f}", (last_date, last_price),
                 textcoords="offset points", xytext=(8, 4), fontsize=9, color="red", fontweight="bold")

    ax1.set_title(SYMBOL_NAMES.get(symbol, symbol), fontsize=13, fontweight="bold", loc="left", color="#1F3864")
    ax1.legend(loc="upper left", fontsize=8, ncol=4, frameon=False)
    ax1.grid(alpha=0.25)
    ax1.set_ylabel("USD")

    # ── 2) RSI(14) ──────────────────────────────────────────────────────────
    ax2.plot(dts, r, color="#146c43", linewidth=1.3)
    ax2.axhline(70, color="#c0392b", linestyle="--", linewidth=0.8, alpha=0.7)
    ax2.axhline(30, color="#2e8b57", linestyle="--", linewidth=0.8, alpha=0.7)
    ax2.set_ylim(0, 100)
    ax2.set_ylabel("RSI(14)")
    ax2.grid(alpha=0.25)

    # ── 3) 스토캐스틱(14,3) %K/%D ────────────────────────────────────────────
    if any(v is not None for v in k_v):
        ax3.plot(dts, k_v, color="#1f77b4", linewidth=1.1, label="%K")
        ax3.plot(dts, d_v, color="#e07b39", linewidth=1.0, linestyle="--", label="%D")
        ax3.axhline(80, color="#c0392b", linestyle="--", linewidth=0.8, alpha=0.6)
        ax3.axhline(20, color="#2e8b57", linestyle="--", linewidth=0.8, alpha=0.6)
        ax3.set_ylim(0, 100)
        ax3.legend(loc="upper left", fontsize=7, ncol=2, frameon=False)
    ax3.set_ylabel("스토캐스틱")
    ax3.grid(alpha=0.25)

    # ── 4) ADX(14) ───────────────────────────────────────────────────────────
    if any(v is not None for v in adx_v):
        ax4.plot(dts, adx_v, color="#6b4c9a", linewidth=1.2)
        ax4.axhline(25, color="#888888", linestyle="--", linewidth=0.8, alpha=0.6)
    ax4.set_ylabel("ADX(14)")
    ax4.set_ylim(bottom=0)
    ax4.grid(alpha=0.25)

    ax4.xaxis.set_major_locator(mdates.MonthLocator())
    ax4.xaxis.set_major_formatter(mdates.DateFormatter("%Y-%m"))
    fig.autofmt_xdate(rotation=30)

    fig.tight_layout()
    fig.savefig(out_path, facecolor="white")
    plt.close(fig)


def prune_images(keep_paths):
    """entries에서 더 이상 참조되지 않는 차트 이미지 삭제 (CLAUDE.md 12항 — data 폴더 폭발 방지)"""
    if not os.path.isdir(IMG_DIR):
        return
    keep_files = {os.path.basename(p) for p in keep_paths}
    for f in glob.glob(os.path.join(IMG_DIR, '*.png')):
        if os.path.basename(f) not in keep_files:
            try:
                os.remove(f)
            except Exception:
                pass


# ─── 판단 원장 (judgment ledger) — 종목별 3영업일 연속성 ────────────────────

def load_ledger():
    try:
        with open(LEDGER_PATH, 'r', encoding='utf-8') as f:
            obj = json.load(f)
        return obj if isinstance(obj, dict) else {}
    except Exception:
        return {}


def save_ledger(ledger):
    try:
        with open(LEDGER_PATH, 'w', encoding='utf-8') as f:
            json.dump(ledger, f, ensure_ascii=False)
    except Exception as e:
        print(f"  판단 원장 저장 실패: {e}")


def append_ledger(ledger, symbol, kst_now, headline, price, change_pct):
    lst = ledger.setdefault(symbol, [])
    sign = '+' if (change_pct or 0) >= 0 else ''
    line = f"{price:,.2f}달러({sign}{change_pct:.2f}%) — {headline}"
    lst.append({'d': kst_now.strftime('%Y-%m-%d'), 't': kst_now.strftime('%H:%M'), 'k': line[:160]})
    ledger[symbol] = lst[-LEDGER_MAX_PER_SYMBOL:]
    return ledger


def ledger_context_block(ledger, symbol):
    lst = ledger.get(symbol, [])
    if not lst:
        return ""
    by_date = {}
    for e in lst:
        if isinstance(e, dict) and e.get('d') and e.get('k'):
            by_date[e['d']] = e
    days = list(by_date.values())[-3:]
    if not days:
        return ""
    lines = '\n'.join(f"- {e['d']} {e.get('t', '')}: {e['k']}" for e in days)
    return f"""
=== {symbol} 직전 판단 흐름(최근 영업일, 연속성 유지용) ===
{lines}
[연속성 규칙]
- 이번 글은 위 흐름 위에서 판단하라. 매번 처음 보는 종목처럼 쓰지 마라.
- 직전 판단 대비 방향이 유지되는지 전환되는지 본문에 자연스럽게 녹여라(예: '어제 지적한 200일선 저항이 오늘도 그대로다').
- 단, 위 기록에 끌려가 현재 데이터와 다른 판단을 내리지는 마라. 판단 근거는 항상 오늘 계산된 수치다.
"""


# ─── Gemini 프롬프트 ─────────────────────────────────────────────────────────

TSLA_MUSK_GUARD = """
=== 테슬라($TSLA)·일론 머스크 관련 재료 취급 원칙 (엄격 적용) ===
- 머스크 개인 발언·SNS·정치적 논란·감정적 언론 보도는 부정 재료로 절대 다루지 않는다.
- 부정적으로 다룰 수 있는 것은 오직 수치·사실 근거가 있는 경우뿐이다: 실적 컨센서스 미스(수치 명시),
  대규모 리콜(건수 명시), 정부·규제기관 제재(기관명·내용 명시), 인도량 급감(전분기 대비 % 명시).
- 위 기준에 해당하지 않으면 그런 재료는 아예 언급하지 않는다.
"""

TONE_GUIDE = """
=== 문체·톤 지침 (반드시 준수) ===
- 운영자 본인이 쓰는 듯한 직설적이고 개성 있는 구어체("~다", "~라고 본다", "~로 보인다"). 정형화된 AI 문체, 과도한 격식체, 뻔한 클리셰 금지.
- 이모티콘, 이모지, 유니코드 불릿 기호(•, ▶ 등) 절대 금지.
- 표(마크다운 테이블) 절대 금지. 수치는 문장 안에 자연스럽게 녹여서 표기.
- 최소 3~4문단, 문단당 3문장 이상. 실제 애널리스트 리포트 수준 깊이.
- 가격, 이동평균선, RSI, 등락률, 52주 고저 등은 반드시 아래 제공된 실제 계산값을 정확히 인용한다. 추측이나 어림 금지.
- "~하세요" 같은 행동 촉구 문장 금지. "~권고", "~구간", "~로 보인다" 같은 분석/진단형 문체 사용.
- 이 콘텐츠는 투자자문이 아닌 참고용 분석이라는 점을 본문 어디에도 노골적으로 광고하듯 반복하지 말 것(디스클레이머는 페이지 하단에 별도 고정 표시된다).
"""

# 2026-07-29 신설 — headline_en/paragraphs_en/tags_en 전용 톤 지침.
# 주의: 이건 TONE_GUIDE(한국어, "운영자 본인 목소리")의 번역이 아니다. "운영자 개인 구어체"라는
# 페르소나 자체가 한국어 화자 1인칭 캐릭터라 영어로 그대로 옮기면 어색하다. 대신 미국 리테일
# 투자자가 실제로 구독하는 금융 뉴스레터(예: Morning Brew Markets류) 톤 — confident, 간결,
# 자연스러운 구어체 축약형 허용 — 을 별도로 정의한다. 판단·근거·숫자는 한국어판과 동일해야 하며
# 문체만 다른 언어권 독자에 맞게 새로 쓴다.
TONE_GUIDE_EN = """
=== English style guide for headline_en / paragraphs_en / tags_en (follow exactly) ===
- Write like a sharp, plain-spoken US markets newsletter (confident, direct, "I think", "this looks like"). Not corporate analyst-speak, not a literal translation of the Korean text above — a natural English rewrite of the same judgment and reasoning.
- No emoji, no bullet symbols (•, ▶, etc), no markdown tables.
- Minimum 3-4 paragraphs, 3+ sentences each — same depth as the Korean version.
- Cite the exact same numbers as the Korean version (price, EMA, RSI, % returns, 52-week high/low) — do not round differently or invent new figures.
- No command-style calls to action ("you should buy now"). Use diagnostic phrasing ("this sits in a buy-watch zone", "reads as consolidation").
- Do not repeatedly disclaim that this isn't investment advice inside the body text (the disclaimer is already shown separately at the bottom of the page).
- tags_en: keep the ticker hashtag as-is (e.g. "#TSLA"), translate the other keyword hashtags into natural English (e.g. "#실적발표" → "#Earnings", not a literal character-by-character translation).
"""


def build_prompt(symbol, ind, dates, kst_now, news_headlines, ledger_block):
    r = ind['returns']

    def fmt_pct(v):
        if v is None:
            return 'N/A'
        sign = '+' if v >= 0 else ''
        return f'{sign}{v:.2f}%'

    change_pct = None
    if ind.get('prev_close'):
        change_pct = round((ind['price'] - ind['prev_close']) / ind['prev_close'] * 100, 2)

    news_block = '\n'.join(f'- {h}' for h in news_headlines) if news_headlines else '- (관련 최신 뉴스 없음 — 가격·기술적 데이터 중심으로 서술)'

    musk_block = TSLA_MUSK_GUARD if symbol == 'TSLA' else ""

    bb_line = ""
    if ind.get('bb_upper') is not None:
        bb_line = f"볼린저밴드(20,2): 상단 {ind['bb_upper']} / 중심(20일선) {ind['bb_mid']} / 하단 {ind['bb_lower']}\n"

    adx_line = ""
    if ind.get('adx14') is not None:
        adx_line = f"ADX(14): {ind['adx14']} (20 미만이면 추세 약함/횡보, 25 이상이면 뚜렷한 추세)\n"

    stoch_line = ""
    if ind.get('stoch_k') is not None:
        approx_note = " (종가 기준 근사치 — 고가/저가 데이터 없어 정밀도 낮음)" if ind.get('stoch_is_approx') else ""
        stoch_line = f"스토캐스틱(14,3): %K {ind['stoch_k']} / %D {ind['stoch_d']}{approx_note}\n"

    fib_line = ""
    if ind.get('fib'):
        f_ = ind['fib']
        fib_line = (f"피보나치 되돌림(52주 고점 {ind['high52']} → 그 이후 최저 종가 기준): "
                    f"0.236={f_['0.236']} / 0.382={f_['0.382']} / 0.5={f_['0.5']} / 0.618={f_['0.618']}\n")

    return f"""당신은 미국 주식·ETF 기술적 분석 콘텐츠를 작성하는 애널리스트입니다.
현재 시각(KST): {kst_label(kst_now)}
종목: {SYMBOL_NAMES.get(symbol, symbol)} ({SYMBOL_NAMES_KR.get(symbol, '')})

=== 오늘 계산된 실제 수치 (이 값만 근거로 사용, 추측 금지) ===
현재가(직전 종가): {ind['price']:,.2f} USD
전일 대비 등락률: {fmt_pct(change_pct)}
5일 지수이동평균(EMA): {ind['ema5']}
20일 지수이동평균(EMA): {ind['ema20']}
50일 지수이동평균(EMA): {ind['ema50']}
200일 지수이동평균(EMA): {ind['ema200']}
(주의: 단순이동평균 SMA가 아닌 지수이동평균 EMA입니다. 글에서 이평선을 언급할 때 최소 한 번은 "EMA" 또는 "지수이동평균"임을 명시하세요.)
RSI(14): {ind['rsi14']}
{bb_line}{adx_line}{stoch_line}{fib_line}52주 최고가: {ind['high52']} ({ind['high52_date']})
52주 최저가: {ind['low52']} ({ind['low52_date']})
기간별 수익률 — 1일: {fmt_pct(r['1d'])} / 1주: {fmt_pct(r['1w'])} / 1개월: {fmt_pct(r['1m'])} / 3개월: {fmt_pct(r['3m'])} / 6개월: {fmt_pct(r['6m'])} / 연초대비(YTD): {fmt_pct(r['ytd'])}

=== 관련 최신 뉴스 헤드라인 ===
{news_block}
{ledger_block}{musk_block}{TONE_GUIDE}
{TONE_GUIDE_EN}

=== 출력 형식 ===
아래 JSON 구조로만 응답하세요. JSON 외 다른 텍스트는 절대 출력하지 마세요.
headline_en/paragraphs_en/tags_en은 headline/paragraphs/tags와 완전히 같은 판단·같은 숫자를
위 English style guide에 따라 자연스러운 영어로 다시 쓴 것이어야 합니다(직역 금지, 결론 변경 금지).
{{
  "headline": "종목명(티커), 한줄 요약 형식의 제목 (예: '테슬라(TSLA), 인도량 서프라이즈에도 왜 주가는 빠졌나')",
  "headline_en": "English version of headline (natural rewrite, e.g. 'Tesla (TSLA): Deliveries Beat, So Why Did the Stock Drop?')",
  "paragraphs": ["문단1", "문단2", "문단3(선택)"],
  "paragraphs_en": ["English paragraph 1", "English paragraph 2", "English paragraph 3 (optional)"],
  "tags": ["#티커", "#핵심키워드1", "#핵심키워드2", "#핵심키워드3"],
  "tags_en": ["#Ticker", "#EnglishKeyword1", "#EnglishKeyword2", "#EnglishKeyword3"]
}}
"""


def _call_single_model(model, payload, max_retries=3):
    url = _gemini_url(model)
    wait_secs = [8, 25, 60]
    wait_secs_429 = [30, 60, 120]

    for attempt in range(max_retries):
        try:
            resp = requests.post(url, json=payload, timeout=120)
            resp.raise_for_status()
            data = resp.json()
            parts = data["candidates"][0]["content"]["parts"]
            text = None
            for part in parts:
                if part.get("thought"):
                    continue
                text = part.get("text", "")
                if text.strip():
                    break
            if not text:
                print(f"    ERROR: {model} — 유효한 텍스트 파트 없음")
                return None
            text = text.strip()
            text = re.sub(r'^```[a-zA-Z]*\n?', '', text)
            text = re.sub(r'\n?```$', '', text)
            return json.loads(text)
        except requests.exceptions.RequestException as e:
            status = getattr(e.response, 'status_code', None) if hasattr(e, 'response') else None
            print(f"    ERROR: {model} 요청 실패 (시도 {attempt + 1}/{max_retries}) — {e}")
            if attempt < max_retries - 1 and status in (None, 429, 500, 502, 503, 504):
                wait = wait_secs_429[attempt] if status == 429 else wait_secs[attempt]
                print(f"    {wait}초 후 재시도...")
                time.sleep(wait)
                continue
            return None
        except (KeyError, IndexError, json.JSONDecodeError) as e:
            print(f"    ERROR: {model} 응답 파싱 실패 — {e}")
            return None
    return None


def call_gemini(prompt):
    if not GEMINI_API_KEY:
        print("    WARNING: GEMINI_API_KEY 없음 — 스킵")
        return None

    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "temperature": 0.5,
            # 2026-07-29: 8192 → 14336 — headline_en/paragraphs_en/tags_en 병기로 3~4문단
            # 분량이 사실상 두 배가 됨. paragraphs는 이 스크립트에서 가장 긴 자유서술
            # 필드라 여유를 넉넉히 둔다.
            "maxOutputTokens": 14336,
            "responseMimeType": "application/json",
            "thinkingConfig": {"thinkingBudget": 0}
        }
    }

    print(f"    1차 시도: {GEMINI_MODEL}")
    result = _call_single_model(GEMINI_MODEL, payload, max_retries=3)
    if result:
        return result

    fallback = 'gemini-2.5-flash'
    print(f"    1차 모델 실패 → 폴백 시도: {fallback}")
    result = _call_single_model(fallback, payload, max_retries=2)
    if result:
        print(f"    성공(폴백): {fallback}")
    return result


def validate_content(result):
    if not isinstance(result, dict):
        return False
    if not result.get('headline') or not isinstance(result.get('paragraphs'), list):
        return False
    if len(result['paragraphs']) < 2:
        return False
    total_len = sum(len(p) for p in result['paragraphs'] if isinstance(p, str))
    if total_len < 150:
        return False
    return True


# ─── JSON 저장/로드 ──────────────────────────────────────────────────────────

def load_existing():
    if os.path.exists(OUTPUT_PATH):
        try:
            with open(OUTPUT_PATH, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            pass
    return {"entries": [], "max_entries": MAX_ENTRIES}


def save_data(data):
    data = _ez_scrub(data)          # 80항 — ' — ' → ' - '
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"저장 완료: {OUTPUT_PATH}")


def recent_run_exists(data, kst_now):
    if os.environ.get('FORCE_TODAYCHART') == '1':
        return False
    entries = data.get('entries', [])
    if not entries:
        return False
    try:
        last_run = entries[0]['id'].split('-', 1)[1]  # "SYMBOL-YYYY-MM-DD-HH:MM" → "YYYY-MM-DD-HH:MM"
        last_dt = datetime.strptime(last_run, '%Y-%m-%d-%H:%M')
        diff_min = (kst_now.replace(tzinfo=None) - last_dt).total_seconds() / 60
        return 0 <= diff_min < MIN_GAP_MINUTES
    except Exception:
        return False


# ─── 메인 ────────────────────────────────────────────────────────────────────

def main():
    kst_now = get_kst_now()
    print(f"=== 오늘의 차트 분석 시작 ({kst_label(kst_now)}) ===")

    os.makedirs(IMG_DIR, exist_ok=True)

    data = load_existing()
    if recent_run_exists(data, kst_now):
        print(f"  직전 실행이 {MIN_GAP_MINUTES}분 이내 — 중복 실행 건너뜀 (FORCE_TODAYCHART=1로 우회 가능)")
        sys.exit(0)

    ledger = load_ledger()
    existing_entries = data.get('entries', [])
    new_entries = []
    ok_count = 0

    for symbol in SYMBOLS:
        print(f"  [{symbol}] 데이터 수집...")
        try:
            dates, closes, highs, lows, volumes = fetch_history(symbol)
        except Exception as e:
            print(f"    ERROR: {symbol} 시세 수집 실패 — {e}")
            continue

        if not dates or not closes:
            print(f"    ERROR: {symbol} 시세 데이터 없음 — 건너뜀")
            continue

        ind = compute_indicators(dates, closes, highs, lows)

        change_pct = None
        if ind.get('prev_close'):
            change_pct = round((ind['price'] - ind['prev_close']) / ind['prev_close'] * 100, 2)

        errs = sanity_check(symbol, closes, ind, change_pct)
        if errs:
            for e in errs:
                print(f"    WARNING: {e} — 이번 실행 발행 보류")
            continue

        news = fetch_news(symbol)
        ledger_block = ledger_context_block(ledger, symbol)
        prompt = build_prompt(symbol, ind, dates, kst_now, news, ledger_block)

        print(f"    Gemini 분석 중...")
        result = call_gemini(prompt)
        if not result or not validate_content(result):
            print(f"    ERROR: {symbol} Gemini 결과 이상 — 건너뜀")
            continue

        style_errs = content_style_errors(result, symbol)
        if style_errs:
            print(f"    WARNING: 문체/형식 위반 {len(style_errs)}건 — 1회 재시도")
            for e in style_errs:
                print(f"      - {e}")
            retry_result = call_gemini(prompt)
            if retry_result and validate_content(retry_result) and not content_style_errors(retry_result, symbol):
                result = retry_result
                print("    재시도 성공 — 위반 없는 결과 채택")
            else:
                print("    재시도에도 위반 존재 — 1차 결과 그대로 사용")

        img_fname = f"{symbol}_{kst_now.strftime('%Y%m%d_%H%M')}.png"
        img_path = os.path.join(IMG_DIR, img_fname)
        try:
            render_chart(symbol, dates, closes, ind, img_path, volumes=volumes)
        except Exception as e:
            print(f"    ERROR: {symbol} 차트 생성 실패 — {e}")
            continue

        entry = {
            "id": entry_id(symbol, kst_now),
            "symbol": symbol,
            "name": SYMBOL_NAMES.get(symbol, symbol),
            "name_kr": SYMBOL_NAMES_KR.get(symbol, ''),
            "timestamp_kst": kst_label(kst_now),
            "price": ind['price'],
            "change_pct": change_pct,
            "ema5": ind['ema5'], "ema20": ind['ema20'], "ema50": ind['ema50'], "ema200": ind['ema200'],
            "rsi14": ind['rsi14'],
            "bb_upper": ind.get('bb_upper'), "bb_mid": ind.get('bb_mid'), "bb_lower": ind.get('bb_lower'),
            "adx14": ind.get('adx14'),
            "stoch_k": ind.get('stoch_k'), "stoch_d": ind.get('stoch_d'), "stoch_is_approx": ind.get('stoch_is_approx'),
            "fib": ind.get('fib'),
            "high52": ind['high52'], "high52_date": ind['high52_date'],
            "low52": ind['low52'], "low52_date": ind['low52_date'],
            "returns": ind['returns'],
            "chart_path": f"{IMG_WEB_PREFIX}/{img_fname}",
            "headline": result['headline'],
            "headline_en": result.get('headline_en', ''),
            "paragraphs": result['paragraphs'],
            "paragraphs_en": result.get('paragraphs_en') or [],
            "tags": (result.get('tags') or [])[:6],
            "tags_en": (result.get('tags_en') or [])[:6],
        }
        new_entries.append(entry)
        ok_count += 1

        headline_short = result['headline'][:60]
        ledger = append_ledger(ledger, symbol, kst_now, headline_short, ind['price'], change_pct or 0)
        print(f"    완료: {entry['id']}")

    if ok_count == 0:
        print("  ERROR: 모든 종목 실패 — 스크립트 종료")
        sys.exit(1)

    # 신규 + 기존 병합, id 중복 제거(신규 우선), 최신순 정렬, 상한 적용
    all_entries = new_entries + existing_entries
    seen = set()
    deduped = []
    for e in all_entries:
        if e.get('id') in seen:
            continue
        seen.add(e.get('id'))
        deduped.append(e)
    deduped.sort(key=lambda e: e.get('id', ''), reverse=True)
    deduped = deduped[:MAX_ENTRIES]

    keep_paths = [e['chart_path'] for e in deduped if e.get('chart_path')]
    prune_images(keep_paths)

    data['entries'] = deduped
    data['max_entries'] = MAX_ENTRIES
    data['updated_at'] = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    save_data(data)

    save_ledger(ledger)

    print(f"  이번 실행 성공: {ok_count}/{len(SYMBOLS)}종목, 총 누적 항목: {len(deduped)}")
    print("=== 완료 ===")


if __name__ == '__main__':
    main()
