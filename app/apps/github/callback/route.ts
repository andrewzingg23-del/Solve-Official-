import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getUser } from "@/lib/supabase/server";
import { getKernel } from "@/lib/kernel/server";
import { exchangeGithubCode, githubGet } from "@/lib/product/providers/github";
import { readProvider, writeProvider } from "@/lib/product/credentials";

// GitHub sends the person back here. Only the request Solve started is accepted (state matches the
// cookie; PKCE proves the same browser); the tokens are sealed into the person's own record and never
// leave the server. The account recorded is the one GitHub itself reports.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const back = (result: string) => NextResponse.redirect(new URL(`/apps?github=${result}`, url.origin));
  const jar = await cookies();
  const pending = (() => { try { return JSON.parse(jar.get("solve_github_oauth")?.value ?? ""); } catch { return null; } })() as { state?: string; verifier?: string } | null;
  jar.delete({ name: "solve_github_oauth", path: "/apps/github" });
  if (url.searchParams.get("error")) return back("declined");
  const code = url.searchParams.get("code");
  if (!code || !pending?.state || pending.state !== url.searchParams.get("state") || !pending.verifier) return back("expired");
  if (!(await getUser())) return back("signed-out");
  try {
    const tokens = await exchangeGithubCode(code, pending.verifier, `${url.origin}/apps/github/callback`);
    const me = await githubGet(tokens.accessToken, "/user");
    const login = me.status === 200 ? String((me.body as { login?: unknown }).login ?? "") : "";
    if (!login) return back("failed");
    const kernel = await getKernel();
    const person = (await kernel.whoami()).actor_id;
    const current = await readProvider(kernel, person, "github");
    await writeProvider(kernel, person, "github", current, { account: login, status: "connected", secret: tokens }, `gh-connect:${crypto.randomUUID()}`);
    return back("connected");
  } catch {
    return back("failed");
  }
}
