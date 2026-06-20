import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    externalDir: true
  },
  // Keep an explicit empty turbopack config so Next doesn't reject custom webpack settings
  turbopack: {},
  webpack(config) {
    config.resolve = config.resolve || {};
    config.resolve.fallback = {
      ...(config.resolve.fallback ?? {}),
      // Prevent client-side bundling of native/node-only modules used by Baileys
      jimp: false,
      sharp: false,
      canvas: false,
      // Core Node modules that should not be bundled for the browser
      fs: false,
      net: false,
      tls: false
    };
    return config;
  }
};

export default nextConfig;
