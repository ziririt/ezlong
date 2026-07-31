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
    req.on('timeout', () => { req.destroy(new Error('쿠키 취득 타임아웃')); });
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
      const chunks = [];
      res.on('data', c => { chunks.push(c); });
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8').trim()));
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('크럼 취득 타임아웃')); });
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
const GEMINI_MODEL          = 'gemini-2.5-flash-lite'; // 비용 절감 모델 (2026-06-27: flash→flash-lite, thinkingBudget:0 병행)
// flash-lite: 차트 분석(패턴 판독)에 충분한 성능, flash 대비 ~7배 저렴
// scorecard(fetch-market-scorecard.py)는 복잡한 시장 판단 필요 → gemini-2.5-flash 유지
const DELAY_MS       = 4500;                        // 티커 간 요청 간격 (Gemini RPM 한도 대응: 4.5s → 분당 13개)
const DATA_DIR       = path.join(__dirname, '..', 'data');

// ── 티커 메타데이터 정의 ──────────────────────────────────────────────────

const TICKERS_US_STOCKS = [
  { symbol:'TSLA',  name:'테슬라',           type:'stock', context:'전기차·에너지·AI 로봇 기업. 변동성이 크며 성장주 중 베타가 가장 높은 편입니다.' },
  { symbol:'NVDA',  name:'엔비디아',          type:'stock', context:'AI 반도체 시장 독점 기업. 데이터센터 GPU 수요가 실적을 좌우합니다.' },
  { symbol:'AAPL',  name:'애플',             type:'stock', context:'글로벌 시총 최상위 빅테크. 생태계 락인과 서비스 매출 성장이 핵심입니다.' },
  { symbol:'MSFT',  name:'마이크로소프트',    type:'stock', context:'클라우드(Azure)·AI 선두 기업. 기업 소프트웨어 시장 지배력이 탁월합니다.' },
  { symbol:'GOOGL', name:'알파벳',           type:'stock', context:'구글 모회사. 검색·광고·클라우드·AI(Gemini) 사업을 영위합니다.' },
  { symbol:'AMZN',  name:'아마존',           type:'stock', context:'e커머스와 AWS 클라우드 1위 기업. 구조적 성장이 지속됩니다.' },
  { symbol:'META',  name:'메타',             type:'stock', context:'페이스북·인스타·왓츠앱 보유. AI 광고 최적화로 수익성이 급개선됐습니다.' },
  { symbol:'AVGO',  name:'브로드컴',          type:'stock', context:'AI 맞춤 반도체(ASIC)와 네트워킹 칩 선두 기업입니다.' },
  { symbol:'TSM',   name:'TSMC',            type:'stock', context:'대만 파운드리 기업 TSMC. 글로벌 파운드리 시장 점유율 1위로 NVIDIA·Apple·AMD 등의 최첨단 반도체를 위탁생산합니다.' },
  { symbol:'MU',    name:'마이크론',          type:'stock', context:'미국 유일의 메모리 반도체 기업. DRAM·NAND·HBM을 생산하며 AI 수요 확대로 HBM 성장이 핵심 모멘텀입니다.' },
  { symbol:'AMD',   name:'AMD',             type:'stock', context:'엔비디아 대항마. AI GPU와 서버 CPU 점유율을 꾸준히 확대하고 있습니다.' },
  { symbol:'ASML',  name:'ASML',            type:'stock', context:'반도체 EUV 노광장비 독점 기업. 전 세계에서 유일하게 생산합니다.' },
  { symbol:'PLTR',  name:'팔란티어',          type:'stock', context:'AI 데이터 분석 플랫폼. 미 정부·기업 고객 기반이 강점입니다.' },
  { symbol:'IONQ',  name:'아이온큐',          type:'stock', context:'양자컴퓨팅 기업. 소형 성장주로 변동성이 매우 높습니다.' },
  { symbol:'NFLX',  name:'넷플릭스',          type:'stock', context:'글로벌 스트리밍 1위. 광고 기반 요금제 확장으로 성장이 재가속됐습니다.' },
  { symbol:'SHOP',  name:'쇼피파이',          type:'stock', context:'중소 이커머스 플랫폼. 캐나다 기업으로 NASDAQ 상장입니다.' },
  { symbol:'SNOW',  name:'스노우플레이크',     type:'stock', context:'클라우드 데이터 웨어하우스 전문 기업. 성장 기대치 대비 밸류에이션이 높습니다.' },
  { symbol:'CRWD',  name:'크라우드스트라이크', type:'stock', context:'클라우드 보안(엔드포인트) 1위 기업. SaaS 구독 매출이 핵심입니다.' },
  { symbol:'ABNB',  name:'에어비앤비',         type:'stock', context:'글로벌 숙박 공유 플랫폼. 여행 수요와 거시경제에 민감하게 반응합니다.' },
  { symbol:'INTU',  name:'인튜이트',           type:'stock', context:'세금·회계 소프트웨어(TurboTax, QuickBooks) 선두 기업입니다.' },
  { symbol:'COIN',  name:'코인베이스',          type:'stock', context:'미국 최대 암호화폐 거래소. 크립토 시장 변동성에 강하게 연동됩니다.' },
];

const TICKERS_US_ETFS = [
  // ── 나스닥 ────────────────────────────────────────────────────────────────
  { symbol:'QQQ',  name:'나스닥 100 ETF',           type:'etf',           context:'AI·빅테크 중심 나스닥 100 추종 ETF입니다.' },
  { symbol:'QLD',  name:'나스닥 100 2X ETF',         type:'etf_leveraged', context:'ProShares Ultra QQQ. 나스닥 100 일일 수익률의 2배를 추구합니다. 반드시 단기 트레이딩 관점에서만 분석하십시오.' },
  { symbol:'TQQQ', name:'나스닥 100 3X ETF',         type:'etf_leveraged', context:'ProShares UltraPro QQQ. 나스닥 100 일일 수익률의 3배를 추구합니다. 변동성 끌림(volatility drag) 손실이 발생하므로 단기 트레이딩 전용입니다.' },
  // ── S&P500 ───────────────────────────────────────────────────────────────
  { symbol:'VOO',  name:'S&P500 ETF (Vanguard)',     type:'etf',           context:'SPY와 동일한 S&P500 추종. 운용보수가 더 낮습니다.' },
  { symbol:'SPY',  name:'S&P500 ETF (SPDR)',         type:'etf',           context:'미국 대형주 500개를 담은 장기 분산 투자의 교과서입니다.' },
  { symbol:'SSO',  name:'S&P500 2X ETF',             type:'etf_leveraged', context:'ProShares Ultra S&P500. S&P500 일일 수익률의 2배를 추구합니다. 반드시 단기 트레이딩 관점에서만 분석하십시오.' },
  { symbol:'UPRO', name:'S&P500 3X ETF',             type:'etf_leveraged', context:'ProShares UltraPro S&P500. S&P500 일일 수익률의 3배를 추구합니다. 변동성 끌림(volatility drag) 손실이 발생하므로 단기 트레이딩 전용입니다.' },
  // ── 반도체 ───────────────────────────────────────────────────────────────
  { symbol:'SMH',  name:'반도체 ETF (VanEck)',        type:'etf',           context:'VanEck 반도체 ETF. NVDA, TSMC 등 글로벌 반도체 기업을 담습니다.' },
  { symbol:'SOXX', name:'반도체 ETF (iShares)',       type:'etf',           context:'iShares 반도체 ETF. 미국 반도체 섹터에 집중 투자합니다.' },
  { symbol:'USD',  name:'반도체 2X ETF',               type:'etf_leveraged', context:'NYSE 상장 ProShares Ultra Semiconductors(USD) — 다우존스 미국 반도체 지수 일일 수익률의 2배를 추구하는 레버리지 ETF입니다. 레버리지 특성상 단기 변동성이 크므로 단기 트레이딩 관점으로 분석하십시오.' },
  { symbol:'SOXL', name:'반도체 3X ETF',              type:'etf_leveraged', context:'Direxion Daily Semiconductor Bull 3X. 필라델피아 반도체 지수의 3배를 추구합니다. 단기 트레이딩 전용입니다.' },
  // ── 배당·인컴 ─────────────────────────────────────────────────────────────
  { symbol:'SCHD', name:'고배당 미국 주식 ETF',        type:'etf',           context:'미국 우량 고배당주 ETF. 배당 성장성과 재무 건전성을 기준으로 종목을 선별합니다.' },
  { symbol:'JEPI', name:'커버드콜 월배당 ETF',         type:'etf',           context:'이 상품은 S&P500 기반 커버드콜 전략 월배당 ETF입니다. 상승장에서 주가 참여가 제한되므로 분석 초점을 배당 안정성과 변동성 수준에 맞추십시오.' },
  // ── 지수·광역 ─────────────────────────────────────────────────────────────
  { symbol:'DIA',  name:'다우존스 ETF',               type:'etf',           context:'미국 다우존스 산업평균지수 30개 종목 추종 ETF입니다.' },
  { symbol:'IWM',  name:'러셀 2000 ETF',             type:'etf',           context:'미국 소형주 2000개 추종. 경기민감도와 달러 강세에 취약합니다.' },
  { symbol:'IVV',  name:'S&P500 ETF (iShares)',      type:'etf',           context:'SPY, VOO와 동일한 S&P500 추종. iShares 브랜드입니다.' },
  { symbol:'^VIX', name:'VIX 변동성 지수',            type:'etf',           context:'CBOE 변동성 지수(공포 지수). S&P500 옵션 내재 변동성으로 시장 심리를 측정합니다. 지수이므로 직접 매매는 불가하나 기술적 분석으로 시장 국면 판단에 활용합니다.' },
  // ── 섹터 ─────────────────────────────────────────────────────────────────
  { symbol:'XLE',  name:'에너지 섹터 ETF',            type:'etf',           context:'S&P500 에너지 섹터. 유가와 높은 상관관계를 보입니다.' },
  { symbol:'XLF',  name:'금융 섹터 ETF',              type:'etf',           context:'S&P500 금융 섹터. 금리 방향성과 신용 사이클에 민감합니다.' },
  { symbol:'XLY',  name:'소비재 섹터 ETF',            type:'etf',           context:'S&P500 경기소비재 섹터. 경기 사이클에 민감하게 반응합니다.' },
  { symbol:'XLK',  name:'IT 섹터 ETF',               type:'etf',           context:'S&P500 기술 섹터. AAPL, MSFT 비중이 높습니다.' },
  // ── 글로벌·채권 ───────────────────────────────────────────────────────────
  { symbol:'VT',   name:'전세계 주식 ETF',            type:'etf',           context:'전 세계 주식시장을 포괄하는 Vanguard 글로벌 ETF입니다.' },
  { symbol:'VTI',  name:'미국 전체 주식 ETF',         type:'etf',           context:'미국 상장 전체 주식을 담는 Vanguard ETF입니다.' },
  { symbol:'TLT',  name:'미국 장기국채 ETF',          type:'etf',           context:'이 상품은 만기 20년 이상 미국 국채 ETF입니다. 가격과 금리가 역방향으로 움직이므로 연준 금리 방향성 컨텍스트를 반드시 포함하십시오.' },
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

// ── 전역 표시 순서 (사이드바 정렬 기준) ──────────────────────────────────────
// updateIndex()가 이 순서를 기준으로 chart-index.json을 항상 재정렬한다.
const TICKER_ORDER = [
  ...TICKERS_US_STOCKS.map(t => t.symbol),
  ...TICKERS_US_ETFS.map(t => t.symbol),
  ...TICKERS_KR_ETFS.map(t => t.symbol),
  ...TICKERS_KR_STOCKS.map(t => t.symbol),
  ...TICKERS_CRYPTO.map(t => t.symbol),
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

// ── 판단 원장 (judgment ledger) — 3영업일 판단 연속성 (2026-07-03) ─────────
// 목적: 매 실행이 과거 판단을 모르는 "기억상실" 문제 해결.
//   쓰기 — 매 생성 성공 시 심볼별로 한 줄 요약을 원장에 append (심볼당 최대 15개 유지)
//   읽기 — 생성 직전 최근 날짜들(직전 3영업일 + 오늘 장중)의 판단을 프롬프트에 주입
// 파일은 그룹별 분리(us/kr/crypto) — 워크플로 동시 실행 시 커밋 충돌 방지.
// 원장이 없거나 깨져도 기존처럼 단발 생성으로 동작한다 (무중단 폴백).

const LEDGER_MAX_PER_SYMBOL = 15;

function ledgerPath() {
  return path.join(DATA_DIR, `judgment-history-${GROUP}.json`);
}

function loadLedger() {
  try {
    const obj = JSON.parse(fs.readFileSync(ledgerPath(), 'utf8'));
    return (obj && typeof obj === 'object') ? obj : {};
  } catch { return {}; }
}

function saveLedger(ledger) {
  try { fs.writeFileSync(ledgerPath(), JSON.stringify(ledger)); }
  catch (e) { console.warn(`  판단 원장 저장 실패: ${e.message}`); }
}

// ─── 정량 엔진 기준선 (2026-07-09 신설) ────────────────────────────────────
// fetch-market-data.py의 calc_buy_score/calc_sell_score 결과(market-signals.json)를 읽어
// Gemini 프롬프트의 가드레일로 넘긴다. 두 엔진이 같은 화면(스윙 전략)에서 정면 모순되는
// 문제(2026-07-09 발견)를 막기 위한 최소 연결 고리. 파일이 없거나 깨져도 무중단 폴백
// (quantBaseline이 null이면 프롬프트에서 해당 섹션·규칙이 자동으로 빠질 뿐, 기존처럼 동작한다).
function quantBaselineFor(symbol) {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'market-signals.json'), 'utf8'));
    const s = data?.symbols?.[symbol];
    if (!s || s.buyScore == null || s.sellScore == null) return null;
    return { buyScore: s.buyScore, sellScore: s.sellScore, gear: s.gear };
  } catch { return null; }
}

