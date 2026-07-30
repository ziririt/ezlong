/* ══════════════════════════════════════════════
   KIS Open API — 해외주식 잔고 조회
   TR_ID: TTTS3012R (실전) / VTTS3012R (모의)
   거래소별 반복 조회 후 중복 제거
   ══════════════════════════════════════════════ */

import { kisGet } from './client';
import type { KisOverseasItem, KisOverseasBalanceResp } from './types';

function getTrId(): string {
  return process.env.KIS_IS_MOCK === 'true' ? 'VTTS3012R' : 'TTTS3012R';
}

// 거래소 코드 → 기본 통화 매핑
const EXCHANGE_CURRENCY: Record<string, string> = {
  NASD: 'USD',   // 나스닥
  NYSE: 'USD',   // 뉴욕증권거래소
  AMEX: 'USD',   // 아메리칸 거래소
  SEHK: 'HKD',  // 홍콩증권거래소
  TKSE: 'JPY',  // 도쿄증권거래소
};

const EXCHANGES = Object.keys(EXCHANGE_CURRENCY);

async function fetchByExchange(
  cano: string,
  acntPrdtCd: string,
  exchange: string
): Promise<{ items: KisOverseasItem[]; warning?: string }> {
  const currency = EXCHANGE_CURRENCY[exchange] ?? 'USD';
  const results: KisOverseasItem[] = [];
  let ctxFk = '';
  let ctxNk = '';

  try {
    while (true) {
      const data = await kisGet<KisOverseasBalanceResp>(
        '/uapi/overseas-stock/v1/trading/inquire-balance',
        {
          trId: getTrId(),
          params: {
            CANO: cano,
            ACNT_PRDT_CD: acntPrdtCd,
            OVRS_EXCG_CD: exchange,
            TR_CRCY_CD: currency,
            CTX_AREA_FK200: ctxFk,
            CTX_AREA_NK200: ctxNk,
          },
        }
      );

      if (Array.isArray(data.output1)) {
        const items = data.output1.filter(
          (item) =>
            item.ovrs_pdno?.trim() !== '' &&
            Number(item.ord_psbl_qty) > 0
        );
        results.push(...items);
      }

      const nextNk = data.ctx_area_nk200?.trim();
      if (nextNk) {
        ctxFk = data.ctx_area_fk200 ?? '';
        ctxNk = nextNk;
      } else {
        break;
      }
    }

    return { items: results };
  } catch (e) {
    // 거래소 하나 실패해도 전체를 중단하지 않음
    return {
      items: [],
      warning: `${exchange} 조회 실패: ${(e as Error).message}`,
    };
  }
}

export async function getOverseasBalance(
  cano: string,
  acntPrdtCd: string
): Promise<{ items: KisOverseasItem[]; warnings: string[] }> {
  // 모든 거래소 병렬 조회
  const results = await Promise.all(
    EXCHANGES.map((ex) => fetchByExchange(cano, acntPrdtCd, ex))
  );

  const allItems: KisOverseasItem[] = [];
  const warnings: string[] = [];
  const seen = new Set<string>();

  for (const { items, warning } of results) {
    if (warning) warnings.push(warning);
    for (const item of items) {
      const key = `${item.ovrs_pdno}:${item.ovrs_excg_cd}`;
      if (!seen.has(key)) {
        seen.add(key);
        allItems.push(item);
      }
    }
  }

  return { items: allItems, warnings };
}
