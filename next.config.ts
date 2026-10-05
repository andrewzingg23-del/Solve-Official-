import { execFileSync } from "node:child_process";
import type { NextConfig } from "next";

// The trunk's recent commits as this deployment was built, so a Build Room can show who did what on
// the deployed branch without a GitHub token (lib/github/deployed.ts). Empty if git isn't there.
function recentCommits(): string {
  try {
    const out = execFileSync("git", ["log", "-n", "30", "--format=%H%x1f%cI%x1f%B%x1e"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 5000 });
    const commits = out.split("\x1e").map((r) => r.trim()).filter(Boolean).map((r) => {
      const [sha, at, message] = r.split("\x1f");
      return { sha, at, message: (message ?? "").slice(0, 400) };
    });
    return JSON.stringify(commits);
  } catch {
    return "[]";
  }
}

const nextConfig: NextConfig = {
  env: {
    // Which Vercel environment this is (preview runs on solve-staging; lib/supabase/config.ts).
    NEXT_PUBLIC_SOLVE_DEPLOY: process.env.VERCEL_ENV ?? "",
    SOLVE_DEPLOYED_REPO: process.env.VERCEL_GIT_REPO_OWNER && process.env.VERCEL_GIT_REPO_SLUG ? `${process.env.VERCEL_GIT_REPO_OWNER}/${process.env.VERCEL_GIT_REPO_SLUG}` : "",
    SOLVE_DEPLOYED_REF: process.env.VERCEL_GIT_COMMIT_REF ?? "",
    SOLVE_DEPLOYED_AT: new Date().toISOString(),
    SOLVE_DEPLOYED_LOG: process.env.VERCEL_GIT_COMMIT_REF ? recentCommits() : "[]",
  },
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
