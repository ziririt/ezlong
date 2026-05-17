#!/usr/bin/env node
/**
 * FlashAlpha SPY 옵션 시장 데이터 수집 스크립트 (GitHub Actions용)
 * FlashAlpha API → data/options-latest.json 저장
 *
 * 실행: FLASHALPHA_API_KEY=xxxx node scripts/fetch-flashalpha-spy.js
 *
 * 수집 항목:
 *   - GEX (Gamma Exposure): 시장 조성자의 헤지 방향 — 양수면 pin/안정, 음수면 가속 변동
 *   - Gamma Flip Level: 이 가격 위/아래에서 시장 성격 전환
 *   - Call Wall / Put Wall: 강한 저항·지지 레벨
 *   - DEX (Delta Exposure): 옵션 시장의 방향성 편향
 *   - SKEW: 꼬리 리스크 헤지 수요 — 높을수록 하방 공포 큼
 *   - VVIX: VIX의 변동성 — 높을수록 공포 급등 우려
 *   - VIX Term Structure: 콘탱고(단기<장기, 안정) vs 백워데이션(단기>장기, 공포)
 *
 * 요구사항: Node.js 18+ (내장 https 모듈만 사용, npm 패키지 불필요)
 */

'use strict';

const https = require('https');
const fs    = require('fs');
const path  = require('path');

// ─── 설정 ──────────────────────────────────────────────────────────────────
const API_KEY     = process.env.FLASHALPHA_API_KEY || 'vBdFDeCc45T1CpcggvAL7BE5MDCXXHKyvLHepciE';
const FA_HOST     = 'flashalpha.io';
const OUTPUT_PATH = path.join(__dirname, '..', 'data', 'options-latest.json');

// ─── 유틸 ──────────────────────────────────────────────────────────────────

const sleep = ms => new Promise(r => setTimeout(r, ms));

function httpGet(hostname, reqPath, headers = {}) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname,
      path: reqPath,
      method: 'GET',
      headers: {
        'User-Agent': 'ATMR-Dashboard/1.0',
        'Accept': 'application/json',
        ...headers,
      },
      timeout: 20000,
    };
    const req = https.request(options, res => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          console.warn(`  HTTP ${res.statusCode} for ${reqPath} — body: ${body.slice(0, 200)}`);
          resolve(null);  // 실패해도 전체 스크립트는 계속 실행
          return;
        }
        try { resolve(JSON.parse(body)); }
        catch (e) {
          console.warn(`  JSON 파싱 실패 (${reqPath}): ${e.message}`);
          resolve(null);
        }
      });
    });
    req.on('error', err => {
      console.warn(`  네트워크 오류 (${reqPath}): ${err.message}`);
      resolve(null);
    });
    req.on('timeout', () => {
      req.destroy();
      console.warn(`  타임아웃 (${reqPath})`);
      resolve(null);
    });
    req.end();
  });
}

// ─── FlashAlpha API 호출 ────────────────────────────────────────────────────

/**
 * SPY 옵션 스냅샷 — GEX, gamma flip, call/put walls, DEX
 * GET /api/v1/options/snapshot?symbol=SPY
 */
async function fetchOptionsSnapshot() {
  console.log('  [1/3] SPY 옵션 스냅샷 (GEX, gamma flip, walls)...');
  const data = await httpGet(
    FA_HOST,
    `/api/v1/options/snapshot?symbol=SPY`,
    { 'X-API-Key': API_KEY }
  );
  if (!data) return null;

  // 응답 구조 정규화 (FlashAlpha 실제 응답에 맞게 추출)
  // 가능한 최대한 많은 필드를 수용하도록 유연하게 파싱
  const snap = data.data || data.snapshot || data;
  return {
    spyPrice:      safeNum(snap.underlying_price || snap.spy_price || snap.price),
    netGEX:        safeNum(snap.net_gex || snap.gex || snap.gamma_exposure),
    gammaFlip:     safeNum(snap.gamma_flip || snap.flip_level || snap.gamma_flip_level),
    callWall:      safeNum(snap.call_wall || snap.major_resistance),
    putWall:       safeNum(snap.put_wall  || snap.major_support),
    netDEX:        safeNum(snap.net_dex || snap.delta_exposure),
    rawResponse:   data,  // 디버깅용 원본 보관
  };
}

/**
 * 매크로 / 변동성 지표 — SKEW, VVIX, VIX term structure
 * GET /api/v1/macro/volatility
 */
