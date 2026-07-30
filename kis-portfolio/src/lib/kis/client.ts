/* ══════════════════════════════════════════════
   KIS Open API — 공통 HTTP 클라이언트
   ══════════════════════════════════════════════
   - 인증 헤더 자동 주입
   - rt_cd 검증
   - 401 → 토큰 재발급 후 1회 재시도
   ══════════════════════════════════════════════ */

import { getAccessToken, clearTokenCache, KIS_BASE_URL } from './auth';

interface KisRequestOptions {
  trId: string;
  params?: Record<string, string>;
  custtype?: string;
}

interface KisBaseResponse {
  rt_cd?: string;
  msg1?: string;
  [key: string]: unknown;
}

export async function kisGet<T extends KisBaseResponse>(
  path: string,
  options: KisRequestOptions,
  _retryOnExpiry = true
): Promise<T> {
  const appKey = process.env.KIS_APP_KEY!;
  const appSecret = process.env.KIS_APP_SECRET!;
  const custtype = options.custtype ?? process.env.KIS_CUSTTYPE ?? 'P';

  const token = await getAccessToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=UTF-8',
    'authorization': `Bearer ${token}`,
    'appkey': appKey,
    'appsecret': appSecret,
    'tr_id': options.trId,
    'custtype': custtype,
  };

  const qs = options.params
    ? '?' + new URLSearchParams(options.params).toString()
    : '';
  const url = `${KIS_BASE_URL}${path}${qs}`;

  const res = await fetch(url, {
    method: 'GET',
    headers,
    cache: 'no-store',
  });

  // 401: 토큰 만료 → 캐시 무효화 후 1회 재시도
  if (res.status === 401 && _retryOnExpiry) {
    clearTokenCache();
    return kisGet<T>(path, options, false);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`KIS API HTTP 오류 (${res.status}) [${options.trId}]: ${text}`);
  }

  const data = (await res.json()) as T;

  // KIS 비즈니스 오류 확인 (rt_cd !== "0")
  if (data.rt_cd !== undefined && data.rt_cd !== '0') {
    throw new Error(
      `KIS API 비즈니스 오류 (rt_cd=${data.rt_cd}) [${options.trId}]: ${data.msg1 ?? '알 수 없는 오류'}`
    );
  }

  return data;
}
