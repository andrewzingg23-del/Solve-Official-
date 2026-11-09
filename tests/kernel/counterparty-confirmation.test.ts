// Counterparty confirmation. A record whose only author is its owner is just their word; these
// tests prove the other side can answer for itself, that the owner cannot answer for them, and
// that holding the link reveals one thing and nothing else.
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { it } from "node:test";
import { kernelClient } from "../../lib/kernel/client";
import { localSupabase } from "../../lib/kernel/local";
import { createKernelDb, user } from "./harness";

type Rpc = { rpc: (name: string, args: Record<string, unknown>) => Promise<unknown> };

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

const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

// One owner with a typed thing, and a second person who is not in their scope at all.
async function twoSides() {
  const db = await createKernelDb();
  const ownerSession = user("auth:confirm-owner");
  const otherSession = user("auth:confirm-other");
  const owner = kernelClient(localSupabase(db, ownerSession));
  const other = kernelClient(localSupabase(db, otherSession));
  const ownerId = await owner.register("Ana");
  await other.register("Dana");
  const scope = `actor:${ownerId}`;
  const ownerApi = api(db, ownerSession);
  const otherApi = api(db, otherSession);

  await ownerApi.rpc("define_type", {
    p_type: "removal", p_scope: scope,
    p_fields: { address: { type: "text", required: true }, stump_ground: { type: "boolean" } },
    p_label: "A tree removal", p_idempotency_key: null, p_as_actor: null,
  });
  const thing = (await ownerApi.rpc("put_object", {
    p_type: "removal", p_scope: scope, p_title: "Removal at 4100 Palm",
    p_data: { address: "4100 Palm", stump_ground: true },
    p_object_id: null, p_visibility: "private", p_idempotency_key: null, p_as_actor: null,
  })) as string;

  return { db, scope, thing, ownerApi, otherApi, ownerSession, otherSession };
}

it("the other side answers for itself, and the owner cannot answer for them", async () => {
  const { thing, ownerApi, otherApi } = await twoSides();
  const token = randomUUID();

  const asked = (await ownerApi.rpc("request_confirmation", {
    p_entity_id: thing, p_token_hash: tokenHash(token),
    p_asked_of: "The homeowner", p_question: "Was the stump ground?",
    p_request_id: "ask-1", p_as_actor: null,
  })) as { request_id: string; expires_at: string }[];
  assert.ok(asked[0]?.request_id, "the request was recorded");

  // Before anyone answers, the owner's own surface says so plainly rather than showing nothing.
  const waiting = (await ownerApi.rpc("read_confirmations", { p_entity_id: thing, p_as_actor: null })) as
    { state: string; asked_of: string }[];
  assert.equal(waiting.length, 1);
  assert.equal(waiting[0].state, "awaiting", "an unanswered request is a state, not a gap");
  assert.equal(waiting[0].asked_of, "The homeowner");

  // The owner cannot manufacture their own proof.
  await assert.rejects(
    ownerApi.rpc("answer_confirmation", {
      p_token_hash: tokenHash(token), p_decision: "confirmed",
      p_note: "I say it is done", p_request_id: "self-1", p_as_actor: null,
    }),
    /cannot confirm your own record/,
    "no actor authors its own proof",
  );

  // The other side can, and it lands as evidence authored by them.
  const answer = await otherApi.rpc("answer_confirmation", {
    p_token_hash: tokenHash(token), p_decision: "confirmed",
    p_note: "Yes, ground flush.", p_request_id: "answer-1", p_as_actor: null,
  });
  assert.ok(typeof answer === "string" && answer.length > 0, "the answer is recorded");

  const after = (await ownerApi.rpc("read_confirmations", { p_entity_id: thing, p_as_actor: null })) as
    { state: string; answered_by: string | null }[];
  assert.equal(after[0].state, "confirmed");
  assert.equal(after[0].answered_by, "Dana", "the record says who confirmed it");

  // An exact retry returns the same answer instead of recording a second one.
  const retry = await otherApi.rpc("answer_confirmation", {
    p_token_hash: tokenHash(token), p_decision: "confirmed",
    p_note: "Yes, ground flush.", p_request_id: "answer-1", p_as_actor: null,
  });
  assert.equal(retry, answer, "an exact retry is the same answer, not a new one");

  // A different answer never overwrites one already given.
  await assert.rejects(
    otherApi.rpc("answer_confirmation", {
      p_token_hash: tokenHash(token), p_decision: "disputed",
      p_note: "changed my mind", p_request_id: "answer-2", p_as_actor: null,
    }),
    /already answered/,
  );
});

