// Team agent: lifecycle events, consent-gated digest, sealed stays sealed.
import assert from "node:assert/strict";
import { it } from "node:test";
import { createTeamAgent, inviteMember, teamDigest } from "../../lib/team/agent";
import { memoryConsent } from "../../lib/bot/consent";

const now = new Date().toISOString();
const hourAgo = new Date(Date.now() - 3600_000).toISOString();

function fakeKernel(opts: { grants?: { scope: string; capability: string }[]; events?: Record<string, { type: string; occurred_at: string }[]> } = {}) {
  const calls: string[] = [];
  return {
    calls,
    createAgent: async (label: string) => {
      calls.push(`create-agent:${label}`);
      return "agent-1";
    },
    recordEvent: async (input: { type: string; scope: string }) => {
      calls.push(`event:${input.type}:${input.scope}`);
      return `evt-${calls.length}`;
    },
    myGrants: async () => (opts.grants ?? []).map((g, i) => ({ id: `g${i}`, ...g })),
    readEvents: async (scope: string) => opts.events?.[scope] ?? [],
  };
}

it("creating a team agent makes the actor and records it", async () => {
  const k = fakeKernel();
  const id = await createTeamAgent(k as never, "owner-1", "Crew brain");
  assert.equal(id, "agent-1");
  assert.ok(k.calls.includes("create-agent:Crew brain"));
  assert.ok(k.calls.some((c) => c === "event:team.agent.created:actor:owner-1/team"));
});

it("inviting a member records the ask and shares nothing by itself", async () => {
  const k = fakeKernel();
  const evt = await inviteMember(k as never, "owner-1", "agent-1", "member-9");
  assert.ok(evt.startsWith("evt-"));
  assert.ok(k.calls.some((c) => c === "event:team.member.invited:actor:owner-1/team"));
  assert.equal(k.calls.filter((c) => c.startsWith("grant:")).length, 0, "no grant issued");
});

it("digest skips unconsented members and summarizes consented activity", async () => {
  const k = fakeKernel({
    grants: [{ scope: "actor:owner-1/bot:memory", capability: "bot.memory.*" }],
    events: {
      "actor:owner-1/bot:memory": [
        { type: "bot.memory.noted", occurred_at: hourAgo },
        { type: "bot.memory.noted", occurred_at: now },
        { type: "consent.granted", occurred_at: now },
      ],
    },
  });
  const digest = await teamDigest(k as never, "agent-1", "owner-1", [
    memoryConsent("owner-1", "agent-1"),
    memoryConsent("owner-2", "agent-1"),
  ]);
  assert.equal(digest.agentActorId, "agent-1");
  const [m1, m2] = digest.members;
  assert.equal(m1.consented, true);
  assert.deepEqual(
    m1.activity.find((a) => a.type === "bot.memory.noted"),
    { type: "bot.memory.noted", count: 2, latestAt: now },
  );
  assert.equal(m2.consented, false, "no grant, no visibility");
  assert.deepEqual(m2.activity, []);
  assert.ok(k.calls.some((c) => c === "event:team.digest:actor:owner-1/team"), "digest is on the record");
});

it("old activity falls outside the 24h window", async () => {
  const old = new Date(Date.now() - 48 * 3600_000).toISOString();
  const k = fakeKernel({
    grants: [{ scope: "actor:owner-1/bot:memory", capability: "bot.memory.*" }],
    events: { "actor:owner-1/bot:memory": [{ type: "bot.memory.noted", occurred_at: old }] },
  });
  const digest = await teamDigest(k as never, "agent-1", "owner-1", [memoryConsent("owner-1", "agent-1")]);
  assert.deepEqual(digest.members[0].activity, [], "stale activity excluded");
});