async function fetchVolatilityMacro() {
  console.log('  [2/3] 변동성 매크로 (SKEW, VVIX, VIX term structure)...');
  await sleep(1500);  // API rate limit 방지
  const data = await httpGet(
    FA_HOST,
    `/api/v1/macro/volatility`,
    { 'X-API-Key': API_KEY }
  );
  if (!data) return null;

  const macro = data.data || data;
  return {
    skew:          safeNum(macro.skew || macro.cboe_skew || macro.SKEW),
    vvix:          safeNum(macro.vvix || macro.VVIX),
    vix1m:         safeNum(macro.vix_1m || macro.vix || macro.VIX),
    vix3m:         safeNum(macro.vix_3m || macro.vix3m),
    vix6m:         safeNum(macro.vix_6m || macro.vix6m),
    termStructure: macro.term_structure || macro.termStructure || null,
    rawResponse:   data,
  };
}

/**
 * SPY 콜/풋 오픈 인터레스트 분포 (선택적 수집)
 * GET /api/v1/options/oi?symbol=SPY
 */
async function fetchOI() {
  console.log('  [3/3] SPY 오픈 인터레스트 분포...');
  await sleep(1500);
  const data = await httpGet(
    FA_HOST,
    `/api/v1/options/oi?symbol=SPY`,
    { 'X-API-Key': API_KEY }
  );
  if (!data) return null;

  const oi = data.data || data;
  return {
    callOI:    safeNum(oi.total_call_oi || oi.call_oi),
    putOI:     safeNum(oi.total_put_oi  || oi.put_oi),
    pcRatio:   safeNum(oi.put_call_ratio || oi.pc_ratio),
    rawResponse: data,
  };
}

// ─── 헬퍼 ──────────────────────────────────────────────────────────────────

