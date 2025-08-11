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
  // Enhanced webpack config to prevent __dirname issues
  webpack: (config, { isServer }) => {
    // Ensure proper module resolution
    config.resolve.extensionAlias = {
      '.js': ['.js', '.ts', '.tsx'],
      '.mjs': ['.mjs', '.mts', '.mtsx'],
    };
    
    // Prevent __dirname usage without forcing ES modules
    if (isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        __dirname: false,
        __filename: false,
      };
    }
    
    return config;
  },
};

export default nextConfig;
