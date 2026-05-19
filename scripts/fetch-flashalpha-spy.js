#!/usr/bin/env node
/**
 * FlashAlpha SPY 옵션 시장 데이터 수집 스크립트 (GitHub Actions용)
 * FlashAlpha API → data/options-latest.json 저장
 *
 * 실행: FLASHALPHA_API_KEY=xxxx node scripts/fetch-flashalpha-spy.js
 *
 * ─── 무료 Starter 플랜 제약 ────────────────────────────────────────────────
 *   · 일일 5회 쿼터 → 요청 1회로 제한 (POST마켓 1회 수집에 딱 맞음)
 *   · SPY 심볼 전용
 *   · 올바른 호스트: lab.flashalpha.com (flashalpha.io 아님)
 *   · 인증 헤더: X-Api-Key (X-API-Key 아님)
 *   · 엔드포인트: GET /v1/stock/spy/summary
 *
 * 수집 항목 (summary 엔드포인트):
 *   - GEX (Gamma Exposure): 양수 = pin/안정, 음수 = 가속 변동
 *   - Gamma Flip Level: 이 가격 위/아래에서 시장 성격 전환
 *   - Call Wall / Put Wall: 강한 저항·지지 레벨
 *   - DEX (Delta Exposure): 있을 경우 파싱
 *
 * 요구사항: Node.js 18+ (내장 https 모듈만 사용, npm 패키지 불필요)
 */

'use strict';

const https = require('https');
const fs    = require('fs');
const path  = require('path');

// ─── 설정 ──────────────────────────────────────────────────────────────────
const API_KEY     = process.env.FLASHALPHA_API_KEY || 'vBdFDeCc45T1CpcggvAL7BE5MDCXXHKyvLHepciE';
const FA_HOST     = 'lab.flashalpha.com';   // ★ 실제 도메인 (flashalpha.io 아님)
const FA_PATH     = '/v1/stock/spy/summary'; // ★ 무료 플랜 단일 엔드포인트
const OUTPUT_PATH = path.join(__dirname, '..', 'data', 'options-latest.json');

// ─── HTTP GET ───────────────────────────────────────────────────────────────

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
        console.log(`  HTTP ${res.statusCode} ← ${hostname}${reqPath}`);
        if (res.statusCode === 429) {
          console.warn('  ⚠ 일일 쿼터 소진 (5회/일). UTC 00:00 에 리셋됩니다.');
          resolve(null);
          return;
        }
        if (res.statusCode !== 200) {
          console.warn(`  HTTP ${res.statusCode} — body: ${body.slice(0, 300)}`);
          resolve(null);
          return;
        }
        try { resolve(JSON.parse(body)); }
        catch (e) {
          console.warn(`  JSON 파싱 실패: ${e.message}\n  원문(앞 300자): ${body.slice(0, 300)}`);
          resolve(null);
        }
      });
    });
    req.on('error', err => {
      console.warn(`  네트워크 오류: ${err.message}`);
      resolve(null);
    });
    req.on('timeout', () => {
      req.destroy();
      console.warn(`  타임아웃 (20s 초과)`);
      resolve(null);
    });
    req.end();
  });
}

// ─── 헬퍼 ──────────────────────────────────────────────────────────────────

function safeNum(v) {
  if (v === null || v === undefined) return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}

/**
 * call_wall / put_wall 은 숫자일 수도 있고 {strike, gex} 객체일 수도 있다.
 * 두 경우 모두 strike 값을 반환.
 */
function extractStrike(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'object' && val !== null) {
    return safeNum(val.strike ?? val.price ?? val.level ?? null);
  }
  return safeNum(val);
}

/**
 * VIX Term Structure 방향 판정 (vix1m, vix3m 있을 때만)
 */
function calcTermStructureDirection(vix1m, vix3m) {
  if (vix1m === null || vix3m === null) return 'unknown';
  const diff = vix1m - vix3m;
  if (diff < -0.5) return 'contango';       // 단기 < 장기: 안정
  if (diff > 0.5)  return 'backwardation';  // 단기 > 장기: 공포
  return 'flat';
}

// ─── FlashAlpha SPY Summary 파싱 ───────────────────────────────────────────

/**
 * /v1/stock/spy/summary 응답을 정규화.
 *
 * FlashAlpha가 반환하는 실제 필드명을 알 수 없으므로
 * 여러 가능한 키 이름을 순서대로 시도해 첫 번째 유효한 값을 사용.
 *
 * 알려진 GEX 필드 (Quick Start Guide 기준):
 *   underlying_price, net_gex, gamma_flip, call_wall, put_wall,
 *   net_gex_label, gex_interpretation, as_of
 */
