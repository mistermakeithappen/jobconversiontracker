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
  // Ensure proper ES module support for Vercel
  experimental: {
    esmExternals: true,
  },
  // Remove problematic webpack fallbacks that cause issues on Vercel
  webpack: (config, { isServer }) => {
    // Ensure proper module resolution
    config.resolve.extensionAlias = {
      '.js': ['.js', '.ts', '.tsx'],
      '.mjs': ['.mjs', '.mts', '.mtsx'],
    };
    return config;
  },
};

export default nextConfig;
