import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: process.env.SKIP_TYPE_CHECK === '1',
  },
  eslint: {
    ignoreDuringBuilds: process.env.SKIP_TYPE_CHECK === '1',
  },
  /* config options here */
  
};

export default nextConfig;