function kstDateStr(d = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(d); // YYYY-MM-DD
}

function kstTimeStr(d = new Date()) {
  return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour12: false, hour: '2-digit', minute: '2-digit' }).format(d);
}

// 최근 판단 컨텍스트: 날짜별 마지막 판단만 추려 최대 4일치(직전 3영업일 + 오늘 장중) 반환.
// 파이프라인이 거래일에만 돌므로 원장에 존재하는 날짜 자체가 영업일 — 별도 휴일 테이블 불필요.
function ledgerContextLines(ledger, symbol) {
  const arr = Array.isArray(ledger[symbol]) ? ledger[symbol] : [];
  if (!arr.length) return null;
  const byDate = new Map();
  for (const e of arr) if (e && e.d && e.k) byDate.set(e.d, e); // 시간순 append → 날짜별 마지막 판단만 남음
  const days = [...byDate.values()].slice(-4);
  if (!days.length) return null;
  return days.map(e => `${e.d} ${e.t || ''}: ${e.k}`).join('\n');
}

function appendLedger(ledger, symbol, summaryLine) {
  if (!Array.isArray(ledger[symbol])) ledger[symbol] = [];
  ledger[symbol].push({ d: kstDateStr(), t: kstTimeStr(), k: summaryLine });
  if (ledger[symbol].length > LEDGER_MAX_PER_SYMBOL) {
    ledger[symbol] = ledger[symbol].slice(-LEDGER_MAX_PER_SYMBOL);
  }
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
      const chunks = [];
      res.on('data', c => { chunks.push(c); });
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
        catch (e) { reject(new Error(`JSON 파싱 오류: ${e.message}`)); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('요청 타임아웃')); });
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
      timeout: 180000, // gemini-2.5-flash thinking 토큰 처리 시간 고려 (30s→90s→180s, 2026-06-26)
    }, res => {
      const chunks = [];
      res.on('data', c => { chunks.push(c); });
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
        catch (e) { reject(new Error(`JSON 파싱 오류: ${e.message}`)); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('Gemini 타임아웃')); });
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
      const chunks = [];
      res.on('data', c => { chunks.push(c); });
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
        catch (e) { reject(new Error(`JSON 파싱 오류: ${e.message}`)); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('Yahoo Finance 타임아웃')); });
    req.end();
  });

  const result = data?.chart?.result?.[0];
  if (!result || !result.timestamp || result.timestamp.length === 0) {
    const errMsg = data?.chart?.error?.description || '데이터 없음';
    throw new Error(`차트 결과 없음 (${symbol}): ${errMsg}`);
  }
  return result;
}

// ── 4시간봉(합성) 데이터 (2026-07-09 신설) ────────────────────────────────
// 일봉/주봉 사이의 단기 확인 시간대. Yahoo Finance는 '4h' interval을 직접
// 제공하지 않아 60분봉을 4개씩 순서대로 묶어 합성한다. 정규장 캘린더
// 경계(예: 9:30 시가 기준)에 정렬된 "진짜" 4H 봉이 아니라 롤링 묶음 근사치
// 임을 분명히 인지할 것 — RSI/MACD 궤적 같은 짧은 lookback 참고용으로는
// 충분하지만, 이 값을 저장해 차트로 그리거나 장기 백테스트에 쓰지 마라.
// 실패해도(네트워크 오류, 데이터 부족 등) null을 반환해 나머지 파이프라인은
// 정상 진행되도록 fail-safe로 설계.
async function fetchYFIntraday(symbol) {
  const { cookie, crumb } = await getYFCrumb();
  const period2 = Math.floor(Date.now() / 1000);
  const period1 = period2 - 30 * 24 * 3600; // 최근 30일
  const encodedCrumb = encodeURIComponent(crumb);
  const reqPath = `/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?period1=${period1}&period2=${period2}&interval=60m&includePrePost=false&crumb=${encodedCrumb}`;

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
      const chunks = [];
      res.on('data', c => { chunks.push(c); });
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
        catch (e) { reject(new Error(`JSON 파싱 오류(인트라데이): ${e.message}`)); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('Yahoo Finance 인트라데이 타임아웃')); });
    req.end();
  });

  const result = data?.chart?.result?.[0];
  if (!result || !result.timestamp || result.timestamp.length === 0) return null;
  return result;
}

function aggregate4H(raw) {
  // 60분봉 4개를 시간 순서대로 묶어 하나의 4H 합성봉 생성 (캘린더 정렬 아님)
  const out = [];
  for (let i = 0; i + 4 <= raw.length; i += 4) {
    const chunk = raw.slice(i, i + 4);
    out.push({
      t: chunk[0].t,
      o: chunk[0].o,
      h: Math.max(...chunk.map(d => d.h)),
      l: Math.min(...chunk.map(d => d.l)),
      c: chunk[chunk.length - 1].c,
      v: chunk.reduce((s, d) => s + (d.v || 0), 0),
    });
  }
  return out;
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

// ── ADX / +DI / −DI (Wilder, 2026-07-09 신설) ────────────────────────────
// 목적: "급락 = 추세적 붕괴"로 성급히 단정하는 것을 막는 필터.
// ADX는 방향이 아니라 "추세의 강도"만 알려준다 — DI가 강하게 한쪽으로
// 쏠려도 ADX가 낮으면 그 하락/상승은 아직 추세로 굳어지지 않은
// 충격성 변동(shock)일 가능성이 높다. 독립 검증(2026-07-09): 실제
// data/ohlcv-SOXX.json(2026-07-07 종가 기준)으로 아래와 동일한 로직을
// Python으로 별도 재구현해 대조 — ADX 16.78 / +DI 19.65 / -DI 36.80로
// TradingView 리포트 수치(ADX 17.58, DI− 36 부근)와 일치 확인.
// 2026-07-14(3차): ATR(14) — Wilder 평균실질변동폭. adx() 내부에도 TR
// 스무딩이 있지만 외부로 노출되지 않아 별도 함수로 복제했다(adx() 본체는
// 건드리지 않음 — 공유 리팩터링보다 회귀 위험이 적은 복제를 택함).
// 외부 리포트가 "손절 버퍼 = 0.5×ATR" 식으로 변동성 기반 리스크 폭을
// 표현하길래, sanitizeTradeLevels(결정론적 손절 계산)는 그대로 두고
// LLM 서술용 참고 지표로만 추가한다.
function atr(highs, lows, closes, period = 14) {
  const n = closes.length;
  const tr = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    const hl = highs[i] - lows[i];
    const hc = Math.abs(highs[i] - closes[i - 1]);
    const lc = Math.abs(lows[i]  - closes[i - 1]);
    tr[i] = Math.max(hl, hc, lc);
  }
  const out = new Array(n).fill(null);
  if (n <= period) return out;
  let seed = 0;
  for (let i = 1; i <= period; i++) seed += tr[i];
  out[period] = seed / period;
  for (let i = period + 1; i < n; i++) {
    out[i] = (out[i - 1] * (period - 1) + tr[i]) / period;
  }
  return out;
}

