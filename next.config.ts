import type { NextConfig } from "next";
const config: NextConfig = {
  distDir: process.env.WAPALA_TEST_HTTP === "1" ? ".next-http-test" : ".next",
  output: "standalone",
  devIndicators: false,
  turbopack: {
    // Keep nested release-extraction checks and deployment builds scoped to
    // their own package lockfile rather than a parent workspace.
    root: process.cwd(),
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "no-referrer" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          ...(process.env.NODE_ENV === "production"
            ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }]
            : []),
        ],
      },
    ];
  },
};
export default config;
