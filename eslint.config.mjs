import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
export default defineConfig([
  ...nextVitals, ...nextTs,
  // Historical QA utilities intentionally use the CommonJS .cjs format.
  { files: ["QAM/evidence/**/*.cjs"], rules: { "@typescript-eslint/no-require-imports": "off" } },
  globalIgnores([".next/**", ".next-mission003/**", ".next-local-verification/**", "next-env.d.ts", "playwright-report/**", "test-results/**"]),
]);
