#!/usr/bin/env node
/**
 * ATMR 시장 데이터 수집 스크립트 (GitHub Actions용)
 * Yahoo Finance API → data/market-signals.json 저장
 * ※ API 키 불필요 — Twelve Data 의존성 완전 제거
 *
 * 실행: node scripts/fetch-market-data.js
 * 요구사항: Node.js 18+ (내장 https 모듈만 사용, npm 패키지 불필요)
 */

'use strict';

const https  = require('https');
const fs     = require('fs');
const path   = require('path');

// ─── 설정 ──────────────────────────────────────────────────────────────────
// QQQ, VOO: 주 지표 / TSLA, NVDA: Two Kings / DIA, IWM, SOXX: 시장 폭
const SYMBOLS    = ['QQQ', 'VOO', 'TSLA', 'NVDA', 'DIA', 'IWM', 'SOXX'];
const DELAY_MS   = 1500;  // Yahoo Finance: 1.5초 간격으로 충분
const OUTPUT_PATH = path.join(__dirname, '..', 'data', 'market-signals.json');
const YF_HOST    = 'query1.finance.yahoo.com';


// ─── 유틸 ──────────────────────────────────────────────────────────────────

const sleep = ms => new Promise(r => setTimeout(r, ms));

function httpGet(hostname, reqPath) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname,
      path: reqPath,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json, */*',
      },
      timeout: 20000,
    };
    const req = https.request(options, res => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${reqPath}`));
        return;
      }
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error(`JSON parse 실패: ${e.message}`)); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
    req.end();
  });
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

function getGear(sma5, sma20, sma50, price) {
  if (!sma5 || !sma20 || !sma50) return 2;
  if (sma5 > sma20 && sma20 > sma50 && price > sma5) return 3;
  if (sma5 > sma20 && sma20 > sma50)                 return 2;
  if (sma5 > sma20)                                  return 1;
  if (sma5 < sma20 && sma20 < sma50 && price < sma5) return -3;
  if (sma5 < sma20 && sma20 < sma50)                 return -2;
  if (sma5 < sma20)                                  return -1;
  return 0;
}

function calcBuyScore({ price, sma5, sma20, sma50, sma200, rsi, macd, high52, low52, vix = 18 }) {
  if (!price || !sma200 || !rsi) return 50;
  let score = 0;
  const dev200 = (price - sma200) / sma200 * 100;
  if (rsi < 30)          score += 30;
  else if (rsi < 40)     score += 20;
  else if (rsi < 50)     score += 10;
  if (dev200 < -20)      score += 20;
  else if (dev200 < -10) score += 10;
  const gear = getGear(sma5, sma20, sma50, price);
  if (gear <= -2)        score += 20;
  else if (gear === -1)  score += 10;
  if (sma5) {
    const dev5 = (price - sma5) / sma5 * 100;
    if (dev5 < -3)        score += 10;
    else if (dev5 < -1.5) score += 5;
  }
  if (sma20) {
    const dev20 = (price - sma20) / sma20 * 100;
    if (dev20 < -5)       score += 10;
    else if (dev20 < -2)  score += 5;
  }
  return Math.min(100, Math.max(0, Math.round(score)));
}

function calcSellScore({ price, sma5, sma20, sma50, sma200, rsi, macd, high52, low52, vix = 18 }) {
  if (!price || !sma200 || !rsi) return 50;
  let score = 0;
  const dev200 = (price - sma200) / sma200 * 100;
  if (rsi > 70)          score += 30;
  else if (rsi > 60)     score += 20;
  else if (rsi > 55)     score += 10;
  if (dev200 > 20)       score += 20;
  else if (dev200 > 10)  score += 10;
  const gear = getGear(sma5, sma20, sma50, price);
  if (gear >= 2)         score += 20;
  else if (gear === 1)   score += 10;
  if (sma5) {
    const dev5 = (price - sma5) / sma5 * 100;
    if (dev5 > 3)         score += 10;
    else if (dev5 > 1.5)  score += 5;
  }
  if (sma20) {
    const dev20 = (price - sma20) / sma20 * 100;
    if (dev20 > 5)        score += 10;
    else if (dev20 > 2)   score += 5;
  }
  return Math.min(100, Math.max(0, Math.round(score)));
}


// ─── 스윙 시그널 지수 계산 ────────────────────────────────────────────────────
function calcSwingSignal(processed, fgData) {
  const qqq  = processed['QQQ'];
  const voo  = processed['VOO'];
  const dia  = processed['DIA'];
  const iwm  = processed['IWM'];
  const soxx = processed['SOXX'];
  const vix  = processed['VIX']?.price ?? 20;

  if (!qqq && !voo) return null;

  let score = 0;
  const ref = qqq || voo;

  // ① VIX (0–20pts)
  const v = typeof vix === 'number' ? vix : 20;
  score += Math.max(0, Math.min(20, 20 * (40 - v) / 30));

  // ② 200일선 이격도 (0–20pts)
  const dev200 = ref.dev200 ?? 0;
  score += Math.max(0, Math.min(20, 10 + dev200 * 20 / 15));

  // ③ RSI (0–15pts)
  const rsi = ref.rsi ?? 50;
  score += Math.max(0, Math.min(15, (rsi - 30) * 15 / 40));

  // ④ 섹터 폭 — 5대 ETF Gear (0–20pts)
  const etfs = [qqq, voo, dia, iwm, soxx].filter(Boolean);
  if (etfs.length > 0) {
    const g3cnt = etfs.filter(d => d.gear >= 2).length;
    const g2cnt = etfs.filter(d => d.gear === 1).length;
    const bPts  = (g3cnt * 2 + g2cnt * 1) / (etfs.length * 2) * 20;
    score += Math.max(0, Math.min(20, bPts));
  } else {
    score += 10;
  }

  // ⑤ 52주 위치 (0–10pts)
  if (ref.high52 && ref.low52 && ref.price) {
    const range = ref.high52 - ref.low52;
    score += range > 0
      ? Math.max(0, Math.min(10, (ref.price - ref.low52) / range * 10))
      : 5;
  } else {
    score += 5;
  }

  // ⑥ MACD 히스토그램 (0–5pts)
  const hist = ref.macd?.histogram ?? 0;
  score += hist > 2 ? 5 : hist > 0.5 ? 3.5 : hist > -0.5 ? 2 : hist > -2 ? 0.5 : 0;

  // ⑦ CNN Fear & Greed (0–10pts)
  if (fgData?.score != null) {
    score += fgData.score * 10 / 100;
  } else {
    score += 5;
  }

  return Math.round(Math.max(0, Math.min(100, score)));
}


// ─── Yahoo Finance: 지수 현재가 + 매크로 ──────────────────────────────────────

async function fetchYFIndex(symbol) {
  const enc = encodeURIComponent(symbol);
  const reqPath = `/v8/finance/chart/${enc}?interval=1d&range=5d`;
  try {
    const data = await httpGet(YF_HOST, reqPath);
    const meta = data?.chart?.result?.[0]?.meta;
    if (!meta?.regularMarketPrice) throw new Error('regularMarketPrice 없음');
    const price     = meta.regularMarketPrice;
    const prev      = meta.previousClose ?? meta.chartPreviousClose ?? price;
    const change    = price - prev;
    const changePct = prev > 0 ? (change / prev * 100) : 0;
    return { price, change, changePct };
  } catch (e) {
    console.warn(`  [YF] ${symbol} 수집 실패: ${e.message}`);
    return null;
  }
}

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
    const raw = await fetchYFIndex(t.symbol);
    if (raw) {
      result[t.key] = { ...raw, symbol: t.symbol, label: t.label, unit: t.unit };
      console.log(`  ${t.label}: ${raw.price.toFixed(2)}${t.unit} (${raw.changePct >= 0 ? '+' : ''}${raw.changePct.toFixed(2)}%)`);
    }
    await sleep(1000);
  }
  return result;
}


// ─── CNN Fear & Greed ────────────────────────────────────────────────────────

function tryFetchFG(hostname, reqPath, headers) {
  return new Promise((resolve) => {
    const options = {
      hostname, path: reqPath, method: 'GET',
      headers: {
        'User-Agent':      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept':          'application/json, */*',
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
      console.log(`  [F&G] 성공: score=${Math.round(fg.score)} (${fg.rating})`);
      return {
        score:      Math.round(fg.score),
        rating:     fg.rating,
        prevClose:  fg.previous_close  != null ? Math.round(fg.previous_close)  : null,
        prev1Week:  fg.previous_1_week != null ? Math.round(fg.previous_1_week) : null,
        prev1Month: fg.previous_1_month != null ? Math.round(fg.previous_1_month) : null,
        timestamp:  fg.timestamp || new Date().toISOString(),
      };
    }
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
        prev1Month: fg.previous_1_month != null ? Math.round(fg.previous_1_month) : null,
        timestamp:  fg.timestamp || new Date().toISOString(),
      };
    }
  }
  console.warn('  [F&G] 모든 엔드포인트 실패');
  return null;
}


