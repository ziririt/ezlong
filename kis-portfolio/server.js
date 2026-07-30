/**
 * KIS 포트폴리오 서버 — Node.js 내장 모듈만 사용
 * 실행: node server.js
 * 접속: http://localhost:4567
 */
const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = 4567;

/* ── .env.local 읽기 ── */
function loadEnv() {
  const envPath = path.join(__dirname, '.env.local');
  if (!fs.existsSync(envPath)) return {};
  const env = {};
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq > 0) env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return env;
}

const ENV = loadEnv();
const APP_KEY    = ENV.KIS_APP_KEY    || '';
const APP_SECRET = ENV.KIS_APP_SECRET || '';
const ACCOUNT_NO = ENV.KIS_ACCOUNT_NO || '';
const IS_MOCK    = ENV.KIS_IS_MOCK === 'true';
const BASE_URL   = IS_MOCK
  ? 'https://openapivts.koreainvestment.com:29443'
  : 'https://openapi.koreainvestment.com:9443';

/* ── 토큰 캐시 ── */
let tokenCache = null;

async function getToken() {
  if (tokenCache && Date.now() < tokenCache.expiresAt) return tokenCache.value;

  const res = await fetch(`${BASE_URL}/oauth2/tokenP`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credentials', appkey: APP_KEY, appsecret: APP_SECRET }),
  });
  if (!res.ok) throw new Error(`토큰 발급 실패 (${res.status})`);
  const d = await res.json();
  tokenCache = { value: d.access_token, expiresAt: Date.now() + (d.expires_in - 300) * 1000 };
  return tokenCache.value;
}

