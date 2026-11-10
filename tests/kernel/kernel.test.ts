import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { anon, createKernelDb, type KernelDb, service, sha, sqlstate, user } from "./harness";

const alice = user("auth-alice");
const bob = user("auth-bob");
const carol = user("auth-carol");

async function registered(k: KernelDb, ...sessions: ReturnType<typeof user>[]) {
  return Promise.all(sessions.map((s) => k.value(s, "register")));
}

async function verify(k: KernelDb) {
  const [result] = await k.rpc(service, "verify_chain");
  return result;
}

describe("genesis", () => {
  it("starts from one genesis event and a verifiable chain", async () => {
    const k = await createKernelDb();
    const events = await k.owner("select seq, type, prev_hash from kernel.events");
    assert.deepEqual(events, [{ seq: 1, type: "kernel.genesis", prev_hash: null }]);
    assert.equal((await verify(k)).ok, true);
  });
});

describe("access", () => {
  it("gives API roles no direct access to kernel tables", async () => {
    const k = await createKernelDb();
    for (const session of [anon, alice, service]) {
      await assert.rejects(k.as(session, "select * from kernel.events"), sqlstate("42501"));
      await assert.rejects(
        k.as(session, "insert into kernel.actors (kind) values ('human')"),
        sqlstate("42501"),
      );
    }
  });

  it("denies anonymous API callers every kernel function", async () => {
    const k = await createKernelDb();
    await assert.rejects(k.rpc(anon, "register"), sqlstate("42501"));
    await assert.rejects(k.rpc(anon, "read_events", { p_scope: "system" }), sqlstate("42501"));
    // The deliberate exceptions: reading a page or a Space its owner chose to share, and whether a
    // photo belongs to a shared page (20261110050000, 20261110090000). Anything else anonymous callers can run is a leak.
    const open = await k.owner(`select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'kernel_api' and has_function_privilege('anon', p.oid, 'execute') order by 1`);
    assert.deepEqual(open.map(r => r.proname), ["file_public", "read_page", "read_space"]);
    const kernelOpen = await k.owner(`select count(*)::int as n from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'kernel' and has_function_privilege('anon', p.oid, 'execute')`);
    assert.equal(kernelOpen[0].n, 0, "no internal kernel function is reachable anonymously");
  });

  it("keeps chain verification for the service role", async () => {
    const k = await createKernelDb();
    await registered(k, alice);
    await assert.rejects(k.rpc(alice, "verify_chain"), sqlstate("42501"));
  });

  it("blocks UPDATE, DELETE and TRUNCATE on history, even for the owner", async () => {
    const k = await createKernelDb();
    await assert.rejects(k.owner("update kernel.events set payload = '{}'"), sqlstate("KA006"));
    await assert.rejects(k.owner("delete from kernel.events"), sqlstate("KA006"));
    await assert.rejects(k.owner("truncate kernel.events cascade"), sqlstate("KA006"));
    await assert.rejects(k.owner("delete from kernel.actors"), sqlstate("KA006"));
  });
});

