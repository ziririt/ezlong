#!/usr/bin/env node
/**
 * ATMR 시장 데이터 수집 스크립트 (GitHub Actions용)
 * Stooq.com (무료, API 키 불필요) → data/market-signals.json 저장
 *
 * 실행: node scripts/fetch-market-data.js
 *
 * 요구사항: Node.js 18+ (내장 https 모듈만 사용, npm 패키지 불필요)
 * API 키 불필요 — Stooq.com CSV API 사용
 */

'use strict';

const https  = require('https');
const fs     = require('fs');
const path   = require('path');

// ─── 설정 ──────────────────────────────────────────────────────────────────
const DELAY_MS = 1500;  // Stooq 연속 호출 간격 (1.5초)

// QQQ, VOO: 주 지표 / TSLA, NVDA: Two Kings / DIA, IWM, SOXX: 시장 폭
const SYMBOLS = ['QQQ', 'VOO', 'TSLA', 'NVDA', 'DIA', 'IWM', 'SOXX'];

// 출력 파일 위치 (repo 루트 기준)
const OUTPUT_PATH = path.join(__dirname, '..', 'data', 'market-signals.json');

// ─── Stooq 심볼 매핑 ───────────────────────────────────────────────────────
const STOOQ_SYM = {
  'QQQ':      'qqq.us',
  'VOO':      'voo.us',
  'TSLA':     'tsla.us',
  'NVDA':     'nvda.us',
  'DIA':      'dia.us',
  'IWM':      'iwm.us',
  'SOXX':     'soxx.us',
  '^VIX':     '%5evix',
  '^IXIC':    '%5endq',
  '^GSPC':    '%5espx',
  '^TNX':     '10us.b',
  '^TYX':     '30us.b',
  'CL=F':     'cl.f',
  'DX-Y.NYB': 'dx.f',
  'GC=F':     'gc.f',
};


// ─── 유틸 ──────────────────────────────────────────────────────────────────

const sleep = ms => new Promise(r => setTimeout(r, ms));

