// Consent gates: the grant is on the data scope, so the kernel enforces it;
// the events are the provenance record. Kernel client is faked.
import assert from "node:assert/strict";
import { it } from "node:test";
import { grantConsent, hasConsent, memoryConsent, requestConsent, revokeConsent } from "../../lib/bot/consent";

type FakeKernel = {
  calls: string[];
  grants: { id: string; capability: string; scope: string }[];
  recordEvent: (input: { type: string; scope: string; payload: Record<string, unknown> }) => Promise<string>;
  issueGrant: (input: { grantee: string; capability: string; scope: string }) => Promise<string>;
  revokeGrant: (grantId: string, reason?: string) => Promise<void>;
  myGrants: () => Promise<{ id: string; capability: string; scope: string }[]>;
};

function fakeKernel(): FakeKernel {
  const calls: string[] = [];
  const grants: FakeKernel["grants"] = [];
  return {
    calls,
    grants,
    recordEvent: async (input) => {
      calls.push(`event:${input.type}:${input.scope}`);
      return `evt-${calls.length}`;
    },
    issueGrant: async (input) => {
      calls.push(`grant:${input.grantee}:${input.capability}:${input.scope}`);
      const id = `grant-${grants.length + 1}`;
      grants.push({ id, capability: input.capability, scope: input.scope });
      return id;
    },
    revokeGrant: async (grantId) => {
      calls.push(`revoke:${grantId}`);
      const i = grants.findIndex((g) => g.id === grantId);
      if (i >= 0) grants.splice(i, 1);
    },
    myGrants: async () => [...grants],
  };
}

const req = memoryConsent("owner-1", "agent-1");

it("memoryConsent targets the data scope with the memory capability", () => {
  assert.equal(req.scope, "actor:owner-1/bot:memory");
  assert.equal(req.capability, "bot.memory.*");
});

it("requesting consent records an event and grants nothing", async () => {
  const k = fakeKernel();
  const eventId = await requestConsent(k as never, req);
  assert.ok(eventId.startsWith("evt-"));
  assert.ok(k.calls.some((c) => c.startsWith("event:consent.requested:actor:owner-1/bot:memory")));
  assert.equal(await hasConsent(k as never, req), false, "asking alone grants nothing");
});

it("granting issues a kernel grant on the data scope; hasConsent flips true", async () => {
  const k = fakeKernel();
  const { grantId, eventId } = await grantConsent(k as never, req);
  assert.ok(grantId.startsWith("grant-"));
  assert.ok(eventId.startsWith("evt-"));
  assert.ok(
    k.calls.some((c) => c === "grant:agent-1:bot.memory.*:actor:owner-1/bot:memory"),
    "grant is on the data scope so the kernel enforces it",
  );
  assert.equal(await hasConsent(k as never, req), true);
});

it("revoking removes the grant and records it; hasConsent flips false", async () => {
  const k = fakeKernel();
  const { grantId } = await grantConsent(k as never, req);
  assert.equal(await hasConsent(k as never, req), true);
  const eventId = await revokeConsent(k as never, req, grantId, "no longer needed");
  assert.ok(eventId.startsWith("evt-"));
  assert.ok(k.calls.some((c) => c.startsWith("event:consent.revoked:")));
  assert.equal(await hasConsent(k as never, req), false);
});

it("consent is scoped: other owners and scopes do not match", async () => {
  const k = fakeKernel();
  await grantConsent(k as never, req);
  assert.equal(await hasConsent(k as never, memoryConsent("owner-2", "agent-1")), false);
  assert.equal(
    await hasConsent(k as never, { ...req, scope: "actor:owner-1/bot:links" }),
    false,
  );
});