// ─── Yahoo Finance: 히스토리 + 현재가 (핵심 교체 부분) ───────────────────────

async function fetchYFChart(symbol) {
  const enc = encodeURIComponent(symbol);
  // 1년 히스토리(약 252 영업일) + 시간외 포함
  const reqPath = `/v8/finance/chart/${enc}?interval=1d&range=1y&includePrePost=true`;
  try {
    const data = await httpGet(YF_HOST, reqPath);
    const result = data?.chart?.result?.[0];
    if (!result) throw new Error(`chart result 없음`);
    return result;
  } catch (e) {
    throw new Error(`[YF chart] ${symbol}: ${e.message}`);
  }
}

function processYFChart(result, symbol, vixPrice) {
  const meta      = result.meta;
  const rawCloses = result.indicators?.quote?.[0]?.close ?? [];

  // null/NaN 제거 — 공휴일·서킷브레이커 등으로 null 가능
  const closes = rawCloses.filter(c => c !== null && !isNaN(c));

  if (closes.length < 30) throw new Error(`데이터 부족: ${closes.length}개`);

  // 현재가: regularMarketPrice (장중/직후) 우선, 없으면 마지막 종가
  const price      = meta.regularMarketPrice || closes[closes.length - 1];
  const prevPrice  = meta.previousClose || closes[closes.length - 2];
  const change     = price - prevPrice;
  const changePct  = prevPrice > 0 ? (change / prevPrice * 100) : 0;

  const allCloses  = [...closes.slice(0, -1), price]; // 마지막을 현재가로 교체
  const sma5   = calcSMA(allCloses, 5);
  const sma20  = calcSMA(allCloses, 20);
  const sma50  = calcSMA(allCloses, 50);
  const sma200 = calcSMA(allCloses, Math.min(200, allCloses.length));
  const rsi    = calcRSI(allCloses, 14);
  const macd   = calcMACD(allCloses);

  const last252 = allCloses.slice(-252);
  const high52  = Math.max(...last252);
  const low52   = Math.min(...last252);

  const dev200  = sma200 ? (price - sma200) / sma200 * 100 : 0;
  const dev5    = sma5   ? (price - sma5)   / sma5   * 100 : 0;
  const dev20   = sma20  ? (price - sma20)  / sma20  * 100 : 0;
  const gear    = getGear(sma5, sma20, sma50, price);

  // breakdown 탐지
  const stage       = gear <= -2 ? 'breakdown' : gear === -1 ? 'warning' : gear >= 2 ? 'uptrend' : 'neutral';
  const consGear1   = gear >= 1;
  const pos52       = (high52 > low52) ? (price - low52) / (high52 - low52) * 100 : 50;

  // 시간외 가격 (시장 상태에 따라)
  const marketState  = meta.marketState; // REGULAR / PRE / POST / CLOSED
  let extPrice = null, extChange = null, extChangePct = null;
  if (marketState === 'PRE' && meta.preMarketPrice) {
    extPrice     = meta.preMarketPrice;
    extChange    = extPrice - (meta.regularMarketPrice || price);
    extChangePct = meta.regularMarketPrice > 0 ? (extChange / meta.regularMarketPrice * 100) : 0;
  } else if (marketState === 'POST' && meta.postMarketPrice) {
    extPrice     = meta.postMarketPrice;
    extChange    = extPrice - (meta.regularMarketPrice || price);
    extChangePct = meta.regularMarketPrice > 0 ? (extChange / meta.regularMarketPrice * 100) : 0;
  }

  const obj = { symbol, price, change, changePct, sma5, sma20, sma50, sma200, rsi, macd,
                high52, low52, dev200, dev5, dev20, gear, vix: vixPrice || 18,
                pos52: Math.round(pos52 * 10) / 10,
                _bd: { stage }, _consGear1: consGear1 };
  if (extPrice !== null) {
    obj.extPrice      = extPrice;
    obj.extChange     = extChange;
    obj.extChangePct  = extChangePct;
    obj.isMarketOpen  = marketState === 'REGULAR';
  } else {
    obj.isMarketOpen = marketState === 'REGULAR';
  }

  return {
    ...obj,
    buyScore:  calcBuyScore(obj),
    sellScore: calcSellScore(obj),
  };
}


