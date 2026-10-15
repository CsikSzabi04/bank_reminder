import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { SECURITY_HEADERS, SERVICE_WORKER_HEADERS } from "./lib/security/headers";

const withNextIntl = createNextIntlPlugin("./lib/i18n/request.ts");

const nextConfig: NextConfig = {
  // a fejlesztői „N" jelző ne takarja a navigációt (tesztek, képernyőképek); a hibák a konzolban/terminálban látszanak
  devIndicators: false,
  // a Névjegy a verziót innen mutatja (npm-szkriptből indítva az npm_package_version él)
  env: { NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version ?? "" },
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      { source: "/:path*", headers: [...SECURITY_HEADERS] },
      { source: "/sw.js", headers: [...SERVICE_WORKER_HEADERS] },
      // a statikus offline oldal inline stílust használ, script nincs: szigorú, nonce nélküli CSP
      {
        source: "/offline.html",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "default-src 'none'; style-src 'unsafe-inline'; img-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
