import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
export default defineConfig([
  ...nextVitals,
  ...nextTs,
  { rules: { "@next/next/no-img-element": "off" } },
  globalIgnores([
    ".next/**",
    ".next-http-test/**",
    "next-env.d.ts",
    "public/**",
    "docs/**",
    "src/generated/**",
    ".local/**",
    "backups/**",
    "output/**",
    "tmp/**",
    "Vercel/**",
  ]),
]);