describe("identity", () => {
  it("registers a signed-in user once, with authority over their own scope", async () => {
    const k = await createKernelDb();
    const first = await k.value(alice, "register", { p_label: "Alice" });
    const again = await k.value(alice, "register");
    assert.equal(again, first);

    const grants = await k.rpc(alice, "my_grants");
    assert.equal(grants.length, 1);
    assert.equal(grants[0].capability, "*");
    assert.equal(grants[0].scope, `actor:${first}`);

    const events = await k.rpc(alice, "read_events", { p_scope: `actor:${first}` });
    assert.deepEqual(
      events.map((e) => e.type),
      ["kernel.actor.registered", "kernel.grant.issued"],
    );
    const [who] = await k.rpc(alice, "whoami");
    assert.equal(who.kind, "human");
  });

  it("rejects unregistered callers", async () => {
    const k = await createKernelDb();
    await assert.rejects(
      k.rpc(alice, "record_event", { p_type: "note.created", p_scope: "system" }),
      sqlstate("KA001"),
    );
  });

  it("never lets the service key act as a human", async () => {
    const k = await createKernelDb();
    const [aliceId] = await registered(k, alice);
    await assert.rejects(
      k.rpc(service, "record_event", {
        p_type: "note.created",
        p_scope: `actor:${aliceId}`,
        p_as_actor: aliceId,
      }),
      sqlstate("KA002"),
    );
    await assert.rejects(
      k.rpc(service, "record_event", { p_type: "note.created", p_scope: `actor:${aliceId}` }),
      sqlstate("KA003"),
    );
    await assert.rejects(k.rpc(service, "register"), sqlstate("KA001"));
  });

  it("never lets the service key act as the kernel itself", async () => {
    const k = await createKernelDb();
    await registered(k, alice);
    const [selfGrant] = await k.rpc(alice, "my_grants");
    const kernelActor = "00000000-0000-4000-8000-000000000001";
    // The kernel issued Alice's self-grant; acting as the kernel must not allow revoking it.
    await assert.rejects(
      k.rpc(service, "revoke_grant", { p_grant_id: selfGrant.id, p_as_actor: kernelActor }),
      sqlstate("KA002"),
    );
    await assert.rejects(
      k.rpc(service, "claim_scope", { p_scope: "world:taken", p_as_actor: kernelActor }),
      sqlstate("KA002"),
    );
    assert.equal((await k.rpc(alice, "my_grants")).length, 1);
  });
});

describe("events", () => {
  it("records who acted, under which grant, on the kernel clock", async () => {
    const k = await createKernelDb();
    const [aliceId] = await registered(k, alice);
    const scope = `actor:${aliceId}`;
    const id = await k.value(alice, "record_event", {
      p_type: "note.created",
      p_scope: scope,
      p_payload: { text: "first" },
    });

    const [selfGrant] = await k.rpc(alice, "my_grants");
    const [event] = await k.rpc(alice, "read_events", { p_scope: scope, p_newest_first: true, p_limit: 1 });
    assert.equal(event.id, id);
    assert.equal(event.actor_id, aliceId);
    assert.equal(event.on_behalf_of, null);
    assert.equal(event.grant_id, selfGrant.id);
    assert.equal(event.auth_method, "user_jwt");
    assert.deepEqual(event.payload, { text: "first" });
    assert.match(String(event.hash), /^[0-9a-f]{64}$/);
  });

  it("rejects writes outside the caller's authority and kernel-reserved types", async () => {
    const k = await createKernelDb();
    const [aliceId] = await registered(k, alice, bob);
    await assert.rejects(
      k.rpc(bob, "record_event", { p_type: "note.created", p_scope: `actor:${aliceId}` }),
      sqlstate("KA002"),
    );
    await assert.rejects(
      k.rpc(alice, "record_event", { p_type: "kernel.grant.issued", p_scope: `actor:${aliceId}` }),
      sqlstate("KA003"),
    );
    await assert.rejects(
      k.rpc(alice, "record_event", { p_type: "note.created", p_scope: "Not A Scope" }),
      sqlstate("KA003"),
    );
  });

  it("returns the original event when a write is retried with the same key", async () => {
    const k = await createKernelDb();
    const [aliceId] = await registered(k, alice);
    const args = { p_type: "note.created", p_scope: `actor:${aliceId}`, p_idempotency_key: "retry-1" };
    const first = await k.value(alice, "record_event", args);
    const [{ count: before }] = await k.owner("select count(*)::int as count from kernel.events");
    const second = await k.value(alice, "record_event", args);
    const [{ count: after }] = await k.owner("select count(*)::int as count from kernel.events");
    assert.equal(second, first);
    assert.equal(after, before);

    await assert.rejects(
      k.rpc(alice, "record_event", { ...args, p_type: "note.deleted" }),
      sqlstate("KA004"),
    );
  });

  it("records corrections as new events and leaves the original untouched", async () => {
    const k = await createKernelDb();
    const [aliceId] = await registered(k, alice);
    const scope = `actor:${aliceId}`;
    const original = await k.value(alice, "record_event", {
      p_type: "note.created",
      p_scope: scope,
      p_payload: { text: "teh" },
    });
    const correction = await k.value(alice, "record_event", {
      p_type: "note.created",
      p_scope: scope,
      p_payload: { text: "the" },
      p_corrects: original,
    });

    const events = await k.rpc(alice, "read_events", { p_scope: scope });
    const byId = new Map(events.map((e) => [e.id, e]));
    assert.deepEqual(byId.get(original)?.payload, { text: "teh" });
    assert.equal(byId.get(correction)?.corrects, original);
  });
});

