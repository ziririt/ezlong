/* ══════════════════════════════════════════════
   KIS 응답 → 앱 표준 Position 모델 변환
   ══════════════════════════════════════════════ */

import type { Position, KisDomesticItem, KisOverseasItem } from './types';

/** 쉼표·원화기호 제거 후 숫자 변환 */
function n(v: string | undefined | null): number {
  if (!v) return 0;
  return parseFloat(v.replace(/[,₩]/g, '')) || 0;
}

export function normalizeDomestic(item: KisDomesticItem): Position {
  return {
    market: 'KR',
    exchange: 'KRX',
    symbol: item.pdno,
    name: item.prdt_name,
    quantity: n(item.hldg_qty),
    avgPrice: n(item.pchs_avg_pric),
    currentPrice: n(item.prpr),
    marketValue: n(item.evlu_amt),
    profitLoss: n(item.evlu_pfls_amt),
    profitLossRate: n(item.evlu_pfls_rt),
    currency: 'KRW',
  };
}

export function normalizeOverseas(item: KisOverseasItem): Position {
  return {
    market: 'US',
    exchange: item.ovrs_excg_cd ?? '',
    symbol: item.ovrs_pdno,
    name: item.ovrs_item_name,
    quantity: n(item.ord_psbl_qty),
    avgPrice: n(item.pchs_avg_pric),
    currentPrice: n(item.now_pric2),
    marketValue: n(item.frcr_evlu_amt2),
    profitLoss: n(item.frcr_evlu_pfls_amt),
    profitLossRate: n(item.evlu_pfls_rt),
    currency: item.tr_crcy_cd ?? 'USD',
  };
}
