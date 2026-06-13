'use strict';

/**
 * generate-market-cycle.js
 * Market Cycle Monitor용 주봉(1wk) OHLCV 데이터 수집 → data/ohlcv-{TICKER}-weekly.json 저장
 *
 * 사용법:
 *   node scripts/generate-market-cycle.js
 *
 * 출력 파일:
 *   data/ohlcv-SPY-weekly.json
 *   data/ohlcv-QQQ-weekly.json
 *   data/ohlcv-SOXX-weekly.json
 *   data/ohlcv-RSP-weekly.json
 *   data/ohlcv-_VIX-weekly.json
 *   data/ohlcv-_TNX-weekly.json
 *
 * ※ Yahoo Finance v8 API는 interval=1wk 요청 시 최근 ~2년(약 105봉)만 반환하는 제한이 있음.
 *    Coppock Curve 계산에 필요한 최소 104봉 + 스파크라인용 156봉 = 총 260봉 이상 확보를 위해
 *    interval=1d(일봉)로 8년치를 요청한 뒤 주봉으로 직접 집계하는 방식으로 우회한다.
 */

const https = require('https');
const fs    = require('fs');
const path  = require('path');

// ── Yahoo Finance Crumb 인증 캐시 (세션당 1회만 취득) ─────────────────────
let _yfCookie = null;
let _yfCrumb  = null;

