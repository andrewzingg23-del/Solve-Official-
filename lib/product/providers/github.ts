// Server only: imported from server actions, route handlers and the connector, never a client component.

// GitHub, through its officially supported method for acting on a person's behalf: a GitHub App's
// user authorization (OAuth web flow with state and PKCE). The person chooses which repositories
// the app can see when they install it; its permissions are read-only (Contents, Metadata); user
// tokens expire after eight hours and are renewed with a refresh token, so a lapsed token is
// recovered without asking the person, until GitHub itself needs their consent again.
//
// Infrastructure, configured once by Solve's administrator (never by a customer):
//   GITHUB_APP_CLIENT_ID      the app's client id (public)
//   GITHUB_APP_CLIENT_SECRET  its client secret (server only)
// Without them this deployment says plainly that GitHub isn't available — it doesn't pretend.
export const GITHUB = {
  authorize: "https://github.com/login/oauth/authorize",
  token: "https://github.com/login/oauth/access_token",
  api: "https://api.github.com",
} as const;

export function githubConfig(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.GITHUB_APP_CLIENT_ID?.trim();
  const clientSecret = process.env.GITHUB_APP_CLIENT_SECRET?.trim();
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}

export type GithubTokens = { accessToken: string; expiresAt: string | null; refreshToken: string | null; refreshExpiresAt: string | null };

function tokensFrom(body: Record<string, unknown>, now = Date.now()): GithubTokens {
  const seconds = (k: string) => typeof body[k] === "number" ? new Date(now + (body[k] as number) * 1000).toISOString() : null;
  return {
    accessToken: String(body.access_token),
    expiresAt: seconds("expires_in"),
    refreshToken: typeof body.refresh_token === "string" ? body.refresh_token : null,
    refreshExpiresAt: seconds("refresh_token_expires_in"),
  };
}

/** GitHub answers token requests with 200 even on failure; the error is in the body. */
async function tokenRequest(params: Record<string, string>, fetchImpl: typeof fetch): Promise<GithubTokens> {
  const config = githubConfig();
  if (!config) throw new Error("GitHub isn't set up on this deployment.");
  const res = await fetchImpl(GITHUB.token, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, ...params }),
    signal: AbortSignal.timeout(10000),
  });
  const body = await res.json().catch(() => ({})) as Record<string, unknown>;
  if (!res.ok || typeof body.access_token !== "string") throw new GithubAuthError(String(body.error ?? res.status), String(body.error_description ?? ""));
  return tokensFrom(body);
}

/** GitHub refused a token request: the person must sign in to GitHub again (e.g. bad_refresh_token). */
export class GithubAuthError extends Error {
  constructor(readonly code: string, description: string) { super(description || code); }
}

export function githubAuthorizeUrl(state: string, challenge: string, redirectUri: string): string {
  const config = githubConfig();
  if (!config) throw new Error("GitHub isn't set up on this deployment.");
  return `${GITHUB.authorize}?${new URLSearchParams({ client_id: config.clientId, redirect_uri: redirectUri, state, code_challenge: challenge, code_challenge_method: "S256", allow_signup: "false" })}`;
}

export const exchangeGithubCode = (code: string, verifier: string, redirectUri: string, fetchImpl: typeof fetch = fetch) =>
  tokenRequest({ code, code_verifier: verifier, redirect_uri: redirectUri }, fetchImpl);

export const refreshGithubToken = (refreshToken: string, fetchImpl: typeof fetch = fetch) =>
  tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken }, fetchImpl);

/** A GitHub REST call as the person. Throws with GitHub's own status so callers can tell a lapsed token from a missing repo. */
export async function githubGet(token: string, path: string, fetchImpl: typeof fetch = fetch): Promise<{ status: number; body: unknown; raw: string }> {
  const res = await fetchImpl(`${GITHUB.api}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", "User-Agent": "Solve" },
    signal: AbortSignal.timeout(10000),
  });
  const raw = await res.text();
  let body: unknown = null;
  try { body = JSON.parse(raw); } catch { /* not JSON */ }
  return { status: res.status, body, raw };
}
