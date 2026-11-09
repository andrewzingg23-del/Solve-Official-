import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    // The acceptance suite builds against staging into its own directory (scripts/acceptance/run.mjs).
    ".next-acceptance/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated: PGlite's untouched browser files, kernel migrations JSON, browser test bundles.
    "public/pglite/**",
    "public/kernel/**",
    "public/cesium/**",
    "public/arcadia/**",
    ".browser-tests/**",
  ]),
]);

export default eslintConfig;