function safeNum(v) {
  if (v === null || v === undefined) return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

/**
 * VIX Term Structure 방향 판정
 * contango  = 단기 VIX < 장기 VIX (정상, 안정)
 * backwardation = 단기 VIX > 장기 VIX (공포, 위험)
 * flat = 차이가 0.5 미만
 */
function calcTermStructureDirection(vix1m, vix3m) {
  if (vix1m === null || vix3m === null) return 'unknown';
  const diff = vix1m - vix3m;
  if (diff < -0.5) return 'contango';       // 단기 < 장기: 안정적
  if (diff > 0.5)  return 'backwardation';  // 단기 > 장기: 공포/위험
  return 'flat';
}

/**
 * 오버레이 점수 계산 (atmr-dashboard.html의 buyScore / sellScore에 ±조정값 제공)
 *
 * buyScore 조정:
 *   SPY > gammaFlip && netGEX > 0  → +8  (시장 조성자 상방 헤지, pin 효과)
 *   SPY ≤ gammaFlip && netGEX < 0  → -10 (하방 가속 구간)
 *   putWall 근처 (±1%)             → +5  (강한 지지)
 *   callWall 근처 (±1%)            → -5  (강한 저항)
 *   pcRatio > 1.2                  → +4  (과도한 풋 → 역발상 매수)
 *
 * sellScore 조정:
 *   callWall 근처 (±1%)            → +8  (저항선 근접, 매도 압박)
 *   SKEW > 145                     → +7  (꼬리 리스크 헤지 급증)
 *   VVIX > 120                     → +6  (변동성의 변동성 극단)
 *   backwardation                  → +10 (VIX term structure 위험 신호)
 *   contango                       → -4  (안정적 구조)
 *   netGEX < -1B                   → +6  (음의 GEX → 하방 가속 위험)
 */
function calcOverlay(snapshot, volMacro, oiData) {
  let buyAdj  = 0;
  let sellAdj = 0;
  const reasons = { buy: [], sell: [] };

  // ── GEX / Gamma Flip 기반 ─────────────────────────────────────────────
  if (snapshot && snapshot.spyPrice !== null && snapshot.gammaFlip !== null) {
    const aboveFlip = snapshot.spyPrice > snapshot.gammaFlip;
    const posGEX    = snapshot.netGEX !== null && snapshot.netGEX > 0;
    const negGEX    = snapshot.netGEX !== null && snapshot.netGEX < 0;

    if (aboveFlip && posGEX) {
      buyAdj  += 8;
      sellAdj -= 4;
      reasons.buy.push(`SPY(${snapshot.spyPrice}) > 감마 플립(${snapshot.gammaFlip}), 순GEX 양수 → 시장 안정 구간 +8`);
    } else if (!aboveFlip && negGEX) {
      buyAdj  -= 10;
      sellAdj += 8;
      reasons.sell.push(`SPY(${snapshot.spyPrice}) ≤ 감마 플립(${snapshot.gammaFlip}), 순GEX 음수 → 하방 가속 구간 +8`);
      reasons.buy.push(`하방 가속 구간 -10`);
    }

    // 극단적 음GEX (예: -1B 이하)
    if (snapshot.netGEX !== null && snapshot.netGEX < -1_000_000_000) {
      sellAdj += 6;
      reasons.sell.push(`순GEX < -1B (극단적 음수) → 하방 가속 위험 +6`);
    }
  }

  // ── Call Wall / Put Wall 근접도 ───────────────────────────────────────
  if (snapshot && snapshot.spyPrice !== null) {
    if (snapshot.callWall !== null) {
      const distPct = Math.abs(snapshot.spyPrice - snapshot.callWall) / snapshot.spyPrice * 100;
      if (distPct <= 1.0) {
        sellAdj += 8;
        buyAdj  -= 5;
        reasons.sell.push(`콜 월(${snapshot.callWall}) 1% 이내 근접 → 저항 압박 +8`);
      }
    }
    if (snapshot.putWall !== null) {
      const distPct = Math.abs(snapshot.spyPrice - snapshot.putWall) / snapshot.spyPrice * 100;
      if (distPct <= 1.0) {
        buyAdj  += 5;
        sellAdj -= 3;
        reasons.buy.push(`풋 월(${snapshot.putWall}) 1% 이내 근접 → 지지 강화 +5`);
      }
    }
  }

  // ── P/C Ratio (역발상) ────────────────────────────────────────────────
  if (oiData && oiData.pcRatio !== null) {
    if (oiData.pcRatio > 1.2) {
      buyAdj  += 4;
      reasons.buy.push(`P/C Ratio ${oiData.pcRatio.toFixed(2)} > 1.2 → 과도한 풋 (역발상 매수 신호) +4`);
    } else if (oiData.pcRatio < 0.7) {
      sellAdj += 4;
      reasons.sell.push(`P/C Ratio ${oiData.pcRatio.toFixed(2)} < 0.7 → 과도한 콜 (과열 경고) +4`);
    }
  }

  // ── SKEW / VVIX ──────────────────────────────────────────────────────
  if (volMacro) {
    if (volMacro.skew !== null) {
      if (volMacro.skew > 145) {
        sellAdj += 7;
        reasons.sell.push(`SKEW ${volMacro.skew.toFixed(1)} > 145 → 꼬리 리스크 헤지 급증 +7`);
      } else if (volMacro.skew > 135) {
        sellAdj += 3;
        reasons.sell.push(`SKEW ${volMacro.skew.toFixed(1)} > 135 → 꼬리 리스크 경계 +3`);
      } else if (volMacro.skew < 115) {
        buyAdj  += 3;
        reasons.buy.push(`SKEW ${volMacro.skew.toFixed(1)} < 115 → 하방 공포 완화 +3`);
      }
    }
    if (volMacro.vvix !== null) {
      if (volMacro.vvix > 120) {
        sellAdj += 6;
        reasons.sell.push(`VVIX ${volMacro.vvix.toFixed(1)} > 120 → 변동성 급등 위험 +6`);
      } else if (volMacro.vvix > 100) {
        sellAdj += 3;
        reasons.sell.push(`VVIX ${volMacro.vvix.toFixed(1)} > 100 → 변동성 상승 경계 +3`);
      }
    }

    // ── VIX Term Structure ──────────────────────────────────────────────
    const termDir = calcTermStructureDirection(volMacro.vix1m, volMacro.vix3m);
    if (termDir === 'backwardation') {
      sellAdj += 10;
      buyAdj  -= 6;
      reasons.sell.push(`VIX 백워데이션 (단기 ${volMacro.vix1m?.toFixed(1)} > 장기 ${volMacro.vix3m?.toFixed(1)}) → 공포 구조 +10`);
      reasons.buy.push(`VIX 백워데이션 → 매수 위험 -6`);
    } else if (termDir === 'contango') {
      buyAdj  += 4;
      sellAdj -= 4;
      reasons.buy.push(`VIX 콘탱고 (단기 ${volMacro.vix1m?.toFixed(1)} < 장기 ${volMacro.vix3m?.toFixed(1)}) → 안정 구조 +4`);
    }
  }

  // 범위 클램프 (-30 ~ +30)
  buyAdj  = Math.max(-30, Math.min(30, buyAdj));
  sellAdj = Math.max(-30, Math.min(30, sellAdj));

  return { buyAdj, sellAdj, reasons };
}

// ─── 메인 ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== FlashAlpha SPY 옵션 데이터 수집 시작 ===');
  console.log(`시각: ${new Date().toISOString()}`);

  if (!API_KEY) {
    console.error('FLASHALPHA_API_KEY 환경 변수가 설정되지 않았습니다.');
    process.exit(1);
  }

  // 데이터 수집
  const [snapshot, volMacro, oiData] = await Promise.allSettled([
    fetchOptionsSnapshot(),
    fetchVolatilityMacro(),
    fetchOI(),
  ]).then(results => results.map(r => r.status === 'fulfilled' ? r.value : null));

  // 오버레이 점수 계산
  const overlay = calcOverlay(snapshot, volMacro, oiData);

  // VIX term structure 방향
  const termDir = volMacro
    ? calcTermStructureDirection(volMacro.vix1m, volMacro.vix3m)
    : 'unknown';

  // 최종 출력 구조
  const output = {
    fetchedAt: new Date().toISOString(),
    source: 'flashalpha.io',
    symbol: 'SPY',

    // 핵심 옵션 시장 지표
    options: {
      spyPrice:    snapshot?.spyPrice    ?? null,
      netGEX:      snapshot?.netGEX      ?? null,
      gammaFlip:   snapshot?.gammaFlip   ?? null,
      callWall:    snapshot?.callWall    ?? null,
      putWall:     snapshot?.putWall     ?? null,
      netDEX:      snapshot?.netDEX      ?? null,
      aboveGammaFlip: (snapshot !== null && snapshot?.spyPrice !== null && snapshot?.gammaFlip !== null)
        ? snapshot.spyPrice > snapshot.gammaFlip
        : null,
    },

    // 변동성 매크로
    volatility: {
      skew:          volMacro?.skew  ?? null,
      vvix:          volMacro?.vvix  ?? null,
      vix1m:         volMacro?.vix1m ?? null,
      vix3m:         volMacro?.vix3m ?? null,
      vix6m:         volMacro?.vix6m ?? null,
      termStructure: termDir,
    },

    // 오픈 인터레스트
    oi: {
      callOI:  oiData?.callOI  ?? null,
      putOI:   oiData?.putOI   ?? null,
      pcRatio: oiData?.pcRatio ?? null,
    },

    // 대시보드 오버레이용 조정값 (즉시 사용 가능)
    overlay: {
      buyAdj:    overlay.buyAdj,
      sellAdj:   overlay.sellAdj,
      reasons:   overlay.reasons,
    },

    // 수집 상태 (각 엔드포인트 성공 여부)
    fetchStatus: {
      snapshot: snapshot !== null,
      volMacro: volMacro !== null,
      oiData:   oiData   !== null,
    },
  };

  // 출력 디렉토리 확인 후 저장
  const outDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf-8');

  console.log('\n=== 수집 완료 ===');
  console.log(`  SPY 가격: ${output.options.spyPrice ?? 'N/A'}`);
  console.log(`  순GEX: ${output.options.netGEX ?? 'N/A'}`);
  console.log(`  감마 플립: ${output.options.gammaFlip ?? 'N/A'}`);
  console.log(`  콜 월: ${output.options.callWall ?? 'N/A'} / 풋 월: ${output.options.putWall ?? 'N/A'}`);
  console.log(`  SKEW: ${output.volatility.skew ?? 'N/A'} / VVIX: ${output.volatility.vvix ?? 'N/A'}`);
  console.log(`  VIX Term: ${output.volatility.termStructure} (1M: ${output.volatility.vix1m ?? 'N/A'}, 3M: ${output.volatility.vix3m ?? 'N/A'})`);
  console.log(`  P/C Ratio: ${output.oi.pcRatio ?? 'N/A'}`);
  console.log(`  오버레이: 매수 ${overlay.buyAdj > 0 ? '+' : ''}${overlay.buyAdj}, 매도 ${overlay.sellAdj > 0 ? '+' : ''}${overlay.sellAdj}`);
  if (overlay.reasons.buy.length)  console.log(`  매수 근거: ${overlay.reasons.buy.join(' / ')}`);
  if (overlay.reasons.sell.length) console.log(`  매도 근거: ${overlay.reasons.sell.join(' / ')}`);
  console.log(`  저장: ${OUTPUT_PATH}`);
  console.log(`  수집 상태: snapshot=${output.fetchStatus.snapshot}, volMacro=${output.fetchStatus.volMacro}, oi=${output.fetchStatus.oiData}`);
}

main().catch(err => {
  console.error('치명적 오류:', err);
  process.exit(1);
});
