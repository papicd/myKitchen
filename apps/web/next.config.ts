import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use a custom build directory to avoid stale/locked .next artifacts on Windows.
  distDir: "next-runtime",
  webpack: (config) => {
    // Prevent flaky cache artifacts on Windows (.next missing chunks/manifests).
    config.cache = false;
    return config;
  },
};

export default nextConfig;