async function getYFCrumb() {
  if (_yfCookie && _yfCrumb) return { cookie: _yfCookie, crumb: _yfCrumb };

  // 1단계: Yahoo Finance 쿠키 취득
  const cookie = await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'fc.yahoo.com',
      path: '/',
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': '*/*',
      },
      timeout: 12000,
    }, res => {
      const setCookies = res.headers['set-cookie'] || [];
      const cookieStr  = setCookies.map(c => c.split(';')[0]).join('; ');
      res.resume();
      resolve(cookieStr);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('쿠키 취득 타임아웃')); });
    req.end();
  });

  // 2단계: 크럼 문자열 취득
  const crumb = await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'query1.finance.yahoo.com',
      path: '/v1/test/getcrumb',
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Cookie': cookie,
      },
      timeout: 12000,
    }, res => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => resolve(data.trim()));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('크럼 취득 타임아웃')); });
    req.end();
  });

  if (!crumb || crumb.length < 2) throw new Error(`크럼 취득 실패: "${crumb}"`);
  _yfCookie = cookie;
  _yfCrumb  = crumb;
  console.log(`  Yahoo Finance 인증 완료 (crumb: ${crumb.substring(0, 8)}...)`);
  return { cookie, crumb };
}

// ── 일봉 → 주봉 집계 ──────────────────────────────────────────────────────
// 월요일 UTC 자정을 기준 키로 그룹화.
// o = 주 첫 거래일 시가, h = 주 최고가, l = 주 최저가,
// c = 주 마지막 거래일 adjclose(종가), v = 주간 누적 거래량.
function aggregateDailyToWeekly(dailyBars) {
  const weekMap = new Map();

  for (const bar of dailyBars) {
    const d   = new Date(bar.t * 1000);
    const dow = d.getUTCDay();                        // 0=일 1=월 … 5=금 6=토
    const daysToMon = (dow === 0) ? 6 : (dow - 1);   // 이번 주 월요일까지 일수
    const mon = new Date(d);
    mon.setUTCDate(d.getUTCDate() - daysToMon);
    mon.setUTCHours(0, 0, 0, 0);
    const key = Math.floor(mon.getTime() / 1000);

    if (!weekMap.has(key)) {
      weekMap.set(key, { t: key, o: bar.o, h: bar.h, l: bar.l, c: bar.c, v: bar.v });
    } else {
      const w = weekMap.get(key);
      if (bar.h > w.h) w.h = bar.h;
      if (bar.l < w.l) w.l = bar.l;
      w.c = bar.c;      // 마지막으로 처리되는 거래일 = 주말 종가
      w.v += bar.v;
    }
  }

  return [...weekMap.values()]
    .sort((a, b) => a.t - b.t)
    .map(w => ({
      t: w.t,
      o: parseFloat(w.o.toFixed(4)),
      h: parseFloat(w.h.toFixed(4)),
      l: parseFloat(w.l.toFixed(4)),
      c: parseFloat(w.c.toFixed(4)),
      v: Math.round(w.v),
    }));
}

// ── 대상 티커 정의 ────────────────────────────────────────────────────────
const DATA_DIR = path.join(__dirname, '..', 'data');

const TICKERS = [
  { symbol: 'SPY',  name: 'S&P500 ETF (SPDR)',   file: 'SPY'  },
  { symbol: 'QQQ',  name: '나스닥 100 ETF',        file: 'QQQ'  },
  { symbol: 'SOXX', name: '반도체 ETF (iShares)', file: 'SOXX' },
  { symbol: 'RSP',  name: '동일가중 S&P500 ETF',  file: 'RSP'  },
  { symbol: '^VIX', name: 'CBOE 공포지수',         file: '_VIX' },
  { symbol: '^TNX', name: '미국 10년물 국채금리',  file: '_TNX' },
];

// ── Yahoo Finance 일봉 수집 → 주봉 집계 ──────────────────────────────────
// interval=1d 로 8년치를 요청 (Yahoo Finance 주봉 2년 제한 우회).
// 일봉 집계를 통해 SPY 기준 ~416봉 이상의 주봉 데이터를 확보.
// Coppock 계산(최소 104봉) + 스파크라인(156봉) = 260봉 충분히 초과.
async function fetchWeeklyOHLCV(symbol) {
  const { cookie, crumb } = await getYFCrumb();

  const period2 = Math.floor(Date.now() / 1000);
  const period1 = period2 - 8 * 365 * 24 * 3600;    // 8년치 일봉 요청
  const encodedCrumb = encodeURIComponent(crumb);

  // ★ interval=1d (Yahoo Finance 주봉 제한 우회)
  const reqPath = `/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?period1=${period1}&period2=${period2}&interval=1d&includePrePost=false&crumb=${encodedCrumb}`;

  const data = await new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'query1.finance.yahoo.com',
      path: reqPath,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Cookie': cookie,
      },
      timeout: 30000,   // 일봉 8년치는 데이터 양이 많으므로 여유 있게
    }, res => {
      let body = '';
      res.on('data', c => { body += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(body)); }
        catch (e) { reject(new Error(`JSON 파싱 오류: ${e.message}`)); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Yahoo Finance 타임아웃')); });
    req.end();
  });

  const result = data?.chart?.result?.[0];
  if (!result || !result.timestamp || result.timestamp.length === 0) {
    const errMsg = data?.chart?.error?.description || '데이터 없음';
    throw new Error(`일봉 데이터 없음 (${symbol}): ${errMsg}`);
  }

  const { timestamp, indicators } = result;
  const quote    = indicators.quote[0];
  const adjClose = indicators.adjclose?.[0]?.adjclose;

  // 유효한 일봉만 필터링 (null 제거)
  const dailyBars = [];
  for (let i = 0; i < timestamp.length; i++) {
    const o = quote.open?.[i];
    const h = quote.high?.[i];
    const l = quote.low?.[i];
    const c = adjClose ? (adjClose[i] ?? quote.close?.[i]) : quote.close?.[i];
    const v = quote.volume?.[i] ?? 0;
    if (o == null || h == null || l == null || c == null) continue;
    dailyBars.push({ t: timestamp[i], o, h, l, c, v });
  }

  console.log(`  일봉 ${dailyBars.length}개 수집 → 주봉 집계 중...`);
  const weeklyBars = aggregateDailyToWeekly(dailyBars);
  return weeklyBars;
}

// ── 메인 ─────────────────────────────────────────────────────────────────
async function main() {
  console.log('===== Market Cycle Monitor 주봉 데이터 생성 시작 =====');
  console.log(`대상 티커: ${TICKERS.map(t => t.symbol).join(', ')}`);
  console.log(`저장 경로: ${DATA_DIR}`);
  console.log('★ 일봉 8년치 요청 → 주봉 집계 방식 (Yahoo Finance 주봉 2년 제한 우회)');

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  let successCount = 0;

  for (const ticker of TICKERS) {
    const { symbol, name, file } = ticker;
    console.log(`\n[${symbol}] 데이터 수집 중...`);

    try {
      const ohlcv = await fetchWeeklyOHLCV(symbol);

      if (ohlcv.length < 260) {
        console.warn(`  경고: ${symbol} 주봉 ${ohlcv.length}봉 — Coppock 스파크라인(260봉 필요) 부족`);
      }

      const output = {
        ticker:    symbol,
        name,
        updatedAt: new Date().toISOString(),
        interval:  '1wk',
        ohlcv,
      };

      const filePath = path.join(DATA_DIR, `ohlcv-${file}-weekly.json`);
      fs.writeFileSync(filePath, JSON.stringify(output));
      console.log(`  저장 완료: ohlcv-${file}-weekly.json (${ohlcv.length}봉)`);
      successCount++;
    } catch (err) {
      console.error(`  오류 [${symbol}]: ${err.message}`);
    }

    // 티커 간 인터벌 — Yahoo Finance 속도 제한 방지
    if (TICKERS.indexOf(ticker) < TICKERS.length - 1) {
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  console.log(`\n===== 완료: ${successCount}/${TICKERS.length}개 성공 =====`);

  if (successCount < TICKERS.length) {
    console.error('일부 티커 수집 실패. 로그를 확인하세요.');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('예상치 못한 오류:', err);
  process.exit(1);
});
