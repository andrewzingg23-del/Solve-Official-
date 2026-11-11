// A guest's work must survive signing in.
//
// The kernel keys a person to their auth subject, so a new subject means a new person and
// everything the old one held — Spaces, a connected GitHub, an AI's grants — is stranded in one
// browser. These tests hold the line that adding an email keeps the subject, that the one case
// where it cannot is never taken on the person's behalf, and that the confirmation link works.
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

type Fixture = {
  anonymous: boolean;
  updateError: { code?: string; message?: string } | null;
  otpError: { message?: string } | null;
  calls: string[];
  redirect: string;
};

async function loadActions(fixture: Fixture) {
  const dir = await mkdtemp(join(tmpdir(), "solve-continuity-"));
  Object.assign(globalThis, { __continuity: fixture });
  const output = await build({
    entryPoints: ["app/login/actions.ts"], bundle: true, platform: "node", format: "esm", write: false,
    plugins: [{ name: "fixture", setup(b) {
      const stubs: Record<string, string> = {
        "next/headers": `export const headers=async()=>new Map([["origin","https://solve.test"]]);`,
        "next/navigation": `export function redirect(to){globalThis.__continuity.redirect=to;const e=new Error("NEXT_REDIRECT");e.digest="NEXT_REDIRECT";throw e;}`,
        "@/lib/safe-next-path": `export const safeNextPath=(v)=>typeof v==="string"&&v.startsWith("/")?v:"/";`,
        "@/lib/supabase/server": `export const createClient=async()=>{const f=globalThis.__continuity;return {auth:{
          getUser:async()=>({data:{user:{is_anonymous:f.anonymous}}}),
          updateUser:async(attrs,opts)=>{f.calls.push("updateUser:"+attrs.email+":"+(opts?.emailRedirectTo??""));return {error:f.updateError};},
          signInWithOtp:async(args)=>{f.calls.push("signInWithOtp:"+args.email+(args.options?.shouldCreateUser===false?":existing-only":""));return {error:f.otpError};},
        }};};`,
      };
      b.onResolve({ filter: /.*/ }, a => a.path in stubs ? { path: a.path, namespace: "fx" } : undefined);
      b.onLoad({ filter: /.*/, namespace: "fx" }, a => ({ contents: stubs[a.path], loader: "js" }));
    } }],
  });
  const path = join(dir, "actions.mjs");
  await writeFile(path, output.outputFiles[0].text);
  const mod = await import(pathToFileURL(path).href);
  return { mod, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

const form = (email: string) => {
  const data = new Map<string, string>([["email", email], ["next", "/apps"]]);
  return { get: (k: string) => data.get(k) ?? null } as unknown as FormData;
};
const run = async (fn: () => Promise<void>) => { try { await fn(); } catch (e) { if ((e as { digest?: string }).digest !== "NEXT_REDIRECT") throw e; } };

test("a guest adding their email keeps the identity they already have", async () => {
  const fixture: Fixture = { anonymous: true, updateError: null, otpError: null, calls: [], redirect: "" };
  const { mod, cleanup } = await loadActions(fixture);
  try {
    await run(() => mod.sendMagicLink(form("me@example.test")));
    assert.ok(fixture.calls.some(c => c.startsWith("updateUser:me@example.test")),
      "the guest's own user gains the email; a fresh sign-in would mint a new subject and strand their work");
    assert.ok(!fixture.calls.some(c => c.startsWith("signInWithOtp")), "no new identity is created");
    assert.match(fixture.calls[0], /https:\/\/solve\.test\/auth\/callback\?next=%2Fapps/, "the link returns where they were");
    assert.match(fixture.redirect, /keeping=1/, "and they are told their work comes with them");
  } finally { await cleanup(); }
});

test("someone already signed out signs in normally", async () => {
  const fixture: Fixture = { anonymous: false, updateError: null, otpError: null, calls: [], redirect: "" };
  const { mod, cleanup } = await loadActions(fixture);
  try {
    await run(() => mod.sendMagicLink(form("me@example.test")));
    assert.deepEqual(fixture.calls, ["signInWithOtp:me@example.test"], "with no guest session there is nothing to carry");
    assert.ok(!/keeping=1/.test(fixture.redirect), "and nothing is claimed about carrying work");
  } finally { await cleanup(); }
});

test("an email that already has an account never silently abandons the guest's work", async () => {
  const fixture: Fixture = { anonymous: true, updateError: { code: "email_exists" }, otpError: null, calls: [], redirect: "" };
  const { mod, cleanup } = await loadActions(fixture);
  try {
    await run(() => mod.sendMagicLink(form("taken@example.test")));
    assert.ok(!fixture.calls.some(c => c.startsWith("signInWithOtp")),
      "it must not fall back to signing them in: that would strand the GitHub token and the AI's access");
    assert.match(fixture.redirect, /taken=taken%40example\.test/, "the person is told, and chooses");
    assert.ok(!/sent=/.test(fixture.redirect), "and is not told a link was sent when none was");
  } finally { await cleanup(); }
});

test("the same refusal is recognised when Supabase only words it", async () => {
  const fixture: Fixture = { anonymous: true, updateError: { message: "A user with this email address has already been registered" }, otpError: null, calls: [], redirect: "" };
  const { mod, cleanup } = await loadActions(fixture);
  try {
    await run(() => mod.sendMagicLink(form("taken@example.test")));
    assert.match(fixture.redirect, /taken=/, "a worded refusal is the same refusal");
    assert.ok(!fixture.calls.some(c => c.startsWith("signInWithOtp")));
  } finally { await cleanup(); }
});

test("leaving the guest behind happens only when the person asks for it", async () => {
  const fixture: Fixture = { anonymous: true, updateError: null, otpError: null, calls: [], redirect: "" };
  const { mod, cleanup } = await loadActions(fixture);
  try {
    await run(() => mod.signInLeavingGuestBehind(form("taken@example.test")));
    assert.deepEqual(fixture.calls, ["signInWithOtp:taken@example.test:existing-only"]);
    assert.match(fixture.redirect, /left=1/, "and the cost is restated on the way out");
  } finally { await cleanup(); }
});

test("a failure says so instead of claiming a link was sent", async () => {
  const fixture: Fixture = { anonymous: true, updateError: { message: "Email rate limit exceeded" }, otpError: null, calls: [], redirect: "" };
  const { mod, cleanup } = await loadActions(fixture);
  try {
    await run(() => mod.sendMagicLink(form("me@example.test")));
    assert.match(fixture.redirect, /error=/, "an honest failure");
    assert.ok(!/sent=/.test(fixture.redirect) && !/taken=/.test(fixture.redirect));
  } finally { await cleanup(); }
});

test("the dead end names the way round it, and overstates nothing", async () => {
  const page = await import("node:fs").then(fs => fs.readFileSync("app/login/page.tsx", "utf8"));
  const taken = page.slice(page.indexOf("data-taken"), page.indexOf("data-bring-across") + 900);
  assert.match(taken, /share a Space/, "the person is pointed at a primitive that exists");
  assert.match(taken, /stays owned by this browser/, "and told it is reach, not a transfer of ownership");
  assert.match(taken, /connected again/, "and that a tool or an AI's access does not travel");
  assert.ok(!/mov(e|ed|es) (everything|your work)/i.test(taken), "nothing claims the work is moved");
});

test("existing-account sign-in errors remain on the existing-account path", async () => {
  const fixture: Fixture = { anonymous: true, updateError: null, otpError: { message: "Try again" }, calls: [], redirect: "" };
  const { mod, cleanup } = await loadActions(fixture);
  try {
    await run(() => mod.signInLeavingGuestBehind(form("taken@example.test")));
    assert.match(fixture.redirect, /intent=signin/);
    assert.deepEqual(fixture.calls, ["signInWithOtp:taken@example.test:existing-only"]);
    assert.ok(!fixture.calls.some(c => c.startsWith("updateUser")));
  } finally { await cleanup(); }
});
