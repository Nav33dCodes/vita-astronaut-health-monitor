import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    // Optimised images come from hashed static imports, so they can be cached for a long time.
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
  // /_next/static assets are content-hashed and already immutable. Public icons are not hashed,
  // so they get a long-but-revalidating policy instead.
  async headers() {
    return [
      {
        source: "/icons/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800, stale-while-revalidate=86400" }],
      },
    ];
  },
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