function parseSummaryResponse(data) {
  if (!data) return null;

  // 데이터 래퍼 벗기기 (data.data, data.result 등)
  const d = data.data ?? data.result ?? data.payload ?? data;

  // GEX 섹션이 별도 키에 있을 수 있음 (예: d.gex, d.exposure)
  const gex = d.gex ?? d.exposure ?? d.gamma_exposure ?? d;

  return {
    // ── 가격 / GEX ─────────────────────────────────────────────────────
    spyPrice:  safeNum(
      d.underlying_price ?? d.spy_price ?? d.price ?? d.last_price ??
      gex.underlying_price ?? null
    ),
    netGEX:    safeNum(
      gex.net_gex ?? gex.gex ?? d.net_gex ?? d.gex ?? null
    ),
    gammaFlip: safeNum(
      gex.gamma_flip ?? gex.flip_level ?? gex.gamma_flip_level ??
      d.gamma_flip ?? d.flip_level ?? null
    ),
    callWall:  extractStrike(
      gex.call_wall ?? d.call_wall ?? null
    ),
    putWall:   extractStrike(
      gex.put_wall  ?? d.put_wall  ?? null
    ),
    netDEX:    safeNum(
      d.net_dex ?? d.dex ?? d.delta_exposure ?? gex.net_dex ?? null
    ),

    // ── 변동성 (summary에 있을 경우) ────────────────────────────────────
    skew:  safeNum(d.skew ?? d.cboe_skew ?? d.SKEW ?? null),
    vvix:  safeNum(d.vvix ?? d.VVIX ?? null),
    vix1m: safeNum(d.vix_1m ?? d.vix ?? d.VIX ?? d.vix1m ?? null),
    vix3m: safeNum(d.vix_3m ?? d.vix3m ?? null),
    vix6m: safeNum(d.vix_6m ?? d.vix6m ?? null),

    // ── OI (summary에 있을 경우) ─────────────────────────────────────────
    callOI:  safeNum(d.call_oi ?? d.total_call_oi ?? d.callOI ?? null),
    putOI:   safeNum(d.put_oi  ?? d.total_put_oi  ?? d.putOI  ?? null),
    pcRatio: safeNum(d.put_call_ratio ?? d.pc_ratio ?? d.pcRatio ?? null),

    rawResponse: data,  // 진단용 원본 보관
  };
}

// ─── 오버레이 점수 계산 ─────────────────────────────────────────────────────

