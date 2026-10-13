import type { NextConfig } from "next";
import { THUMBNAIL_HOST_PATTERNS } from "./src/lib/thumbnail-hosts";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

// "jobs" (Docker/VPS: antrean + progress SSE) atau "direct" (Vercel: satu request per unduhan).
const downloadMode = process.env.DOWNLOAD_MODE || (process.env.VERCEL === "1" ? "direct" : "jobs");

const nextConfig: NextConfig = {
  // Untuk Docker: hasil build mandiri di .next/standalone (lihat Dockerfile).
  output: "standalone",
  env: { NEXT_PUBLIC_DOWNLOAD_MODE: downloadMode },
  // Vercel: ikutkan binary yt-dlp & ffmpeg (diunduh scripts/fetch-binaries.mjs) ke function API.
  outputFileTracingIncludes: { "/api/**/*": ["./vendor/bin/**/*"] },
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  images: {
    remotePatterns: THUMBNAIL_HOST_PATTERNS.map((hostname) => ({ protocol: "https" as const, hostname })),
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/api/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex" }] },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
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
