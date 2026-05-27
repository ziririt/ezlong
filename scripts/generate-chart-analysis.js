'use strict';

/**
 * generate-chart-analysis.js
 * OHLCV 수집 → 보조지표 계산 → 지지/저항 산출 → Gemini AI 분석 → JSON 저장
 *
 * 사용법:
 *   node scripts/generate-chart-analysis.js us       # 미국 주식/ETF (39개)
 *   node scripts/generate-chart-analysis.js kr       # 한국 주식/ETF (6개)
 *   node scripts/generate-chart-analysis.js crypto   # 암호화폐 (5개)
 *
 * 환경변수:
 *   GEMINI_API_KEY  — Google AI Studio API 키
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

// ── 설정 ──────────────────────────────────────────────────────────────────
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_HOST    = 'generativelanguage.googleapis.com';
const GEMINI_MODEL   = 'gemini-2.5-flash-lite';   // 비용 최소화 모델
const DELAY_MS       = 1200;                        // 티커 간 요청 간격
const DATA_DIR       = path.join(__dirname, '..', 'data');

// ── 티커 메타데이터 정의 ──────────────────────────────────────────────────

const TICKERS_US_STOCKS = [
  { symbol:'TSLA',  name:'테슬라',         type:'stock', context:'전기차·에너지·AI 로봇 기업. 변동성이 크며 성장주 중 베타가 가장 높은 편입니다.' },
  { symbol:'NVDA',  name:'엔비디아',        type:'stock', context:'AI 반도체 시장 독점 기업. 데이터센터 GPU 수요가 실적을 좌우합니다.' },
  { symbol:'AAPL',  name:'애플',           type:'stock', context:'글로벌 시총 최상위 빅테크. 생태계 락인과 서비스 매출 성장이 핵심입니다.' },
  { symbol:'MSFT',  name:'마이크로소프트',  type:'stock', context:'클라우드(Azure)·AI 선두 기업. 기업 소프트웨어 시장 지배력이 탁월합니다.' },
  { symbol:'GOOGL', name:'알파벳',         type:'stock', context:'구글 모회사. 검색·광고·클라우드·AI(Gemini) 사업을 영위합니다.' },
  { symbol:'PLTR',  name:'팔란티어',        type:'stock', context:'AI 데이터 분석 플랫폼. 미 정부·기업 고객 기반이 강점입니다.' },
  { symbol:'IONQ',  name:'아이온큐',        type:'stock', context:'양자컴퓨팅 기업. 소형 성장주로 변동성이 매우 높습니다.' },
  { symbol:'META',  name:'메타',           type:'stock', context:'페이스북·인스타·왓츠앱 보유. AI 광고 최적화로 수익성이 급개선됐습니다.' },
  { symbol:'AMZN',  name:'아마존',         type:'stock', context:'e커머스와 AWS 클라우드 1위 기업. 구조적 성장이 지속됩니다.' },
  { symbol:'AMD',   name:'AMD',           type:'stock', context:'엔비디아 대항마. AI GPU와 서버 CPU 점유율을 꾸준히 확대하고 있습니다.' },
  { symbol:'AVGO',  name:'브로드컴',        type:'stock', context:'AI 맞춤 반도체(ASIC)와 네트워킹 칩 선두 기업입니다.' },
  { symbol:'ASML',  name:'ASML',          type:'stock', context:'반도체 EUV 노광장비 독점 기업. 전 세계에서 유일하게 생산합니다.' },
  { symbol:'NFLX',  name:'넷플릭스',        type:'stock', context:'글로벌 스트리밍 1위. 광고 기반 요금제 확장으로 성장이 재가속됐습니다.' },
  { symbol:'SHOP',  name:'쇼피파이',        type:'stock', context:'중소 이커머스 플랫폼. 캐나다 기업으로 NASDAQ 상장입니다.' },
  { symbol:'SNOW',  name:'스노우플레이크',   type:'stock', context:'클라우드 데이터 웨어하우스 전문 기업. 성장 기대치 대비 밸류에이션이 높습니다.' },
  { symbol:'CRWD',  name:'크라우드스트라이크', type:'stock', context:'클라우드 보안(엔드포인트) 1위 기업. SaaS 구독 매출이 핵심입니다.' },
  { symbol:'ABNB',  name:'에어비앤비',       type:'stock', context:'글로벌 숙박 공유 플랫폼. 여행 수요와 거시경제에 민감하게 반응합니다.' },
  { symbol:'INTU',  name:'인튜이트',         type:'stock', context:'세금·회계 소프트웨어(TurboTax, QuickBooks) 선두 기업입니다.' },
  { symbol:'COIN',  name:'코인베이스',        type:'stock', context:'미국 최대 암호화폐 거래소. 크립토 시장 변동성에 강하게 연동됩니다.' },
];

const TICKERS_US_ETFS = [
  { symbol:'QQQ',  name:'나스닥 100 ETF',          type:'etf', context:'AI·빅테크 중심 나스닥 100 추종 ETF입니다.' },
  { symbol:'SPY',  name:'S&P500 ETF (SPDR)',        type:'etf', context:'미국 대형주 500개를 담은 장기 분산 투자의 교과서입니다.' },
  { symbol:'VOO',  name:'S&P500 ETF (Vanguard)',    type:'etf', context:'SPY와 동일한 S&P500 추종. 운용보수가 더 낮습니다.' },
  { symbol:'IVV',  name:'S&P500 ETF (iShares)',     type:'etf', context:'SPY, VOO와 동일한 S&P500 추종. iShares 브랜드입니다.' },
  { symbol:'DIA',  name:'다우존스 ETF',              type:'etf', context:'미국 다우존스 산업평균지수 30개 종목 추종 ETF입니다.' },
  { symbol:'SMH',  name:'반도체 ETF (VanEck)',       type:'etf', context:'VanEck 반도체 ETF. NVDA, TSMC 등 글로벌 반도체 기업을 담습니다.' },
  { symbol:'SOXX', name:'반도체 ETF (iShares)',      type:'etf', context:'iShares 반도체 ETF. 미국 반도체 섹터에 집중 투자합니다.' },
  { symbol:'XLF',  name:'금융 섹터 ETF',             type:'etf', context:'S&P500 금융 섹터. 금리 방향성과 신용 사이클에 민감합니다.' },
  { symbol:'XLE',  name:'에너지 섹터 ETF',           type:'etf', context:'S&P500 에너지 섹터. 유가와 높은 상관관계를 보입니다.' },
  { symbol:'XLY',  name:'소비재 섹터 ETF',           type:'etf', context:'S&P500 경기소비재 섹터. 경기 사이클에 민감하게 반응합니다.' },
  { symbol:'XLK',  name:'IT 섹터 ETF',              type:'etf', context:'S&P500 기술 섹터. AAPL, MSFT 비중이 높습니다.' },
  { symbol:'IWM',  name:'러셀 2000 ETF',            type:'etf', context:'미국 소형주 2000개 추종. 경기민감도와 달러 강세에 취약합니다.' },
  { symbol:'VT',   name:'전세계 주식 ETF',           type:'etf', context:'전 세계 주식시장을 포괄하는 Vanguard 글로벌 ETF입니다.' },
  { symbol:'VTI',  name:'미국 전체 주식 ETF',        type:'etf', context:'미국 상장 전체 주식을 담는 Vanguard ETF입니다.' },
  { symbol:'TLT',  name:'미국 장기국채 ETF',         type:'etf', context:'이 상품은 만기 20년 이상 미국 국채 ETF입니다. 가격과 금리가 역방향으로 움직이므로 연준 금리 방향성 컨텍스트를 반드시 포함하십시오.' },
  { symbol:'IEF',  name:'미국 중기국채 ETF',         type:'etf', context:'이 상품은 만기 7~10년 미국 국채 ETF입니다. TLT보다 금리 민감도가 낮으며 안전자산 선호 흐름을 측정하는 지표로도 활용됩니다.' },
  { symbol:'HYG',  name:'하이일드 회사채 ETF',        type:'etf', context:'이 상품은 미국 하이일드(투기등급) 회사채 ETF입니다. 신용 스프레드 확대 시 가격이 급락하며 리스크온/오프 심리를 반영합니다.' },
  { symbol:'LQD',  name:'투자등급 회사채 ETF',        type:'etf', context:'이 상품은 미국 투자등급 회사채 ETF입니다. 국채 대비 스프레드와 금리 방향성을 함께 분석해야 합니다.' },
  { symbol:'SCHD', name:'고배당 미국 주식 ETF',       type:'etf', context:'미국 우량 고배당주 ETF. 배당 성장성과 재무 건전성을 기준으로 종목을 선별합니다.' },
  { symbol:'JEPI', name:'커버드콜 월배당 ETF',        type:'etf', context:'이 상품은 S&P500 기반 커버드콜 전략 월배당 ETF입니다. 상승장에서 주가 참여가 제한되므로 분석 초점을 배당 안정성과 변동성 수준에 맞추십시오.' },
];

const TICKERS_KR_ETFS = [
  { symbol:'069500.KS', name:'KODEX 200',           type:'etf',           market:'kr', context:'한국거래소(KRX) 상장 KOSPI 200 추종 ETF(삼성자산운용)입니다. 가격은 KRW 기준이며 KOSPI 지수 흐름과 외국인 순매수/순매도가 핵심 변수입니다.' },
  { symbol:'396500.KS', name:'TIGER FN 반도체Top10', type:'etf',           market:'kr', context:'한국거래소(KRX) 상장 반도체 섹터 ETF입니다. 삼성전자·SK하이닉스 등 국내 반도체 상위 10개 종목에 집중 투자합니다. 가격은 KRW 기준입니다.' },
  { symbol:'102110.KS', name:'TIGER 200',            type:'etf',           market:'kr', context:'한국거래소(KRX) 상장 KOSPI 200 추종 ETF(미래에셋)입니다. 가격은 KRW 기준이며 KODEX 200과 유사한 포트폴리오를 구성합니다.' },
  { symbol:'122630.KS', name:'KODEX 레버리지',        type:'etf_leveraged', market:'kr', context:'이 상품은 KOSPI 200의 2배 수익을 추구하는 일일 리밸런싱 레버리지 ETF입니다. 장기 보유 시 변동성 끌림(volatility drag) 손실이 발생합니다. 반드시 단기 트레이딩 관점에서만 분석하십시오. 가격은 KRW 기준입니다.' },
];

const TICKERS_KR_STOCKS = [
  { symbol:'005930.KS', name:'삼성전자', type:'stock', market:'kr', context:'한국거래소(KRX) 상장 삼성전자입니다. 글로벌 반도체(메모리)·스마트폰·가전 1~2위 기업입니다. 가격은 KRW 기준이며 KOSPI 지수, 원달러 환율, 외국인 순매수/순매도가 핵심 변수입니다.' },
  { symbol:'000660.KS', name:'SK하이닉스', type:'stock', market:'kr', context:'한국거래소(KRX) 상장 SK하이닉스입니다. 글로벌 메모리 반도체(HBM·DRAM·NAND) 2위 기업으로 AI 메모리 수요가 핵심 성장 동력입니다. 가격은 KRW 기준입니다.' },
];

const TICKERS_CRYPTO = [
  { symbol:'BTC-USD', name:'비트코인',  type:'crypto', context:'전 세계 시총 1위 암호화폐. 24시간 365일 거래되며 온체인 지표, 반감기 사이클, 기관 매수 동향, 규제 뉴스가 핵심 변수입니다.' },
  { symbol:'ETH-USD', name:'이더리움',  type:'crypto', context:'스마트컨트랙트 플랫폼 1위 암호화폐. DeFi·NFT·L2 생태계가 가치 기반이며 비트코인과 높은 상관관계를 보입니다.' },
  { symbol:'XRP-USD', name:'리플',      type:'crypto', context:'국제 송금 특화 암호화폐. SEC 소송 결과와 금융기관 파트너십 동향이 핵심 이벤트입니다.' },
  { symbol:'DOGE-USD', name:'도지코인', type:'crypto', context:'밈코인으로 출발한 암호화폐. 일론 머스크의 SNS 언급과 소셜 미디어 심리에 가격이 강하게 반응합니다.' },
  { symbol:'ADA-USD', name:'카르다노',  type:'crypto', context:'학술적 접근 방식의 블록체인 플랫폼 암호화폐. 이더리움과 경쟁하는 레이어1 스마트컨트랙트 플랫폼입니다.' },
];

// ── 실행 그룹 결정 ────────────────────────────────────────────────────────
const GROUP = process.argv[2] || 'us';

let tickersToProcess = [];
switch (GROUP) {
  case 'us':     tickersToProcess = [...TICKERS_US_STOCKS, ...TICKERS_US_ETFS]; break;
  case 'kr':     tickersToProcess = [...TICKERS_KR_ETFS, ...TICKERS_KR_STOCKS]; break;
  case 'crypto': tickersToProcess = TICKERS_CRYPTO; break;
  default:
    console.error(`알 수 없는 그룹: ${GROUP}. 'us' | 'kr' | 'crypto' 중 하나를 사용하세요.`);
    process.exit(1);
}

// ── 유틸리티 ──────────────────────────────────────────────────────────────

const sleep = ms => new Promise(res => setTimeout(res, ms));

function round(v, d = 4) {
  if (v == null || isNaN(v)) return null;
  return parseFloat(v.toFixed(d));
}

function httpGet(host, reqPath) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: host,
      path: reqPath,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ATMR-ChartBot/2.0)',
        'Accept': 'application/json',
      },
      timeout: 20000,
    }, res => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`JSON 파싱 오류: ${e.message}`)); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('요청 타임아웃')); });
    req.end();
  });
}

function httpPost(host, reqPath, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = JSON.stringify(body);
    const req = https.request({
      hostname: host,
      path: reqPath,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyStr),
      },
      timeout: 30000,
    }, res => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`JSON 파싱 오류: ${e.message}`)); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Gemini 타임아웃')); });
    req.write(bodyStr);
    req.end();
  });
}

// ── Yahoo Finance OHLCV 수집 (v8 API + crumb 인증) ───────────────────────

async function fetchYFChart(symbol) {
  const { cookie, crumb } = await getYFCrumb();

  const period2 = Math.floor(Date.now() / 1000);
  const period1 = period2 - 2 * 365 * 24 * 3600;  // 2년치
  const encodedCrumb = encodeURIComponent(crumb);
  const reqPath = `/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?period1=${period1}&period2=${period2}&interval=1d&includePrePost=true&crumb=${encodedCrumb}`;

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
      timeout: 25000,
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
    throw new Error(`차트 결과 없음 (${symbol}): ${errMsg}`);
  }
  return result;
}

// ── 기술적 지표 계산 ──────────────────────────────────────────────────────

function sma(closes, period) {
  return closes.map((_, i) => {
    if (i < period - 1) return null;
    const slice = closes.slice(i - period + 1, i + 1);
    return slice.reduce((a, b) => a + b, 0) / period;
  });
}

function ema(closes, period) {
  const k = 2 / (period + 1);
  const result = new Array(closes.length).fill(null);
  let seed = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  result[period - 1] = seed;
  for (let i = period; i < closes.length; i++) {
    seed = closes[i] * k + seed * (1 - k);
    result[i] = seed;
  }
  return result;
}

function rsi(closes, period = 14) {
  const result = new Array(closes.length).fill(null);
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    avgGain += Math.max(0, d) / period;
    avgLoss += Math.max(0, -d) / period;
  }
  const rs0 = avgLoss === 0 ? 100 : avgGain / avgLoss;
  result[period] = 100 - 100 / (1 + rs0);
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(0, d)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(0, -d)) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    result[i] = 100 - 100 / (1 + rs);
  }
  return result;
}

function macd(closes, fast = 12, slow = 26, signal = 9) {
  const emaF  = ema(closes, fast);
  const emaS  = ema(closes, slow);
  const macdL = closes.map((_, i) =>
    emaF[i] != null && emaS[i] != null ? emaF[i] - emaS[i] : null
  );
  // Signal EMA of MACD line (only from first non-null)
  const firstIdx = macdL.findIndex(v => v != null);
  const sigResult = new Array(closes.length).fill(null);
  if (firstIdx >= 0) {
    const macdVals = macdL.slice(firstIdx);
    const sigEMA = ema(macdVals, signal);
    sigEMA.forEach((v, j) => { sigResult[firstIdx + j] = v; });
  }
  return closes.map((_, i) => ({
    macd:      macdL[i] != null      ? round(macdL[i], 6)    : null,
    signal:    sigResult[i] != null  ? round(sigResult[i], 6) : null,
    histogram: (macdL[i] != null && sigResult[i] != null)
                 ? round(macdL[i] - sigResult[i], 6) : null,
  }));
}

function bollingerBands(closes, period = 20, mult = 2) {
  const mid = sma(closes, period);
  return closes.map((_, i) => {
    if (mid[i] == null) return { upper: null, middle: null, lower: null, bandwidth: null };
    const slice = closes.slice(i - period + 1, i + 1);
    const variance = slice.reduce((s, v) => s + (v - mid[i]) ** 2, 0) / period;
    const std = Math.sqrt(variance);
    const upper = mid[i] + mult * std;
    const lower = mid[i] - mult * std;
    return {
      upper:     round(upper),
      middle:    round(mid[i]),
      lower:     round(lower),
      bandwidth: round((upper - lower) / mid[i], 4),
    };
  });
}

// ── 주봉 집계 ─────────────────────────────────────────────────────────────

function aggregateWeekly(raw) {
  if (!raw || raw.length === 0) return [];
  const weeks = {};
  for (const d of raw) {
    // 해당 날짜의 월요일(UTC 기준) 타임스탬프를 키로 사용
    const date = new Date(d.t * 1000);
    const dayOfWeek = date.getUTCDay(); // 0=일, 1=월 ...
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(date.getTime() + diffToMonday * 86400000);
    const weekKey = monday.toISOString().split('T')[0];
    const weekTs  = Math.floor(monday.getTime() / 1000);

    if (!weeks[weekKey]) {
      weeks[weekKey] = { t: weekTs, o: d.o, h: d.h, l: d.l, c: d.c, v: d.v || 0 };
    } else {
      if (d.h > weeks[weekKey].h) weeks[weekKey].h = d.h;
      if (d.l < weeks[weekKey].l) weeks[weekKey].l = d.l;
      weeks[weekKey].c = d.c;                            // 주 마지막 종가
      weeks[weekKey].v = (weeks[weekKey].v || 0) + (d.v || 0);
    }
  }
  return Object.values(weeks).sort((a, b) => a.t - b.t);
}

// ── 지지/저항 레벨 계산 ───────────────────────────────────────────────────

function findSwingLevels(highs, lows, closes, lookback = 5) {
  const swingHighs = [], swingLows = [];
  for (let i = lookback; i < highs.length - lookback; i++) {
    if (highs.slice(i - lookback, i).every(h => h < highs[i]) &&
        highs.slice(i + 1, i + lookback + 1).every(h => h < highs[i])) {
      swingHighs.push(highs[i]);
    }
    if (lows.slice(i - lookback, i).every(l => l > lows[i]) &&
        lows.slice(i + 1, i + lookback + 1).every(l => l > lows[i])) {
      swingLows.push(lows[i]);
    }
  }
  const price = closes[closes.length - 1];
  const resistance = swingHighs.filter(h => h > price).sort((a, b) => a - b)[0] ?? null;
  const support    = swingLows.filter(l => l < price).sort((a, b) => b - a)[0] ?? null;
  return { resistance, support };
}

function pivotPoints(highs, lows, closes) {
  const n  = 20;
  const H  = Math.max(...highs.slice(-n));
  const L  = Math.min(...lows.slice(-n));
  const C  = closes[closes.length - 1];
  const PP = (H + L + C) / 3;
  return {
    pp: round(PP, 2),
    r1: round(2 * PP - L, 2),
    r2: round(PP + (H - L), 2),
    s1: round(2 * PP - H, 2),
    s2: round(PP - (H - L), 2),
  };
}

// ── Gemini AI 분석 ────────────────────────────────────────────────────────

async function callGemini(meta, ind, swing, pivot, price, weeklyInd) {
  if (!GEMINI_API_KEY) {
    console.warn('  GEMINI_API_KEY 없음 — AI 분석 건너뜀');
    return null;
  }

  const isKR     = meta.symbol.endsWith('.KS');
  const isCrypto = meta.type === 'crypto';
  const cur      = isKR ? '원' : 'USD';
  const fmt      = v => v == null ? 'N/A'
    : isKR ? Math.round(v).toLocaleString() + cur
    : isCrypto && v > 1000 ? '$' + v.toLocaleString(undefined, { maximumFractionDigits: 2 })
    : '$' + v.toFixed(2);

  const pos52 = (ind.high52 && ind.low52)
    ? ((price - ind.low52) / (ind.high52 - ind.low52) * 100).toFixed(1) + '%'
    : 'N/A';

  // 주봉 컨텍스트 섹션 (있을 때만 포함)
  const weeklySection = weeklyInd ? `
[주봉 지표 — 장기 추세 판단]
주봉 RSI(14): ${weeklyInd.rsi != null ? weeklyInd.rsi.toFixed(1) : 'N/A'}
주봉 MACD 히스토그램: ${weeklyInd.macd?.histogram != null ? weeklyInd.macd.histogram.toFixed(4) : 'N/A'}
주봉 SMA20: ${fmt(weeklyInd.sma20)} | 주봉 SMA50: ${fmt(weeklyInd.sma50)} | 주봉 SMA100: ${fmt(weeklyInd.sma100)}
주봉 볼린저밴드 상단: ${fmt(weeklyInd.bb?.upper)} / 하단: ${fmt(weeklyInd.bb?.lower)}
현재가 vs 주봉 SMA20: ${weeklyInd.sma20 ? ((price / weeklyInd.sma20 - 1) * 100).toFixed(2) + '%' : 'N/A'}
현재가 vs 주봉 SMA100: ${weeklyInd.sma100 ? ((price / weeklyInd.sma100 - 1) * 100).toFixed(2) + '%' : 'N/A'}
` : '';

  const prompt = `당신은 실전 경험이 풍부한 기술적 분석 애널리스트입니다. 차트를 직접 보고 설명하듯, 아래 일봉·주봉 데이터를 종합해 ${meta.name}(${meta.symbol})에 대한 심층 분석을 수행하십시오.

[절대 준수 사항]
- 오직 이동평균선, RSI, MACD, 볼린저밴드, 거래량, 가격 패턴, 추세 채널 등 순수 기술적 지표만 분석에 사용하십시오.
- 기업 펀더멘털, 재무제표, 실적, 매출, 금리, 연준 정책, 거시경제, 환율, 산업 트렌드, 규제, 정치적 요인, 경쟁사 동향은 절대 언급하지 마십시오.
- riskNote에도 반드시 기술적 분석 관점(예: "지지선 이탈 시 추가 하락 위험", "RSI 과매수 구간 진입")만 작성하십시오.

[종목 정보 — 차트 컨텍스트 참고용]
${meta.context}

[일봉 가격]
현재가: ${fmt(price)} | 52주 고가: ${fmt(ind.high52)} | 52주 저가: ${fmt(ind.low52)} | 52주 위치: ${pos52}

[일봉 이동평균선]
SMA20: ${fmt(ind.sma20)} | SMA50: ${fmt(ind.sma50)} | SMA100: ${fmt(ind.sma100)} | SMA200: ${fmt(ind.sma200)}
현재가/SMA100: ${ind.sma100 ? ((price / ind.sma100 - 1) * 100).toFixed(2) + '%' : 'N/A'}
현재가/SMA200: ${ind.sma200 ? ((price / ind.sma200 - 1) * 100).toFixed(2) + '%' : 'N/A'}

[일봉 모멘텀]
RSI(14): ${ind.rsi != null ? ind.rsi.toFixed(1) : 'N/A'}
MACD: ${ind.macd.macd != null ? ind.macd.macd.toFixed(4) : 'N/A'} / 시그널: ${ind.macd.signal != null ? ind.macd.signal.toFixed(4) : 'N/A'} / 히스토그램: ${ind.macd.histogram != null ? ind.macd.histogram.toFixed(4) : 'N/A'}

[일봉 볼린저밴드 20,2]
상단: ${fmt(ind.bb.upper)} | 중단(SMA20): ${fmt(ind.bb.middle)} | 하단: ${fmt(ind.bb.lower)} | 밴드폭: ${ind.bb.bandwidth != null ? (ind.bb.bandwidth * 100).toFixed(2) + '%' : 'N/A'}

[지지/저항]
스윙 저항: ${fmt(swing.resistance)} | 스윙 지지: ${fmt(swing.support)}
피벗(PP): ${fmt(pivot.pp)} | R1: ${fmt(pivot.r1)} | R2: ${fmt(pivot.r2)} | S1: ${fmt(pivot.s1)} | S2: ${fmt(pivot.s2)}
${weeklySection}
분석 지침:
- 모든 분석은 순수 기술적 분석에만 근거하십시오. 거시경제·펀더멘털·산업 이슈는 절대 포함하지 마십시오.
- narrative는 실제 차트를 보면서 설명하는 듯한 자연스러운 한국어 문체로 작성합니다. (예: "현재 주가가 상승 채널 상단부에 위치해 있으며 RSI가 70에 근접하고 있습니다. MACD는 골든크로스 직후 히스토그램이 점진적으로 확대되고 있어…")
- profitTarget1은 가장 가까운 1차 익절 목표가, profitTarget2는 2차 목표가입니다. 차트의 저항선·채널 상단 기준으로 설정하십시오.
- stopLoss는 이 분석 관점의 손절 기준가입니다. 핵심 기술적 지지선 하단을 기준으로 설정하십시오.
- buyScore는 현재 기술적 관점의 매수 매력도입니다 (1=전혀 매력 없음, 10=최고의 진입 기회).
- patternNote는 일봉·주봉 차트에서 관찰되는 패턴이나 추세 채널을 1~2문장으로 묘사합니다. (예: "일봉에서는 고점을 낮추는 하락 채널이 형성 중이나, 주봉 기준으로는 상승 추세선이 유지되고 있습니다.")
- riskNote는 반드시 기술적 분석 관점의 리스크만 작성합니다. (예: "핵심 지지선인 SMA200 이탈 시 추가 하락 압력이 커질 수 있습니다.", "RSI 과매수 구간에서 거래량이 감소하면 단기 되돌림 가능성이 높아집니다.")

다음 JSON만 반환하십시오. 다른 텍스트는 절대 포함하지 마십시오:
{
  "trend": "강세" | "약세" | "횡보",
  "strength": 1~5 정수 (추세 강도),
  "support": 핵심 지지가격 숫자,
  "resistance": 핵심 저항가격 숫자,
  "rsiStatus": "과매수" | "중립" | "과매도",
  "macdStatus": "골든크로스" | "데드크로스" | "강세확산" | "약세수렴" | "중립",
  "bbStatus": "상단돌파" | "상단접근" | "중단" | "하단접근" | "하단이탈",
  "stage": "상승추세" | "분배구간" | "하락추세" | "축적구간",
  "action": "적극매수" | "분할매수" | "관망" | "분할매도" | "적극매도",
  "buyScore": 1~10 정수,
  "profitTarget1": 1차 익절 목표가 숫자,
  "profitTarget2": 2차 익절 목표가 숫자,
  "stopLoss": 손절 기준가 숫자,
  "narrative": "250자 내외 한국어 심층 분석 (차트를 보며 설명하는 문체)",
  "patternNote": "차트 패턴 또는 추세 채널 묘사 1~2문장",
  "keyPoints": ["핵심 포인트 1", "핵심 포인트 2", "핵심 포인트 3"],
  "riskNote": "주요 리스크 한 문장"
}`;

  try {
    const resp = await httpPost(
      GEMINI_HOST,
      `/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.15, maxOutputTokens: 1600 },
      }
    );
    const text = resp?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('JSON 미포함 응답');
    return JSON.parse(m[0]);
  } catch (e) {
    console.error(`  Gemini 오류 (${meta.symbol}): ${e.message}`);
    return null;
  }
}

// ── 티커 1개 처리 ─────────────────────────────────────────────────────────

async function processTicker(meta) {
  const { symbol, name } = meta;
  console.log(`  처리: ${symbol} (${name})`);

  // safe 심볼 — 파일명에 사용 (함수 상단에서 정의)
  const safeSymbol = symbol.replace(/[^a-zA-Z0-9]/g, '_');

  // 1. OHLCV 수집 (Yahoo Finance v8 API — crumb 인증으로 정확한 현재가 보장)
  const yfResult   = await fetchYFChart(symbol);
  const mta        = yfResult.meta;
  const timestamps = yfResult.timestamp;
  const quote      = yfResult.indicators.quote[0];
  const adjcloseArr = yfResult.indicators.adjclose?.[0]?.adjclose;

  // split-adjusted close(adjclose)를 사용해 분할/배당 반영
  const raw = timestamps.map((t, i) => ({
    t,
    o: quote.open[i],
    h: quote.high[i],
    l: quote.low[i],
    c: adjcloseArr?.[i] ?? quote.close[i],
    v: quote.volume[i] ?? 0,
  })).filter(d => d.o != null && d.h != null && d.l != null && d.c != null);

  if (raw.length < 30) throw new Error(`데이터 부족: ${raw.length}개`);

  const closes = raw.map(d => d.c);
  const highs  = raw.map(d => d.h);
  const lows   = raw.map(d => d.l);
  const n      = closes.length;

  // 2. 지표 계산
  const sma20A  = sma(closes, 20);
  const sma50A  = sma(closes, 50);
  const sma100A = sma(closes, 100);
  const sma200A = sma(closes, 200);
  const rsiA    = rsi(closes, 14);
  const macdA   = macd(closes, 12, 26, 9);
  const bbA     = bollingerBands(closes, 20, 2);

  // regularMarketPrice = Yahoo Finance 실시간 현재가 (정확)
  const price   = mta.regularMarketPrice ?? closes[n - 1];
  const high52  = Math.max(...highs);
  const low52   = Math.min(...lows);

  const indicators = {
    sma20:  sma20A[n - 1],
    sma50:  sma50A[n - 1],
    sma100: sma100A[n - 1],
    sma200: sma200A[n - 1],
    rsi:    rsiA[n - 1],
    macd:   macdA[n - 1],
    bb:     bbA[n - 1],
    high52, low52,
  };

  // 3. 지지/저항
  const swing = findSwingLevels(highs, lows, closes);
  const pivot = pivotPoints(highs, lows, closes);

  // 4. 주봉 집계 + 지표 계산
  const weekly    = aggregateWeekly(raw);
  const wCloses   = weekly.map(d => d.c);
  const wHighs    = weekly.map(d => d.h);
  const wLows     = weekly.map(d => d.l);
  const wN        = wCloses.length;
  let weeklyInd   = null;
  if (wN >= 26) {
    const wSma20A  = sma(wCloses, 20);
    const wSma50A  = sma(wCloses, Math.min(50, wN));
    const wSma100A = sma(wCloses, Math.min(100, wN));
    const wSma200A = sma(wCloses, Math.min(200, wN));
    const wRsiA    = rsi(wCloses, 14);
    const wMacdA   = macd(wCloses, 12, 26, 9);
    const wBbA     = bollingerBands(wCloses, 20, 2);
    weeklyInd = {
      sma20:  wSma20A[wN - 1],
      sma50:  wSma50A[wN - 1],
      sma100: wSma100A[wN - 1],
      sma200: wSma200A[wN - 1],
      rsi:    wRsiA[wN - 1],
      macd:   wMacdA[wN - 1],
      bb:     wBbA[wN - 1],
    };

    // 주봉 OHLCV + 지표 배열 (차트 렌더링용)
    const ohlcvWeeklyOut = {
      ticker:    symbol,
      name,
      updatedAt: new Date().toISOString(),
      currency:  symbol.endsWith('.KS') ? 'KRW' : 'USD',
      ohlcv: weekly.map(d => ({
        t: d.t,
        o: round(d.o, 4), h: round(d.h, 4), l: round(d.l, 4), c: round(d.c, 4),
        v: d.v,
      })),
      ind: {
        sma20:  wSma20A.map(v  => round(v, 4)),
        sma50:  wSma50A.map(v  => round(v, 4)),
        sma100: wSma100A.map(v => round(v, 4)),
        sma200: wSma200A.map(v => round(v, 4)),
        rsi:    wRsiA.map(v    => round(v, 2)),
        macd:   wMacdA,
        bb:     wBbA,
      },
    };
    fs.writeFileSync(
      path.join(DATA_DIR, `ohlcv-${safeSymbol}-weekly.json`),
      JSON.stringify(ohlcvWeeklyOut)
    );
  }

  // 5. Gemini AI 분석
  const aiResult = await callGemini(meta, indicators, swing, pivot, price, weeklyInd);

  // 6. 장외 시세 (프리마켓 / 포스트마켓)
  const marketState = mta.marketState || 'CLOSED';
  const prevClose   = mta.chartPreviousClose || mta.previousClose || (n >= 2 ? closes[n - 2] : null);
  let extPrice = null, extChange = null, extChangePct = null;
  // 프리마켓: price = 프리마켓 현재가, base = 전일 종가
  // 포스트마켓: price = 포스트마켓 현재가, base = 당일 정규장 종가
  if (marketState === 'PRE' && mta.preMarketPrice) {
    extPrice     = mta.preMarketPrice;
    const base   = prevClose || closes[n - 1];
    extChange    = round(extPrice - base, 4);
    extChangePct = round((extPrice - base) / base * 100, 2);
  } else if (marketState === 'POST' && mta.postMarketPrice) {
    extPrice     = mta.postMarketPrice;
    const base   = closes[n - 1];
    extChange    = round(extPrice - base, 4);
    extChangePct = round((extPrice - base) / base * 100, 2);
  }

  // 7. 저장 (analysis + daily OHLCV — 주봉은 위에서 이미 저장)

  // OHLCV + 지표 배열 (차트 렌더링용)
  const ohlcvOut = {
    ticker:    symbol,
    name,
    updatedAt: new Date().toISOString(),
    currency:  symbol.endsWith('.KS') ? 'KRW' : 'USD',
    ohlcv: raw.map(d => ({
      t: d.t,
      o: round(d.o, 4), h: round(d.h, 4), l: round(d.l, 4), c: round(d.c, 4),
      v: d.v,
    })),
    ind: {
      sma20:  sma20A.map(v  => round(v, 4)),
      sma50:  sma50A.map(v  => round(v, 4)),
      sma100: sma100A.map(v => round(v, 4)),
      sma200: sma200A.map(v => round(v, 4)),
      rsi:    rsiA.map(v    => round(v, 2)),
      macd:   macdA,
      bb:     bbA,
    },
  };

  // 분석 요약 (AI 분석 패널용)
  const analysisOut = {
    ticker:    symbol,
    name,
    assetType: meta.type,
    market:    meta.market || 'us',
    updatedAt: new Date().toISOString(),
    price: {
      current:     round(price, 4),
      change:      prevClose ? round(price - prevClose, 4) : null,
      changePct:   prevClose ? round((price - prevClose) / prevClose * 100, 2) : null,
      high52:      round(high52, 4),
      low52:       round(low52, 4),
      pos52:       round((price - low52) / (high52 - low52) * 100, 1),
      marketState,
      extPrice:    extPrice    ? round(extPrice, 4)    : null,
      extChange:   extChange   ? round(extChange, 4)   : null,
      extChangePct: extChangePct ? round(extChangePct, 2) : null,
    },
    indicators: {
      sma20:  round(indicators.sma20,  4),
      sma50:  round(indicators.sma50,  4),
      sma100: round(indicators.sma100, 4),
      sma200: round(indicators.sma200, 4),
      rsi:    round(indicators.rsi,   2),
      macd:   indicators.macd,
      bb:     indicators.bb,
    },
    levels: {
      swingResistance: swing.resistance ? round(swing.resistance, 4) : null,
      swingSupport:    swing.support    ? round(swing.support,    4) : null,
      pivot,
    },
    analysis: aiResult ?? {
      trend: '분석 대기',
      strength: 0,
      support:    swing.support    ? round(swing.support,    2) : null,
      resistance: swing.resistance ? round(swing.resistance, 2) : null,
      rsiStatus: 'N/A',
      macdStatus: 'N/A',
      bbStatus: 'N/A',
      stage: 'N/A',
      action: '관망',
      buyScore: null,
      profitTarget1: null,
      profitTarget2: null,
      stopLoss: null,
      narrative: 'AI 분석 데이터를 불러오는 중입니다.',
      patternNote: null,
      keyPoints: [],
      riskNote: '',
    },
  };

  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

  fs.writeFileSync(
    path.join(DATA_DIR, `ohlcv-${safeSymbol}.json`),
    JSON.stringify(ohlcvOut)   // 미니파이 — 파일 크기 최소화
  );
  fs.writeFileSync(
    path.join(DATA_DIR, `analysis-${safeSymbol}.json`),
    JSON.stringify(analysisOut, null, 2)
  );

  const trend  = aiResult?.trend  || '-';
  const action = aiResult?.action || '-';
  console.log(`  완료: ${symbol} | ${round(price,2)} | RSI ${round(indicators.rsi,1)} | ${trend} | ${action}`);
  return true;
}

// ── 인덱스 업데이트 ──────────────────────────────────────────────────────

function updateIndex(tickers, results) {
  const idxPath = path.join(DATA_DIR, 'chart-index.json');
  let idx = {};
  try {
    if (fs.existsSync(idxPath)) idx = JSON.parse(fs.readFileSync(idxPath, 'utf8'));
  } catch {}

  const now = new Date().toISOString();
  tickers.forEach((t, i) => {
    if (results[i]) {
      idx[t.symbol] = {
        name:        t.name,
        type:        t.type,
        market:      t.market || 'us',
        safeSymbol:  t.symbol.replace(/[^a-zA-Z0-9]/g, '_'),
        lastUpdated: now,
      };
    }
  });
  fs.writeFileSync(idxPath, JSON.stringify(idx, null, 2));
}

// ── 메인 ─────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n=== ATMR 차트 분석 생성기 ===`);
  console.log(`그룹: ${GROUP} | 티커: ${tickersToProcess.length}개 | 시작: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} KST`);
  if (!GEMINI_API_KEY) console.warn('⚠ GEMINI_API_KEY 미설정 — 기술적 데이터만 저장됩니다.');

  const results = [];
  for (let i = 0; i < tickersToProcess.length; i++) {
    const t = tickersToProcess[i];
    try {
      results.push(await processTicker(t));
    } catch (e) {
      console.error(`  오류 (${t.symbol}): ${e.message}`);
      results.push(false);
    }
    if (i < tickersToProcess.length - 1) await sleep(DELAY_MS);
  }

  updateIndex(tickersToProcess, results);

  const ok  = results.filter(Boolean).length;
  const err = results.length - ok;
  console.log(`\n완료: ${ok}/${results.length}개 성공${err > 0 ? ` (실패 ${err}개)` : ' — 전원 성공'}`);
  if (err > 0) process.exit(1);
}

main().catch(e => {
  console.error('치명적 오류:', e.message);
  process.exit(1);
});
