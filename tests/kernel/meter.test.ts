// The AI spend meter (migration 20261111000000). Durable and shared, unlike the
// per-instance Map it replaces: the count survives, a retry is not charged
// twice, and one person can never read or move another's meter.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { kernelClient } from "../../lib/kernel/client";
import { pgliteSupabase } from "../support/pglite-supabase";
import { createKernelDb, sqlstate, user } from "./harness";

async function setup() {
  const k = await createKernelDb();
  const person = (sub: string) => kernelClient(pgliteSupabase(k, user(sub)));
  const alice = person("meter-alice");
  const bob = person("meter-bob");
  await alice.register("Alice");
  await bob.register("Bob");
  return { k, alice, bob, person };
}

describe("the AI spend meter", () => {
  it("starts at nothing and counts what is charged", async () => {
    const { alice } = await setup();
    assert.deepEqual(await alice.readAiSpend(), { tokens: 0, calls: 0 });

    const first = await alice.recordAiSpend({ tokens: 1200, kind: "chat" });
    assert.deepEqual(first, { tokens: 1200, calls: 1 });

    const second = await alice.recordAiSpend({ tokens: 800, kind: "draft" });
    assert.deepEqual(second, { tokens: 2000, calls: 2 });
    assert.deepEqual(await alice.readAiSpend(), { tokens: 2000, calls: 2 });
  });

  it("charges a retried request once and still reports the true total", async () => {
    const { alice } = await setup();
    await alice.recordAiSpend({ tokens: 500, kind: "chat", requestId: "turn-1" });
    const retry = await alice.recordAiSpend({ tokens: 500, kind: "chat", requestId: "turn-1" });
    // Recorded once, but the window is still answered truthfully.
    assert.deepEqual(retry, { tokens: 500, calls: 1 });

    // A different request on the same actor is a separate charge.
    const next = await alice.recordAiSpend({ tokens: 500, kind: "chat", requestId: "turn-2" });
    assert.deepEqual(next, { tokens: 1000, calls: 2 });
  });

  it("meters each person separately — one meter never shows another's spend", async () => {
    const { alice, bob } = await setup();
    await alice.recordAiSpend({ tokens: 9000, kind: "chat" });
    assert.deepEqual(await bob.readAiSpend(), { tokens: 0, calls: 0 });
    // The same request id on a different actor is a different charge, not a clash.
    await bob.recordAiSpend({ tokens: 7, kind: "chat", requestId: "shared-id" });
    await alice.recordAiSpend({ tokens: 3, kind: "chat", requestId: "shared-id" });
    assert.deepEqual(await bob.readAiSpend(), { tokens: 7, calls: 1 });
    assert.deepEqual(await alice.readAiSpend(), { tokens: 9003, calls: 2 });
  });

  it("an end user cannot meter anybody else", async () => {
    const { k, alice } = await setup();
    const bobId = await kernelClient(pgliteSupabase(k, user("meter-bob"))).whoami();
    // p_as_actor is refused for authenticated callers (KA002: act only as yourself).
    await assert.rejects(
      () => kernelClient(pgliteSupabase(k, user("meter-alice")), { actAs: bobId.actor_id }).readAiSpend(),
      sqlstate("KA002"),
    );
    await assert.rejects(
      () =>
        kernelClient(pgliteSupabase(k, user("meter-alice")), { actAs: bobId.actor_id }).recordAiSpend({
          tokens: 1,
          kind: "chat",
        }),
      sqlstate("KA002"),
    );
    assert.deepEqual(await alice.readAiSpend(), { tokens: 0, calls: 0 });
  });

  it("rejects a window, a token count or a kind outside its bounds", async () => {
    const { alice } = await setup();
    await assert.rejects(() => alice.readAiSpend(59), sqlstate("KA003"));
    await assert.rejects(() => alice.readAiSpend(86401), sqlstate("KA003"));
    await assert.rejects(
      () => alice.recordAiSpend({ tokens: 0, kind: "chat" }),
      sqlstate("KA003"),
    );
    await assert.rejects(
      () => alice.recordAiSpend({ tokens: -5, kind: "chat" }),
      sqlstate("KA003"),
    );
    await assert.rejects(
      () => alice.recordAiSpend({ tokens: 10_000_001, kind: "chat" }),
      sqlstate("KA003"),
    );
    await assert.rejects(
      () => alice.recordAiSpend({ tokens: 10, kind: "Chat Turn" }),
      sqlstate("KA003"),
    );
    // Nothing above was charged.
    assert.deepEqual(await alice.readAiSpend(), { tokens: 0, calls: 0 });
  });

  it("counts only inside the window asked for", async () => {
    const { k, alice } = await setup();
    await alice.recordAiSpend({ tokens: 400, kind: "chat" });
    // Age the row past an hour. Owner-level write: the meter itself is never
    // reachable from an API role, which is the point of the test below.
    await k.owner("update kernel.ai_meter set at = now() - interval '2 hours'");
    assert.deepEqual(await alice.readAiSpend(3600), { tokens: 0, calls: 0 });
    assert.deepEqual(await alice.readAiSpend(86400), { tokens: 400, calls: 1 });
  });

  it("the meter table is unreachable from every API role — only the two functions touch it", async () => {
    const { k } = await setup();
    // Asserted on the real grants, not through the test client: the invariant is
    // that no API role holds a privilege on kernel.ai_meter, so the only way in
    // is the two security-definer functions.
    for (const role of ["anon", "authenticated", "service_role"]) {
      for (const privilege of ["select", "insert", "update", "delete"]) {
        const [row] = await k.owner(
          "select has_table_privilege($1, 'kernel.ai_meter', $2) as allowed",
          [role, privilege],
        );
        assert.equal(row.allowed, false, `${role} must not hold ${privilege} on kernel.ai_meter`);
      }
      // The schema itself stays closed too.
      const [usage] = await k.owner("select has_schema_privilege($1, 'kernel', 'usage') as allowed", [role]);
      assert.equal(usage.allowed, false, `${role} must not have usage on the kernel schema`);
    }
  });

  it("both meter functions are executable by the API roles that need them", async () => {
    const { k } = await setup();
    const signatures = [
      "kernel_api.read_ai_spend(integer, uuid)",
      "kernel_api.record_ai_spend(integer, text, integer, text, uuid)",
    ];
    for (const signature of signatures) {
      for (const role of ["authenticated", "service_role"]) {
        const [row] = await k.owner("select has_function_privilege($1, $2, 'execute') as allowed", [role, signature]);
        assert.equal(row.allowed, true, `${role} should execute ${signature}`);
      }
      const [anonRow] = await k.owner("select has_function_privilege('anon', $1, 'execute') as allowed", [signature]);
      assert.equal(anonRow.allowed, false, `anon must not execute ${signature}`);
    }
  });
});
