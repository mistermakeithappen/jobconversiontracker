import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Temporarily ignore ESLint errors during production build
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Temporarily ignore TypeScript errors during production build
    ignoreBuildErrors: true,
  },
  experimental: {
    // Disable Lightning CSS to avoid missing native binary in some environments (e.g., Vercel)
    optimizeCss: false,
  },
  env: {
    NEXT_DISABLE_LIGHTNINGCSS: "1",
  },
};

export default nextConfig;
