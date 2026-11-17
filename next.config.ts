import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: false,
  // Prevent Turbopack from walking up to a home-directory package-lock.json.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
