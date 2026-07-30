import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '계좌 포트폴리오 | EZLONG',
  description: '한국투자증권 Open API 연동 — 보유 종목 현황 조회 (조회 전용)',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
