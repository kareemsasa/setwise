import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@setwise/domain"],
  allowedDevOrigins: ["erebus.tail172bcd.ts.net"],
};

export default nextConfig;
