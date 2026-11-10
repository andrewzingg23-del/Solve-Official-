// Probe (not part of the suite): what can an outside AI app's OAuth token reach when it bypasses the
// connector and calls the kernel API directly? Uses a fresh automated fixture on staging.
import { createHash, randomBytes } from "node:crypto";
import { chromium } from "playwright-core";
import { STAGING, VIEWPORTS, beginThing, chromiumPath, kernelFor, persona, Evidence, RUN } from "../lib.mjs";

const base = process.argv[2];
const REDIRECT = "http://127.0.0.1:8765/callback";
const b64url = b => Buffer.from(b).toString("base64url");
const evidence = new Evidence(`test-results/acceptance/${RUN}-probe`);
const browser = await chromium.launch({ executablePath: chromiumPath(), args: ["--no-sandbox"] });
try {
  const owner = await persona(browser, base, "owner", VIEWPORTS.phone390, evidence, "probe");
  const secret = `${RUN} private diary`;
  const worldId = await beginThing(owner.page, base, secret);
  const reg = await fetch(`${STAGING.url}/auth/v1/oauth/clients/register`, { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_name: `[automated ${RUN}] probe app`, redirect_uris: [REDIRECT], token_endpoint_auth_method: "none", grant_types: ["authorization_code"], response_types: ["code"] }) }).then(r => r.json());
  const verifier = b64url(randomBytes(32)), challenge = b64url(createHash("sha256").update(verifier).digest());
  const sent = await fetch(`${STAGING.url}/auth/v1/oauth/authorize?` + new URLSearchParams({ client_id: reg.client_id, redirect_uri: REDIRECT, response_type: "code", code_challenge: challenge, code_challenge_method: "S256", state: "s" }), { redirect: "manual" });
  const authId = new URL(sent.headers.get("location")).searchParams.get("authorization_id");
  let code = "";
  await owner.context.route("http://127.0.0.1:8765/**", r => { code = new URL(r.request().url()).searchParams.get("code") ?? ""; return r.fulfill({ body: "ok" }); });
  await owner.page.goto(`${base}/oauth/consent?authorization_id=${authId}`);
  await owner.page.locator("[data-connect]").click();   // default: Read only
  await owner.page.waitForURL(u => u.toString().startsWith("http://127.0.0.1:8765/"), { timeout: 20000 }).catch(() => {});
  const tok = await fetch(`${STAGING.url}/auth/v1/oauth/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, code_verifier: verifier, client_id: reg.client_id, redirect_uri: REDIRECT }) }).then(r => r.json());
  const app = kernelFor(tok.access_token);
  const read = await app.rpc("read_world", { p_scope: `world:${worldId}` }).then(rows => rows, e => e);
  const sawIt = Array.isArray(read) && read.some(r => r.title === secret);
  console.log(JSON.stringify({ connected: Boolean(tok.access_token), aiLetIntoThisSpace: "never (Off)",
    directKernelRead: Array.isArray(read) ? `returned ${read.length} records` : `refused: ${read.message}`, sawPrivateTitle: sawIt }));
  const write = await app.rpc("record_event", { p_type: "probe.write", p_scope: `world:${worldId}`, p_payload: {} }).then(() => "written", e => `refused: ${e.message}`);
  console.log(JSON.stringify({ directKernelWrite: write }));
} finally { await browser.close(); }