describe("authority", () => {
  it("lets a holder delegate, and revocation takes effect immediately", async () => {
    const k = await createKernelDb();
    const [aliceId, bobId] = await registered(k, alice, bob);
    const scope = `actor:${aliceId}`;
    const grant = await k.value(alice, "issue_grant", {
      p_grantee: bobId,
      p_capability: "note.*",
      p_scope: scope,
    });

    await k.rpc(bob, "record_event", { p_type: "note.created", p_scope: scope });
    const [bobsEvent] = await k.rpc(alice, "read_events", { p_scope: scope, p_newest_first: true, p_limit: 1 });
    assert.equal(bobsEvent.actor_id, bobId);
    assert.equal(bobsEvent.grant_id, grant);

    await k.rpc(alice, "revoke_grant", { p_grant_id: grant, p_reason: "done" });
    await assert.rejects(
      k.rpc(bob, "record_event", { p_type: "note.created", p_scope: scope }),
      sqlstate("KA002"),
    );
  });

  it("never grants more than the issuer holds", async () => {
    const k = await createKernelDb();
    const [aliceId, bobId, carolId] = await registered(k, alice, bob, carol);
    const scope = `actor:${aliceId}`;
    await k.rpc(alice, "issue_grant", { p_grantee: bobId, p_capability: "note.*", p_scope: scope });

    // Bob holds note.* but not kernel.grant.issue.
    await assert.rejects(
      k.rpc(bob, "issue_grant", { p_grantee: carolId, p_capability: "note.*", p_scope: scope }),
      sqlstate("KA002"),
    );

    await k.rpc(alice, "issue_grant", { p_grantee: bobId, p_capability: "kernel.grant.issue", p_scope: scope });
    // Bob may now delegate note.*, but nothing wider.
    await k.rpc(bob, "issue_grant", { p_grantee: carolId, p_capability: "note.created", p_scope: scope });
    await assert.rejects(
      k.rpc(bob, "issue_grant", { p_grantee: carolId, p_capability: "*", p_scope: scope }),
      sqlstate("KA002"),
    );
    await assert.rejects(
      k.rpc(bob, "issue_grant", { p_grantee: carolId, p_capability: "note.*", p_scope: "*" }),
      sqlstate("KA002"),
    );
  });

  it("voids every grant delegated from a revoked grant", async () => {
    const k = await createKernelDb();
    const [aliceId, bobId, carolId] = await registered(k, alice, bob, carol);
    const scope = `actor:${aliceId}`;
    const bobsGrant = await k.value(alice, "issue_grant", { p_grantee: bobId, p_capability: "*", p_scope: scope });
    await k.rpc(bob, "issue_grant", { p_grantee: carolId, p_capability: "note.*", p_scope: scope });
    await k.rpc(carol, "record_event", { p_type: "note.created", p_scope: scope });

    await k.rpc(alice, "revoke_grant", { p_grant_id: bobsGrant });
    await assert.rejects(
      k.rpc(carol, "record_event", { p_type: "note.created", p_scope: scope }),
      sqlstate("KA002"),
    );
  });

  it("lets grants expire", async () => {
    const k = await createKernelDb();
    const [aliceId, bobId] = await registered(k, alice, bob);
    const scope = `actor:${aliceId}`;
    await k.rpc(alice, "issue_grant", {
      p_grantee: bobId,
      p_capability: "note.*",
      p_scope: scope,
      p_expires_at: new Date(Date.now() + 1000).toISOString(),
    });
    await k.rpc(bob, "record_event", { p_type: "note.created", p_scope: scope });
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await assert.rejects(
      k.rpc(bob, "record_event", { p_type: "note.created", p_scope: scope }),
      sqlstate("KA002"),
    );
  });

  it("gives the first claimant of a new scope authority over it and everything nested", async () => {
    const k = await createKernelDb();
    await registered(k, alice, bob);
    await k.rpc(alice, "claim_scope", { p_scope: "world:alpha" });
    await k.rpc(alice, "record_event", { p_type: "world.named", p_scope: "world:alpha" });
    await k.rpc(alice, "record_event", { p_type: "room.opened", p_scope: "world:alpha/room:study" });

    await assert.rejects(k.rpc(bob, "claim_scope", { p_scope: "world:alpha" }), sqlstate("KA004"));
    await assert.rejects(k.rpc(bob, "claim_scope", { p_scope: "actor:anyone" }), sqlstate("KA003"));
    await assert.rejects(k.rpc(bob, "claim_scope", { p_scope: "chain:solana" }), sqlstate("KA003"));
    await assert.rejects(k.rpc(bob, "claim_scope", { p_scope: "world:alpha/room:x" }), sqlstate("KA003"));
    await assert.rejects(
      k.rpc(bob, "record_event", { p_type: "world.named", p_scope: "world:alpha" }),
      sqlstate("KA002"),
    );
  });

  it("gates reads by scope", async () => {
    const k = await createKernelDb();
    const [aliceId] = await registered(k, alice, bob);
    await assert.rejects(
      k.rpc(bob, "read_events", { p_scope: `actor:${aliceId}` }),
      sqlstate("KA002"),
    );
  });
});

