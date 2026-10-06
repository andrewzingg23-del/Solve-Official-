// World swap feed: only members who opted in appear; newest first; read-only.
import assert from "node:assert/strict";
import { it } from "node:test";
import { readWorldSwaps, SWAP_EXECUTED } from "../../lib/trading/social";

type FakeEvent = { type: string; payload: Record<string, unknown> };
function fakeKernel(scopes: Record<string, FakeEvent[]>) {
  return {
    readEvents: async (scope: string) => scopes[scope] ?? [],
  };
}

const swap = (from: string, to: string, at: string) => ({
  type: SWAP_EXECUTED,
  payload: { from, to, inAmount: "1", outAmount: "2", signature: "sig", at },
});
const scope = (actor: string) => `actor:${actor}/trading:swaps`;

it("merges opted-in members newest-first and skips everyone else", async () => {
  const kernel = fakeKernel({
    [scope("alice")]: [swap("SOL", "USDC", "2026-10-06T10:00:00Z"), swap("BONK", "SOL", "2026-10-06T12:00:00Z")],
    [scope("bob")]: [swap("ETH", "USDC", "2026-10-06T11:00:00Z")],
    [scope("carol")]: [swap("SOL", "JUP", "2026-10-06T13:00:00Z")],
  });
  const sharing = async (_k: unknown, actor: string) => actor === "alice" || actor === "bob";

  const feed = await readWorldSwaps(kernel as never, ["alice", "bob", "carol"], sharing as never);
  assert.equal(feed.length, 3, "carol opted out so her swap is excluded");
  assert.deepEqual(
    feed.map((s) => s.actorId),
    ["alice", "bob", "alice"],
    "newest first across members",
  );
  assert.ok(feed.every((s) => typeof s.signature === "string"), "records carry through");
});

it("empty when nobody shares, and honors the limit", async () => {
  const kernel = fakeKernel({ [scope("alice")]: [swap("SOL", "USDC", "2026-10-06T10:00:00Z")] });
  const none = await readWorldSwaps(kernel as never, ["alice"], (async () => false) as never);
  assert.deepEqual(none, []);
  const one = await readWorldSwaps(kernel as never, ["alice"], (async () => true) as never, 1);
  assert.equal(one.length, 1);
});

it("a member whose read fails does not break the feed", async () => {
  const kernel = {
    readEvents: async (s: string) => {
      if (s.includes("bob")) throw new Error("denied");
      return [swap("SOL", "USDC", "2026-10-06T10:00:00Z")];
    },
  };
  const feed = await readWorldSwaps(kernel as never, ["alice", "bob"], (async () => true) as never);
  assert.equal(feed.length, 1);
  assert.equal(feed[0].actorId, "alice");
});
