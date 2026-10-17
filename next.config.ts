import type { NextConfig } from "next";

/**
 * Tempo is a fully static site (`output: "export"`): no server code runs in
 * production. Security and cross-origin-isolation headers are therefore set
 * by the host — see vercel.json, public/_headers (Netlify / Cloudflare
 * Pages) and scripts/serve.mjs (local production preview). Keep the three in
 * sync with SECURITY_HEADERS in scripts/headers.mjs.
 */
const isDev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  // Static export for production. In development the Next dev server is
  // used instead, so we can attach the same cross-origin-isolation headers
  // there and the multi-threaded engine works locally too.
  ...(isDev
    ? {
        async headers() {
          return [
            {
              source: "/:path*",
              headers: [
                { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
                { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
              ],
            },
          ];
        },
      }
    : { output: "export" as const }),
  trailingSlash: false,
  images: { unoptimized: true },
  poweredByHeader: false,
  reactStrictMode: true,
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