function adx(highs, lows, closes, period = 14) {
  const n = closes.length;
  const tr = new Array(n).fill(0);
  const plusDM  = new Array(n).fill(0);
  const minusDM = new Array(n).fill(0);

  for (let i = 1; i < n; i++) {
    const hl = highs[i] - lows[i];
    const hc = Math.abs(highs[i] - closes[i - 1]);
    const lc = Math.abs(lows[i]  - closes[i - 1]);
    tr[i] = Math.max(hl, hc, lc);

    const upMove   = highs[i] - highs[i - 1];
    const downMove = lows[i - 1] - lows[i];
    plusDM[i]  = (upMove > downMove && upMove > 0) ? upMove : 0;
    minusDM[i] = (downMove > upMove && downMove > 0) ? downMove : 0;
  }

  // Wilder 스무딩 — 첫 값은 1~period 구간의 단순 합, 이후는 누적 스무딩
  function wilderSmooth(arr) {
    const out = new Array(n).fill(null);
    if (n <= period) return out;
    let seed = 0;
    for (let i = 1; i <= period; i++) seed += arr[i];
    out[period] = seed;
    for (let i = period + 1; i < n; i++) {
      out[i] = out[i - 1] - (out[i - 1] / period) + arr[i];
    }
    return out;
  }

  const trS      = wilderSmooth(tr);
  const plusDMS  = wilderSmooth(plusDM);
  const minusDMS = wilderSmooth(minusDM);

  const plusDI  = new Array(n).fill(null);
  const minusDI = new Array(n).fill(null);
  const dx      = new Array(n).fill(null);

  for (let i = period; i < n; i++) {
    if (trS[i]) {
      plusDI[i]  = 100 * plusDMS[i]  / trS[i];
      minusDI[i] = 100 * minusDMS[i] / trS[i];
    } else {
      plusDI[i] = 0; minusDI[i] = 0;
    }
    const s = plusDI[i] + minusDI[i];
    dx[i] = s ? 100 * Math.abs(plusDI[i] - minusDI[i]) / s : 0;
  }

  const adxArr = new Array(n).fill(null);
  const start = period * 2; // ADX 첫 값 = 그 이전 period개 DX의 단순평균
  if (n > start) {
    let seedAdx = 0;
    for (let i = period; i < start; i++) seedAdx += dx[i];
    adxArr[start - 1] = seedAdx / period;
    for (let i = start; i < n; i++) {
      adxArr[i] = (adxArr[i - 1] * (period - 1) + dx[i]) / period;
    }
  }

  return closes.map((_, i) => ({
    plusDI:  plusDI[i]  != null ? round(plusDI[i], 2)  : null,
    minusDI: minusDI[i] != null ? round(minusDI[i], 2) : null,
    adx:     adxArr[i]  != null ? round(adxArr[i], 2)  : null,
  }));
}

// ADX 값 → 결정론적 라벨 (LLM에게 판정을 맡기지 않고 JS에서 직접 분류)
function classifyADX(v) {
  if (v == null) return null;
  if (v < 20) return '무추세(충격 가능)';
  if (v < 25) return '추세 형성 초기';
  if (v < 50) return '뚜렷한 추세';
  return '과열된 추세(소멸 경계)';
}

// ── CCI(20) — Commodity Channel Index (2026-07-09 신설) ──────────────────
// 배경: 유저가 외부 TradingView 분석 리포트를 근거로 요청. 그 리포트는 SOXX
// 반등의 핵심 근거로 "CCI -180 → -30 급격한 정상화 = 기관 매수 유입"을 들었다.
// RSI/스토캐스틱과 다른 계산식(전형 가격의 이동평균 대비 편차)이라 같은
// 과매도 국면에서도 다른 타이밍에 신호를 준다 — 상호 보완용으로 추가.
// 절대 손대지 말 것: calc_buy_score/calc_sell_score(fetch-market-data.py)는
// 건드리지 않는다 — 이 파일(Engine B, LLM 판단)에만 참고 컨텍스트로 주입한다.
function cci(highs, lows, closes, period = 20) {
  const n = closes.length;
  const tp = closes.map((c, i) => (highs[i] + lows[i] + c) / 3);
  const tpSma = sma(tp, period);
  const result = new Array(n).fill(null);
  for (let i = period - 1; i < n; i++) {
    if (tpSma[i] == null) continue;
    const slice = tp.slice(i - period + 1, i + 1);
    const meanDev = slice.reduce((s, v) => s + Math.abs(v - tpSma[i]), 0) / period;
    result[i] = meanDev === 0 ? 0 : (tp[i] - tpSma[i]) / (0.015 * meanDev);
  }
  return result.map(v => v != null ? round(v, 2) : null);
}

