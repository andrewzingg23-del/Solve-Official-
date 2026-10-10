import test from "node:test";
import assert from "node:assert/strict";
import { kernelClient, KernelError } from "../../lib/kernel/client";
import { localSupabase } from "../../lib/kernel/local";
import { createKernelDb, user, anon, service } from "../kernel/harness";
import { validateIdentityInput } from "../../lib/product/identity";
import { DEFAULT_PERSONA } from "../../lib/bot/persona";

test("identity input keeps the existing personality unless a reviewed import replaces it", () => {
  const existing = { ...DEFAULT_PERSONA, body: "orb" as const, voice: "Keep this voice.", about: "Existing context" };
  const result = validateIdentityInput({ name: " Ana ", botName: " Juno ", face: "host" }, existing);
  assert.equal(result.ok, true);
  if (result.ok) { assert.equal(result.name, "Ana"); assert.equal(result.persona.name, "Juno"); assert.equal(result.persona.voice, existing.voice); assert.equal(result.persona.body, "orb"); }
});

test("profile validation rejects malformed or blank fields", () => {
  for (const input of [null, [], { name: "", botName: "Juno", face: "host" }, { name: "Ana", botName: "", face: "host" }, { name: "Ana", botName: "Juno", face: "fake" }, { name: "A\u0000na", botName: "Juno", face: "host" }]) assert.equal(validateIdentityInput(input, DEFAULT_PERSONA).ok, false);
});

test("display name is derived from the human caller, recorded and retry safe", async () => {
  const db = await createKernelDb();
  const ana = kernelClient(localSupabase(db, user("auth:profile-ana")));
  const ben = kernelClient(localSupabase(db, user("auth:profile-ben")));
  const anaId = await ana.register("Old name"); await ben.register("Ben");
  const first = await ana.setPersonLabel("Ana", "profile-request-001");
  assert.equal((await ana.whoami()).label, "Ana");
  assert.equal((await ana.whoami()).actor_id, anaId);
  assert.equal((await ana.readActors([anaId]))[0].label, "Ana");
  const original = await db.db.query<{ label: string }>("select label from kernel.actors where id = $1", [anaId]);
  assert.equal(original.rows[0].label, "Old name", "the identity record stays append-only");
  assert.equal(await ana.setPersonLabel("Ana", "profile-request-001"), first);
  await assert.rejects(ana.setPersonLabel("Someone else", "profile-request-001"), (e: unknown) => e instanceof KernelError && e.name === "conflict");
  await ben.setPersonLabel("Benjamin", "profile-request-002");
  assert.equal((await ana.whoami()).label, "Ana", "another person's write cannot target Ana");
  const events = await ana.readEvents(`actor:${anaId}`, { limit: 100 });
  assert.equal(events.filter(e => e.type === "kernel.person.label.updated").length, 1);
  await ana.setPersonLabel("Ana Z", "profile-request-003");
  await ana.setPersonLabel("Ana", "profile-request-001");
  assert.equal((await ana.whoami()).label, "Ana Z", "a delayed retry cannot roll back a later edit");
});

test("anonymous and service callers cannot change a human profile", async () => {
  const db = await createKernelDb();
  for (const session of [anon, service]) {
    await assert.rejects(kernelClient(localSupabase(db, session)).setPersonLabel("Forged", "profile-request-004"));
  }
});
