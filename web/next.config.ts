import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@calhacks13/lib"],
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        // Keep CSS Modules scoped; rewriting them as *.css removes their exports.
        condition: { not: { path: "*.module.css" } },
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
