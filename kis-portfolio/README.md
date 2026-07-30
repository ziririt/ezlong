# KIS Portfolio — 한국투자증권 Open API 포트폴리오 뷰어

한국투자증권 Open API로 계좌 보유 종목을 조회하는 Next.js 앱.
**조회 전용 — 주문/매매 API 완전 차단**

## 빠른 시작

### 1. 패키지 설치
```bash
cd kis-portfolio
npm install
```

### 2. 환경변수 설정
```bash
cp .env.local.example .env.local
```
`.env.local`을 열고 실제 값 입력:
```
KIS_APP_KEY=발급받은_앱키
KIS_APP_SECRET=발급받은_앱시크릿
KIS_ACCOUNT_NO=12345678-01
KIS_IS_MOCK=false
KIS_CUSTTYPE=P
```

> **KIS Open API 키 발급:** https://apiportal.koreainvestment.com

### 3. 개발 서버 실행
```bash
npm run dev
```
→ http://localhost:3000 에서 포트폴리오 확인

### 4. Vercel 배포 (선택)
```bash
npx vercel
```
Vercel 대시보드 → Settings → Environment Variables에서 `.env.local` 항목 동일하게 입력

---

## API 엔드포인트

### GET /api/kis/account/positions

계좌 전체 보유 종목 조회 (국내 + 해외 통합)

**응답 예시:**
```json
{
  "ok": true,
  "account": "12345678-01",
  "fetchedAt": "2026-06-29T10:30:00.000Z",
  "positions": [
    {
      "market": "US",
      "exchange": "NASD",
      "symbol": "TQQQ",
      "name": "ProShares UltraPro QQQ",
      "quantity": 100,
      "avgPrice": 45.12,
      "currentPrice": 71.83,
      "marketValue": 7183.00,
      "profitLoss": 2671.00,
      "profitLossRate": 59.21,
      "currency": "USD"
    }
  ]
}
```

---

## 프로젝트 구조

```
src/
├── lib/kis/
│   ├── types.ts              # 타입 정의
│   ├── auth.ts               # 토큰 발급/캐시 (메모리)
│   ├── client.ts             # HTTP 클라이언트 (에러 처리, 재시도)
│   ├── domestic-balance.ts   # 국내주식 잔고 조회
│   ├── overseas-balance.ts   # 해외주식 잔고 조회 (거래소별 병렬)
│   └── normalize-position.ts # KIS 응답 → Position 모델 변환
└── app/
    ├── api/kis/account/positions/
    │   └── route.ts          # GET /api/kis/account/positions
    ├── page.tsx              # 포트폴리오 UI
    ├── layout.tsx
    └── globals.css
```

---

## 보안 원칙

- `APP_KEY`, `APP_SECRET`은 서버 환경변수에만 저장
- 브라우저에 토큰/시크릿 노출 없음
- `.env.local`은 `.gitignore`에 포함 (절대 커밋 금지)
- `APP_KEY`가 로그/응답에 포함되지 않도록 주의

---

## 제한 사항

- **주문 기능 없음** — 조회 전용
- 해외주식: NASD, NYSE, AMEX, SEHK, TKSE 거래소만 지원
- 토큰 캐시: 서버 메모리 기반 (재시작 시 재발급)
- 현재가: KIS API 제공 데이터 기준 (최대 15분 지연)
