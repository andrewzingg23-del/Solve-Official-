import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { githubAuthorizeUrl, githubConfig } from "@/lib/product/providers/github";

// Start connecting the person's GitHub: GitHub's own approval screen, with state and PKCE kept in a
// short-lived, httpOnly cookie that only this deployment can read back.
export async function GET(request: Request) {
  const origin = new URL(request.url).origin;
  if (!githubConfig()) return NextResponse.redirect(new URL("/apps?github=unavailable", origin));
  if (!(await getUser())) return NextResponse.redirect(new URL("/login?next=%2Fapps", origin));
  const state = randomBytes(16).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const response = NextResponse.redirect(githubAuthorizeUrl(state, challenge, `${origin}/apps/github/callback`));
  response.cookies.set("solve_github_oauth", JSON.stringify({ state, verifier }), {
    httpOnly: true, secure: origin.startsWith("https:"), sameSite: "lax", path: "/apps/github", maxAge: 600,
  });
  return response;
}
