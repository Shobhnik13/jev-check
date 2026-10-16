import type {NextConfig} from 'next';

// Locally the backend runs on :4000. On Vercel it must be set explicitly, or /api has nowhere to go.
const BACKEND_URL = process.env.BACKEND_URL || (process.env.VERCEL ? '' : 'http://localhost:4000');

const nextConfig: NextConfig = {
  // Phones on the same Wi-Fi open the dev server by LAN IP.
  allowedDevOrigins: ['192.168.*.*', '10.*.*.*'],
  async rewrites() {
    return BACKEND_URL ? [{source: '/api/:path*', destination: `${BACKEND_URL}/:path*`}] : [];
  },
};

export default nextConfig;
