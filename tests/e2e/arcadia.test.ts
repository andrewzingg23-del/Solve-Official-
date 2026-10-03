// Arcadia is reproducible: the same seed, generator and kernel give the same semantic digest and the
// same key material; a different seed changes only key material, never meaning; the snapshot the
// browser boots from reproduces the kernel exactly; every entity keeps a natural key across
// generations; a private record never reaches You.
import { PGlite } from "@electric-sql/pglite";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { kernelDigest } from "../../lib/sandbox/digest";
import { ARCADIA_GENERATOR, ARCADIA_SEED, ARCADIA_WORLD, buildArcadia, kernelVersion, PERSONAS } from "../support/arcadia";
import { kernelClient } from "../../lib/kernel/client";
import { localSupabase, service, user } from "../../lib/kernel/local";

describe("Arcadia", () => {
  it("is reproducible from its seed, and the seed changes only key material", async () => {
    const a = await buildArcadia();
    const b = await buildArcadia();
    const c = await buildArcadia({ seed: "another-seed" });

    assert.equal(a.manifest.arcadia.generator, ARCADIA_GENERATOR);
    assert.equal(a.manifest.arcadia.seed, ARCADIA_SEED);
    assert.equal(a.manifest.arcadia.kernel, kernelVersion().digest);
    assert.equal(a.manifest.arcadia.digest, b.manifest.arcadia.digest, "same seed, same meaning");
    assert.equal(a.manifest.you.wallet, b.manifest.you.wallet, "same seed, same keys");
    assert.equal(a.manifest.bob.wallet, b.manifest.bob.wallet);
    assert.deepEqual(a.manifest.arcadia.tables, b.manifest.arcadia.tables);
    assert.deepEqual(a.manifest.arcadia.events, b.manifest.arcadia.events);

    assert.notEqual(c.manifest.you.wallet, a.manifest.you.wallet, "another seed, other keys");
    assert.equal(c.manifest.arcadia.digest, a.manifest.arcadia.digest, "keys are not meaning");
    assert.notEqual(c.manifest.arcadia.configuration, a.manifest.arcadia.configuration, "the seed is part of the configuration");

    // The snapshot is a faithful projection: reloaded, it reproduces the kernel. (The browser
    // snapshot is a PGlite data directory; on a Postgres server there is none to reload.)
    const db = a.k.db as unknown as { dumpDataDir?(c: "gzip"): Promise<Blob> };
    if (db.dumpDataDir) {
      const reloaded = new PGlite({ loadDataDir: await db.dumpDataDir("gzip") });
      const parity = await kernelDigest(async (sql) => (await reloaded.query<Record<string, unknown>>(sql)).rows);
      assert.equal(parity.digest, a.manifest.arcadia.digest);
      await reloaded.close();
    }

    // Every entity keeps a natural key across generations.
    const keyed = await a.k.owner("select v.attributes->>'arcadia_key' as key from kernel.entity_versions v");
    assert.ok(keyed.length > 0);
    assert.ok(keyed.every((r) => typeof r.key === "string" && r.key.length > 0), "every entity has an arcadia_key");
    assert.equal(new Set(keyed.map((r) => r.key)).size, keyed.length, "natural keys are unique");

    // A private record exists for the steward and never for You.
    const you = kernelClient(localSupabase(a.k, user(PERSONAS.you)));
    const steward = kernelClient(localSupabase(a.k, user(PERSONAS.steward)));
    const hidden = a.manifest.privateEntityId;
    assert.ok((await steward.readWorld(ARCADIA_WORLD)).some((e) => e.entity_id === hidden));
    assert.ok(!(await you.readWorld(ARCADIA_WORLD)).some((e) => e.entity_id === hidden));
    assert.ok(!(await you.publicWorld()).some((e) => e.entity_id === hidden));
    const mentions = (events: { payload: Record<string, unknown> }[]) => events.some((e) => JSON.stringify(e.payload).includes("second line (confidential)"));
    assert.ok(!mentions(await you.readEvents(ARCADIA_WORLD, { limit: 500 })), "nor its events");
    assert.ok(mentions(await steward.readEvents(ARCADIA_WORLD, { limit: 500 })));
    assert.equal((await kernelClient(localSupabase(a.k, service)).verifyChain()).ok, true);

    // The default scenario: SOV's collective worked two lost payment replies to closure and
    // recorded what it learned. A base civilization has no such history.
    assert.deepEqual(a.manifest.arcadia.scenarios, ["lost-payment-responses", "creation-loop"]);
    assert.equal(a.manifest.operations?.tasks.length, 2);
    const tasks = await steward.readTasks("system/chain:litesvm");
    assert.deepEqual(tasks.map((t) => t.status), ["completed", "completed"]);
    const proposal = (await steward.readEvents("system/ops")).find((e) => e.type === "ops.build_proposal.proposed");
    assert.equal(proposal?.id, a.manifest.operations?.proposalEventId);
    assert.equal(proposal?.payload.change_class, "A");
    // The creation loop built, tested, reviewed, promoted and observed it.
    const engineering = (await steward.readTasks("system/ops")).find((t) => t.task_id === a.manifest.operations?.engineeringTask);
    assert.equal(engineering?.status, "completed");
    const ops = (await steward.readEvents("system/ops")).map((e) => e.type).filter((t) => t.startsWith("ops."));
    assert.deepEqual(ops, ["ops.learning.recorded", "ops.build_proposal.proposed", "ops.ci.completed", "ops.observation.recorded"]);
    const base = await buildArcadia({ scenarios: [] });
    assert.equal(base.manifest.operations, null);
    assert.notEqual(base.manifest.arcadia.digest, a.manifest.arcadia.digest, "scenarios are part of what a snapshot means");
  });
});
