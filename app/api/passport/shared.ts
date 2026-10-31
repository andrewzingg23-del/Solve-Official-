// The short-lived cookie that carries one connect attempt (state, PKCE verifier, client id) from
// /api/passport/connect to /api/passport/callback. HttpOnly, scoped to these routes, 10 minutes.
export const FLOW_COOKIE = "solve_passport_flow";
export const FLOW_MAX_AGE = 600;
export type Flow = { state: string; verifier: string; clientId: string; redirectUri: string };

export function readFlow(raw: string | undefined): Flow | null {
  if (!raw) return null;
  try {
    const f = JSON.parse(raw) as Record<string, unknown>;
    return typeof f.state === "string" && typeof f.verifier === "string" && typeof f.clientId === "string" && typeof f.redirectUri === "string"
      ? { state: f.state, verifier: f.verifier, clientId: f.clientId, redirectUri: f.redirectUri }
      : null;
  } catch {
    return null;
  }
}

export const back = (origin: string, outcome: string) => `${origin}/bot?section=knowledge&passport=${encodeURIComponent(outcome)}`;
