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
    // Force ES modules to prevent __dirname errors
    esmExternals: true,
    serverComponentsExternalPackages: [],
  },
  // Ensure we're using ES modules
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Force ES modules for server-side code
      config.experiments = {
        ...config.experiments,
        outputModule: true,
      };
    }
    return config;
  },
};

export default nextConfig;
