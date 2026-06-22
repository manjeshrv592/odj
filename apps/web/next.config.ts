import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // @odj/shared is shipped as TypeScript source; Next must transpile it.
  transpilePackages: ["@odj/shared"],
};

export default nextConfig;
