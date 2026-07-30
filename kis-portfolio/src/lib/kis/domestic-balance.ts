/* ══════════════════════════════════════════════
   KIS Open API — 국내주식 잔고 조회
   TR_ID: TTTC8434R (실전) / VTTC8434R (모의)
   페이지네이션: ctx_area_nk100 반복 조회
   ══════════════════════════════════════════════ */

import { kisGet } from './client';
import type { KisDomesticItem, KisDomesticBalanceResp } from './types';

function getTrId(): string {
  return process.env.KIS_IS_MOCK === 'true' ? 'VTTC8434R' : 'TTTC8434R';
}

export async function getDomesticBalance(
  cano: string,
  acntPrdtCd: string
): Promise<KisDomesticItem[]> {
  const results: KisDomesticItem[] = [];
  let ctxFk = '';
  let ctxNk = '';

  while (true) {
    const data = await kisGet<KisDomesticBalanceResp>(
      '/uapi/domestic-stock/v1/trading/inquire-balance',
      {
        trId: getTrId(),
        params: {
          CANO: cano,
          ACNT_PRDT_CD: acntPrdtCd,
          AFHR_FLPR_YN: 'N',     // 시간외단일가 여부
          OFL_YN: '',             // 오프라인 여부
          INQR_DVSN: '02',       // 조회구분: 02=종목별
          UNPR_DVSN: '01',       // 단가구분: 01=기준가
          FUND_STTL_ICLD_YN: 'N',
          FNCG_AMT_AUTO_RDPT_YN: 'N',
          PRCS_DVSN: '00',       // 처리구분: 00=전일매매포함
          CTX_AREA_FK100: ctxFk,
          CTX_AREA_NK100: ctxNk,
        },
      }
    );

    if (Array.isArray(data.output1)) {
      // 합계 행 제거: 종목코드 없거나 수량 0
      const items = data.output1.filter(
        (item) =>
          item.pdno?.trim() !== '' &&
          Number(item.hldg_qty) > 0
      );
      results.push(...items);
    }

    // 다음 페이지 여부
    const nextNk = data.ctx_area_nk100?.trim();
    if (nextNk) {
      ctxFk = data.ctx_area_fk100 ?? '';
      ctxNk = nextNk;
    } else {
      break;
    }
  }

  return results;
}
