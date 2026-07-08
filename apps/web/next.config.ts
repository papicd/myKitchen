import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    // Prevent flaky cache artifacts on Windows (.next missing chunks/manifests).
    config.cache = false;
    return config;
  },
};

export default nextConfig;
