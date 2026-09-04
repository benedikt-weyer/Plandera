import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@e2ee-lib/e2ee-auth', '@e2ee-lib/oqs-kek'],
  typescript: {
    ignoreBuildErrors: process.env.SKIP_TYPE_CHECK === '1',
  },
  eslint: {
    ignoreDuringBuilds: process.env.SKIP_TYPE_CHECK === '1',
  },
  /* config options here */
  
};

export default nextConfig;