it("a dispute is recorded beside the claim and never replaces it", async () => {
  const { thing, ownerApi, otherApi } = await twoSides();
  const token = randomUUID();
  await ownerApi.rpc("request_confirmation", {
    p_entity_id: thing, p_token_hash: tokenHash(token),
    p_asked_of: "The homeowner", p_question: "Was the stump ground?",
    p_request_id: "ask-d", p_as_actor: null,
  });

  await otherApi.rpc("answer_confirmation", {
    p_token_hash: tokenHash(token), p_decision: "disputed",
    p_note: "The stump is still there.", p_request_id: "answer-d", p_as_actor: null,
  });

  const state = (await ownerApi.rpc("read_confirmations", { p_entity_id: thing, p_as_actor: null })) as
    { state: string }[];
  assert.equal(state[0].state, "disputed", "the disagreement is part of the record");

  // The owner's own record of the thing is untouched: a dispute adds, it does not edit.
  const mine = (await ownerApi.rpc("export_mine", { p_as_actor: null })) as {
    things: { title: string; data: Record<string, unknown> }[];
  };
  const kept = mine.things.find(t => t.title === "Removal at 4100 Palm");
  assert.deepEqual(kept?.data, { address: "4100 Palm", stump_ground: true },
    "what the owner recorded still says what it said");
});

it("holding the link shows that one thing and nothing else, and guessing reveals nothing", async () => {
  const { scope, thing, ownerApi, otherApi } = await twoSides();

  // A second, private thing in the same scope that was never shared with anyone.
  await ownerApi.rpc("put_object", {
    p_type: "removal", p_scope: scope, p_title: "Removal at 9 Hidden Lane",
    p_data: { address: "9 Hidden Lane", stump_ground: false },
    p_object_id: null, p_visibility: "private", p_idempotency_key: null, p_as_actor: null,
  });

  const token = randomUUID();
  await ownerApi.rpc("request_confirmation", {
    p_entity_id: thing, p_token_hash: tokenHash(token),
    p_asked_of: "The homeowner", p_question: "Was the stump ground?",
    p_request_id: "ask-s", p_as_actor: null,
  });

  const seen = (await otherApi.rpc("read_confirmation_request", {
    p_token_hash: tokenHash(token), p_as_actor: null,
  })) as Record<string, unknown>;
  assert.equal((seen.thing as { title: string }).title, "Removal at 4100 Palm");
  assert.equal(seen.asked_by, "Ana", "the person knows who is asking");
  assert.equal(seen.answered, false);
  assert.ok(!JSON.stringify(seen).includes("Hidden Lane"),
    "nothing else in the owner's scope comes with it");

  // The other side still cannot read the scope itself.
  await assert.rejects(
    otherApi.rpc("read_confirmations", { p_entity_id: thing, p_as_actor: null }),
    "a confirmation grants no authority over the thing",
  );

  // A token that was never issued is indistinguishable from one that does not exist, so the
  // existence of anything cannot be learned by guessing.
  const unissued = otherApi.rpc("read_confirmation_request", {
    p_token_hash: tokenHash(randomUUID()), p_as_actor: null,
  });
  await assert.rejects(unissued, /confirmation link is unavailable/);
  await assert.rejects(
    otherApi.rpc("read_confirmation_request", { p_token_hash: "not-a-hash", p_as_actor: null }),
    /confirmation link is unavailable/,
    "a malformed token fails exactly like an unknown one",
  );
});

