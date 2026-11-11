// The connection lifecycle exactly as a compatible AI app runs it — nothing here is specific to one
// provider or one person. Discovery (OAuth metadata at the connector's own address), dynamic client
// registration, PKCE authorization, the person's approval on Solve's consent screen, the code
// exchanged for tokens, then the connector at /mcp with the app's own token.
import { createHash, randomBytes } from "node:crypto";

const REDIRECT = "http://127.0.0.1:8765/callback";
const b64url = buf => Buffer.from(buf).toString("base64url");

export async function mcp(base, token, method, params = {}) {
  const r = await fetch(base + "/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ jsonrpc: "2.0", id: Math.floor(Math.random() * 1e9), method, params }),
  });
  return { status: r.status, body: await r.json().catch(() => null), challenge: r.headers.get("www-authenticate") ?? "" };
}
export const tool = (base, token, name, args = {}) => mcp(base, token, "tools/call", { name, arguments: args });
export const said = res => res.body?.result?.content?.map(c => c.text).join(" ") ?? JSON.stringify(res.body)?.slice(0, 300);

/**
 * Connect an app for `who`, the way any MCP client does, starting from nothing but the connector's
 * address. Returns its client id and tokens, or the step that failed.
 */
export async function connectApp(who, base, appName) {
  // Discovery: the connector says where its authorization server is; that server says the rest.
  const resource = await fetch(`${base}/.well-known/oauth-protected-resource/mcp`).then(r => r.json()).catch(() => null);
  const issuer = resource?.authorization_servers?.[0];
  if (!issuer) return { failed: "discovery: no authorization server advertised" };
  const meta = await fetch(`${issuer.replace(/\/auth\/v1$/, "")}/.well-known/oauth-authorization-server/auth/v1`).then(r => r.json()).catch(() => null);
  if (!meta?.registration_endpoint) return { failed: "discovery: no registration endpoint" };
  const reg = await fetch(meta.registration_endpoint, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_name: appName, redirect_uris: [REDIRECT], token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"], response_types: ["code"] }) })
    .then(r => r.json()).catch(e => ({ error: e.message }));
  if (!reg.client_id) return { failed: `registration: ${JSON.stringify(reg).slice(0, 160)}` };
  const verifier = b64url(randomBytes(32)), challenge = b64url(createHash("sha256").update(verifier).digest()), state = b64url(randomBytes(12));
  const sent = await fetch(`${meta.authorization_endpoint}?` + new URLSearchParams({ client_id: reg.client_id, redirect_uri: REDIRECT, response_type: "code", code_challenge: challenge, code_challenge_method: "S256", state }), { redirect: "manual" });
  const authorizationId = new URL(sent.headers.get("location") ?? "about:blank").searchParams.get("authorization_id");
  if (!authorizationId) return { failed: "authorization: no consent request" };
  let code = "", back = "";
  await who.context.route("http://127.0.0.1:8765/**", route => { const u = new URL(route.request().url()); code = u.searchParams.get("code") ?? ""; back = u.searchParams.get("state") ?? ""; return route.fulfill({ body: "ok" }); });
  // The approval happens on this deployment's consent screen (staging's Site URL may point elsewhere).
  await who.page.goto(`${base}/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`);
  const heading = (await who.page.getByRole("heading", { level: 1 }).textContent().catch(() => "")) ?? "";
  await who.page.locator("[data-connect]").click();
  await who.page.waitForURL(u => u.toString().startsWith("http://127.0.0.1:8765/"), { timeout: 20000 }).catch(() => {});
  if (!code || back !== state) return { failed: "approval: no code returned", heading };
  const exchange = extra => fetch(meta.token_endpoint, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: reg.client_id, redirect_uri: REDIRECT, ...extra }) }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  const tokens = await exchange({ grant_type: "authorization_code", code, code_verifier: verifier });
  if (!tokens.body.access_token) return { failed: `token: ${tokens.status}` };
  return { clientId: reg.client_id, token: tokens.body.access_token, refreshToken: tokens.body.refresh_token, heading,
    refresh: () => exchange({ grant_type: "refresh_token", refresh_token: tokens.body.refresh_token ?? "" }) };
}