describe("agents", () => {
  it("start with no authority and record the human they act for", async () => {
    const k = await createKernelDb();
    const [aliceId] = await registered(k, alice);
    const scope = `actor:${aliceId}`;
    const agent = await k.value(alice, "create_agent", { p_label: "Alice's companion" });
    const asAgent = { p_type: "note.drafted", p_scope: scope, p_as_actor: agent };

    await assert.rejects(k.rpc(service, "record_event", asAgent), sqlstate("KA002"));

    await k.rpc(alice, "issue_grant", { p_grantee: agent, p_capability: "note.*", p_scope: scope });
    const id = await k.value(service, "record_event", asAgent);
    const [event] = await k.rpc(alice, "read_events", { p_scope: scope, p_newest_first: true, p_limit: 1 });
    assert.equal(event.id, id);
    assert.equal(event.actor_id, agent);
    assert.equal(event.on_behalf_of, aliceId);
    assert.equal(event.auth_method, "service_role");
  });

  it("cannot exceed their owner's authority", async () => {
    const k = await createKernelDb();
    const [, bobId] = await registered(k, alice, bob);
    const agent = await k.value(alice, "create_agent", { p_label: "companion" });
    await assert.rejects(
      k.rpc(alice, "issue_grant", { p_grantee: agent, p_capability: "note.*", p_scope: `actor:${bobId}` }),
      sqlstate("KA002"),
    );
  });

  it("cannot be impersonated by an end user", async () => {
    const k = await createKernelDb();
    const [aliceId] = await registered(k, alice);
    const agent = await k.value(alice, "create_agent", { p_label: "companion" });
    await assert.rejects(
      k.rpc(alice, "record_event", { p_type: "note.drafted", p_scope: `actor:${aliceId}`, p_as_actor: agent }),
      sqlstate("KA002"),
    );
  });
});

