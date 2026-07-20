import type { NextConfig } from "next";

const indexingDisabled = process.env.NEXT_PUBLIC_DISABLE_INDEXING === "true";
const allowIndexing =
  !indexingDisabled &&
  (process.env.NEXT_PUBLIC_ALLOW_INDEXING === "true" ||
    process.env.VERCEL_ENV === "production");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(self), payment=()",
          },
          ...(!allowIndexing
            ? [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
