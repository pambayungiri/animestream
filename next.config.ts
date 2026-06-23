import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prevent Turbopack/webpack from bundling these packages so that
  // __dirname resolves correctly at runtime (got-scraping's header-generator
  // reads JSON data files relative to __dirname at construction time).
  serverExternalPackages: ["got-scraping", "header-generator", "fingerprint-generator", "fingerprint-injector"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.otakudesu.blog" },
      { protocol: "https", hostname: "**.otakudesu.info" },
      { protocol: "https", hostname: "i0.wp.com" },
      { protocol: "https", hostname: "i1.wp.com" },
      { protocol: "https", hostname: "i2.wp.com" },
      { protocol: "https", hostname: "i3.wp.com" },
    ],
  },
};

export default nextConfig;