// ─── 메인 ───────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n=== ATMR 데이터 수집 시작 (${new Date().toISOString()}) ===`);
  console.log('=== 데이터 소스: Yahoo Finance (API 키 없음) ===\n');

  const processed  = {};
  let   errorCount = 0;

  // ── 1차: Yahoo Finance 히스토리 + 현재가 수집 ─────────────────────────────
  let vixPrice = 18;
  let vixYF    = null;

  console.log('--- VIX 수집 ---');
  vixYF = await fetchYFIndex('^VIX');
  if (vixYF) {
    vixPrice = vixYF.price;
    console.log(`  ^VIX: ${vixYF.price.toFixed(2)} (${vixYF.changePct >= 0 ? '+' : ''}${vixYF.changePct.toFixed(2)}%)`);
  } else {
    console.warn(`  VIX 수집 실패. 기본값 ${vixPrice} 사용.`);
  }
  await sleep(DELAY_MS);

  console.log('\n--- 7개 종목 수집 (Yahoo Finance 1Y 히스토리) ---');
  for (let i = 0; i < SYMBOLS.length; i++) {
    const sym = SYMBOLS[i];
    try {
      console.log(`[${i + 1}/${SYMBOLS.length}] ${sym} 수집 중...`);
      const result    = await fetchYFChart(sym);
      processed[sym]  = processYFChart(result, sym, vixPrice);
      const d = processed[sym];
      console.log(`  → $${d.price.toFixed(2)}  RSI ${d.rsi?.toFixed(1)}  Gear ${d.gear}  dev200 ${d.dev200?.toFixed(1)}%  Buy ${d.buyScore}  Sell ${d.sellScore}`);
    } catch (e) {
      console.error(`  → ERROR ${sym}: ${e.message}`);
      errorCount++;
    }
    if (i < SYMBOLS.length - 1) await sleep(DELAY_MS);
  }

  // VIX processed 등록
  if (vixYF) {
    processed['VIX'] = {
      symbol: 'VIX', price: vixYF.price, change: vixYF.change, changePct: vixYF.changePct,
      vix: vixYF.price, buyScore: null, sellScore: null,
      sma5: null, sma20: null, sma50: null, sma200: null,
      rsi: null, macd: null, high52: null, low52: null,
      dev200: null, dev5: null, gear: null,
    };
  }

  // 포스트마켓 수신 여부
  const hasExtendedPrices = SYMBOLS.some(sym => processed[sym]?.extPrice != null);
  if (hasExtendedPrices) {
    const extSyms = SYMBOLS.filter(sym => processed[sym]?.extPrice != null);
    console.log(`\n  시간외 데이터 수신: ${extSyms.join(', ')}`);
  }

  // ── 2차: 나스닥 / S&P500 지수 현재가 ──────────────────────────────────────
  console.log('\n--- 나스닥 / S&P500 지수 수집 ---');
  await sleep(DELAY_MS);
  const ndxRaw  = await fetchYFIndex('^IXIC');
  await sleep(DELAY_MS);
  const gspcRaw = await fetchYFIndex('^GSPC');

  const ndxData  = ndxRaw  ? { price: ndxRaw.price,  change: ndxRaw.change,  changePct: processed['QQQ']?.changePct  ?? ndxRaw.changePct  } : null;
  const gspcData = gspcRaw ? { price: gspcRaw.price, change: gspcRaw.change, changePct: processed['VOO']?.changePct ?? gspcRaw.changePct } : null;
  if (ndxData)  console.log(`  NASDAQ: ${ndxData.price.toLocaleString('en-US', { minimumFractionDigits: 2 })} (${ndxData.changePct >= 0 ? '+' : ''}${ndxData.changePct.toFixed(2)}%)`);
  if (gspcData) console.log(`  S&P500: ${gspcData.price.toLocaleString('en-US', { minimumFractionDigits: 2 })} (${gspcData.changePct >= 0 ? '+' : ''}${gspcData.changePct.toFixed(2)}%)`);

  // ── 3차: CNN Fear & Greed ──────────────────────────────────────────────────
  console.log('\n--- CNN Fear & Greed Index 수집 ---');
  const fgData = await fetchFearAndGreed();

  // ── 4차: 매크로 지표 ────────────────────────────────────────────────────────
  console.log('\n--- 매크로 지표 수집 ---');
  const macroData = await fetchMacroIndicators();

  // ── 5차: 이전 히스토리 읽기 + 스냅샷 추가 ─────────────────────────────────
  const HISTORY_MAX = 144;  // 30분 × 144 = 72시간
  let previousSignals = [];
  const dir = path.dirname(OUTPUT_PATH);

  if (fs.existsSync(OUTPUT_PATH)) {
    try {
      const existing = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf8'));
      previousSignals = Array.isArray(existing.previousSignals) ? existing.previousSignals : [];

      // 현재 회차 스냅샷을 히스토리에 추가
      const qqq  = existing.symbols?.QQQ || existing.symbols?.['QQQ'];
      const soxx = existing.symbols?.SOXX || existing.symbols?.['SOXX'];
      if (qqq) {
        const snapshot = {
          at:      existing.generatedAt || existing.updatedAt,
          atKST:   existing.generatedAtKST || null,
          qqq: {
            rsi:       qqq.rsi ?? null,
            macdHist:  qqq.macd?.histogram ?? null,
            dev5:      qqq.dev5 ?? null,
            dev200:    qqq.dev200 ?? null,
            gear:      qqq.gear ?? null,
            buyScore:  qqq.buyScore ?? null,
            sellScore: qqq.sellScore ?? null,
            price:     qqq.price ?? null,
          },
          soxxMacdHist:     soxx?.macd?.histogram ?? null,
          fearAndGreed:     existing.fearAndGreed?.score ?? null,
          yield10y:         existing.macro?.yield10y?.price ?? null,
          swingSignalScore: existing.swingSignalScore ?? null,
        };
        previousSignals.unshift(snapshot);
        if (previousSignals.length > HISTORY_MAX) {
          previousSignals = previousSignals.slice(0, HISTORY_MAX);
        }
      }
      console.log(`\n  히스토리 스냅샷: ${previousSignals.length}개 (최대 ${HISTORY_MAX}개 / 72시간)`);
    } catch (e) {
      console.warn(`  이전 데이터 읽기 실패 (첫 실행일 수 있음): ${e.message}`);
    }
  }

  // ── 스윙 지수 계산 ─────────────────────────────────────────────────────────
  const swingSignalScore = calcSwingSignal(processed, fgData);
  console.log(`\n  스윙 시그널 지수: ${swingSignalScore ?? '계산 불가'}점`);

  // ── 저장 ───────────────────────────────────────────────────────────────────
  const now     = new Date();
  const kstDate = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  const pad2    = n => String(n).padStart(2, '0');
  const kstStr  = `${kstDate.getUTCFullYear()}-${pad2(kstDate.getUTCMonth()+1)}-${pad2(kstDate.getUTCDate())} ${pad2(kstDate.getUTCHours())}:${pad2(kstDate.getUTCMinutes())}`;

  const output = {
    generatedAt:      now.toISOString(),
    generatedAtKST:   kstStr + ' KST',
    _source:          'yahoo-finance',
    symbolCount:      Object.keys(processed).length,
    errorCount,
    swingSignalScore,
    hasExtendedPrices,
    symbols:          processed,
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

  console.log(`\n=== 완료: ${OUTPUT_PATH} (${Object.keys(processed).length}개 종목, 오류 ${errorCount}개) ===`);
  console.log(`=== 생성 시각: ${kstStr} KST ===\n`);

  if (errorCount >= SYMBOLS.length) {
    console.error('모든 종목 수집 실패. Yahoo Finance 연결을 확인하세요.');
    process.exit(1);
  }
}

main().catch(e => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
