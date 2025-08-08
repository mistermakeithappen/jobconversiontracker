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
    // Exclude lightningcss from server-side bundle
    serverComponentsExternalPackages: ["lightningcss"],
  },
  webpack: (config, { isServer }) => {
    // Polyfill __dirname and __filename for server-side code
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