describe("ledger", () => {
  async function economy() {
    const k = await createKernelDb();
    const founder = user("auth-founder");
    const [founderId, aliceId, bobId] = await registered(k, founder, alice, bob);
    await k.owner("select kernel.grant_root($1)", [founderId]);
    await k.rpc(founder, "define_asset", { p_code: "SOV", p_issuer_scope: "system", p_decimals: 9 });
    const issuance = await k.value(founder, "open_account", {
      p_scope: "system",
      p_asset: "SOV",
      p_normal_balance: "credit",
      p_label: "SOV issuance",
    });
    const aliceWallet = await k.value(alice, "open_account", { p_scope: `actor:${aliceId}`, p_asset: "SOV" });
    const bobWallet = await k.value(bob, "open_account", { p_scope: `actor:${bobId}`, p_asset: "SOV" });
    await k.rpc(founder, "post_transaction", {
      p_scope: "system",
      p_entries: [
        { account_id: issuance, amount: "-1000" },
        { account_id: aliceWallet, amount: "1000" },
      ],
      p_memo: "issue",
    });
    const balance = async (session: ReturnType<typeof user>, account: string) =>
      (await k.rpc(session, "account_balance", { p_account_id: account }))[0].balance;
    return { k, founder, aliceId, bobId, issuance, aliceWallet, bobWallet, balance };
  }

  it("issues only from the issuer scope and derives balances from entries", async () => {
    const { k, founder, issuance, aliceWallet, balance } = await economy();
    assert.equal(await balance(alice, aliceWallet), "1000");
    assert.equal(await balance(founder, issuance), "1000");
    assert.equal((await verify(k)).ok, true);
  });

  it("moves value only with the sender's authority", async () => {
    const { k, aliceId, bobId, aliceWallet, bobWallet, balance } = await economy();
    await k.rpc(alice, "post_transaction", {
      p_scope: `actor:${aliceId}`,
      p_entries: [
        { account_id: aliceWallet, amount: "-300" },
        { account_id: bobWallet, amount: "300" },
      ],
    });
    assert.equal(await balance(alice, aliceWallet), "700");
    assert.equal(await balance(bob, bobWallet), "300");

    const takeFromBob = [
      { account_id: bobWallet, amount: "-100" },
      { account_id: aliceWallet, amount: "100" },
    ];
    await assert.rejects(
      k.rpc(alice, "post_transaction", { p_scope: `actor:${aliceId}`, p_entries: takeFromBob }),
      sqlstate("KA002"),
    );
    await assert.rejects(
      k.rpc(alice, "post_transaction", { p_scope: `actor:${bobId}`, p_entries: takeFromBob }),
      sqlstate("KA002"),
    );
  });

  it("rejects unbalanced postings and overdrafts without moving anything", async () => {
    const { k, aliceId, aliceWallet, bobWallet, balance } = await economy();
    const post = (a: string, b: string) =>
      k.rpc(alice, "post_transaction", {
        p_scope: `actor:${aliceId}`,
        p_entries: [
          { account_id: aliceWallet, amount: a },
          { account_id: bobWallet, amount: b },
        ],
      });
    await assert.rejects(post("-100", "90"), sqlstate("KA003"));
    await assert.rejects(post("-5000", "5000"), sqlstate("KA005"));
    await assert.rejects(post("-0", "0"), sqlstate("KA003"));
    assert.equal(await balance(alice, aliceWallet), "1000");
  });

  it("allows supply-creating accounts only inside the issuer scope", async () => {
    const { k, aliceId } = await economy();
    const scope = `actor:${aliceId}`;
    await assert.rejects(
      k.rpc(alice, "open_account", { p_scope: scope, p_asset: "SOV", p_normal_balance: "credit" }),
      sqlstate("KA002"),
    );
    await assert.rejects(
      k.rpc(alice, "open_account", { p_scope: scope, p_asset: "SOV", p_allow_negative: true }),
      sqlstate("KA002"),
    );
    await assert.rejects(
      k.rpc(alice, "define_asset", { p_code: "FAKE", p_issuer_scope: scope, p_decimals: 0 }),
      sqlstate("KA002"),
    );
  });

  it("never posts twice for one idempotency key", async () => {
    const { k, aliceId, aliceWallet, bobWallet, balance } = await economy();
    const args = {
      p_scope: `actor:${aliceId}`,
      p_entries: [
        { account_id: aliceWallet, amount: "-250" },
        { account_id: bobWallet, amount: "250" },
      ],
      p_idempotency_key: "pay-bob-1",
    };
    const first = await k.value(alice, "post_transaction", args);
    const second = await k.value(alice, "post_transaction", args);
    assert.equal(second, first);
    assert.equal(await balance(alice, aliceWallet), "750");
  });

  it("refuses ledger rows that do not balance, even from the owner", async () => {
    const { k, aliceWallet } = await economy();
    const [{ id: eventId }] = await k.owner("select id from kernel.events order by seq desc limit 1");
    await assert.rejects(
      k.owner("insert into kernel.ledger_entries (event_id, account_id, asset, amount) values ($1, $2, 'SOV', 5)", [
        eventId,
        aliceWallet,
      ]),
      sqlstate("KA003"),
    );
  });
});