function httpGetRaw(hostname, reqPath, extraHeaders) {
  extraHeaders = extraHeaders || {};
  return new Promise((resolve, reject) => {
    const options = {
      hostname,
      path: reqPath,
      method: 'GET',
      headers: Object.assign({
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,text/csv,*/*',
        'Accept-Language': 'en-US,en;q=0.9',
      }, extraHeaders),
      timeout: 15000,
    };
    const req = https.request(options, res => {
      let body = '';
      const headers = res.headers;
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body, headers }));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    req.end();
  });
}


// ─── Stooq CSV 파싱 ────────────────────────────────────────────────────────
function parseStooqCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  // 헤더 스킵, 날짜 오름차순 정렬
  return lines.slice(1)
    .map(l => {
      const parts = l.split(',');
      const date  = parts[0] ? parts[0].trim() : '';
      const open  = parseFloat(parts[1]);
      const high  = parseFloat(parts[2]);
      const low   = parseFloat(parts[3]);
      const close = parseFloat(parts[4]);
      const vol   = parseFloat(parts[5]) || 0;
      return { date, open, high, low, close, volume: vol };
    })
    .filter(r => r.date && !isNaN(r.close) && r.close > 0)
    .sort((a, b) => a.date < b.date ? -1 : 1);
}


// ─── Stooq: 종목 히스토리 수집 (2년치 일봉) ─────────────────────────────────
async function fetchStooqHistory(symbol) {
  const s = STOOQ_SYM[symbol] || (symbol.toLowerCase() + '.us');
  const r = await httpGetRaw('stooq.com', `/q/d/l/?s=${s}&i=d`, {
    'Referer': 'https://stooq.com/',
  });
  if (r.status !== 200) throw new Error(`HTTP ${r.status}`);

  const rows = parseStooqCSV(r.body);
  if (rows.length < 30) throw new Error(`${symbol}: 데이터 부족 (${rows.length}행)`);

  // 최근 2년치 (약 504 거래일)
  const recent  = rows.slice(-504);
  const closes  = recent.map(row => row.close);
  const volumes = recent.map(row => row.volume || 0);
  const last    = recent[recent.length - 1];
  const prev    = recent[recent.length - 2];
  const change  = last.close - prev.close;
  const changePct = prev.close > 0 ? (change / prev.close * 100) : 0;

  // volRatio: 당일 거래량 / 최근 20일 평균 거래량 (당일 제외)
  const latestVol = volumes[volumes.length - 1] || 0;
  const vol20     = volumes.slice(-21, -1);
  const vol20Avg  = vol20.length > 0 ? vol20.reduce((a, b) => a + b, 0) / vol20.length : 0;
  const volRatio  = (vol20Avg > 1000) ? latestVol / vol20Avg : null;

  return {
    closes,
    volRatio,
    price:       last.close,
    change,
    changePct,
    meta:        { date: last.date, fiftyTwoWeekHigh: null, fiftyTwoWeekLow: null },
    extPrice:    null,
    extChange:   null,
    extChangePct: null,
    marketState: 'CLOSED',
  };
}


// ─── Stooq: 현재가 단순 조회 ──────────────────────────────────────────────
async function fetchStooqPrice(symbol) {
  try {
    const s = STOOQ_SYM[symbol] || (symbol.toLowerCase() + '.us');
    const r = await httpGetRaw('stooq.com', `/q/d/l/?s=${s}&i=d`, {
      'Referer': 'https://stooq.com/',
    });
    console.log(`  [DBG ${symbol}] HTTP ${r.status} | ${r.body.substring(0, 120).replace(/\n/g, '\\n')}`);
    if (r.status !== 200) throw new Error(`HTTP ${r.status}`);
    const rows = parseStooqCSV(r.body);
    if (rows.length < 2) throw new Error('데이터 부족');
    const last  = rows[rows.length - 1];
    const prev  = rows[rows.length - 2];
    const change    = last.close - prev.close;
    const changePct = prev.close > 0 ? (change / prev.close * 100) : 0;
    return { price: last.close, change, changePct };
  } catch (e) {
    console.warn(`  [Stooq] ${symbol} 수집 실패: ${e.message}`);
    return null;
  }
}


// ─── 수학 함수들 ────────────────────────────────────────────────────────────

function calcSMA(arr, period) {
  if (arr.length < period) return null;
  const slice = arr.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function calcEMA(arr, period) {
  if (arr.length < period) return [];
  const k = 2 / (period + 1);
  let ema = arr.slice(0, period).reduce((a, b) => a + b, 0) / period;
  const result = [ema];
  for (let i = period; i < arr.length; i++) {
    ema = arr[i] * k + ema * (1 - k);
    result.push(ema);
  }
  return result;
}

function calcRSI(closes, period = 14) {
  if (closes.length < period + 1) return null;
  const changes = closes.slice(1).map((v, i) => v - closes[i]);
  let avgGain = 0, avgLoss = 0;
  for (let i = 0; i < period; i++) {
    if (changes[i] > 0) avgGain += changes[i];
    else avgLoss += Math.abs(changes[i]);
  }
  avgGain /= period;
  avgLoss /= period;
  for (let i = period; i < changes.length; i++) {
    const c = changes[i];
    avgGain = (avgGain * (period - 1) + Math.max(0, c)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(0, -c)) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function calcMACD(closes, fast = 12, slow = 26, signal = 9) {
  if (closes.length < slow + signal) return { macd: 0, signal: 0, histogram: 0 };
  const fastEMA = calcEMA(closes, fast);
  const slowEMA = calcEMA(closes, slow);
  const diff = slow - fast;
  const macdLine = fastEMA.slice(diff).map((v, i) => v - slowEMA[i]);
  const signalLine = calcEMA(macdLine, signal);
  const offset = signal - 1;
  const histogram = macdLine.slice(offset).map((v, i) => v - signalLine[i]);
  return {
    macd:      macdLine[macdLine.length - 1]     || 0,
    signal:    signalLine[signalLine.length - 1] || 0,
    histogram: histogram[histogram.length - 1]   || 0,
  };
}

function getGear(dev200) {
  if (dev200 > 2)  return 3;
  if (dev200 > -2) return 2;
  return 1;
}

function calcBuyScore({ price, sma5, sma50 = null, sma200, rsi, macd, high52, low52, vix = 18,
                        rsi5dAgo = null, hist5dAgo = null,
                        high5d = null, low5d = null, high20dExcl = null, low20dExcl = null,
                        volRatio = null }) {
  if (!price || !sma200 || !rsi) return 50;
  let score = 0;
  const dev200 = (price - sma200) / sma200 * 100;
  const inUptrend       = dev200 > 0;                              // 기본: 200일선 위
  const inStrongUptrend = inUptrend && sma50 != null && sma50 > sma200;  // 강화: 골든크로스 상태

  // 1. Gear 상태 (0~25점) — 200일선 기준 대세 판단
  if (dev200 > 2)       score += 25;
  else if (dev200 > -2) score += 12;
  // dev200 ≤ -2: 0점 (하락 추세)

  // 2. RSI 구간 (0~20점) — 골든크로스 상승장에서 RSI 60~70 = 건강한 모멘텀으로 인정 [2026-06-16 개선]
  if (rsi < 30)      score += 20;
  else if (rsi < 40) score += 16;
  else if (rsi < 50) score += 12;
  else if (rsi < 60) score += 8;
  else if (rsi < 70) score += inStrongUptrend ? 13 : inUptrend ? 10 : 4;  // 골든크로스 확인시 최대, 단순 상승장은 중간
  else if (rsi < 80) score += 2;
  // RSI ≥ 80: 0점 (극단 과매수)

  // 2a. RSI 모멘텀 보정 (−5~+5pt) — 과열 경고 먼저, 그 다음 회복/모멘텀 보너스
  if (rsi5dAgo !== null) {
    const rsiDelta = rsi - rsi5dAgo;
    if (rsi > 65 && rsiDelta > 5)              score -= 5;  // 이미 고RSI 급등 중 (최우선 감점)
    else if (rsi > 65 && rsiDelta > 3)         score -= 3;  // 고RSI 상승 중
    else if (rsi5dAgo < 40 && rsiDelta > 3)    score += 5;  // 과매도탈출 — 강한 회복 신호
    else if (rsi5dAgo < 45 && rsiDelta > 3)    score += 3;  // 저RSI에서 회복 중
    else if (rsiDelta > 10 && inUptrend)       score += 4;  // 상승장 강한 RSI 모멘텀 [신규]
    else if (rsiDelta > 5  && inUptrend)       score += 2;  // 상승장 RSI 상승 중 [신규]
    else if (rsi5dAgo > 65 && rsiDelta < -3)   score += 2;  // 과매수냉각 — 살짝 긍정
  }

  // 3. 단기 추세 정렬 (0~15점) — 5일선 위 = 상승 확인, 아래 = 눌림목 기회 [2026-06-16 개선]
  // 구버전: 5일선 이격도(0~20pt) — 아래일수록 고점수 (상승장을 구조적으로 과소평가)
  if (sma5) {
    const dev5 = (price - sma5) / sma5 * 100;
    if (dev5 < -3)                    score += 15;  // 강한 눌림 — 매수 기회
    else if (dev5 < -1.5)             score += 13;  // 눌림목
    else if (dev5 < 0)                score += 11;  // 약한 눌림
    else if (dev5 < 1.5 && inUptrend) score += 10;  // 5일선 근접 상방, 추세 확인
    else if (dev5 < 3   && inUptrend) score += 8;   // 5일선 위, 적당한 모멘텀
    else if (dev5 < 5   && inUptrend) score += 6;   // 단기 과도, 일부 조정 필요
    else if (inUptrend)               score += 3;   // 5%↑ 이상 과도한 단기 급등
    else                              score += 2;   // 하락 추세 중 5일선 위 = 약세
  } else { score += 8; }

  // 4. 시장 환경 (0~15점) — VIX 확장: 안정적 상승장도 좋은 투자 환경 [2026-06-16 개선]
  // 구버전: VIX 공포(0~15pt) — VIX<17 = 1pt (평온한 상승장을 완전히 무시)
  if (vix > 35)                      score += 15;  // 공포 — 최고 매수 기회
  else if (vix > 28)                 score += 12;  // 불안
  else if (vix > 22)                 score += 9;   // 경계
  else if (vix > 17)                 score += inUptrend ? 8 : 7;
  else if (vix > 14)                 score += inStrongUptrend ? 11 : inUptrend ? 8 : 5;  // 골든크로스 상승장 = 최강
  else                               score += inStrongUptrend ? 6 : inUptrend ? 4 : 3;   // VIX<14 과도 안정

  // 5. MACD 종합 (0~14점) — MACD 라인 위치 + 히스토그램 심도 통합 [2026-06-16 개선]
  // 구버전: 히스토그램만 0~10pt (MACD 라인이 양수인지 음수인지 전혀 구분 안 함)
  {
    const macdLine = macd?.macd ?? 0;
    const hist     = macd?.histogram ?? 0;
    let macdScore;
    if (macdLine > 0) {
      // MACD 라인 양수 = 중기 추세 건강
      if (hist > 1)       macdScore = 12;  // 완전 강세 (라인+히스토 모두 양수)
      else if (hist > -1) macdScore = 9;   // 강세, 히스토 소폭 음
      else if (hist > -2) macdScore = 6;   // 히스토 약화 중
      else                macdScore = 4;   // MACD 양수지만 히스토 깊은 음 (냉각)
    } else {
      // MACD 라인 음수 = 과매도 심도로 반등 기회 가늠
      if (hist < -3)      macdScore = 10;  // 깊은 과매도 → 반등 기대
      else if (hist < -1) macdScore = 7;
      else if (hist < 0)  macdScore = 4;
      else                macdScore = 6;   // MACD 음수지만 히스토 양전환 (골든크로스 직전)
    }
    if (hist5dAgo !== null) {
      const histDelta = hist - hist5dAgo;
      if (histDelta > 0.5)       macdScore += 2;  // 히스토 개선 중
      else if (histDelta < -0.5) macdScore -= 2;  // 히스토 악화 중
    }
    score += Math.max(0, Math.min(14, macdScore));
  }

  // 6. 52주 위치 (0~5점) — 저점 근처일수록 장기 매수 가치↑
  if (high52 && low52 && high52 > low52) {
    const pos52 = (price - low52) / (high52 - low52) * 100;
    if (pos52 < 20)      score += 5;
    else if (pos52 < 40) score += 4;
    else if (pos52 < 60) score += 3;
    else if (pos52 < 80) score += 1;
  }

  // 7. 가격 패턴 ±3pt — Higher Low(회복) vs Lower High(약화)
  if (high5d !== null && low5d !== null && high20dExcl !== null && low20dExcl !== null) {
    if (low5d > low20dExcl * 1.005)        score += 3;  // Higher Low — 저점 높아짐
    else if (high5d < high20dExcl * 0.995) score -= 3;  // Lower High — 고점 낮아짐
  }

  // 8. 거래량 확인 (0~7pt) — 거래량 뒷받침 유무 [2026-06-16 TV AI 추천]
  // volRatio = 당일거래량 / 20일평균. null이면 데이터 없음 → 0점 (중립)
  if (volRatio !== null) {
    if      (volRatio > 1.5) score += 7;  // 거래량 폭증 — 움직임 강한 신뢰
    else if (volRatio > 1.2) score += 5;  // 평균 이상
    else if (volRatio > 0.8) score += 3;  // 정상 수준
    else if (volRatio > 0.5) score += 2;  // 약간 부진
    else                     score += 1;  // 매우 부진 (신호 신뢰도 낮음)
  }

  return Math.min(100, Math.max(0, Math.round(score)));
}

function calcSellScore({ price, sma5, sma200, rsi, macd, high52, low52, vix = 18,
                         rsi5dAgo = null, hist5dAgo = null,
                         high5d = null, low5d = null, high20dExcl = null, low20dExcl = null }) {
  if (!price || !sma200 || !rsi) return 50;
  let score = 0;
  const dev200 = (price - sma200) / sma200 * 100;
  if (dev200 > 20)      score += 25;
  else if (dev200 > 12) score += 20;
  else if (dev200 > 6)  score += 13;
  else if (dev200 > 2)  score += 7;
  else if (dev200 > -2) score += 2;
  if (rsi > 80)         score += 30;
  else if (rsi > 75)    score += 24;
  else if (rsi > 70)    score += 17;
  else if (rsi > 65)    score += 10;
  else if (rsi > 60)    score += 4;
  // RSI 추세 보정 ±5pt — 5일 전 RSI 기준 (70→80 급등 vs 65→55 냉각)
  if (rsi5dAgo !== null) {
    const rsiDelta = rsi - rsi5dAgo;
    if (rsi5dAgo >= 65 && rsiDelta > 3)       score += 5;  // 이미 과열에서 더 상승 — 강한 매도 압력
    else if (rsi5dAgo >= 60 && rsiDelta > 3)  score += 3;  // 고RSI 구간 상승
    else if (rsi5dAgo >= 65 && rsiDelta < -3) score -= 3;  // 과매수 냉각 중 — 매도 시그널 약화
    else if (rsi < 40 && rsiDelta < -5)       score -= 5;  // 급락해서 과매도 — 매도 시그널 소멸
  }
  if (sma5) {
    const dev5 = (price - sma5) / sma5 * 100;
    if (dev5 > 4)         score += 20;
    else if (dev5 > 2.5)  score += 16;
    else if (dev5 > 1.5)  score += 11;
    else if (dev5 > 0.5)  score += 6;
  } else { score += 8; }
  if (vix < 13)         score += 12;
  else if (vix < 15)    score += 9;
  else if (vix < 18)    score += 6;
  else if (vix < 22)    score += 3;
  const hist = macd?.histogram ?? 0;
  if (hist > 3)         score += 8;
  else if (hist > 1.5)  score += 6;
  else if (hist > 0)    score += 3;
  // MACD 히스토그램 추세 보정 ±3pt — 양수 히스토가 더 커지면(악화) 매도 압력
  if (hist5dAgo !== null) {
    const histDelta = hist - hist5dAgo;
    if (histDelta > 0.5)       score += 3;  // 히스토 상승(강세 확대) — 매도 시그널 강화
    else if (histDelta < -0.5) score -= 2;  // 히스토 하락(강세 약화) — 매도 시그널 완화
  }
  if (high52 && low52 && high52 > low52) {
    const pos52 = (price - low52) / (high52 - low52) * 100;
    if (pos52 > 90)      score += 5;
    else if (pos52 > 80) score += 4;
    else if (pos52 > 70) score += 3;
    else if (pos52 > 60) score += 1;
  }
  // 가격 패턴 ±3pt — Lower High(약화) vs Higher Low(회복)
  if (high5d !== null && low5d !== null && high20dExcl !== null && low20dExcl !== null) {
    if (high5d < high20dExcl * 0.995)     score += 3;  // Lower High — 상승 모멘텀 약화
    else if (low5d > low20dExcl * 1.005)  score -= 3;  // Higher Low — 하방 지지 강화
  }
  return Math.min(100, Math.max(0, Math.round(score)));
}


// ─── 종목 처리 ──────────────────────────────────────────────────────────────

function processSymbol(raw, symbol, vixPrice) {
  const { closes, volRatio = null, price, change, changePct, meta, extPrice, extChange, extChangePct, marketState } = raw;

  const sma5   = calcSMA(closes, 5);
  const sma20  = calcSMA(closes, 20);
  const sma50  = calcSMA(closes, 50);
  const sma200 = calcSMA(closes, Math.min(200, closes.length));
  const rsi    = calcRSI(closes, 14);
  const macd   = calcMACD(closes);

  // 추세 분석 — 5일 전 RSI·MACD 히스토그램 [TradingView 개선 반영]
  const rsi5dAgo    = closes.length > 20 ? calcRSI(closes.slice(0, -5), 14)       : null;
  const hist5dAgo   = closes.length > 35 ? calcMACD(closes.slice(0, -5)).histogram : null;
  // 가격 패턴 — Higher Low / Lower High (closes 기반)
  const high5d      = Math.max(...closes.slice(-5));
  const low5d       = Math.min(...closes.slice(-5));
  const high20dExcl = closes.length > 20 ? Math.max(...closes.slice(-20, -5)) : null;
  const low20dExcl  = closes.length > 20 ? Math.min(...closes.slice(-20, -5)) : null;

  // 52주 고저: Stooq는 meta 없으므로 최근 252봉에서 계산
  const high52 = meta?.fiftyTwoWeekHigh ?? Math.max(...closes.slice(-252));
  const low52  = meta?.fiftyTwoWeekLow  ?? Math.min(...closes.slice(-252));

  const dev200 = sma200 ? (price - sma200) / sma200 * 100 : 0;
  const dev5   = sma5   ? (price - sma5)   / sma5   * 100 : 0;
  const dev20  = sma20  ? (price - sma20)  / sma20  * 100 : 0;
  const gear   = getGear(dev200);

  const vix = vixPrice || 18;
  const obj = { symbol, price, change, changePct, sma5, sma20, sma50, sma200, rsi, macd, high52, low52, dev200, dev5, dev20, gear, vix, rsi5dAgo, hist5dAgo, high5d, low5d, high20dExcl, low20dExcl, volRatio };

  return {
    ...obj,
    buyScore:    calcBuyScore(obj),
    sellScore:   calcSellScore(obj),
    extPrice:    extPrice    ?? null,
    extChange:   extChange   ?? null,
    extChangePct: extChangePct ?? null,
    isMarketOpen: marketState === 'REGULAR',
  };
}


// ─── CNN Fear & Greed Index ────────────────────────────────────────────────

function tryFetchFG(hostname, path, headers) {
  return new Promise((resolve) => {
    const options = {
      hostname, path, method: 'GET',
      headers: {
        'User-Agent':      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept':          'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control':   'no-cache',
        ...(headers || {}),
      },
      timeout: 12000,
    };
    const req = https.request(options, res => {
      let body = '';
      res.on('data', c => { body += c; });
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) { resolve({ ok: false, reason: `HTTP ${res.statusCode}` }); return; }
          resolve({ ok: true, body: JSON.parse(body) });
        } catch (e) { resolve({ ok: false, reason: e.message }); }
      });
    });
    req.on('error', e => resolve({ ok: false, reason: e.message }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false, reason: 'timeout' }); });
    req.end();
  });
}

async function fetchFearAndGreed() {
  const r1 = await tryFetchFG('production.dataviz.cnn.io', '/index/fearandgreed/graphdata', {
    'Referer': 'https://www.cnn.com/markets/fear-and-greed',
    'Origin':  'https://www.cnn.com',
  });
  if (r1.ok) {
    const fg = r1.body?.fear_and_greed;
    if (fg && typeof fg.score === 'number') {
      console.log(`  [F&G] 엔드포인트1 성공: score=${Math.round(fg.score)}`);
      return {
        score:      Math.round(fg.score),
        rating:     fg.rating,
        prevClose:  fg.previous_close  != null ? Math.round(fg.previous_close)  : null,
        prev1Week:  fg.previous_1_week != null ? Math.round(fg.previous_1_week) : null,
        prev1Month: fg.previous_1_month!= null ? Math.round(fg.previous_1_month): null,
        timestamp:  fg.timestamp || new Date().toISOString(),
      };
    }
    console.warn(`  [F&G] 엔드포인트1 파싱 실패`);
  } else {
    console.warn(`  [F&G] 엔드포인트1 실패: ${r1.reason}`);
  }

  const r2 = await tryFetchFG('production.dataviz.cnn.io', '/index/fearandgreed/graphdata/', {
    'Referer': 'https://www.cnn.com/',
    'Origin':  'https://www.cnn.com',
  });
  if (r2.ok) {
    const fg = r2.body?.fear_and_greed;
    if (fg && typeof fg.score === 'number') {
      console.log(`  [F&G] 엔드포인트2 성공: score=${Math.round(fg.score)}`);
      return {
        score:      Math.round(fg.score),
        rating:     fg.rating,
        prevClose:  fg.previous_close  != null ? Math.round(fg.previous_close)  : null,
        prev1Week:  fg.previous_1_week != null ? Math.round(fg.previous_1_week) : null,
        prev1Month: fg.previous_1_month!= null ? Math.round(fg.previous_1_month): null,
        timestamp:  fg.timestamp || new Date().toISOString(),
      };
    }
    console.warn(`  [F&G] 엔드포인트2 파싱 실패`);
  } else {
    console.warn(`  [F&G] 엔드포인트2 실패: ${r2.reason}`);
  }

  console.warn('  [F&G] 모든 엔드포인트 실패 — Fear & Greed 데이터 없음');
  return null;
}


// ─── 매크로 지표: 국채금리·원유·달러·금 (Stooq) ──────────────────────────────

async function fetchMacroIndicators() {
  const targets = [
    { symbol: '^TNX',     key: 'yield10y',  label: '미10년물 금리',  unit: '%'  },
    { symbol: '^TYX',     key: 'yield30y',  label: '미30년물 금리',  unit: '%'  },
    { symbol: 'CL=F',     key: 'oil',       label: 'WTI 원유',       unit: 'USD' },
    { symbol: 'DX-Y.NYB', key: 'dxy',       label: '달러인덱스 DXY', unit: ''   },
    { symbol: 'GC=F',     key: 'gold',      label: '금 Gold',        unit: 'USD' },
  ];

  const result = {};
  for (const t of targets) {
    const raw = await fetchStooqPrice(t.symbol);
    if (raw) {
      result[t.key] = { ...raw, symbol: t.symbol, label: t.label, unit: t.unit };
      console.log(`  ${t.label}: ${raw.price.toFixed(2)}${t.unit} (${raw.changePct >= 0 ? '+' : ''}${raw.changePct.toFixed(2)}%)`);
    }
    await sleep(1000);
  }
  return result;
}


// ─── 메인 ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n=== ATMR 데이터 수집 시작 (${new Date().toISOString()}) ===\n`);
  console.log('데이터 소스: Stooq.com (API 키 불필요)\n');

  const processed  = {};
  let   errorCount = 0;

  // ── 1차: VIX 먼저 수집 (종목 처리에 필요) ──────────────────────────────
  let vixPrice = 18;
  let vixData  = null;
  console.log('--- VIX 변동성 지수 수집 ---');
  vixData = await fetchStooqPrice('^VIX');
  if (vixData) {
    vixPrice = vixData.price;
    console.log(` ^VIX: ${vixData.price.toFixed(2)} (${vixData.changePct >= 0 ? '+' : ''}${vixData.changePct.toFixed(2)}%)`);
  } else {
    console.warn(` VIX 수집 실패. 기본값 ${vixPrice} 사용.`);
  }
  await sleep(DELAY_MS);

  // ── 2차: 7개 심볼 순차 수집 (Stooq 히스토리) ────────────────────────────
  console.log('\n--- 종목별 히스토리 수집 (Stooq.com, 2년치 일봉) ---');
  for (let i = 0; i < SYMBOLS.length; i++) {
    const sym = SYMBOLS[i];
    try {
      console.log(`[${i + 1}/${SYMBOLS.length}] ${sym} 수집 중...`);
      const raw = await fetchStooqHistory(sym);
      processed[sym] = processSymbol(raw, sym, vixPrice);
      const d = processed[sym];
      console.log(`  → $${d.price.toFixed(2)}, RSI ${d.rsi?.toFixed(1)}, SMA200 ${d.sma200?.toFixed(2)}, Gear ${d.gear}, 매수 ${d.buyScore}, 매도 ${d.sellScore}`);
    } catch (e) {
      console.error(`  → ERROR: ${e.message}`);
      errorCount++;
    }
    if (i < SYMBOLS.length - 1) await sleep(DELAY_MS);
  }

  // VIX를 processed에 추가
  if (vixData) {
    processed['VIX'] = {
      symbol:    'VIX',
      price:     vixData.price,
      change:    vixData.change,
      changePct: vixData.changePct,
      vix:       vixData.price,
      buyScore: null, sellScore: null,
      sma5: null, sma20: null, sma50: null, sma200: null,
      rsi:  null, macd:  null, high52: null, low52: null,
      dev200: null, dev5: null, gear: null,
    };
  }

  // ── 3차: 나스닥100·S&P500 지수 현재가 ──────────────────────────────────
  console.log('\n--- 나스닥100 / S&P500 지수 수집 ---');
  await sleep(DELAY_MS);
  const ndxRaw  = await fetchStooqPrice('^IXIC');
  await sleep(DELAY_MS);
  const gspcRaw = await fetchStooqPrice('^GSPC');

  const ndxData = ndxRaw ? {
    price:     ndxRaw.price,
    change:    ndxRaw.change,
    changePct: processed['QQQ']?.changePct ?? ndxRaw.changePct,
  } : null;

  const gspcData = gspcRaw ? {
    price:     gspcRaw.price,
    change:    gspcRaw.change,
    changePct: processed['VOO']?.changePct ?? gspcRaw.changePct,
  } : null;

  if (ndxData)  console.log(`  ^IXIC: ${ndxData.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}  (${ndxData.changePct >= 0 ? '+' : ''}${ndxData.changePct.toFixed(2)}%)`);
  if (gspcData) console.log(`  ^GSPC: ${gspcData.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}  (${gspcData.changePct >= 0 ? '+' : ''}${gspcData.changePct.toFixed(2)}%)`);

  // ── 4차: CNN Fear & Greed Index ───────────────────────────────────────────
  console.log('\n--- CNN Fear & Greed Index 수집 ---');
  await sleep(DELAY_MS);
  const fgData = await fetchFearAndGreed();
  if (fgData) {
    console.log(`  Fear & Greed: ${fgData.score} (${fgData.rating}) | 전일 ${fgData.prevClose ?? '-'}, 1주전 ${fgData.prev1Week ?? '-'}, 1개월전 ${fgData.prev1Month ?? '-'}`);
  } else {
    console.warn('  Fear & Greed 수집 실패 — 대시보드 표시 제외');
  }

  // ── 5차: 매크로 지표 ────────────────────────────────────────────────────
  console.log('\n--- 매크로 지표 수집 (국채금리·원유·달러·금) ---');
  await sleep(DELAY_MS);
  const macroData = await fetchMacroIndicators();

  // ── 6차: 저장 ──────────────────────────────────────────────────────────
  const now     = new Date();
  const kstDate = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const pad2    = n => String(n).padStart(2, '0');
  const kstStr  = `${kstDate.getUTCFullYear()}-${pad2(kstDate.getUTCMonth()+1)}-${pad2(kstDate.getUTCDate())} ${pad2(kstDate.getUTCHours())}:${pad2(kstDate.getUTCMinutes())}`;

  // 이전 신호 히스토리 읽기 (24시간 연속성)
  const HISTORY_MAX = 144;
  let previousSignals = [];
  const dir = path.dirname(OUTPUT_PATH);
  if (fs.existsSync(OUTPUT_PATH)) {
    try {
      const existing = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
      previousSignals = Array.isArray(existing.previousSignals) ? existing.previousSignals : [];
      const qqq  = existing.symbols?.QQQ;
      const soxx = existing.symbols?.SOXX;
      if (qqq) {
        const snapshot = {
          at:      existing.generatedAt,
          atKST:   existing.generatedAtKST,
          qqq: {
            rsi:       qqq.rsi       ?? null,
            macdHist:  qqq.macd?.histogram ?? null,
            dev5:      qqq.dev5      ?? null,
            dev200:    qqq.dev200    ?? null,
            gear:      qqq.gear      ?? null,
            buyScore:  qqq.buyScore  ?? null,
            sellScore: qqq.sellScore ?? null,
            price:     qqq.price     ?? null,
          },
          soxxMacdHist: soxx?.macd?.histogram ?? null,
          fearAndGreed: existing.fearAndGreed?.score ?? null,
          yield10y:     existing.macro?.yield10y?.price ?? null,
        };
        previousSignals.unshift(snapshot);
      }
      if (previousSignals.length > HISTORY_MAX) {
        previousSignals = previousSignals.slice(0, HISTORY_MAX);
      }
      console.log(`\n  히스토리 스냅샷 저장: ${previousSignals.length}개 (최대 ${HISTORY_MAX}개)`);
    } catch (e) {
      console.warn(`  이전 데이터 읽기 실패 (첫 실행일 수 있음): ${e.message}`);
    }
  }

  const output = {
    generatedAt:    now.toISOString(),
    generatedAtKST: kstStr + ' KST',
    symbolCount:    Object.keys(processed).length,
    errorCount,
    dataSource:     'Stooq.com',
    symbols:        processed,
    indices: {
      NDX:  ndxData  || null,
      GSPC: gspcData || null,
    },
    fearAndGreed:    fgData || null,
    macro:           Object.keys(macroData).length > 0 ? macroData : null,
    previousSignals: previousSignals,
  };

  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf8');

  console.log(`\n=== 완료: ${OUTPUT_PATH} (${Object.keys(processed).length}개 종목) ===`);
  console.log(`=== 생성 시각: ${kstStr} KST ===\n`);

  if (errorCount === SYMBOLS.length) {
    console.error('모든 종목 수집 실패. GitHub Actions 로그를 확인하세요.');
    process.exit(1);
  }
}

main().catch(e => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
