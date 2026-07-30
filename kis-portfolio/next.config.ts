import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // ezlong.com에서 이 API를 호출할 수 있도록 CORS 허용
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: 'https://ezlong.com' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type' },
        ],
      },
    ];
  },
};

export default nextConfig;
