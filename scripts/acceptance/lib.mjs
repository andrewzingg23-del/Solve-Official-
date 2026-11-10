// SOLVE acceptance harness: the real application, the real staging kernel, real browsers.
//
// What makes this different from scripts/test-product.mjs: that suite runs the app with no
// database, so it can only prove layout and device-local behaviour. This one builds the app exactly
// as a Vercel preview is built (VERCEL_ENV=preview → solve-staging), drives it as several
// independent people, and then reads every result back through the kernel with that person's own
// session — so a check passes only if the kernel itself agrees, under its own authority rules.
//
// Every identity created here is an automated staging fixture, never a real person: each is
// labelled "[automated]" in the kernel where the kernel allows it, and everything they write
// starts with the run's marker, so no fixture can be mistaken for genuine human activity.

import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

export const STAGING = {
  ref: "taeikshnbcsjlgbattyp",
  url: "https://taeikshnbcsjlgbattyp.supabase.co",
  // Public by design: it ships in browser code (lib/supabase/config.ts).
  publishableKey: "sb_publishable_uiH3w7rzYgDe0Q7xF0N78Q_7H-5Hb_b",
};

export const RUN = `acc-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "")}-${Math.random().toString(36).slice(2, 6)}`;
export const MARK = `[automated ${RUN}]`;

export const VIEWPORTS = {
  phone320: { width: 320, height: 720 },
  phone390: { width: 390, height: 844 },
  desktop: { width: 1440, height: 1000 },
};

