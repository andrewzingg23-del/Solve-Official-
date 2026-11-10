// Apps: one external capability, end to end — an outside AI app connects to a person's Solve and
// does real work there, within what they allowed, and stops the moment they disconnect it.
//
// The path is exactly what Claude or ChatGPT takes: dynamic client registration with staging's
// OAuth server, PKCE authorization, the person's approval on Solve's own consent screen, the code
// exchanged for a token, then the connector at /mcp. Everything the app claims to have done is read
// back from the kernel as the person, never trusted from the app's reply.
import { createHash, randomBytes } from "node:crypto";
import { MARK, STAGING, VIEWPORTS, beginThing, close, persona } from "../lib.mjs";

const S = "apps";
const REDIRECT = "http://127.0.0.1:8765/callback";
const b64url = buf => Buffer.from(buf).toString("base64url");

async function mcp(base, token, method, params = {}) {
  const r = await fetch(base + "/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify({ jsonrpc: "2.0", id: Math.floor(Math.random() * 1e9), method, params }),
  });
  const body = await r.json().catch(() => null);
  return { status: r.status, body, challenge: r.headers.get("www-authenticate") ?? "" };
}
const call = (base, token, name, args = {}) => mcp(base, token, "tools/call", { name, arguments: args });
// A refusal counts only when it is the kernel saying no on permission — never a broken deployment,
// a bad key or any other error that merely looks like a refusal.
const refused = res => Boolean(res.body?.result?.isError) && /may not add to that|has not been let into that/i.test(said(res));
const said = res => res.body?.result?.content?.map(c => c.text).join(" ") ?? JSON.stringify(res.body)?.slice(0, 300);

