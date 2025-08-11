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
  // Enable static export for AWS Amplify
  output: 'export',
  trailingSlash: true,
  // Prevent __dirname errors by ensuring proper module handling
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Ensure server-side code doesn't use __dirname
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
