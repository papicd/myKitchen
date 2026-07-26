import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep generated Next.js artifacts out of the source tree's old next-runtime folder.
  // The npm scripts set this to separate dev/build folders to avoid stale Windows locks.
  distDir: process.env.NEXT_DIST_DIR ?? ".next-dev",
  webpack: (config) => {
    // Prevent flaky cache artifacts on Windows (.next missing chunks/manifests).
    config.cache = false;
    return config;
  },
};

export default nextConfig;