export function chromiumPath() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const cache = process.env.PLAYWRIGHT_BROWSERS_PATH
    || join(homedir(), process.platform === "darwin" ? "Library/Caches/ms-playwright" : ".cache/ms-playwright");
  const binaries = [
    "chrome-linux/chrome", "chrome-linux64/chrome", "chrome-linux/headless_shell", "chrome-linux64/headless_shell",
    "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
    "chrome-mac/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
    "chrome-headless-shell-mac-arm64/chrome-headless-shell", "chrome-headless-shell-mac/chrome-headless-shell",
  ];
  if (!existsSync(cache)) return null;
  for (const dir of readdirSync(cache).filter(d => /^chromium(?:_headless_shell)?-\d+$/.test(d)).sort().reverse()) {
    for (const bin of binaries) if (existsSync(join(cache, dir, bin))) return join(cache, dir, bin);
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Evidence. Every check is recorded with its outcome, and every step can leave a screenshot, so a
// failure arrives with what the person would have seen rather than only an assertion message.

export class Evidence {
  constructor(dir) {
    this.dir = dir;
    mkdirSync(dir, { recursive: true });
    this.checks = [];
    this.shots = [];
  }
  record(scenario, persona, claim, ok, detail = "") {
    this.checks.push({ scenario, persona, claim, ok, detail: String(detail).slice(0, 500) });
    const mark = ok ? "✔" : "✖";
    console.log(`${mark} [${scenario}] ${persona}: ${claim}${ok ? "" : ` — ${detail}`}`);
    return ok;
  }
  async shot(page, name) {
    const file = join(this.dir, `${name}.png`);
    await page.screenshot({ path: file, fullPage: true }).catch(() => {});
    this.shots.push(file);
    return file;
  }
  get failures() { return this.checks.filter(c => !c.ok); }
  write(meta) {
    const report = { run: RUN, ...meta, checks: this.checks, screenshots: this.shots };
    writeFileSync(join(this.dir, "report.json"), JSON.stringify(report, null, 2));
    const lines = [
      `# Acceptance run ${RUN}`, "",
      `Target: ${meta.target}  `,
      `Build: ${meta.build}  `,
      `Result: **${this.failures.length === 0 ? "PASS" : `FAIL (${this.failures.length})`}** — ${this.checks.length} checks`, "",
      "All identities below are automated staging fixtures, not real people.", "",
      "| | Scenario | Persona | Claim | Detail |", "|---|---|---|---|---|",
      ...this.checks.map(c => `| ${c.ok ? "✔" : "✖"} | ${c.scenario} | ${c.persona} | ${c.claim} | ${c.ok ? "" : c.detail.replace(/\|/g, "/")} |`),
    ];
    writeFileSync(join(this.dir, "report.md"), lines.join("\n") + "\n");
  }
}

// ---------------------------------------------------------------------------------------------
// The kernel, as a given person. Reads go through kernel_api with that person's own token, so the
// kernel's own authority rules decide what comes back. Nothing here uses a service key.

export function kernelFor(accessToken) {
  const sb = createClient(STAGING.url, STAGING.publishableKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return {
    // Storage as this person: every read and write is decided by the kernel's file_allowed.
    storage: sb.storage,
    async rpc(fn, args = {}) {
      const { data, error } = await sb.schema("kernel_api").rpc(fn, args);
      if (error) throw Object.assign(new Error(`${fn}: ${error.message}`), { code: error.code });
      return data;
    },
  };
}

/** The Supabase session a browser context is holding, read from its @supabase/ssr cookies. */
export async function sessionOf(context) {
  const base = `sb-${STAGING.ref}-auth-token`;
  const cookies = (await context.cookies()).filter(c => c.name === base || c.name.startsWith(base + "."));
  if (cookies.length === 0) return null;
  const whole = cookies.find(c => c.name === base);
  const raw = whole
    ? whole.value
    : cookies.sort((a, b) => Number(a.name.split(".").pop()) - Number(b.name.split(".").pop())).map(c => c.value).join("");
  let text = decodeURIComponent(raw);
  if (text.startsWith("base64-")) text = Buffer.from(text.slice("base64-".length), "base64").toString("utf8");
  try { return JSON.parse(text); } catch { return null; }
}

// ---------------------------------------------------------------------------------------------
// A persona: an independent browser context, so cookies, storage and identity are fully separate.

export async function persona(browser, base, role, viewport, evidence, scenario) {
  const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(base + "/");
  // The proxy gives every visitor an anonymous identity and registers it with the kernel.
  const session = await sessionOf(context);
  const who = { role, context, page, errors, session, kernel: null, actorId: null };
  if (!evidence.record(scenario, role, "is given an identity on first visit, with no sign-up", Boolean(session?.access_token),
    "no Supabase session cookie after visiting Home")) return who;
  who.kernel = kernelFor(session.access_token);
  const me = await who.kernel.rpc("whoami").catch(e => e);
  const actor = Array.isArray(me) ? me[0] : null;
  who.actorId = actor?.actor_id ?? null;
  evidence.record(scenario, role, "that identity is a kernel actor", Boolean(who.actorId), me instanceof Error ? me.message : "whoami empty");
  // Label the fixture so it is never mistaken for a real person. Best effort: the kernel may refuse
  // to label an anonymous actor, in which case the run marker in every record still identifies it.
  if (who.actorId) {
    const set = await who.kernel.rpc("set_person_label", { p_label: `${MARK} ${role}`, p_request_id: `${RUN}-${role}-label` })
      .then(() => null, e => e.message);
    // Read it back rather than trusting the write: the harness holds its own fixtures to the same
    // standard as the product.
    const back = await who.kernel.rpc("read_actors", { p_actor_ids: [who.actorId] }).catch(() => []);
    const label = Array.isArray(back) ? back[0]?.label ?? "" : "";
    evidence.record(scenario, role, "is labelled as an automated fixture in the kernel, read back", label.startsWith(MARK),
      set ? `kernel refused the label (${set})` : `read back "${label}"`);
  }
  return who;
}

export async function close(...personas) {
  for (const p of personas) await p?.context?.close().catch(() => {});
}

/** Our words, which a person should never see on their own thing (DECISIONS.md 2026-11-09). */
export const OUR_WORDS = /\b(World|Worlds|Project|Projects|kernel|Kernel)\b/;

/**
 * Internal identifiers a person must never be shown: scope ids such as "world:<uuid>" and bare
 * UUIDs. Found on the 2026-11-09 run, where the record rendered its scope id under "whose it is".
 */
export const INTERNAL_IDS = /\b(world|actor|community|system):[0-9a-f]{8}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * Write something in Your Space's box and send it. Starting something takes the person into it, so this
 * waits for the thing's own page and returns its id (empty when it didn't arrive).
 */
/** Open the Space switcher on Your Space and return the link to one of the person's Spaces. */
export async function switcherEntry(page, base, title) {
  await page.goto(base + "/");
  await page.locator("summary", { hasText: "Your Space" }).click();
  return page.locator("[aria-label='Your Spaces'] a[data-thing]", { hasText: title });
}

/** Open a Space's sharing panel (one line until opened) the way a person would, if it isn't open. */
export async function openShare(page) {
  const panel = page.locator("[data-share]");
  await panel.waitFor({ timeout: 15000 });
  if (!(await panel.evaluate(el => el.open))) await panel.locator("summary").click();
}

export async function beginThing(page, base, words) {
  await page.goto(base + "/");
  await page.getByRole("textbox", { name: "Ask, create, or add anything" }).fill(words);
  await page.getByRole("button", { name: "Make it a Space" }).click();
  const arrived = await page.waitForURL(/\/world\/[0-9a-f-]{36}$/, { timeout: 20000 }).then(() => true, () => false);
  if (!arrived) return "";
  await page.getByRole("heading", { level: 1 }).waitFor({ timeout: 15000 }).catch(() => {});
  return decodeURIComponent(new URL(page.url()).pathname.split("/")[2] ?? "");
}
