/* ══════════════════════════════════════════════
   GET /api/kis/account/positions
   ══════════════════════════════════════════════
   계좌 보유 종목 조회 (국내 + 해외 통합)

   ⚠ 주문 API는 절대 연결하지 않음
   ⚠ 조회 전용
   ══════════════════════════════════════════════ */

import { NextResponse } from 'next/server';
import { getDomesticBalance } from '@/lib/kis/domestic-balance';
import { getOverseasBalance } from '@/lib/kis/overseas-balance';
import { normalizeDomestic, normalizeOverseas } from '@/lib/kis/normalize-position';
import type { PositionsResponse } from '@/lib/kis/types';

/** 계좌번호 파싱: "12345678-01" → { cano, acntPrdtCd } */
function parseAccount(raw: string): { cano: string; acntPrdtCd: string } {
  const parts = raw.split('-');
  if (
    parts.length !== 2 ||
    !/^\d{8}$/.test(parts[0]) ||
    !/^\d{2}$/.test(parts[1])
  ) {
    throw new Error(
      `계좌번호 형식 오류: "${raw}" — XXXXXXXX-XX 형식이어야 합니다.`
    );
  }
  return { cano: parts[0], acntPrdtCd: parts[1] };
}

export async function GET(): Promise<NextResponse<PositionsResponse>> {
  const accountNo = process.env.KIS_ACCOUNT_NO;

  if (!accountNo) {
    return NextResponse.json(
      {
        ok: false,
        account: '',
        fetchedAt: new Date().toISOString(),
        positions: [],
        error: 'KIS_ACCOUNT_NO 환경변수가 설정되지 않았습니다.',
      },
      { status: 400 }
    );
  }

  let cano: string;
  let acntPrdtCd: string;

  try {
    ({ cano, acntPrdtCd } = parseAccount(accountNo));
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        account: accountNo,
        fetchedAt: new Date().toISOString(),
        positions: [],
        error: (e as Error).message,
      },
      { status: 400 }
    );
  }

  const warnings: string[] = [];

  try {
    // 국내 + 해외 병렬 조회
    const [domesticItems, overseasResult] = await Promise.all([
      getDomesticBalance(cano, acntPrdtCd).catch((e: Error) => {
        warnings.push(`국내주식 조회 실패: ${e.message}`);
        return [];
      }),
      getOverseasBalance(cano, acntPrdtCd).catch((e: Error) => {
        warnings.push(`해외주식 조회 실패: ${e.message}`);
        return { items: [], warnings: [] };
      }),
    ]);

    if (overseasResult.warnings?.length) {
      warnings.push(...overseasResult.warnings);
    }

    const positions = [
      ...domesticItems.map(normalizeDomestic),
      ...(overseasResult.items ?? []).map(normalizeOverseas),
    ];

    // 평가금액 내림차순 정렬
    positions.sort((a, b) => b.marketValue - a.marketValue);

    return NextResponse.json({
      ok: true,
      account: accountNo,
      fetchedAt: new Date().toISOString(),
      positions,
      ...(warnings.length ? { warnings } : {}),
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        account: accountNo,
        fetchedAt: new Date().toISOString(),
        positions: [],
        error: (e as Error).message,
        ...(warnings.length ? { warnings } : {}),
      },
      { status: 500 }
    );
  }
}
