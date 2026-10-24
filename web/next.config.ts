import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@calhacks13/lib"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
