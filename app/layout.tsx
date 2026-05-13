import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ezlong',
  description: '네이버 프리미엄 콘텐츠',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="bg-white text-gray-900 antialiased">{children}</body>
    </html>
  );
}