it("a withdrawn request cannot be answered, and an answer already given stays", async () => {
  const { thing, ownerApi, otherApi } = await twoSides();
  const open = randomUUID();
  const withdrawn = randomUUID();

  const asked = (await ownerApi.rpc("request_confirmation", {
    p_entity_id: thing, p_token_hash: tokenHash(withdrawn),
    p_asked_of: "Wrong person", p_question: "", p_request_id: "ask-w", p_as_actor: null,
  })) as { request_id: string }[];

  await ownerApi.rpc("request_confirmation", {
    p_entity_id: thing, p_token_hash: tokenHash(open),
    p_asked_of: "Right person", p_question: "", p_request_id: "ask-o", p_as_actor: null,
  });

  await ownerApi.rpc("cancel_confirmation", { p_confirmation_id: asked[0].request_id, p_as_actor: null });

  await assert.rejects(
    otherApi.rpc("answer_confirmation", {
      p_token_hash: tokenHash(withdrawn), p_decision: "confirmed",
      p_note: "", p_request_id: "answer-w", p_as_actor: null,
    }),
    /unavailable/,
    "a withdrawn link stops working",
  );

  // Withdrawing one request leaves the other alone.
  await otherApi.rpc("answer_confirmation", {
    p_token_hash: tokenHash(open), p_decision: "confirmed",
    p_note: "", p_request_id: "answer-o", p_as_actor: null,
  });
  const states = (await ownerApi.rpc("read_confirmations", { p_entity_id: thing, p_as_actor: null })) as
    { state: string; asked_of: string }[];
  assert.equal(states.find(s => s.asked_of === "Wrong person")?.state, "withdrawn");
  assert.equal(states.find(s => s.asked_of === "Right person")?.state, "confirmed");
});

it("names people by their chosen name, and tells the answerer it was them", async () => {
  // Regression from the 2026-11-09 staging acceptance run: the readers used the raw label column,
  // so an asker who had named themselves appeared as "Someone".
  const { thing, ownerApi, otherApi } = await twoSides();
  await ownerApi.rpc("set_person_label", { p_label: "Ana the holder", p_request_id: "label-owner" });
  await otherApi.rpc("set_person_label", { p_label: "Dana who was asked", p_request_id: "label-other" });
  const token = randomUUID();
  await ownerApi.rpc("request_confirmation", {
    p_entity_id: thing, p_token_hash: tokenHash(token), p_asked_of: "Dana", p_question: "",
    p_request_id: "ask-names", p_as_actor: null,
  });

  const before = (await otherApi.rpc("read_confirmation_request", { p_token_hash: tokenHash(token), p_as_actor: null })) as
    { asked_by: string; answered_by_you: boolean };
  assert.equal(before.asked_by, "Ana the holder", "the asker's chosen name, not their registration label");
  assert.equal(before.answered_by_you, false);

  await otherApi.rpc("answer_confirmation", {
    p_token_hash: tokenHash(token), p_decision: "confirmed", p_note: "", p_request_id: "ans-names", p_as_actor: null,
  });
  const mine = (await otherApi.rpc("read_confirmation_request", { p_token_hash: tokenHash(token), p_as_actor: null })) as
    { answered_by_you: boolean };
  assert.equal(mine.answered_by_you, true, "the person who answered is told it was them");
  const theirs = (await ownerApi.rpc("read_confirmation_request", { p_token_hash: tokenHash(token), p_as_actor: null })) as
    { answered_by_you: boolean };
  assert.equal(theirs.answered_by_you, false, "nobody else is told it was them");

  const states = (await ownerApi.rpc("read_confirmations", { p_entity_id: thing, p_as_actor: null })) as
    { answered_by: string }[];
  assert.equal(states[0].answered_by, "Dana who was asked", "the holder sees who confirmed it, by name");
});