/**
 * atmr-dashboard.html의 buyScore / sellScore 에 ±조정값 제공.
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
function calcOverlay(parsed) {
  let buyAdj  = 0;
  let sellAdj = 0;
  const reasons = { buy: [], sell: [] };

  if (!parsed) return { buyAdj, sellAdj, reasons };

  // ── GEX / Gamma Flip 기반 ─────────────────────────────────────────────
  if (parsed.spyPrice !== null && parsed.gammaFlip !== null) {
    const aboveFlip = parsed.spyPrice > parsed.gammaFlip;
    const posGEX    = parsed.netGEX !== null && parsed.netGEX > 0;
    const negGEX    = parsed.netGEX !== null && parsed.netGEX < 0;

    if (aboveFlip && posGEX) {
      buyAdj  += 8;
      sellAdj -= 4;
      reasons.buy.push(`SPY(${parsed.spyPrice}) > 감마 플립(${parsed.gammaFlip}), 순GEX 양수 → 시장 안정 구간 +8`);
      reasons.sell.push(`SPY(${parsed.spyPrice}) > 감마 플립(${parsed.gammaFlip}), 순GEX 양수 → 시장 안정 -4`);
    } else if (!aboveFlip && negGEX) {
      buyAdj  -= 10;
      sellAdj += 8;
      reasons.sell.push(`SPY(${parsed.spyPrice}) ≤ 감마 플립(${parsed.gammaFlip}), 순GEX 음수 → 하방 가속 구간 +8`);
      reasons.buy.push(`하방 가속 구간 -10`);
    }

    if (parsed.netGEX !== null && parsed.netGEX < -1_000_000_000) {
      sellAdj += 6;
      reasons.sell.push(`순GEX < -1B (극단적 음수) → 하방 가속 위험 +6`);
    }
  }

  // ── Call Wall / Put Wall 근접도 ───────────────────────────────────────
  if (parsed.spyPrice !== null) {
    if (parsed.callWall !== null) {
      const distPct = Math.abs(parsed.spyPrice - parsed.callWall) / parsed.spyPrice * 100;
      if (distPct <= 1.0) {
        sellAdj += 8;
        buyAdj  -= 5;
        reasons.sell.push(`콜 월(${parsed.callWall}) 1% 이내 근접 → 저항 압박 +8`);
      }
    }
    if (parsed.putWall !== null) {
      const distPct = Math.abs(parsed.spyPrice - parsed.putWall) / parsed.spyPrice * 100;
      if (distPct <= 1.0) {
        buyAdj  += 5;
        sellAdj -= 3;
        reasons.buy.push(`풋 월(${parsed.putWall}) 1% 이내 근접 → 지지 강화 +5`);
      }
    }
  }

  // ── P/C Ratio (역발상) ────────────────────────────────────────────────
  if (parsed.pcRatio !== null) {
    if (parsed.pcRatio > 1.2) {
      buyAdj  += 4;
      reasons.buy.push(`P/C Ratio ${parsed.pcRatio.toFixed(2)} > 1.2 → 과도한 풋 (역발상 매수) +4`);
    } else if (parsed.pcRatio < 0.7) {
      sellAdj += 4;
      reasons.sell.push(`P/C Ratio ${parsed.pcRatio.toFixed(2)} < 0.7 → 과도한 콜 (과열 경고) +4`);
    }
  }

  // ── SKEW / VVIX ──────────────────────────────────────────────────────
  if (parsed.skew !== null) {
    if (parsed.skew > 145) {
      sellAdj += 7;
      reasons.sell.push(`SKEW ${parsed.skew.toFixed(1)} > 145 → 꼬리 리스크 헤지 급증 +7`);
    } else if (parsed.skew > 135) {
      sellAdj += 3;
      reasons.sell.push(`SKEW ${parsed.skew.toFixed(1)} > 135 → 꼬리 리스크 경계 +3`);
    } else if (parsed.skew < 115) {
      buyAdj  += 3;
      reasons.buy.push(`SKEW ${parsed.skew.toFixed(1)} < 115 → 하방 공포 완화 +3`);
    }
  }
  if (parsed.vvix !== null) {
    if (parsed.vvix > 120) {
      sellAdj += 6;
      reasons.sell.push(`VVIX ${parsed.vvix.toFixed(1)} > 120 → 변동성 급등 위험 +6`);
    } else if (parsed.vvix > 100) {
      sellAdj += 3;
      reasons.sell.push(`VVIX ${parsed.vvix.toFixed(1)} > 100 → 변동성 상승 경계 +3`);
    }
  }

  // ── VIX Term Structure ────────────────────────────────────────────────
  const termDir = calcTermStructureDirection(parsed.vix1m, parsed.vix3m);
  if (termDir === 'backwardation') {
    sellAdj += 10;
    buyAdj  -= 6;
    reasons.sell.push(`VIX 백워데이션 (단기 ${parsed.vix1m?.toFixed(1)} > 장기 ${parsed.vix3m?.toFixed(1)}) → 공포 구조 +10`);
    reasons.buy.push(`VIX 백워데이션 → 매수 위험 -6`);
  } else if (termDir === 'contango') {
    buyAdj  += 4;
    sellAdj -= 4;
    reasons.buy.push(`VIX 콘탱고 (단기 ${parsed.vix1m?.toFixed(1)} < 장기 ${parsed.vix3m?.toFixed(1)}) → 안정 구조 +4`);
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
  console.log(`호스트: ${FA_HOST}`);
  console.log(`엔드포인트: ${FA_PATH}`);

  if (!API_KEY) {
    console.error('FLASHALPHA_API_KEY 환경 변수가 설정되지 않았습니다.');
    process.exit(1);
  }

  // ── 단일 요청 (무료 플랜: 5회/일 → 1회 사용) ──────────────────────────
  console.log('\n[1/1] SPY summary 수집...');
  const raw = await httpGet(FA_HOST, FA_PATH, { 'X-Api-Key': API_KEY });

  // ── 응답 진단 (최초 실행 디버깅용) ────────────────────────────────────
  if (raw) {
    const preview = JSON.stringify(raw).slice(0, 500);
    console.log(`  응답 미리보기(500자): ${preview}`);
  }

  // ── 파싱 ──────────────────────────────────────────────────────────────
  const parsed = parseSummaryResponse(raw);

  // ── 오버레이 계산 ──────────────────────────────────────────────────────
  const overlay = calcOverlay(parsed);

  // ── VIX Term Structure 방향 ────────────────────────────────────────────
  const termDir = parsed
    ? calcTermStructureDirection(parsed.vix1m, parsed.vix3m)
    : 'unknown';

  // ── 출력 JSON 조립 ─────────────────────────────────────────────────────
  const output = {
    fetchedAt: new Date().toISOString(),
    source: 'lab.flashalpha.com',
    symbol: 'SPY',

    options: {
      spyPrice:      parsed?.spyPrice    ?? null,
      netGEX:        parsed?.netGEX      ?? null,
      gammaFlip:     parsed?.gammaFlip   ?? null,
      callWall:      parsed?.callWall    ?? null,
      putWall:       parsed?.putWall     ?? null,
      netDEX:        parsed?.netDEX      ?? null,
      aboveGammaFlip: (parsed?.spyPrice !== null && parsed?.gammaFlip !== null)
        ? (parsed.spyPrice > parsed.gammaFlip)
        : null,
    },

    volatility: {
      skew:          parsed?.skew  ?? null,
      vvix:          parsed?.vvix  ?? null,
      vix1m:         parsed?.vix1m ?? null,
      vix3m:         parsed?.vix3m ?? null,
      vix6m:         parsed?.vix6m ?? null,
      termStructure: termDir,
    },

    oi: {
      callOI:  parsed?.callOI  ?? null,
      putOI:   parsed?.putOI   ?? null,
      pcRatio: parsed?.pcRatio ?? null,
    },

    overlay: {
      buyAdj:  overlay.buyAdj,
      sellAdj: overlay.sellAdj,
      reasons: overlay.reasons,
    },

    fetchStatus: {
      snapshot: parsed !== null,
      volMacro: parsed !== null && (parsed.vix1m !== null || parsed.skew !== null),
      oiData:   parsed !== null && parsed.pcRatio !== null,
    },
  };

  // ── 저장 ──────────────────────────────────────────────────────────────
  const outDir = path.dirname(OUTPUT_PATH);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2), 'utf-8');

  // ── 결과 요약 ──────────────────────────────────────────────────────────
  console.log('\n=== 수집 완료 ===');
  console.log(`  SPY 가격   : ${output.options.spyPrice    ?? 'N/A'}`);
  console.log(`  순GEX      : ${output.options.netGEX      ?? 'N/A'}`);
  console.log(`  감마 플립  : ${output.options.gammaFlip   ?? 'N/A'}`);
  console.log(`  콜 월      : ${output.options.callWall    ?? 'N/A'}`);
  console.log(`  풋 월      : ${output.options.putWall     ?? 'N/A'}`);
  console.log(`  SKEW       : ${output.volatility.skew     ?? 'N/A'}`);
  console.log(`  VVIX       : ${output.volatility.vvix     ?? 'N/A'}`);
  console.log(`  VIX 1M     : ${output.volatility.vix1m    ?? 'N/A'}`);
  console.log(`  VIX Term   : ${output.volatility.termStructure}`);
  console.log(`  P/C Ratio  : ${output.oi.pcRatio          ?? 'N/A'}`);
  console.log(`  오버레이   : 매수 ${overlay.buyAdj >= 0 ? '+' : ''}${overlay.buyAdj} / 매도 ${overlay.sellAdj >= 0 ? '+' : ''}${overlay.sellAdj}`);
  if (overlay.reasons.buy.length)  console.log(`  매수 근거  : ${overlay.reasons.buy.join(' / ')}`);
  if (overlay.reasons.sell.length) console.log(`  매도 근거  : ${overlay.reasons.sell.join(' / ')}`);
  console.log(`  저장 경로  : ${OUTPUT_PATH}`);
  console.log(`  수집 상태  : snapshot=${output.fetchStatus.snapshot}, volMacro=${output.fetchStatus.volMacro}, oi=${output.fetchStatus.oiData}`);

  if (parsed === null) {
    console.warn('\n  ★ 주의: API 응답 없음. 가능한 원인:');
    console.warn('    1) 일일 쿼터 소진 (5회/일, UTC 00:00 리셋)');
    console.warn('    2) API 키 미등록 → GitHub Secrets > FLASHALPHA_API_KEY 확인');
    console.warn('    3) 네트워크 오류');
  }
}

main().catch(err => {
  console.error('치명적 오류:', err);
  process.exit(1);
});