export async function apps({ browser, base, evidence }) {
  const owner = await persona(browser, base, "owner", VIEWPORTS.phone390, evidence, S);
  const appName = `${MARK} AI app`;
  try {
    if (!owner.kernel) return;
    const { page } = owner;

    // --- A Space of the person's own that the app is never let into.
    const privateTitle = `${MARK} Diary, just mine`;
    const privateId = await beginThing(page, base, privateTitle);
    evidence.record(S, owner.role, "has a private Space of their own", Boolean(privateId));

    // --- The app registers itself, as an AI client does on first connect.
    const reg = await fetch(`${STAGING.url}/auth/v1/oauth/clients/register`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_name: appName, redirect_uris: [REDIRECT], token_endpoint_auth_method: "none",
        grant_types: ["authorization_code", "refresh_token"], response_types: ["code"] }),
    }).then(r => r.json()).catch(e => ({ error: e.message }));
    const clientId = reg.client_id ?? "";
    if (!evidence.record(S, "app", "registers with Solve's OAuth server", Boolean(clientId), JSON.stringify(reg).slice(0, 200))) return;

    // --- It asks to connect (PKCE). Staging's OAuth server sends the person to approve it.
    const verifier = b64url(randomBytes(32));
    const challenge = b64url(createHash("sha256").update(verifier).digest());
    const state = b64url(randomBytes(12));
    const authorize = `${STAGING.url}/auth/v1/oauth/authorize?` + new URLSearchParams({
      client_id: clientId, redirect_uri: REDIRECT, response_type: "code", code_challenge: challenge, code_challenge_method: "S256", state,
    });
    const sent = await fetch(authorize, { redirect: "manual" });
    const to = new URL(sent.headers.get("location") ?? "about:blank");
    const authorizationId = to.searchParams.get("authorization_id") ?? "";
    evidence.record(S, "app", "is sent to Solve's consent screen with a pending request", to.pathname === "/oauth/consent" && Boolean(authorizationId),
      `${sent.status} → ${to.origin}${to.pathname}`);
    // Staging's Auth Site URL decides which deployment that screen is on; this run approves on the
    // build under test, with the same request.
    evidence.record(S, "harness", "note: staging sends approvals to", true, to.origin);

    // --- Nothing reaches the connector without a token, and it says where to get one.
    const anon = await mcp(base, "", "tools/list");
    evidence.record(S, "app", "the connector refuses a request with no token, and points to the OAuth metadata",
      anon.status === 401 && /resource_metadata=/.test(anon.challenge), `${anon.status} ${anon.challenge}`);

    // --- The person sees who is asking and what it may do, and lets it read and add.
    let code = "", returnedState = "";
    await owner.context.route("http://127.0.0.1:8765/**", route => {
      const u = new URL(route.request().url());
      code = u.searchParams.get("code") ?? ""; returnedState = u.searchParams.get("state") ?? "";
      return route.fulfill({ status: 200, contentType: "text/plain", body: "The app received its code." });
    });
    await page.goto(`${base}/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`);
    const heading = await page.getByRole("heading", { level: 1 }).textContent().catch(() => "");
    evidence.record(S, owner.role, "the consent screen names the app asking", (heading ?? "").includes(appName), heading ?? "");
    const facts = await page.locator("main").innerText().catch(() => "");
    evidence.record(S, owner.role, "and says plainly what it can't do", /can.t pay, buy or commit/i.test(facts) && /disconnect it at any time/i.test(facts));
    await evidence.shot(page, "apps-01-consent-390");
    await page.getByRole("radio", { name: /Read and add/ }).check();
    await page.locator("[data-connect]").click();
    await page.waitForURL(u => u.toString().startsWith("http://127.0.0.1:8765/"), { timeout: 20000 }).catch(() => {});
    evidence.record(S, "app", "receives an authorization code, with its own state back", Boolean(code) && returnedState === state);

    // --- The code becomes a token only with the verifier the app kept.
    const exchange = (extra) => fetch(`${STAGING.url}/auth/v1/oauth/token`, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, redirect_uri: REDIRECT, ...extra }),
    }).then(async r => ({ status: r.status, body: await r.json().catch(() => ({})) }));
    const wrong = await exchange({ grant_type: "authorization_code", code, code_verifier: b64url(randomBytes(32)) });
    evidence.record(S, "app", "a wrong verifier gets no token", !wrong.body.access_token, `${wrong.status}`);
    const tokens = await exchange({ grant_type: "authorization_code", code, code_verifier: verifier });
    const token = tokens.body.access_token ?? "";
    if (!evidence.record(S, "app", "exchanges the code for a token", Boolean(token), `${tokens.status} ${JSON.stringify(tokens.body).slice(0, 160)}`)) return;

    // --- It can see what it may use, and who it is acting for.
    const listed = await mcp(base, token, "tools/list");
    const names = (listed.body?.result?.tools ?? []).map(t => t.name);
    evidence.record(S, "app", "lists the connector's tools, and offers no way to create a Space it couldn't", names.includes("add_to_world") && !names.includes("start_world"), names.join(","));
    const who = await call(base, token, "whoami");
    evidence.record(S, "app", "whoami answers for this person's connection", who.status === 200 && !who.body?.result?.isError, said(who).slice(0, 160));

    // --- The person makes a Space and, from that Space, lets their AI in to add.
    const title = `${MARK} Plan the reunion picnic`;
    const worldId = await beginThing(page, base, title);
    evidence.record(S, owner.role, "makes a Space for the goal", Boolean(worldId));
    const before = await call(base, token, "add_to_world", { world_id: worldId, title: "Early", body: "Before I was let in" });
    evidence.record(S, "app", "cannot add to it before being let in (refused on permission)",
      refused(before), said(before).slice(0, 200));
    const control = page.locator("[data-ai-access]");
    evidence.record(S, owner.role, "the Space offers a control for their AI, off by default",
      await control.waitFor({ timeout: 15000 }).then(() => true, () => false) && await control.locator('[data-ai-choice="none"]').isChecked());
    await control.locator('[data-ai-choice="add"]').check();
    evidence.record(S, owner.role, "letting it in to add is confirmed",
      await control.locator("[data-ai-note]").filter({ hasText: "add drafts" }).waitFor({ timeout: 15000 }).then(() => true, () => false));
    await evidence.shot(page, "apps-02-let-ai-in-390");
    const seen = await call(base, token, "list_worlds");
    const entry = (seen.body?.result?.structuredContent?.worlds ?? []).find(w => w.world_id === worldId);
    evidence.record(S, "app", "now sees the Space, with add access", entry?.bot_access === "add", said(seen).slice(0, 200));

    // --- Real work: it adds a draft — read back from the kernel, never trusted from its reply.
    const added = await call(base, token, "add_to_world", { world_id: worldId, title: "Shortlist", body: "Riverside Park or Elm Grove, Saturday the 14th" });
    const artifactId = added.body?.result?.structuredContent?.artifact_id ?? "";
    evidence.record(S, "app", "adds a draft to it", Boolean(artifactId) && !added.body?.result?.isError, said(added).slice(0, 200));

    const rows = await owner.kernel.rpc("read_world", { p_scope: `world:${worldId}` }).catch(e => e);
    evidence.record(S, owner.role, "the kernel holds the draft in their Space, readable by them", Array.isArray(rows) && rows.some(r => r.entity_id === artifactId),
      rows instanceof Error ? rows.message : `${rows.length} records`);
    const events = await owner.kernel.rpc("read_events", { p_scope: `world:${worldId}`, p_after_seq: 0, p_limit: 200, p_newest_first: false }).catch(() => []);
    const made = Array.isArray(events) ? events.find(e => e.type === "kernel.entity.created" && e.payload?.entity_id === artifactId) : null;
    evidence.record(S, owner.role, "the draft is recorded as written by their AI, not by them", Boolean(made) && made.actor_id !== owner.actorId,
      made ? `author ${made.actor_id === owner.actorId ? "the person" : "their AI"}` : "no creation event found");

    // --- Switched off, it is refused again at once.
    await page.goto(`${base}/world/${encodeURIComponent(worldId)}`);
    await page.locator('[data-ai-access] [data-ai-choice="none"]').check();
    await page.locator("[data-ai-note]").filter({ hasText: "can't see" }).waitFor({ timeout: 15000 }).catch(() => {});
    const off = await call(base, token, "add_to_world", { world_id: worldId, title: "After", body: "After I was taken out" });
    evidence.record(S, "app", "once switched off, it is refused (on permission)", refused(off), said(off).slice(0, 200));

    // --- The person sees it in Solve, credited to their AI.
    await page.goto(`${base}/world/${encodeURIComponent(worldId)}`);
    const draft = page.locator("[data-piece]", { hasText: "Riverside Park" });
    const shown = await draft.waitFor({ timeout: 15000 }).then(() => true, () => false);
    const author = shown ? (await draft.locator("[data-author]").textContent())?.trim() ?? "" : "";
    evidence.record(S, owner.role, "opens it in Solve and sees the draft, credited to their AI", shown && author !== "You" && author.length > 0, author);
    await evidence.shot(page, "apps-02-ai-draft-390");

    // --- The boundary: a Space it was never let into stays closed to it.
    // Refused for the right reason: permission, not a deployment that can't act at all.
    const peek = await call(base, token, "read_world", { world_id: privateId });
    evidence.record(S, "app", "cannot read a Space it was never let into (refused on permission)",
      refused(peek) && !said(peek).includes(privateTitle), said(peek).slice(0, 200));
    const intrude = await call(base, token, "add_to_world", { world_id: privateId, title: "Hi", body: "Let me in" });
    evidence.record(S, "app", "cannot add to it either (refused on permission)", refused(intrude), said(intrude).slice(0, 200));

    // --- The person disconnects it in Apps; it stops at once.
    await page.goto(base + "/apps");
    const row = page.locator(`[data-app="${clientId}"]`);
    evidence.record(S, owner.role, "sees the app under Apps, connected", await row.waitFor({ timeout: 15000 }).then(() => true, () => false));
    await evidence.shot(page, "apps-03-connected-390");
    await row.locator("[data-disconnect]").click();
    evidence.record(S, owner.role, "disconnecting removes it from the list", await row.waitFor({ state: "detached", timeout: 15000 }).then(() => true, () => false));
    const after = await call(base, token, "whoami");
    evidence.record(S, "app", "its token is refused immediately after", after.status === 401, `${after.status}`);
    const refreshed = await exchange({ grant_type: "refresh_token", refresh_token: tokens.body.refresh_token ?? "" });
    evidence.record(S, "app", "and it cannot refresh its way back in", !refreshed.body.access_token, `${refreshed.status}`);

    // --- The person's work stays theirs after the AI is gone.
    await page.goto(`${base}/world/${encodeURIComponent(worldId)}`);
    evidence.record(S, owner.role, "the Space and the AI's draft are still theirs after disconnecting",
      await page.locator("[data-piece]", { hasText: "Riverside Park" }).waitFor({ timeout: 15000 }).then(() => true, () => false));

    evidence.record(S, owner.role, "no uncaught errors in the page", owner.errors.length === 0, owner.errors.join(" | "));
  } finally {
    await close(owner);
  }
}