// ── 스토캐스틱(14,3) — %K/%D (2026-07-09 신설) ────────────────────────────
function stochastic(highs, lows, closes, kPeriod = 14, dPeriod = 3) {
  const n = closes.length;
  const kArr = new Array(n).fill(null);
  for (let i = kPeriod - 1; i < n; i++) {
    const hh = Math.max(...highs.slice(i - kPeriod + 1, i + 1));
    const ll = Math.min(...lows.slice(i - kPeriod + 1, i + 1));
    kArr[i] = hh === ll ? 50 : (closes[i] - ll) / (hh - ll) * 100;
  }
  const dArr = new Array(n).fill(null);
  for (let i = kPeriod - 1 + dPeriod - 1; i < n; i++) {
    const slice = kArr.slice(i - dPeriod + 1, i + 1);
    dArr[i] = slice.reduce((a, b) => a + b, 0) / dPeriod;
  }
  return closes.map((_, i) => ({
    k: kArr[i] != null ? round(kArr[i], 2) : null,
    d: dArr[i] != null ? round(dArr[i], 2) : null,
  }));
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

// 시간순 스윙 피벗(고점/저점) 리스트 — findSwingLevels와 동일한 로컬 극값
// 탐지 방식(좌우 lookback봉보다 높다/낮다)을 쓰되, 값이 아니라 (위치,종류,값)을
// 전부 반환해 fibRetracement가 "가장 최근에 완성된 스윙 구간"을 찾을 수 있게 한다.
function findSwingPivots(highs, lows, lookback = 5) {
  const pivots = [];
  for (let i = lookback; i < highs.length - lookback; i++) {
    if (highs.slice(i - lookback, i).every(h => h < highs[i]) &&
        highs.slice(i + 1, i + lookback + 1).every(h => h < highs[i])) {
      pivots.push({ idx: i, type: 'high', value: highs[i] });
    }
    if (lows.slice(i - lookback, i).every(l => l > lows[i]) &&
        lows.slice(i + 1, i + lookback + 1).every(l => l > lows[i])) {
      pivots.push({ idx: i, type: 'low', value: lows[i] });
    }
  }
  return pivots.sort((a, b) => a.idx - b.idx);
}

// 2026-07-13(2차): 피보나치 되돌림 — 외부 TradingView 리포트가 SOXX의
// $550.85(0.786 되돌림) 지지선을 CPI 발표 앞둔 핵심 판단 근거로 썼다.
// 1차 시도는 "최근 N거래일 중 최고가/최저가"였는데, 실제 SOXX 데이터로
// 검증해보니 120일 윈도우 안의 훨씬 오래된(3/30, 별개 급락의) 저점을 잘못
// 집어 리포트의 "$522.24(6/9 저점)"와 전혀 다른 결과가 나왔다(레벨 완전
// 불일치 확인). 그래서 findSwingPivots로 실제 스윙 피벗을 찾은 뒤 "가장
// 최근에 완성된 한 구간(마지막 극값 + 그 직전 반대 타입 극값)"만 골라내는
// 방식으로 재작성 — 실제 SOXX 데이터로 재검증한 결과 고점 655.95/저점
// 522.24로 리포트와 정확히 일치했다(아래 재검증 커밋 참고).
function fibRetracement(highs, lows, closes, lookback = 5) {
  const pivots = findSwingPivots(highs, lows, lookback);
  if (pivots.length < 2) return null;

  const lastType = pivots[pivots.length - 1].type;
  let anchor = pivots[pivots.length - 1];
  let i = pivots.length - 1;
  // 마지막 극값과 같은 타입이 연속되면(작은 눌림이 새 반대 피벗을 못 만든
  // 경우) 더 극단적인 값으로 anchor를 계속 갱신하며 건너뛴다.
  while (i >= 0 && pivots[i].type === lastType) {
    if (lastType === 'high' ? pivots[i].value > anchor.value : pivots[i].value < anchor.value) {
      anchor = pivots[i];
    }
    i--;
  }
  if (i < 0) return null; // 반대 타입 피벗을 못 찾음 — 스윙 구조 데이터 부족
  const oppType = pivots[i].type;
  let opposite = pivots[i];
  while (i >= 0 && pivots[i].type === oppType) {
    if (oppType === 'high' ? pivots[i].value > opposite.value : pivots[i].value < opposite.value) {
      opposite = pivots[i];
    }
    i--;
  }

  const high = lastType === 'high' ? anchor.value : opposite.value;
  const low  = lastType === 'high' ? opposite.value : anchor.value;
  if (!(high > low)) return null;
  const range  = high - low;
  const ratios = [0.236, 0.382, 0.5, 0.618, 0.786, 1.0];
  const direction = lastType === 'high' ? 'pullback_from_high' : 'bounce_from_low';
  const levels = {};
  ratios.forEach(r => {
    levels[r] = direction === 'pullback_from_high'
      ? round(high - r * range, 2)
      : round(low + r * range, 2);
  });
  const price = closes[closes.length - 1];
  const retracedPct = direction === 'pullback_from_high'
    ? round((high - price) / range * 100, 1)
    : round((price - low) / range * 100, 1);
  return { high: round(high, 2), low: round(low, 2), direction, levels, retracedPct };
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

// Gemini가 entry/stop/target/invalidation을 0으로 반환하는 간헐적 프롬프트 미준수 방어.
// 2026-07-09 확인: TSLA/VOO/DIA에서 action="관망"일 때 4개 필드가 전부 0으로 반환되어
// atmr-dashboard.html 트레이드 플랜 카드에 "$0.00"로 노출됨(QQQ/NVDA/IWM은 같은 관망인데도
// 정상 반환 — action별 규칙성 없는 LLM 확률적 결함). 프롬프트 규칙 8 강화와 별개로,
// 이미 계산된 피벗/스윙 레벨로 0값을 결정적으로 대체해 근본 차단한다.
// 절대 손대지 말 것: 값이 정상(0이 아닌 유한수)이면 그대로 통과 — Gemini 판단을 덮어쓰지 않는다.
function sanitizeTradeLevels(result, price, swing, pivot, symbol) {
  if (!result) return result;
  const bad = v => v == null || v === 0 || !isFinite(v);
  if (!bad(result.entry) && !bad(result.stop) && !bad(result.target) && !bad(result.invalidation)) {
    return result;
  }
  const supportLv    = swing.support    ?? pivot.s1 ?? price;
  const resistanceLv = swing.resistance ?? pivot.r1 ?? price;
  let entry, stop, target, invalidation;
  if (result.action === '매수') {
    entry = price; stop = supportLv; target = resistanceLv; invalidation = supportLv;
  } else if (result.action === '매도') {
    entry = price; stop = resistanceLv; target = supportLv; invalidation = resistanceLv;
  } else {
    entry = pivot.pp ?? price; stop = supportLv; target = resistanceLv; invalidation = supportLv;
  }
  const fixed = { ...result };
  if (bad(result.entry))        fixed.entry        = round(entry, 2);
  if (bad(result.stop))         fixed.stop          = round(stop, 2);
  if (bad(result.target))       fixed.target        = round(target, 2);
  if (bad(result.invalidation)) fixed.invalidation  = round(invalidation, 2);
  console.warn(`  ⚠ ${symbol}: 트레이드 레벨 0값 감지(action=${result.action}) — 피벗/스윙 레벨로 대체`);
  return fixed;
}

// ── Gemini AI 분석 ────────────────────────────────────────────────────────

async function callGemini(meta, ind, swing, pivot, price, weeklyInd, historyLines, quantBaseline, fourHInd) {
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
주봉 ADX: ${weeklyInd.adx?.adx != null ? weeklyInd.adx.adx.toFixed(1) + ' (' + weeklyInd.adx.status + ')' : 'N/A'} — 25 이상이면 장기(주간) 추세가 살아있다는 뜻, 단기 일봉 조정과 혼동하지 마라.
` : '';

  // ADX/DI 섹션 (2026-07-09 신설) — "급락=추세붕괴" 성급한 단정을 막는 필터.
  // ADX/DI는 JS에서 결정론적으로 계산·분류한 값을 그대로 주입한다 (Gemini가 임계값을 직접 판정하지 않음).
  const adxSection = ind.adx?.adx != null ? `
[ADX/DI(14) — 추세의 "강도"를 재는 지표. 방향은 알려주지 않는다]
ADX: ${ind.adx.adx.toFixed(1)} (${ind.adx.status}) | 5일 전 ADX: ${ind.adx5dAgo != null ? ind.adx5dAgo.toFixed(1) : 'N/A'}
+DI: ${ind.adx.plusDI != null ? ind.adx.plusDI.toFixed(1) : 'N/A'} | -DI: ${ind.adx.minusDI != null ? ind.adx.minusDI.toFixed(1) : 'N/A'}
해석 규칙 (반드시 지켜라):
- ADX 20 미만: 지금의 상승/하락은 "추세"가 아니라 "충격성 변동"일 가능성이 높다. -DI가 +DI보다 훨씬 커도(또는 반대여도) 그 방향성이 아직 추세로 굳어지지 않았다는 뜻이다. 이 구간에서 급락을 "추세적 붕괴"로, 급등을 "추세적 상승 전환"으로 단정하지 마라 — "되돌림 가능성이 있는 충격"으로 표현하라.
- ADX 20~25: 추세가 막 형성되는 초기 단계. 방향 확정은 아직 이르다.
- ADX 25 이상 + DI 방향과 가격 방향 일치: 진짜 추세로 판단해도 된다.
- ADX 50 이상: 과열 — 추세 소멸(반전) 경계 구간임을 함께 언급하라.
` : '';

  // CCI(20)/스토캐스틱(14,3) 섹션 (2026-07-09 신설) — 유저가 공유한 외부 TradingView
  // 분석 리포트가 SOXX 반등의 핵심 근거로 사용한 지표. RSI와 다른 계산식이라
  // 같은 과매도 국면에서도 다른 타이밍에 신호를 준다.
  const cciStochSection = (ind.cci != null || ind.stoch?.k != null) ? `
[CCI(20) / 스토캐스틱(14,3) — 과매도·과매수 극단 및 되돌림 포착]
CCI: ${ind.cci != null ? ind.cci.toFixed(1) : 'N/A'} (5일 전: ${ind.cci5dAgo != null ? ind.cci5dAgo.toFixed(1) : 'N/A'})
스토캐스틱 %K: ${ind.stoch?.k != null ? ind.stoch.k.toFixed(1) : 'N/A'} (5일 전: ${ind.stochK5dAgo != null ? ind.stochK5dAgo.toFixed(1) : 'N/A'}) | %D: ${ind.stoch?.d != null ? ind.stoch.d.toFixed(1) : 'N/A'}
해석 참고: CCI가 -100 이하 극단에서 빠르게 회복 중이면(예: -180→-30) 기관 매수 유입 가능성. CCI +100 이상에서 급락 중이면 반대로 기관 매도 가능성. 스토캐스틱 %K가 20 미만에서 %D를 상향 돌파하면 단기 반등 신호, %K가 50을 넘으면 중립 구간 안착으로 본다.
` : '';

  // 피보나치 되돌림 섹션 (2026-07-13 2차 신설) — 외부 리포트가 SOXX 지지선
  // 판단의 핵심 근거로 씀. 자동 스윙탐지 기반이라 "참고용 보조 지표"임을
  // 명시해 Gemini가 이걸 유일한 절대 기준처럼 과신하지 않도록 한다.
  const fibSection = ind.fib ? `
[피보나치 되돌림(자동 스윙탐지 — 가장 최근에 완성된 스윙 구간 기준) — 참고용 보조 지표]
스윙 고점: ${fmt(ind.fib.high)} | 스윙 저점: ${fmt(ind.fib.low)} | 국면: ${ind.fib.direction === 'pullback_from_high' ? '고점 대비 눌림(되돌림) 중' : '저점 대비 반등 중'}
되돌림 레벨 — 0.236: ${fmt(ind.fib.levels['0.236'])} | 0.382: ${fmt(ind.fib.levels['0.382'])} | 0.5: ${fmt(ind.fib.levels['0.5'])} | 0.618: ${fmt(ind.fib.levels['0.618'])} | 0.786: ${fmt(ind.fib.levels['0.786'])} | 1.0(스윙 반대쪽 끝): ${fmt(ind.fib.levels['1'])}
현재 되돌림 진행률: ${ind.fib.retracedPct}%
해석 참고: 되돌림 진행률이 61.8~78.6% 구간이면 "깊은 되돌림"으로 스윙 반대쪽 끝(1.0 레벨, 직전 스윙 극점)이 다음 방어선일 수 있다. 이 지표는 자동 탐지된 스윙 기준이라 실제 차트의 주요 스윙과 다를 수 있는 보조 참고치임을 감안해서 말하되, 다른 지표(ADX·MACD·볼린저)와 겹치는 방향일 때만 근거로 강조하라.
` : '';

  // 4시간봉 섹션 (2026-07-09 신설) — Yahoo 60분봉 4개 롤링 집계 합성치.
  // 실패 시(fourHInd === null) 섹션 자체가 생략되며 나머지 판단에는 영향 없음.
  const fourHSection = fourHInd ? `
[4시간봉(합성) 지표 — 일봉과 주봉 사이의 단기 확인 시간대. 60분봉 4개 롤링 집계]
4H RSI(14): ${fourHInd.rsi != null ? fourHInd.rsi.toFixed(1) : 'N/A'} (5봉 전: ${fourHInd.rsi5BarsAgo != null ? fourHInd.rsi5BarsAgo.toFixed(1) : 'N/A'})
4H MACD 히스토그램: ${fourHInd.macdHist != null ? fourHInd.macdHist.toFixed(4) : 'N/A'} (5봉 전: ${fourHInd.macdHist5BarsAgo != null ? fourHInd.macdHist5BarsAgo.toFixed(4) : 'N/A'})
활용: 일봉·주봉과 이 4시간봉이 같은 방향(매수 우위 또는 매도 우위)으로 정렬되면 "다중 시간대 정렬"로 판단 신뢰도가 높아진다. 정렬 여부는 규칙 12(위장반등 체크리스트)의 higherTimeframeAligned에서 명시적으로 판정하라.
` : '';

  // 정량 엔진 기준선 (2026-07-09 신설) — calc_buy_score/calc_sell_score(계산식)가 이미 계산한
  // 매수 매력도/매도 압력. "스윙 시그널·스윙 전략" 탭이 보여주는 숫자와 이 AI 판단이 정면으로
  // 모순되는 걸 막기 위한 최소 가드레일이다. QQQ/VOO/TSLA/NVDA/DIA/IWM/SOXX만 존재(계산식 엔진이
  // 이 종목들만 다룸) — 그 외 티커는 quantBaseline이 null이라 이 섹션 자체가 생략된다.
  const quantSection = quantBaseline ? `
[정량 엔진 기준선 — 계산식 기반 매수 매력도/매도 압력. 반드시 참고하라]
정량 매수 매력도: ${quantBaseline.buyScore}/100 | 정량 매도 압력: ${quantBaseline.sellScore}/100 | Gear: ${quantBaseline.gear}
(스윙 시그널·스윙 전략 탭에 표시되는 것과 동일한 숫자다. 같은 화면에 다른 결론이 뜨면 사용자가 혼란스러워한다.)
` : '';

  // RSI/MACD 궤적 라벨 (프롬프트 가독성용)
  const rsiNow     = ind.rsi     != null ? ind.rsi.toFixed(1)       : 'N/A';
  const rsiPrev    = ind.rsi5dAgo != null ? ind.rsi5dAgo.toFixed(1) : 'N/A';
  const histNow    = ind.macd.histogram != null ? ind.macd.histogram.toFixed(4) : 'N/A';
  const histPrev   = ind.macdHist5d     != null ? ind.macdHist5d.toFixed(4)     : 'N/A';
  const volR       = ind.volRatio != null ? ind.volRatio.toFixed(2) : 'N/A';

  // 최근 5거래일 등락률 — 프롬프트 맥락용
  const recentReturnSection = (() => {
    const arr = ind.recentDailyReturns;
    if (!arr || arr.length === 0) return '';
    const labels = ['오늘(최근)', '어제', '2일 전', '3일 전', '4일 전'];
    const lines = arr.map((r, i) => {
      if (r == null) return `${labels[i]}: N/A`;
      const sign = r >= 0 ? '+' : '';
      return `${labels[i]}: ${sign}${r.toFixed(2)}%`;
    }).join(' | ');
    return `\n[최근 5거래일 일봉 변동률 — 반드시 이 흐름을 분석에 언급하라]\n${lines}\n`;
  })();

  // 판단 연속성 섹션 — 직전 3영업일 + 오늘 장중 판단 기록 (2026-07-03)
  const historySection = historyLines ? `
[직전 판단 기록 — 최근 3영업일 + 오늘 장중 (판단 연속성 필수)]
${historyLines}
연속성 규칙 (반드시 지켜라):
- 오늘 판단은 위 기록의 흐름 위에서 내려라. 처음 보는 종목처럼 서술하지 마라.
- action/stage가 직전 기록과 달라지면, reason에 무엇이 달라졌는지(어떤 지표·가격 변화 때문인지) 반드시 명시하라.
- 같은 판단이 이어지면 "N일 연속" 형태로 흐름을 서술하라.
- 단, 위 기록에 끌려가서 현재 데이터와 다른 판단을 내리지는 마라. 기록은 맥락이고, 판단 근거는 항상 오늘의 지표다.
` : '';

  // ── 수석 스윙 뷰 컨텍스트 (2026-07-31 신설) — 미국 시장 주식/ETF에만 주입 ────
  // 차트를 보는 이유는 스윙 트레이딩이다 — 종목 판독이 시장 전체 수석 판단의 맥락 위에서
  // 이뤄지게 한다. 정합이면 정합을, 모순이면 모순을 명시하게 해서 코너 간 "다른 소리"를
  // 숨기지 않고 드러낸다. KR/암호화폐는 미국 시장 수석 판단의 적용 대상이 아니라 제외.
  const chiefSection = (() => {
    if ((meta.market || 'us') !== 'us' || meta.type === 'crypto') return '';
    try {
      const sv = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'data', 'swing-view.json'), 'utf8'));
      if (!sv || !sv.comp || !sv.comp.stanceLabel) return '';
      const first = (sv.comp.commentary || [])[0] || '';
      return `
[수석 스윙 뷰 — 시장 전체 판단 맥락 (${sv.generatedAtKST} 기준)]
오늘 시장 스탠스: ${sv.comp.stanceLabel}${sv.flow ? ` | 판단 흐름: ${sv.flow}` : ''}
${first}
맥락 규칙 (반드시 지켜라):
- 위는 시장 전체(QQQ·VOO·SOXX 종합)에 대한 수석 판단이다. 이 종목의 기술적 판독이 같은 방향이면 그 정합을 한 문장으로 언급하라.
- 어긋나면 어긋난다는 사실과 "이 종목만의" 기술적 이유를 reason에 반드시 명시하라. 모순을 숨기지 마라.
- 단, 수석 판단에 끌려가서 이 종목의 지표와 다른 판단을 내리지는 마라. 판단 근거는 항상 이 종목의 오늘 지표다.
`;
    } catch (e) { return ''; }
  })();

  const prompt = `너는 15년 경력의 스윙 트레이더다. 분석가처럼 "~할 수 있다", "가능성이 있다"라고 얼버무리지 마라.
매번 하나의 방향을 정하고, 그 근거를 숫자로 대라. 확신이 없을 때는 "관망"이라고 말하고, 왜 관망인지 이유를 써라.

[절대 준수 사항]
- 오직 이동평균선, RSI, MACD, 볼린저밴드, 거래량, 가격 패턴 등 순수 기술적 지표만 사용하라.
- 기업 펀더멘털, 실적, 금리, 연준, 거시경제, 환율, 산업 트렌드, 규제, 정치적 요인은 절대 언급하지 마라.
${chiefSection}${historySection}${recentReturnSection}
[종목 정보]
${meta.context}

[일봉 가격]
현재가: ${fmt(price)} | 52주 고가: ${fmt(ind.high52)} | 52주 저가: ${fmt(ind.low52)} | 52주 위치: ${pos52}

[이동평균선]
SMA5: ${fmt(ind.sma5)} | SMA20: ${fmt(ind.sma20)} | SMA50: ${fmt(ind.sma50)} | SMA100: ${fmt(ind.sma100)} | SMA200: ${fmt(ind.sma200)}
현재가/SMA200: ${ind.sma200 ? ((price / ind.sma200 - 1) * 100).toFixed(2) + '%' : 'N/A'}
EMA10: ${fmt(ind.ema10)} | EMA20: ${fmt(ind.ema20)} | EMA50: ${fmt(ind.ema50)} | EMA200: ${fmt(ind.ema200)}
현재가/EMA50: ${ind.ema50 ? ((price / ind.ema50 - 1) * 100).toFixed(2) + '%' : 'N/A'} | 현재가/EMA200: ${ind.ema200 ? ((price / ind.ema200 - 1) * 100).toFixed(2) + '%' : 'N/A'}
(EMA는 SMA보다 최근 가격에 민감하게 반응한다 — SMA200 대비 EMA200 괴리가 크면 최근 추세 전환 가능성을 시사한다)
EMA 스택 정렬: 현재가 > EMA10 > EMA20 > EMA50 순으로 전부 위에 있으면 "완전 강세 정렬", 반대로 전부 아래면 "완전 약세 정렬" — 일부만 걸쳐 있으면 전환 국면으로 서술하라.

[ATR(14) — 평균실질변동폭, 변동성 참고용]
ATR: ${fmt(ind.atr)} (현재가 대비 ${ind.atr && price ? (ind.atr / price * 100).toFixed(2) + '%' : 'N/A'})
해석 참고: 손절선을 논할 때 "현재가 대비 절대적으로 가깝다/멀다"만 말하지 말고, ATR 대비 몇 배 거리인지도 함께 언급하면 변동성 대비 리스크 폭을 더 정확히 전달할 수 있다.

[RSI 궤적 — 숫자 하나로 말하지 마라, 방향을 봐라]
RSI(14) 현재: ${rsiNow}
RSI(14) 5일 전: ${rsiPrev}
RSI 14일 최저/최고: ${ind.rsi14dLow != null ? ind.rsi14dLow.toFixed(1) : 'N/A'} / ${ind.rsi14dHigh != null ? ind.rsi14dHigh.toFixed(1) : 'N/A'}

[MACD 궤적 — 히스토그램 방향이 핵심]
MACD: ${ind.macd.macd != null ? ind.macd.macd.toFixed(4) : 'N/A'} / 시그널: ${ind.macd.signal != null ? ind.macd.signal.toFixed(4) : 'N/A'}
히스토그램 현재: ${histNow} | 5일 전: ${histPrev}

[볼린저밴드 20,2]
상단: ${fmt(ind.bb.upper)} | 중단(SMA20): ${fmt(ind.bb.middle)} | 하단: ${fmt(ind.bb.lower)} | 밴드폭: ${ind.bb.bandwidth != null ? (ind.bb.bandwidth * 100).toFixed(2) + '%' : 'N/A'}

[가격 패턴 진단용]
5일 고가/저가: ${fmt(ind.high5d)} / ${fmt(ind.low5d)}
20일 고가/저가: ${fmt(ind.high20d)} / ${fmt(ind.low20d)}

[거래량]
5일 평균 대비 거래량 비율: ${volR}

[지지/저항]
스윙 저항: ${fmt(swing.resistance)} | 스윙 지지: ${fmt(swing.support)}
피벗(PP): ${fmt(pivot.pp)} | R1: ${fmt(pivot.r1)} | R2: ${fmt(pivot.r2)} | S1: ${fmt(pivot.s1)} | S2: ${fmt(pivot.s2)}
${weeklySection}${adxSection}${cciStochSection}${fibSection}${fourHSection}${quantSection}
[판단 규칙 — 반드시 지켜라]

1. action은 "매수" / "매도" / "관망" 중 하나만. "매수 우위지만 관망" 같은 혼합 금지.

2. RSI 궤적으로 판단:
   - 과매도 탈출 (30~45권 → 50 이상 회복): 매수 점수
   - 과매수 냉각 (70 이상 → 60 이하): 매도 점수
   - 중립 구간 횡보: 방향성 결여, 관망 가중
   rsiTrajectory에 반드시 "${rsiPrev} → ${rsiNow} (해석)" 형식으로 써라.

3. MACD 히스토그램 궤적으로 판단:
   - 음수지만 개선 중(+방향): 바닥 다지는 중, 매수 준비
   - 양수지만 악화 중(-방향): 강세 꺾임, 매도 준비
   macdTrajectory에 반드시 "히스토 ${histPrev} → ${histNow} (개선/악화/유지)" 형식으로 써라.

4. 가격 패턴 진단:
   - 5일 저가 > 20일 저가 * 1.005 → Higher Low → 회복 신호 → 매수 점수
   - 5일 고가 < 20일 고가 * 0.995 → Lower High → 약화 신호 → 매도 점수
   - 둘 다 아니면 → 횡보 → 관망 가능성

5. 볼린저밴드 리스크:
   - 현재가 하단~중단 + RSI 상승 중 → 매수 기회
   - 현재가 상단~중단 + RSI 하락 중 → 매도 기회
   - 중단 부근 횡보 → 방향성 결여

6. 거래량:
   - vol_ratio > 1.3: 움직임에 힘 (방향 신뢰도 상승)
   - vol_ratio < 0.7: 무기력한 움직임 (신뢰도 하락)

7. 주봉-일봉 충돌 시: 결론은 일봉 기준. weeklyConflict에 충돌 내용 명시.

8. entry/stop/target/invalidation 4개는 반드시 0이 아닌 실제 가격 숫자여야 한다 (절대 0 반환 금지 —
   0은 "레벨 없음"이 아니라 화면에 "$0.00"로 그대로 노출된다). action="관망"이라 확신이 낮아도
   위에 주어진 스윙 지지/저항, 피벗(PP/R1/R2/S1/S2) 중 현재가에 가장 가까운 값을 그대로 가져다
   채워라 — 새로 추정하지 말고 이미 계산된 레벨을 재사용하면 된다.

9. ADX가 20 미만인데 며칠 새 급락/급등이 있었다면, keyPoints나 riskNote 중 하나에
   반드시 "ADX ${ind.adx?.adx != null ? ind.adx.adx.toFixed(1) : 'N/A'}로 추세 미형성 — 충격성 변동 가능성"
   같은 형태로 ADX 근거를 명시하라. 방향성(DI)이 강해 보인다고 해서 추세로 단정하지 마라.

10. buyScore(1~10)는 매수와 매도를 하나로 잇는 연속 척도다 (매수/매도 각각의 별도 점수가 아니다).
    반드시 아래 5구간 중 하나에 들어맞게 매겨라: 8~10=강한 매수 신호 · 6~7=매수 우위 ·
    4~5=중립/관망 · 2~3=매도 우위 · 1=강한 매도 신호.
    action="매수"면 buyScore는 6 이상, action="매도"면 buyScore는 4 이하, action="관망"이면
    4~6 사이여야 한다. action과 buyScore가 서로 모순되면(예: action="매도"인데 buyScore=8)
    절대 안 된다.

11. [정량 엔진 기준선]이 위에 주어졌다면 (없으면 이 규칙은 무시하라):
    - 정량 매수 매력도가 70 이상이면 action을 "매도"로 결론내지 마라 ("매수" 또는 "관망"만 가능).
    - 정량 매도 압력이 70 이상이면 action을 "매수"로 결론내지 마라 ("매도" 또는 "관망"만 가능).
    - 그 외 구간에서는 정량 점수와 다른 action을 내려도 된다. 단, reason 맨 앞에 반드시
      "정량 매수 {N}점과 달리 관망/매도로 보는 이유:" 형태로 왜 다르게 판단했는지 명시하라
      (ADX 무추세, 주봉 충돌, 거래량 부재 등 정량 엔진이 못 보는 근거를 대라).
      같은 화면(스윙 전략 탭)에 정량 점수와 네 판단이 나란히 노출된다는 걸 명심하라.

12. [위장반등 vs 진짜반등 체크리스트 — 2026-07-09 신설] 유저가 공유한 외부 TradingView
    분석 리포트에서 실전 검증된 판별 프레임을 이식한 것이다. confluenceChecklist에
    아래 5개 조건을 각각 true/false로 판정하고 몇 개 충족했는지 세라:
    - volumeConfirmed: 거래량비(vol_ratio)가 1.2 이상인가
    - resistanceReclaimed: 상승 국면이면 현재가가 피벗 R1 또는 스윙 저항을 상회/안착했는가,
      하락 국면이면 반대로 지지선(피벗 S1 또는 스윙 지지) 붕괴 여부로 판정
    - adxLowRisk: ADX가 50 미만인가 (과열된 추세·소멸 경계에 아직 도달 안 함)
    - higherTimeframeAligned: 주봉과 4시간봉(주어졌다면)이 일봉과 같은 방향(매수 우위 또는
      매도 우위)으로 정렬됐는가. 4시간봉 데이터가 없으면 주봉 정렬 여부만으로 판정하라.
    - oversoldExtremeOrigin: CCI가 최근 -100 이하(상승 국면 판정 시) 또는 +100 이상(하락
      국면 판정 시)의 극단을 찍었다가 되돌아오는 중이거나, 스토캐스틱 %K가 20 미만에서 %D를
      상향 돌파(또는 80 초과에서 하향 돌파)했는가
    5개 중 4개 이상 충족 = "진짜 반등/추세 가능성 높음", 2~3개 = "초기 단계 — 확인 관문 남음",
    0~1개 = "위장 가능성 — 신중 필요". verdict 필드에 이 셋 중 하나를 그대로 써라. score
    필드에는 "N/5" 형태로 충족 개수를 명시하라. 이 체크리스트는 방향(매수/매도) 판단 자체를
    바꾸지 않는다 — 이미 내린 action의 "신뢰도"를 보여주는 보조 지표다.

13. [영어 병기 — 2026-07-29 신설] scoreReasonEn / keyPointsEn / continuityEn / narrativeEn /
    patternNoteEn / riskNoteEn 6개 필드에 대응하는 한국어 필드와 "같은 판단·같은 근거"를
    영어로도 작성하라. 절대 규칙:
    - 직역(word-for-word)이 아니라 미국 개인 투자자가 자연스럽게 읽는 관용적 영어로 다시 써라.
    - 티커, 숫자, 달러 금액, RSI/MACD/ADX 같은 기술적 지표 약어는 그대로 유지(번역·의역 금지).
    - 한국어판과 다른 결론·다른 숫자를 절대 넣지 마라 — 같은 판단의 영어 버전이어야 한다.
    - trend/action/stage/rsiStatus/macdStatus/bbStatus/pricePattern/bbPosition/weeklyConflict는
      고정된 한국어 단어 중 하나이므로 영어 버전을 만들지 않는다 (화면에서 별도 처리).
    - narrativeEn도 narrative와 동일하게 [Trend Position]/[Momentum Indicators]/
      [Support & Resistance]/[Volume & Conclusion] 4개 섹션, 각 항목은 "·"로 시작, 섹션당
      2~3개 항목 구조를 유지하되 문장은 자연스러운 영어 서술형으로 써라(한국어처럼 명사형
      종결을 강제하지 않는다 — 영어는 자연스러운 완결 문장이 더 읽기 좋다).

다음 JSON만 반환하라. 다른 텍스트는 절대 붙이지 마라:
{
  "trend": "강세" | "약세" | "횡보",
  "strength": 1~5 정수,
  "support": 핵심 지지가 숫자,
  "resistance": 핵심 저항가 숫자,
  "rsiStatus": "과매수" | "중립" | "과매도",
  "macdStatus": "골든크로스" | "데드크로스" | "강세확산" | "약세수렴" | "중립",
  "bbStatus": "상단돌파" | "상단접근" | "중단" | "하단접근" | "하단이탈",
  "stage": "상승추세" | "분배구간" | "하락추세" | "축적구간",
  "action": "매수" | "매도" | "관망",
  "buyScore": 1~10 정수 (규칙 10의 5구간·action 일치 기준 준수),
  "scoreReason": "buyScore 이유 15~25자 (예: 'RSI 과매도탈출+Higher Low 회복 초입', 'MACD 악화+Lower High 하락 초입')",
  "scoreReasonEn": "scoreReason의 자연스러운 영어 버전 (규칙 13 참조, 15~25자 제한 없음, 한 짧은 구절)",
  "rsiTrajectory": "${rsiPrev} → ${rsiNow} (과매도탈출/과매수냉각/중립지속 중 택1)",
  "rsiTrajectoryEn": "rsiTrajectory의 영어 버전 (숫자·화살표는 그대로, 괄호 안 표현만 자연스러운 영어로: exiting oversold/cooling from overbought/staying neutral 등)",
  "macdTrajectory": "히스토 ${histPrev} → ${histNow} (개선/악화/유지 중 택1)",
  "macdTrajectoryEn": "macdTrajectory의 영어 버전 (숫자·화살표는 그대로, 괄호 안 표현만 자연스러운 영어로: improving/worsening/holding steady 등)",
  "pricePattern": "Higher Low 또는 Lower High 또는 횡보 — 설명 한 줄",
  "pricePatternEn": "pricePattern의 자연스러운 영어 버전 (Higher Low/Lower High 용어는 그대로 유지, 설명 문구만 영어로)",
  "volComment": "거래량비 ${volR} (급증/정상/위축 중 택1)",
  "bbPosition": "상단근처" | "중단근처" | "하단근처",
  "reason": "판단 근거 2~3줄 (숫자 포함, 가장 강한 근거만)",
  "reasonEn": "reason의 자연스러운 영어 버전 (규칙 13 참조)",
  "entry": 진입가 숫자,
  "stop": 손절가 숫자,
  "target": 목표가 숫자,
  "invalidation": 무효선 숫자,
  "weeklyConflict": "충돌 없음" 또는 "주봉은 XXX이나 일봉 신호 우선",
  "weeklyConflictEn": "weeklyConflict의 영어 버전 (충돌 없으면 'No conflict', 있으면 자연스러운 영어 문장)",
  "profitTarget1": 1차 익절 목표가 숫자,
  "profitTarget2": 2차 익절 목표가 숫자,
  "stopLoss": 손절 기준가 숫자,
  "narrative": "반드시 단일 문자열(string)로 작성하라. JSON object나 배열로 반환하면 절대 안 된다. 아래 4개 섹션을 \\n으로 구분된 하나의 string 안에 모두 담아라. 섹션 제목은 대괄호로 감싸라([추세 위치] 형태). 각 항목은 · 으로 시작. 문장 끝은 서술어 없이 명사형으로 끝맺기 (예: '~구간', '~확인', '~진단', '~수준'). '~할 수 있다', '~가능성', '~예상', '~전망' 절대 금지. 항목마다 숫자값 필수 포함. 각 항목은 충분한 해석이 담긴 한 문장 — 너무 짧아서 의미 파악이 안 될 정도로 짧게 쓰지 마라. 섹션당 2~3개 항목.\n\n[추세 위치]\n· 현재가($숫자) vs SMA5/20/50($숫자/$숫자/$숫자) — 단기·중기 추세 위치 진단 + 상회/하회 여부\n· SMA100/200($숫자/$숫자) 대비 위치 — 중장기 추세 강도 판단\n· 52주 위치(%숫자) + 현 가격대 역사적 의미\n[모멘텀 지표]\n· RSI 궤적 (이전값→현재값) + 과매수/과매도/중립 판단 + 방향성 해석\n· MACD 히스토그램 궤적 (이전값→현재값) + 개선/악화 진단 + 추세 전환 신호 여부\n· 볼린저밴드 현재가 위치 (상단/중단/하단 $숫자) + 밴드폭 수준 해석\n[지지·저항 구조]\n· 스윙 지지선 ($숫자) + 근거 (피벗/스윙저점/이동평균 기반)\n· 스윙 저항선 ($숫자) + 돌파 시 의미\n· 5일/20일 고가·저가 패턴 (Higher Low / Lower High / 횡보) + 추세 해석\n[거래량·결론]\n· 거래량 비율 (5일 평균 대비 숫자배) + 움직임의 신뢰도 판단\n· 현 구간 진단 (축적/분배/상승추세/하락추세) + 진입·관망 조건 명시",
  "narrativeEn": "narrative의 영어 버전 (규칙 13 참조). [Trend Position]/[Momentum Indicators]/[Support & Resistance]/[Volume & Conclusion] 4개 섹션, 각 섹션 2~3개 항목, 항목은 '· '로 시작, 자연스러운 완결 문장, 숫자·달러 금액 반드시 포함, 단일 string으로 \\n 구분",
  "patternNote": "차트 패턴 또는 추세 채널 1~2문장",
  "patternNoteEn": "patternNote의 자연스러운 영어 버전",
  "keyPoints": ["핵심 포인트 1", "핵심 포인트 2", "핵심 포인트 3"],
  "keyPointsEn": ["keyPoints[0]의 영어 버전", "keyPoints[1]의 영어 버전", "keyPoints[2]의 영어 버전"],
  "riskNote": "기술적 리스크 한 문장",
  "riskNoteEn": "riskNote의 자연스러운 영어 버전",
  "continuity": "${historyLines ? "직전 판단 기록 대비 오늘의 흐름 1~2문장. 판단 유지면 'N일 연속 ~' 형태, 판단 전환이면 전환 이유(지표 변화)를 숫자와 함께 명시" : "기록 없음 — 첫 판단"}",
  "continuityEn": "continuity의 자연스러운 영어 버전 (예: 'N-day streak of ~' 또는 전환 이유 설명, 기록 없으면 'No prior record — first read')",
  "confluenceChecklist": {
    "volumeConfirmed": true 또는 false,
    "resistanceReclaimed": true 또는 false,
    "adxLowRisk": true 또는 false,
    "higherTimeframeAligned": true 또는 false,
    "oversoldExtremeOrigin": true 또는 false,
    "score": "N/5 형태 문자열",
    "verdict": "진짜 반등/추세 가능성 높음" | "초기 단계 — 확인 관문 남음" | "위장 가능성 — 신중 필요"
  }
}`;

  // 단일 모델 호출 (최대 4회 재시도, 지수 백오프: 5s → 15s → 45s)
  // gemini-2.5-flash는 thinking 토큰으로 인해 간헐적 타임아웃 발생 → 긴 딜레이로 model 재시도 효과
  async function _callWithModel(model) {
    const MAX_TRIES = 4;
    const DELAYS = [5000, 15000, 45000];

    for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
      try {
        const resp = await httpPost(
          GEMINI_HOST,
          `/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
          {
            contents: [{ parts: [{ text: prompt }] }],
            // 2026-07-29: 8192 → 16384 — narrative 등 6개 필드에 영어(En) 병기본이 추가되며
            // 출력량이 늘어남. CLAUDE.md 기록상 4096→8192로 올려 JSON 잘림을 해결한 전례가
            // 있어(narrative 단일 필드만으로도 절단 발생했었음), 이번엔 필드 수가 두 배가
            // 되므로 여유를 넉넉히 둔다. gemini-2.5-flash-lite는 이 값을 지원한다.
            generationConfig: { temperature: 0.15, maxOutputTokens: 16384, responseMimeType: 'application/json', thinkingConfig: { thinkingBudget: 0 } },
          }
        );
        // thinking 토큰 처리 (gemini-2.5-flash): thought:true 파트는 제외하고 실제 응답만 추출
        const parts = resp?.candidates?.[0]?.content?.parts || [];
        const text = parts.filter(p => !p.thought).map(p => p.text || '').join('');
        if (!text) {
          // 실제 Gemini 에러 메시지 추출
          const apiErr = resp?.error?.message;
          const blockReason = resp?.promptFeedback?.blockReason;
          const finishReason = resp?.candidates?.[0]?.finishReason;
          const detail = apiErr || blockReason || (finishReason ? `finishReason=${finishReason}` : null) || JSON.stringify(resp).slice(0, 300);
          throw new Error(`JSON 미포함 응답 [${detail}]`);
        }
        const m = text.match(/\{[\s\S]*\}/);
        if (!m) throw new Error(`JSON 미포함 응답 [text=${text.slice(0,200)}]`);
        const result = JSON.parse(m[0]);
        if (attempt > 1) console.log(`  Gemini 재시도 성공 (${meta.symbol}, ${model}, ${attempt}회차)`);
        return result;
      } catch (e) {
        // 모델 deprecated/404 에러는 재시도 없이 즉시 null 반환
        if (e.message.includes('no longer available') || e.message.includes('404')) {
          console.error(`  Gemini 모델 미지원 (${meta.symbol}): ${model} — ${e.message}`);
          return null;
        }
        if (attempt < MAX_TRIES) {
          console.warn(`  Gemini 오류 (${meta.symbol}, ${attempt}/${MAX_TRIES}, ${model}): ${e.message} — ${DELAYS[attempt-1]/1000}초 후 재시도`);
          await new Promise(r => setTimeout(r, DELAYS[attempt - 1]));
        } else {
          console.error(`  Gemini 최종 실패 (${meta.symbol}, ${model}): ${e.message}`);
          return null;
        }
      }
    }
  }

  // gemini-2.5-flash 단독 사용 (v1beta 1.5계열 전부 404 — 2026-06-26 확인)
  return await _callWithModel(GEMINI_MODEL);
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
  const sma5A   = sma(closes, 5);
  const sma20A  = sma(closes, 20);
  const sma50A  = sma(closes, 50);
  const sma100A = sma(closes, 100);
  const sma200A = sma(closes, 200);
  // 2026-07-13: EMA50/EMA200 추가 — SMA와 달리 최근 가격에 더 민감하게
  // 반응하는 지수이동평균. 외부 TradingView 리포트가 "vs EMA50/EMA200"을
  // 표준 트렌드 판정 지표로 쓰길래 동일 어휘로 맞춘다. ema() 헬퍼는 기존에
  // MACD 내부 계산용으로만 쓰이던 것을 재사용(신규 함수 추가 없음).
  const ema50A  = ema(closes, 50);
  const ema200A = ema(closes, 200);
  // 2026-07-14(3차): EMA10/EMA20 추가 — 외부 리포트의 "EMA 스택"(10<20<50<SMA200
  // 정렬 여부로 단기~장기 추세 강도를 한눈에 보는 서술) 재현용.
  const ema10A  = ema(closes, 10);
  const ema20A  = ema(closes, 20);
  const atrA    = atr(highs, lows, closes, 14);
  const rsiA    = rsi(closes, 14);
  const macdA   = macd(closes, 12, 26, 9);
  const bbA     = bollingerBands(closes, 20, 2);
  const adxA    = adx(highs, lows, closes, 14);
  const cciA    = cci(highs, lows, closes, 20);
  const stochA  = stochastic(highs, lows, closes, 14, 3);
  const volumes  = raw.map(d => d.v);

  // regularMarketPrice = Yahoo Finance 실시간 현재가 (정확)
  const price   = mta.regularMarketPrice ?? closes[n - 1];

  // 52주 고저가: Yahoo Finance 공식 값 우선, 없으면 2년 OHLCV에서 계산
  // — 이상값 방어: low52가 현재가의 30% 미만이면 OHLCV 계산값으로 대체
  let high52 = mta.fiftyTwoWeekHigh ?? Math.max(...highs);
  let low52  = mta.fiftyTwoWeekLow  ?? Math.min(...lows);

  // 이상값 필터 — 분할/병합 이전 데이터 오염 대응
  const calcHigh52 = Math.max(...highs);
  const calcLow52  = Math.min(...lows);
  if (price > 0) {
    // 야후 공식 값이 현재가 대비 너무 낮거나 높으면 계산값으로 교체
    if (low52  < price * 0.25)  low52  = Math.min(...lows.filter(l  => l  > price * 0.25));
    if (high52 > price * 5)     high52 = Math.max(...highs.filter(h => h < price * 5));
    // 계산값도 이상하면 현재가 기준으로 최소한 보정
    if (!isFinite(low52)  || low52  <= 0) low52  = price * 0.7;
    if (!isFinite(high52) || high52 <= 0) high52 = price * 1.3;
  }

  // 궤적 지표 계산 (5일 전 vs 현재)
  const rsi5dAgo    = n > 5  ? (rsiA[n - 6]              ?? null) : null;
  const rsi14dVals  = rsiA.slice(Math.max(0, n - 14)).filter(v => v != null);
  const rsi14dLow   = rsi14dVals.length ? Math.min(...rsi14dVals) : null;
  const rsi14dHigh  = rsi14dVals.length ? Math.max(...rsi14dVals) : null;
  const macdHist5d  = n > 5  ? (macdA[n - 6]?.histogram  ?? null) : null;
  const high5d      = n >= 5  ? Math.max(...highs.slice(n - 5))  : Math.max(...highs);
  const low5d       = n >= 5  ? Math.min(...lows.slice(n - 5))   : Math.min(...lows);
  const high20d     = n >= 20 ? Math.max(...highs.slice(n - 20)) : Math.max(...highs);
  const low20d      = n >= 20 ? Math.min(...lows.slice(n - 20))  : Math.min(...lows);
  const vol5dAvg    = volumes.slice(Math.max(0, n - 6), n - 1).reduce((a, b) => a + (b || 0), 0) / 5;
  const volRatio    = vol5dAvg > 0 ? round(volumes[n - 1] / vol5dAvg, 2) : null;
  const adx5dAgo    = n > 5 ? (adxA[n - 6]?.adx ?? null) : null;
  const cci5dAgo    = n > 5 ? (cciA[n - 6] ?? null) : null;
  const stochK5dAgo = n > 5 ? (stochA[n - 6]?.k ?? null) : null;

  const indicators = {
    sma5:  sma5A[n - 1],
    sma20:  sma20A[n - 1],
    sma50:  sma50A[n - 1],
    sma100: sma100A[n - 1],
    sma200: sma200A[n - 1],
    ema50:  ema50A[n - 1],
    ema200: ema200A[n - 1],
    ema10:  ema10A[n - 1],
    ema20:  ema20A[n - 1],
    atr:    atrA[n - 1],
    rsi:    rsiA[n - 1],
    rsi5dAgo, rsi14dLow, rsi14dHigh,
    macd:   macdA[n - 1],
    macdHist5d,
    bb:     bbA[n - 1],
    adx:    { ...adxA[n - 1], status: classifyADX(adxA[n - 1]?.adx) },
    adx5dAgo,
    cci: cciA[n - 1], cci5dAgo,
    stoch: stochA[n - 1], stochK5dAgo,
    high52, low52,
    high5d, low5d, high20d, low20d,
    volRatio,
  };

  // 최근 5거래일 일봉 변동률 — [0]=오늘, [1]=어제, [2]=2일전, ...
  const recentDailyReturns = [];
  for (let i = 0; i < Math.min(5, n - 1); i++) {
    const curr = closes[n - 1 - i];
    const prev = closes[n - 2 - i];
    recentDailyReturns.push(prev > 0 ? +((curr - prev) / prev * 100).toFixed(2) : null);
  }
  indicators.recentDailyReturns = recentDailyReturns;

  // 3. 지지/저항
  const swing = findSwingLevels(highs, lows, closes);
  const pivot = pivotPoints(highs, lows, closes);
  const fib   = fibRetracement(highs, lows, closes);
  indicators.fib = fib;

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
    // 2026-07-13(2차): 주봉 ADX 추가 — 기존엔 주봉 RSI/MACD/SMA만 있고
    // 추세강도(ADX)는 일봉에만 있었다. 외부 리포트가 "1W ADX 40.3"을
    // 주간 추세 건재 여부의 핵심 근거로 쓰길래 동일 지표를 보강한다.
    const wAdxA    = adx(wHighs, wLows, wCloses, 14);
    weeklyInd = {
      sma20:  wSma20A[wN - 1],
      sma50:  wSma50A[wN - 1],
      sma100: wSma100A[wN - 1],
      sma200: wSma200A[wN - 1],
      rsi:    wRsiA[wN - 1],
      macd:   wMacdA[wN - 1],
      bb:     wBbA[wN - 1],
      adx:    { ...wAdxA[wN - 1], status: classifyADX(wAdxA[wN - 1]?.adx) },
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

  // 4-b. 4시간봉(합성) — 실패해도 무시하고 계속 진행 (fail-safe, 2026-07-09 신설)
  let fourHInd = null;
  try {
    const intraday = await fetchYFIntraday(symbol);
    if (intraday) {
      const iQuote = intraday.indicators.quote[0];
      const iAdj   = intraday.indicators.adjclose?.[0]?.adjclose;
      const rawHourly = intraday.timestamp.map((t, i) => ({
        t,
        o: iQuote.open[i], h: iQuote.high[i], l: iQuote.low[i],
        c: iAdj?.[i] ?? iQuote.close[i], v: iQuote.volume[i] ?? 0,
      })).filter(d => d.o != null && d.h != null && d.l != null && d.c != null);
      const raw4H = aggregate4H(rawHourly);
      if (raw4H.length >= 20) {
        const c4  = raw4H.map(d => d.c);
        const n4  = c4.length;
        const rsi4  = rsi(c4, 14);
        const macd4 = macd(c4, 12, 26, 9);
        fourHInd = {
          rsi:            rsi4[n4 - 1],
          rsi5BarsAgo:    n4 > 5 ? (rsi4[n4 - 6] ?? null) : null,
          macdHist:       macd4[n4 - 1]?.histogram ?? null,
          macdHist5BarsAgo: n4 > 5 ? (macd4[n4 - 6]?.histogram ?? null) : null,
          barsUsed: n4,
        };
      }
    }
  } catch (e) {
    console.warn(`  4시간봉 조회 실패(${symbol}, 무시하고 계속): ${e.message}`);
  }

  // 5. Gemini AI 분석 — 판단 원장에서 직전 3영업일 기록을 읽어 연속성 컨텍스트로 주입
  const ledger       = loadLedger();
  const historyLines = ledgerContextLines(ledger, symbol);
  const quantBaseline = quantBaselineFor(symbol);
  let aiResult = await callGemini(meta, indicators, swing, pivot, price, weeklyInd, historyLines, quantBaseline, fourHInd);
  aiResult = sanitizeTradeLevels(aiResult, price, swing, pivot, symbol);

  // 판단 원장 기록 — Gemini 신규 판단 성공 시에만 (실패 시 기존 분석 보존 경로는 기록하지 않음)
  if (aiResult && aiResult.action) {
    try {
      const summaryLine = [
        `$${round(price, 2)}`,
        indicators.rsi != null ? `RSI ${round(indicators.rsi, 1)}` : null,
        `${aiResult.action}${aiResult.buyScore != null ? `(매수점수 ${aiResult.buyScore})` : ''}`,
        aiResult.stage || null,
        aiResult.scoreReason || null,
      ].filter(Boolean).join(' · ').slice(0, 120);
      appendLedger(ledger, symbol, summaryLine);
      saveLedger(ledger);
    } catch (e) { console.warn(`  판단 원장 기록 실패 (${symbol}): ${e.message}`); }
  }

  // 6. 장외 시세 (프리마켓 / 포스트마켓)
  // 한국 주식(.KS): Yahoo Finance v8 API가 marketState를 누락하는 경우가 많아 'CLOSED' 폴백으로 오표시
  // → 스크립트 실행 시각의 UTC를 기준으로 KRX 장 상태(09:00~15:30 KST = 00:00~06:30 UTC) 직접 계산
  function getKRXMarketState() {
    const now = new Date();
    const day = now.getUTCDay(); // 0=일 1=월..5=금 6=토
    const totalMinUTC = now.getUTCHours() * 60 + now.getUTCMinutes();
    if (day >= 1 && day <= 5 && totalMinUTC >= 0 && totalMinUTC < 390) return 'REGULAR'; // 390분 = 6h30m
    return 'CLOSED';
  }
  // 미국 주식: Yahoo Finance v8 API가 marketState를 누락하는 경우 시간 기반으로 직접 계산
  // 프리마켓 04:00~09:30 ET, 정규장 09:30~16:00 ET, 포스트마켓 16:00~20:00 ET
  function getUSMarketState() {
    const now = new Date();
    const etStr = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
    const et = new Date(etStr);
    const day = et.getDay(); // 0=일, 6=토
    if (day === 0 || day === 6) return 'CLOSED';
    const totalMin = et.getHours() * 60 + et.getMinutes();
    if (totalMin >= 240 && totalMin < 570)  return 'PRE';     // 04:00~09:30 ET
    if (totalMin >= 570 && totalMin < 960)  return 'REGULAR'; // 09:30~16:00 ET
    if (totalMin >= 960 && totalMin < 1200) return 'POST';    // 16:00~20:00 ET
    return 'CLOSED';
  }
  const isKRSymbol = symbol.endsWith('.KS') || symbol.endsWith('.KQ');
  const marketState = isKRSymbol
    ? (mta.marketState || getKRXMarketState())
    : (mta.marketState || getUSMarketState());
  // regularMarketPreviousClose = 실제 전일 종가 (v8 API 기준)
  // chartPreviousClose는 차트 시작 시점(2년 전) 종가이므로 절대 사용 불가
  const prevClose   = mta.regularMarketPreviousClose || mta.previousClose || (n >= 2 ? closes[n - 2] : null);
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
      adx:    indicators.adx,
    },
    levels: {
      swingResistance: swing.resistance ? round(swing.resistance, 4) : null,
      swingSupport:    swing.support    ? round(swing.support,    4) : null,
      pivot,
    },
    analysis: (() => {
      // Gemini 성공 → 새 분석 사용
      if (aiResult) return aiResult;

      // Gemini 실패 → 기존 파일에 유효한 분석이 있으면 보존 (플레이스홀더로 덮어쓰지 않음)
      const existingPath = path.join(DATA_DIR, `analysis-${safeSymbol}.json`);
      try {
        if (fs.existsSync(existingPath)) {
          const prev = JSON.parse(fs.readFileSync(existingPath, 'utf8'));
          const prevNarrative = prev?.analysis?.narrative ?? '';
          if (prevNarrative && prevNarrative !== 'AI 분석 데이터를 불러오는 중입니다.' && prevNarrative.length > 30) {
            console.warn(`  Gemini 실패 — 기존 분석 보존: ${symbol} (${prev.updatedAt ?? '날짜미상'})`);
            return prev.analysis;
          }
        }
      } catch (e) { /* 기존 파일 읽기 실패 — 폴백 사용 */ }

      // 기존 유효 데이터 없음 → 폴백
      return {
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
        narrativeEn: 'Loading AI analysis data.',
        patternNote: null,
        patternNoteEn: null,
        keyPoints: [],
        keyPointsEn: [],
        riskNote: '',
        riskNoteEn: '',
        scoreReasonEn: null,
        continuityEn: '',
      };
    })(),
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

  // 현재 배치의 성공한 심볼 업데이트
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

  // TICKER_ORDER 기준으로 전체 인덱스 순서 재정렬
  // → 사이드바 표시 순서가 항상 TICKER_ORDER를 따름
  const ordered = {};
  TICKER_ORDER.forEach(sym => {
    if (idx[sym]) ordered[sym] = idx[sym];
  });
  // TICKER_ORDER에 없는 레거시 심볼은 마지막에 보존
  Object.entries(idx).forEach(([sym, val]) => {
    if (!ordered[sym]) ordered[sym] = val;
  });

  fs.writeFileSync(idxPath, JSON.stringify(ordered, null, 2));
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
