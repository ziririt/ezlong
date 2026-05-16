#!/usr/bin/env node
/**
 * ATMR 시장 데이터 수집 스크립트 (GitHub Actions용)
 * Twelve Data API → data/market-signals.json 저장
 *
 * 실행: TWELVEDATA_API_KEY=xxxx node scripts/fetch-market-data.js
 *
 * 요구사항: Node.js 18+ (내장 https 모듈만 사용, npm 패키지 불필요)
 */

'use strict';

const https  = require('https');
const fs     = require('fs');
const path   = require('path');

// ─── 설정 ──────────────────────────────────────────────────────────────────
const API_KEY  = process.env.TWELVEDATA_API_KEY;
const TD_HOST  = 'api.twelvedata.com';
const DELAY_MS = 8500;  // 무료 플랜: 8 credits/min → 8.5초 간격

// QQQ, VOO: 주 지표 / TSLA, NVDA: Two Kings / DIA, IWM, SOXX: 시장 폭
// VIX는 Twelve Data 무료플랜 미지원 → Yahoo Finance로 별도 수집
const SYMBOLS = ['QQQ', 'VOO', 'TSLA', 'NVDA', 'DIA', 'IWM', 'SOXX'];

// 출력 파일 위치 (repo 루트 기준)
const OUTPUT_PATH = path.join(__dirname, '..', 'data', 'market-signals.json');


// ─── 유틸 ──────────────────────────────────────────────────────────────────

const sleep = ms => new Promise(r => setTimeout(r, ms));

function httpGet(hostname, reqPath) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname,
      path: reqPath,
      method: 'GET',
      headers: { 'User-Agent': 'ATMR-Dashboard/1.0' },
      timeout: 15000,
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

function getGear(dev200) {
  if (dev200 > 2)  return 3;
  if (dev200 > -2) return 2;
  return 1;
}

function calcBuyScore({ price, sma5, sma200, rsi, macd, high52, low52, vix = 18 }) {
  if (!price || !sma200 || !rsi) return 50;
  let score = 0;
  const dev200 = (price - sma200) / sma200 * 100;
  if (dev200 > 2)        score += 25;
  else if (dev200 > -2)  score += 12;
  if (rsi < 30)          score += 25;
  else if (rsi < 40)     score += 20;
  else if (rsi < 50)     score += 14;
  else if (rsi < 60)     score += 8;
  else if (rsi < 70)     score += 3;
  if (sma5) {
    const dev5 = (price - sma5) / sma5 * 100;
    if (dev5 < -3)         score += 20;
    else if (dev5 < -1.5)  score += 16;
    else if (dev5 < 0)     score += 11;
    else if (dev5 < 1.5)   score += 6;
    else                   score += 2;
  } else { score += 10; }
  if (vix > 35)          score += 15;
  else if (vix > 28)     score += 12;
  else if (vix > 22)     score += 8;
  else if (vix > 17)     score += 5;
  else                   score += 1;
  const hist = macd?.histogram ?? 0;
  if (hist < -2)         score += 10;
  else if (hist < 0)     score += 7;
  else if (hist < 1)     score += 4;
  else if (hist < 3)     score += 2;
  if (high52 && low52 && high52 > low52) {
    const pos52 = (price - low52) / (high52 - low52) * 100;
    if (pos52 < 20)      score += 5;
    else if (pos52 < 40) score += 4;
    else if (pos52 < 60) score += 3;
    else if (pos52 < 80) score += 1;
  }
  return Math.min(100, Math.max(0, Math.round(score)));
}

function calcSellScore({ price, sma5, sma200, rsi, macd, high52, low52, vix = 18 }) {
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
  if (high52 && low52 && high52 > low52) {
    const pos52 = (price - low52) / (high52 - low52) * 100;
    if (pos52 > 90)      score += 5;
    else if (pos52 > 80) score += 4;
    else if (pos52 > 70) score += 3;
    else if (pos52 > 60) score += 1;
  }
  return Math.min(100, Math.max(0, Math.round(score)));
}


