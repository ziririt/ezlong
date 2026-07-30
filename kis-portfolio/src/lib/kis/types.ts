/* ══════════════════════════════════════════════
   KIS Open API — 공통 타입 정의
   ══════════════════════════════════════════════ */

// ── 내부 표준 포지션 모델 ───────────────────────
export interface Position {
  market: 'KR' | 'US' | 'OTHER';
  exchange: string;
  symbol: string;
  name: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  marketValue: number;
  profitLoss: number;
  profitLossRate: number;
  currency: 'KRW' | 'USD' | string;
}

// ── API 응답 모델 ───────────────────────────────
export interface PositionsResponse {
  ok: boolean;
  account: string;
  fetchedAt: string;
  positions: Position[];
  warnings?: string[];
  error?: string;
}

// ── 토큰 캐시 ──────────────────────────────────
export interface KisToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  fetchedAt: number; // Date.now()
}

// ── KIS 국내주식 잔고 응답 필드 ────────────────
export interface KisDomesticItem {
  pdno: string;           // 종목코드
  prdt_name: string;      // 종목명
  hldg_qty: string;       // 보유수량
  pchs_avg_pric: string;  // 평균매입가
  prpr: string;           // 현재가
  evlu_amt: string;       // 평가금액
  evlu_pfls_amt: string;  // 평가손익
  evlu_pfls_rt: string;   // 수익률
  [key: string]: string;
}

export interface KisDomesticBalanceResp {
  rt_cd: string;
  msg1: string;
  ctx_area_fk100: string;
  ctx_area_nk100: string;
  output1: KisDomesticItem[];
  output2: Array<Record<string, string>>;
}

// ── KIS 해외주식 잔고 응답 필드 ────────────────
export interface KisOverseasItem {
  ovrs_pdno: string;          // 해외종목코드
  ovrs_item_name: string;     // 해외종목명
  ord_psbl_qty: string;       // 보유수량 (주문가능수량)
  pchs_avg_pric: string;      // 평균매입가
  now_pric2: string;          // 현재가
  frcr_evlu_amt2: string;     // 외화평가금액
  frcr_evlu_pfls_amt: string; // 외화평가손익
  evlu_pfls_rt: string;       // 수익률
  tr_crcy_cd: string;         // 거래통화코드
  ovrs_excg_cd: string;       // 해외거래소코드
  [key: string]: string;
}

export interface KisOverseasBalanceResp {
  rt_cd: string;
  msg1: string;
  ctx_area_fk200: string;
  ctx_area_nk200: string;
  output1: KisOverseasItem[];
  output2: Array<Record<string, string>>;
}
