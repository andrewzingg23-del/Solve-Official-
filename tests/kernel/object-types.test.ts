// Object types and export. The kernel could store a thing but not say what it is; a type is
// itself an entity, so it carries the same scope, authority and history as everything else.
import assert from "node:assert/strict";
import { it } from "node:test";
import { kernelClient } from "../../lib/kernel/client";
import { localSupabase } from "../../lib/kernel/local";
import { createKernelDb, user } from "./harness";

type Rpc = { rpc: (name: string, args: Record<string, unknown>) => Promise<unknown> };

// Calls kernel_api directly: these functions are new and have no typed client yet.
function api(db: Awaited<ReturnType<typeof createKernelDb>>, session: ReturnType<typeof user>): Rpc {
  const supabase = localSupabase(db, session);
  return {
    rpc: async (name, args) => {
      const { data, error } = await (supabase as unknown as {
        schema: (s: string) => { rpc: (n: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }> };
      }).schema("kernel_api").rpc(name, args);
      if (error) throw new Error(error.message);
      return data;
    },
  };
}

it("a type says what a thing is, and the kernel refuses a thing that does not match", async () => {
  const db = await createKernelDb();
  const session = user("auth:types-ana");
  const ana = kernelClient(localSupabase(db, session));
  const anaId = await ana.register("Ana");
  const scope = `actor:${anaId}`;
  const rpc = api(db, session);

  // One domain's vocabulary, declared by the person who owns the scope.
  await rpc.rpc("define_type", {
    p_type: "candidate",
    p_scope: scope,
    p_fields: { name: { type: "text", required: true }, years: { type: "number" }, licensed: { type: "boolean" } },
    p_label: "Someone applying",
    p_idempotency_key: null,
    p_as_actor: null,
  });

  const id = await rpc.rpc("put_object", {
    p_type: "candidate",
    p_scope: scope,
    p_title: "Dana",
    p_data: { name: "Dana", years: 4, licensed: true },
    p_object_id: null,
    p_visibility: "private",
    p_idempotency_key: null,
    p_as_actor: null,
  });
  assert.ok(typeof id === "string" && id.length > 0, "the thing was recorded");

  // A missing required field never enters history.
  await assert.rejects(
    rpc.rpc("put_object", {
      p_type: "candidate", p_scope: scope, p_title: "No name",
      p_data: { years: 2 }, p_object_id: null, p_visibility: "private",
      p_idempotency_key: null, p_as_actor: null,
    }),
    /name is required/,
    "a required field is enforced before anything is written",
  );

  // A field of the wrong shape is refused too.
  await assert.rejects(
    rpc.rpc("put_object", {
      p_type: "candidate", p_scope: scope, p_title: "Wrong shape",
      p_data: { name: "Eli", years: "four" }, p_object_id: null, p_visibility: "private",
      p_idempotency_key: null, p_as_actor: null,
    }),
    /years must be a number/,
  );

  // An undeclared type is refused: the vocabulary is explicit, not invented at write time.
  await assert.rejects(
    rpc.rpc("put_object", {
      p_type: "invoice", p_scope: scope, p_title: "x",
      p_data: {}, p_object_id: null, p_visibility: "private",
      p_idempotency_key: null, p_as_actor: null,
    }),
    /No type called invoice/,
  );
});

it("one person's types and things never leak into another person's scope", async () => {
  const db = await createKernelDb();
  const anaSession = user("auth:types-owner");
  const benSession = user("auth:types-other");
  const ana = kernelClient(localSupabase(db, anaSession));
  const ben = kernelClient(localSupabase(db, benSession));
  const anaId = await ana.register("Ana");
  await ben.register("Ben");
  const anaScope = `actor:${anaId}`;

  await api(db, anaSession).rpc("define_type", {
    p_type: "secret_kind", p_scope: anaScope, p_fields: { note: { type: "text" } },
    p_label: null, p_idempotency_key: null, p_as_actor: null,
  });

  // Ben cannot write Ana's type into Ana's scope.
  await assert.rejects(
    api(db, benSession).rpc("put_object", {
      p_type: "secret_kind", p_scope: anaScope, p_title: "intrusion",
      p_data: { note: "mine now" }, p_object_id: null, p_visibility: "private",
      p_idempotency_key: null, p_as_actor: null,
    }),
    "another person's scope stays closed",
  );
});

it("a person can take their work with them, and the export carries nothing of anyone else's", async () => {
  const db = await createKernelDb();
  const anaSession = user("auth:export-ana");
  const benSession = user("auth:export-ben");
  const ana = kernelClient(localSupabase(db, anaSession));
  const ben = kernelClient(localSupabase(db, benSession));
  const anaId = await ana.register("Ana");
  const benId = await ben.register("Ben");
  const anaScope = `actor:${anaId}`;
  const benScope = `actor:${benId}`;

  await api(db, anaSession).rpc("define_type", {
    p_type: "note", p_scope: anaScope, p_fields: { body: { type: "text", required: true } },
    p_label: null, p_idempotency_key: null, p_as_actor: null,
  });
  await api(db, anaSession).rpc("put_object", {
    p_type: "note", p_scope: anaScope, p_title: "Kept",
    p_data: { body: "something of mine" }, p_object_id: null, p_visibility: "private",
    p_idempotency_key: null, p_as_actor: null,
  });

  await api(db, benSession).rpc("define_type", {
    p_type: "note", p_scope: benScope, p_fields: { body: { type: "text", required: true } },
    p_label: null, p_idempotency_key: null, p_as_actor: null,
  });
  await api(db, benSession).rpc("put_object", {
    p_type: "note", p_scope: benScope, p_title: "Ben's",
    p_data: { body: "not yours" }, p_object_id: null, p_visibility: "private",
    p_idempotency_key: null, p_as_actor: null,
  });

  const mine = (await api(db, anaSession).rpc("export_mine", { p_as_actor: null })) as {
    actor: { label: string };
    scopes: string[];
    things: { title: string; type: string; data: Record<string, unknown> }[];
    history: { type: string }[];
  };

  assert.equal(mine.actor.label, "Ana");
  assert.ok(mine.scopes.includes(anaScope), "the export names the scopes it covers");

  const titles = mine.things.map((t) => t.title);
  assert.ok(titles.includes("Kept"), "my work comes with me");
  assert.ok(!titles.includes("Ben's"), "nobody else's work does");
  assert.ok(!JSON.stringify(mine).includes("not yours"), "and none of it leaks in any form");

  const kept = mine.things.find((t) => t.title === "Kept");
  assert.equal(kept?.type, "note", "the export says what each thing is");
  assert.deepEqual(kept?.data, { body: "something of mine" }, "with the data intact, not a summary");
  assert.ok(mine.history.length > 0, "and the history of what I did");
});