describe("evidence", () => {
  it("attaches proof and limits who can claim which basis", async () => {
    const k = await createKernelDb();
    const founder = user("auth-founder");
    const [founderId, aliceId, bobId] = await registered(k, founder, alice, bob);
    const scope = `actor:${aliceId}`;

    const eventId = await k.value(alice, "record_event", {
      p_type: "trade.called",
      p_scope: scope,
      p_payload: { market: "BTC", direction: "long" },
      p_evidence: [{ basis: "self_reported", content_hash: sha(1), description: "screenshot" }],
    });

    await assert.rejects(
      k.rpc(alice, "attach_evidence", { p_event_id: eventId, p_basis: "externally_verified", p_content_hash: sha(2) }),
      sqlstate("KA002"),
    );
    await assert.rejects(
      k.rpc(alice, "attach_evidence", { p_event_id: eventId, p_basis: "witnessed", p_content_hash: sha(3) }),
      sqlstate("KA002"),
    );
    await assert.rejects(
      k.rpc(alice, "attach_evidence", { p_event_id: eventId, p_basis: "artifact", p_content_hash: "md5:abc" }),
      sqlstate("KA003"),
    );

    // Bob can witness once Alice lets him attach evidence in her scope.
    await k.rpc(alice, "issue_grant", { p_grantee: bobId, p_capability: "kernel.evidence.attach", p_scope: scope });
    await k.rpc(bob, "attach_evidence", { p_event_id: eventId, p_basis: "witnessed", p_content_hash: sha(4) });

    // A verification service, created under root authority, can attest externally.
    await k.owner("select kernel.grant_root($1)", [founderId]);
    const verifier = await k.value(founder, "create_service_actor", { p_label: "price verifier" });
    await k.rpc(alice, "issue_grant", {
      p_grantee: verifier,
      p_capability: "kernel.evidence.attach",
      p_scope: scope,
    });
    await k.rpc(service, "attach_evidence", {
      p_event_id: eventId,
      p_basis: "externally_verified",
      p_content_hash: sha(5),
      p_as_actor: verifier,
    });

    const evidence = await k.rpc(alice, "read_evidence", { p_event_id: eventId });
    assert.deepEqual(
      evidence.map((e) => [e.basis, e.attached_by]),
      [
        ["self_reported", aliceId],
        ["witnessed", bobId],
        ["externally_verified", verifier],
      ],
    );
  });
});

describe("tamper evidence", () => {
  it("detects an edited event", async () => {
    const k = await createKernelDb();
    const [aliceId] = await registered(k, alice);
    await k.rpc(alice, "record_event", { p_type: "note.created", p_scope: `actor:${aliceId}`, p_payload: { n: 1 } });
    assert.equal((await verify(k)).ok, true);

    await k.owner("alter table kernel.events disable trigger events_append_only");
    await k.owner(`update kernel.events set payload = '{"n": 2}' where type = 'note.created'`);
    const [{ seq }] = await k.owner("select seq from kernel.events where type = 'note.created'");

    const result = await verify(k);
    assert.equal(result.ok, false);
    assert.equal(result.first_bad_seq, seq);
    assert.equal(result.problem, "event content does not match its hash");
  });

  it("detects ledger rows that no longer match their posting", async () => {
    const k = await createKernelDb();
    const founder = user("auth-founder");
    const [founderId] = await registered(k, founder);
    await k.owner("select kernel.grant_root($1)", [founderId]);
    await k.rpc(founder, "define_asset", { p_code: "SOV", p_issuer_scope: "system", p_decimals: 9 });
    const a = await k.value(founder, "open_account", { p_scope: "system", p_asset: "SOV", p_normal_balance: "credit" });
    const b = await k.value(founder, "open_account", { p_scope: "system", p_asset: "SOV" });
    await k.rpc(founder, "post_transaction", {
      p_scope: "system",
      p_entries: [
        { account_id: a, amount: "-10" },
        { account_id: b, amount: "10" },
      ],
    });

    await k.owner("alter table kernel.ledger_entries disable trigger ledger_entries_append_only");
    await k.owner("update kernel.ledger_entries set amount = amount * 100");

    const result = await verify(k);
    assert.equal(result.ok, false);
    assert.equal(result.problem, "ledger entries do not match the posting event");
  });
});