/* ── KIS GET 요청 ── */
async function kisGet(path, trId, params) {
  const token = await getToken();
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${BASE_URL}${path}?${qs}`, {
    headers: {
      'authorization': `Bearer ${token}`,
      'appkey': APP_KEY,
      'appsecret': APP_SECRET,
      'tr_id': trId,
      'custtype': 'P',
    },
  });
  if (!res.ok) throw new Error(`KIS API 오류 (${res.status}) [${trId}]`);
  const d = await res.json();
  if (d.rt_cd && d.rt_cd !== '0') throw new Error(`KIS 오류 (rt_cd=${d.rt_cd}): ${d.msg1}`);
  return d;
}

/* ── 계좌번호 파싱 ── */
function parseAccount(raw) {
  const parts = raw.split('-');
  if (parts.length !== 2) throw new Error(`계좌번호 형식 오류: ${raw} (예: 12345678-01)`);
  return { cano: parts[0], acnt: parts[1] };
}

/* ── 국내 잔고 조회 ── */
async function getDomestic(cano, acnt) {
  const trId = IS_MOCK ? 'VTTC8434R' : 'TTTC8434R';
  const items = [];
  let ctxFk = '', ctxNk = '';
  while (true) {
    const d = await kisGet('/uapi/domestic-stock/v1/trading/inquire-balance', trId, {
      CANO: cano, ACNT_PRDT_CD: acnt,
      AFHR_FLPR_YN: 'N', OFL_YN: '', INQR_DVSN: '02', UNPR_DVSN: '01',
      FUND_STTL_ICLD_YN: 'N', FNCG_AMT_AUTO_RDPT_YN: 'N', PRCS_DVSN: '00',
      CTX_AREA_FK100: ctxFk, CTX_AREA_NK100: ctxNk,
    });
    (d.output1 || []).filter(i => i.pdno?.trim() && Number(i.hldg_qty) > 0).forEach(i => {
      items.push({
        market: 'KR', exchange: 'KRX',
        symbol: i.pdno, name: i.prdt_name,
        quantity: +i.hldg_qty, avgPrice: +i.pchs_avg_pric,
        currentPrice: +i.prpr, marketValue: +i.evlu_amt,
        profitLoss: +i.evlu_pfls_amt, profitLossRate: +i.evlu_pfls_rt,
        currency: 'KRW',
      });
    });
    const nk = d.ctx_area_nk100?.trim();
    if (nk) { ctxFk = d.ctx_area_fk100 || ''; ctxNk = nk; } else break;
  }
  return items;
}

/* ── 해외 잔고 조회 (거래소별 병렬) ── */
async function getOverseas(cano, acnt) {
  const trId = IS_MOCK ? 'VTTS3012R' : 'TTTS3012R';
  const EXCHANGES = { NASD: 'USD', NYSE: 'USD', AMEX: 'USD', SEHK: 'HKD', TKSE: 'JPY' };
  const items = [];
  const warnings = [];
  const seen = new Set();

  await Promise.all(Object.entries(EXCHANGES).map(async ([ex, cur]) => {
    try {
      let ctxFk = '', ctxNk = '';
      while (true) {
        const d = await kisGet('/uapi/overseas-stock/v1/trading/inquire-balance', trId, {
          CANO: cano, ACNT_PRDT_CD: acnt,
          OVRS_EXCG_CD: ex, TR_CRCY_CD: cur,
          CTX_AREA_FK200: ctxFk, CTX_AREA_NK200: ctxNk,
        });
        (d.output1 || []).filter(i => i.ovrs_pdno?.trim() && Number(i.ord_psbl_qty) > 0).forEach(i => {
          const key = `${i.ovrs_pdno}:${ex}`;
          if (!seen.has(key)) {
            seen.add(key);
            items.push({
              market: 'US', exchange: ex,
              symbol: i.ovrs_pdno, name: i.ovrs_item_name,
              quantity: +i.ord_psbl_qty, avgPrice: +i.pchs_avg_pric,
              currentPrice: +i.now_pric2, marketValue: +i.frcr_evlu_amt2,
              profitLoss: +i.frcr_evlu_pfls_amt, profitLossRate: +i.evlu_pfls_rt,
              currency: cur,
            });
          }
        });
        const nk = d.ctx_area_nk200?.trim();
        if (nk) { ctxFk = d.ctx_area_fk200 || ''; ctxNk = nk; } else break;
      }
    } catch (e) {
      warnings.push(`${ex} 조회 실패: ${e.message}`);
    }
  }));

  return { items, warnings };
}

/* ── HTML 파일 읽기 ── */
function readHtml() {
  return fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
}

/* ── HTTP 서버 ── */
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // API 엔드포인트
  if (url.pathname === '/api/positions') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    try {
      if (!APP_KEY || !APP_SECRET) throw new Error('.env.local에 KIS_APP_KEY / KIS_APP_SECRET 가 없습니다.');
      if (!ACCOUNT_NO) throw new Error('.env.local에 KIS_ACCOUNT_NO 가 없습니다.');
      const { cano, acnt } = parseAccount(ACCOUNT_NO);
      const warnings = [];
      const [domestic, overseasResult] = await Promise.all([
        getDomestic(cano, acnt).catch(e => { warnings.push(`국내: ${e.message}`); return []; }),
        getOverseas(cano, acnt).catch(e => { warnings.push(`해외: ${e.message}`); return { items: [], warnings: [] }; }),
      ]);
      if (overseasResult.warnings?.length) warnings.push(...overseasResult.warnings);
      const positions = [...domestic, ...overseasResult.items]
        .sort((a, b) => b.marketValue - a.marketValue);
      res.writeHead(200);
      res.end(JSON.stringify({ ok: true, account: ACCOUNT_NO, fetchedAt: new Date().toISOString(), positions, warnings }));
    } catch (e) {
      res.writeHead(500);
      res.end(JSON.stringify({ ok: false, error: e.message, positions: [] }));
    }
    return;
  }

  // 메인 HTML 페이지
  if (url.pathname === '/' || url.pathname === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(readHtml());
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`\n✅ KIS 포트폴리오 서버 실행 중`);
  console.log(`   http://localhost:${PORT}\n`);
  if (!APP_KEY)    console.warn('⚠️  KIS_APP_KEY 없음 — .env.local 확인');
  if (!APP_SECRET) console.warn('⚠️  KIS_APP_SECRET 없음 — .env.local 확인');
  if (!ACCOUNT_NO) console.warn('⚠️  KIS_ACCOUNT_NO 없음 — .env.local 확인');
});