// ─── Yahoo Finance: 지수 현재가 (API 키 불필요, 서버사이드에서 CORS 없음) ───

async function fetchYFIndex(symbol) {
  const enc = encodeURIComponent(symbol);
  const reqPath = `/v8/finance/chart/${enc}?interval=1d&range=5d`;
  try {
    const data = await httpGet('query1.finance.yahoo.com', reqPath);
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

// ─── CNN Fear & Greed Index ────────────────────────────────────────────────

async function fetchFearAndGreed() {
  const reqPath = '/index/fearandgreed/graphdata';
  try {
    const data = await httpGet('production.dataviz.cnn.io', reqPath);
    const fg = data?.fear_and_greed;
    if (!fg || typeof fg.score !== 'number') throw new Error('F&G 응답 데이터 없음');
    return {
      score:      Math.round(fg.score),
      rating:     fg.rating,        // "Extreme Fear"|"Fear"|"Neutral"|"Greed"|"Extreme Greed"
      prevClose:  fg.previous_close  != null ? Math.round(fg.previous_close)  : null,
      prev1Week:  fg.previous_1_week != null ? Math.round(fg.previous_1_week) : null,
      prev1Month: fg.previous_1_month != null ? Math.round(fg.previous_1_month) : null,
      timestamp:  fg.timestamp || new Date().toISOString(),
    };
  } catch (e) {
    console.warn(`  [F&G] CNN Fear & Greed 수집 실패: ${e.message}`);
    return null;
  }
}


// ─── API 호출 (Twelve Data) ─────────────────────────────────────────────────

async function fetchTimeSeries(symbol) {
  const outputsize = 300;
  const p = `/time_series?symbol=${encodeURIComponent(symbol)}&interval=1day&outputsize=${outputsize}&apikey=${API_KEY}`;
  const data = await httpGet(TD_HOST, p);
  if (data.status === 'error' || !data.values) {
    throw new Error(`[time_series] ${symbol}: ${data.message || '데이터 없음'}`);
  }
  return data;
}

async function fetchQuote(symbol) {
  // /quote는 extended hours 데이터 포함 (extended_price, is_market_open 등)
  const p = `/quote?symbol=${encodeURIComponent(symbol)}&apikey=${API_KEY}`;
  try {
    const data = await httpGet(TD_HOST, p);
    if (data.status === 'error') return null;
    return data;
  } catch (e) {
    console.warn(`  [quote] ${symbol} 실패 (무시): ${e.message}`);
    return null;
  }
}


// ─── 종목 처리 ──────────────────────────────────────────────────────────────

function processTimeSeries(raw, symbol, vixPrice) {
  const values  = [...raw.values].reverse(); // 오름차순 정렬 (오래된 → 최신)
  const closes  = values.map(v => parseFloat(v.close)).filter(v => !isNaN(v));

  if (closes.length < 30) throw new Error(`데이터 부족: ${closes.length}개`);

  const price    = closes[closes.length - 1];
  const prevPrice = closes[closes.length - 2];
  const change   = price - prevPrice;
  const changePct = (change / prevPrice) * 100;

  const sma5   = calcSMA(closes, 5);
  const sma20  = calcSMA(closes, 20);
  const sma50  = calcSMA(closes, 50);
  const sma200 = calcSMA(closes, Math.min(200, closes.length));
  const rsi    = calcRSI(closes, 14);
  const macd   = calcMACD(closes);

  const last252 = closes.slice(-252);
  const high52  = Math.max(...last252);
  const low52   = Math.min(...last252);

  const dev200 = sma200 ? (price - sma200) / sma200 * 100 : 0;
  const dev5   = sma5   ? (price - sma5)   / sma5   * 100 : 0;
  const gear   = getGear(dev200);

  const vix    = symbol === 'VIX' ? price : (vixPrice || 18);
  const obj    = { symbol, price, change, changePct, sma5, sma20, sma50, sma200, rsi, macd, high52, low52, dev200, dev5, gear, vix };

  return {
    ...obj,
    buyScore:  calcBuyScore(obj),
    sellScore: calcSellScore(obj),
  };
}


// ─── 메인 ───────────────────────────────────────────────────────────────────

async function main() {
  if (!API_KEY) {
    console.error('ERROR: TWELVEDATA_API_KEY 환경변수가 없습니다.');
    process.exit(1);
  }

  console.log(`\n=== ATMR 데이터 수집 시작 (${new Date().toISOString()}) ===\n`);

  const rawData    = {};
  const processed  = {};
  let   errorCount = 0;

  // ── 1차: time_series 순차 수집 ─────────────────────────────────────────
  for (let i = 0; i < SYMBOLS.length; i++) {
    const sym = SYMBOLS[i];
    try {
      console.log(`[${i + 1}/${SYMBOLS.length}] ${sym} time_series 수집 중...`);
      rawData[sym] = await fetchTimeSeries(sym);
      console.log(`  → ${rawData[sym].values.length}개 레코드 수집 완료`);
    } catch (e) {
      console.error(`  → ERROR: ${e.message}`);
      errorCount++;
    }
    if (i < SYMBOLS.length - 1) {
      process.stdout.write(`  딜레이 ${DELAY_MS / 1000}초 대기 중...\n`);
      await sleep(DELAY_MS);
    }
  }

  // ── 2차: VIX 변동성 지수 수집 (Yahoo Finance — Twelve Data 무료플랜 미지원) ──
  let vixPrice = 18; // 기본값
  let vixYF = null;
  console.log('\n--- VIX 변동성 지수 수집 (Yahoo Finance) ---');
  vixYF = await fetchYFIndex('^VIX');
  if (vixYF) {
    vixPrice = vixYF.price;
    console.log(` ^VIX: ${vixYF.price.toFixed(2)} (${vixYF.changePct >= 0 ? '+' : ''}${vixYF.changePct.toFixed(2)}%)`);
  } else {
    console.warn(` VIX 수집 실패. 기본값 ${vixPrice} 사용.`);
  }

  // ── 3차: 전체 처리 ─────────────────────────────────────────────────────
  for (const sym of SYMBOLS) {
    if (!rawData[sym]) continue;
    try {
      processed[sym] = processTimeSeries(rawData[sym], sym, vixPrice);
      const d = processed[sym];
      console.log(`  ${sym}: $${d.price.toFixed(2)}, RSI ${d.rsi?.toFixed(1)}, Gear ${d.gear}, 매수 ${d.buyScore}, 매도 ${d.sellScore}`);
    } catch (e) {
      console.error(`  ${sym} 처리 실패: ${e.message}`);
    }
  }

  // VIX: Yahoo Finance에서 수집한 데이터를 processed에 추가
  if (vixYF) {
    processed['VIX'] = {
      symbol:    'VIX',
      price:     vixYF.price,
      change:    vixYF.change,
      changePct: vixYF.changePct,
      vix:       vixYF.price,
      buyScore:  null, sellScore: null,
      sma5: null, sma20: null, sma50: null, sma200: null,
      rsi:  null, macd:  null, high52: null, low52: null,
      dev200: null, dev5: null, gear: null,
    };
    console.log(`  VIX: ${vixYF.price.toFixed(2)} (Yahoo Finance)`);
  }

  // ── 4차: quote (extended hours) 보완 수집 ──────────────────────────────
  console.log('\n--- Extended hours 데이터 보완 ---');
  for (let i = 0; i < SYMBOLS.length; i++) {
    const sym = SYMBOLS[i];
    if (!processed[sym]) continue;
    if (i > 0) await sleep(DELAY_MS);
    console.log(`  ${sym} quote 수집 중...`);
    const q = await fetchQuote(sym);
    if (q) {
      const ext = parseFloat(q.extended_price);
      const extChg = parseFloat(q.extended_change);
      const extPct = parseFloat(q.extended_percent_change);
      if (!isNaN(ext)) {
        processed[sym].extPrice      = ext;
        processed[sym].extChange     = isNaN(extChg) ? null : extChg;
        processed[sym].extChangePct  = isNaN(extPct) ? null : extPct;
        processed[sym].extTimestamp  = q.extended_timestamp || null;
        processed[sym].isMarketOpen  = q.is_market_open === true || q.is_market_open === 'true';
        console.log(`    → extended $${ext.toFixed(2)} (${extPct > 0 ? '+' : ''}${(extPct || 0).toFixed(2)}%)`);
      } else {
        processed[sym].isMarketOpen  = q.is_market_open === true || q.is_market_open === 'true';
        console.log(`    → extended hours 데이터 없음 (정규장 시간 또는 미지원)`);
      }
    }
  }

  // ── 5차: 나스닥100·S&P500 지수 현재가 (Yahoo Finance) ─────────────────
  // 가격(지수값)은 ^NDX·^GSPC에서, 등락률은 QQQ·VOO로 보정
  // (Yahoo Finance 인덱스 심볼의 previousClose 기준이 ETF와 달라 오차 발생)
  console.log('\n--- 나스닥100 / S&P500 지수 수집 (Yahoo Finance) ---');
  const ndxRaw  = await fetchYFIndex('^IXIC');  // 나스닥 종합지수 (Composite)
  const gspcRaw = await fetchYFIndex('^GSPC');

  const ndxData = ndxRaw ? {
    price:     ndxRaw.price,
    change:    ndxRaw.change,
    changePct: processed['QQQ']?.changePct ?? ndxRaw.changePct,  // QQQ로 등락률 보정
  } : null;

  const gspcData = gspcRaw ? {
    price:     gspcRaw.price,
    change:    gspcRaw.change,
    changePct: processed['VOO']?.changePct ?? gspcRaw.changePct,  // VOO로 등락률 보정
  } : null;

  if (ndxData)  console.log(`  ^NDX:  ${ndxData.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}  (${ndxData.changePct >= 0 ? '+' : ''}${ndxData.changePct.toFixed(2)}%) [QQQ 보정]`);
  if (gspcData) console.log(`  ^GSPC: ${gspcData.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}  (${gspcData.changePct >= 0 ? '+' : ''}${gspcData.changePct.toFixed(2)}%) [VOO 보정]`);

  // ── 6차: CNN Fear & Greed Index ───────────────────────────────────────────
  console.log('\n--- CNN Fear & Greed Index 수집 ---');
  const fgData = await fetchFearAndGreed();
  if (fgData) {
    console.log(`  Fear & Greed: ${fgData.score} (${fgData.rating}) | 전일 ${fgData.prevClose ?? '-'}, 1주전 ${fgData.prev1Week ?? '-'}, 1개월전 ${fgData.prev1Month ?? '-'}`);
  } else {
    console.warn('  Fear & Greed 수집 실패 — 대시보드 표시 제외');
  }

  // ── 7차: 저장 ──────────────────────────────────────────────────────────
  const now    = new Date();
  const kstStr = now.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });

  const output = {
    generatedAt:    now.toISOString(),
    generatedAtKST: kstStr + ' KST',
    symbolCount:    Object.keys(processed).length,
    errorCount,
    symbols:        processed,
    indices: {
      NDX:  ndxData  || null,
      GSPC: gspcData || null,
    },
    fearAndGreed: fgData || null,
  };

  const dir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf8');

  console.log(`\n=== 완료: ${OUTPUT_PATH} (${Object.keys(processed).length}개 종목) ===`);
  console.log(`=== 생성 시각: ${kstStr} KST ===\n`);

  if (errorCount === SYMBOLS.length) {
    console.error('모든 종목 수집 실패. GitHub Actions를 확인하세요.');
    process.exit(1);
  }
}

main().catch(e => {
  console.error('FATAL:', e.message);
  process.exit(1);
});
