/* ══════════════════════════════════════════════
   KIS Open API — 토큰 발급 / 캐시 관리
   ══════════════════════════════════════════════
   - 메모리 캐시: 토큰 만료 5분 전에 자동 재발급
   - 환경변수 KIS_IS_MOCK=true 이면 모의투자 도메인 사용
   ══════════════════════════════════════════════ */

import type { KisToken } from './types';

export const KIS_BASE_URL =
  process.env.KIS_IS_MOCK === 'true'
    ? 'https://openapivts.koreainvestment.com:29443'
    : 'https://openapi.koreainvestment.com:9443';

// 서버 메모리 토큰 캐시 (단일 인스턴스 기준)
let tokenCache: KisToken | null = null;

function isTokenValid(token: KisToken): boolean {
  const BUFFER_SEC = 300; // 만료 5분 전 재발급
  const expiresAt = token.fetchedAt + (token.expires_in - BUFFER_SEC) * 1000;
  return Date.now() < expiresAt;
}

export async function getAccessToken(): Promise<string> {
  if (tokenCache && isTokenValid(tokenCache)) {
    return tokenCache.access_token;
  }

  const appKey = process.env.KIS_APP_KEY;
  const appSecret = process.env.KIS_APP_SECRET;

  if (!appKey || !appSecret) {
    throw new Error(
      'KIS_APP_KEY 또는 KIS_APP_SECRET 환경변수가 설정되지 않았습니다.\n' +
      '.env.local 파일을 확인하세요.'
    );
  }

  const res = await fetch(`${KIS_BASE_URL}/oauth2/tokenP`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      appkey: appKey,
      appsecret: appSecret,
    }),
    // 서버→KIS 직접 호출이므로 캐시 금지
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`KIS 토큰 발급 실패 (HTTP ${res.status}): ${text}`);
  }

  const data = await res.json();

  if (!data.access_token) {
    throw new Error(`KIS 토큰 응답 오류: access_token 없음 → ${JSON.stringify(data)}`);
  }

  tokenCache = {
    access_token: data.access_token,
    token_type: data.token_type ?? 'Bearer',
    expires_in: Number(data.expires_in) || 86400,
    fetchedAt: Date.now(),
  };

  return tokenCache.access_token;
}

/** 강제 토큰 만료 (401 수신 시 호출) */
export function clearTokenCache(): void {
  tokenCache = null;
}
