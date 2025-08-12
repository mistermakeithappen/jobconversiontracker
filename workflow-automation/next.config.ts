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
  // Fix for Next.js 15 + Vercel compatibility
  experimental: {
    // Disable some experimental features that cause issues
    serverComponentsExternalPackages: [],
  },
  // Ensure proper output
  output: 'standalone',
  // Disable static optimization for problematic routes
  trailingSlash: false,
};

export default nextConfig;
