import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The /money sandbox runs the kernel in PGlite (WebAssembly) and the chain in LiteSVM (a native
  // addon). Both load files at runtime, so they stay external and their files are traced in.
  serverExternalPackages: ["@electric-sql/pglite", "litesvm"],
  outputFileTracingIncludes: {
    "/money": [
      "./supabase/migrations/*.sql",
      "./node_modules/@electric-sql/pglite/dist/**/*",
      "./node_modules/litesvm/dist/**/*",
      "./node_modules/litesvm-linux-x64-gnu/**/*",
    ],
  },
};

export default nextConfig;
