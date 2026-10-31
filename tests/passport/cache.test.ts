import assert from "node:assert/strict";
import { it } from "node:test";
import { TtlCache } from "../../lib/passport/cache";
import { clearPassportCache, passportContext } from "../../lib/passport/context";
import type { ToolResult } from "../../lib/passport/client";

it("TtlCache keeps a value until its TTL, then forgets it, per key", () => {
  let t = 0;
  const cache = new TtlCache(1000, () => t);
  assert.equal(cache.get("a"), null);
  cache.set("a", "hello");
  assert.equal(cache.get("a"), "hello");
  t = 999;
  assert.equal(cache.get("a"), "hello", "still fresh just under the TTL");
  t = 1000;
  assert.equal(cache.get("a"), null, "gone at the TTL");
  cache.set("a", "x");
  cache.set("b", "y");
  cache.clear();
  assert.equal(cache.get("a"), null);
  assert.equal(cache.get("b"), null);
});

it("passportContext reads profile and projects once per person, but related facts every message", async () => {
  clearPassportCache();
  const calls: string[] = [];
  const fakeCall = async (name: string): Promise<ToolResult> => {
    calls.push(name);
    return { text: `${name}-text`, structured: null, isError: false };
  };
  // A withPassport stand-in: always "linked", just runs the work with our fake call.
  const withImpl = (async (_kernel: unknown, _ownerId: string, work: (c: typeof fakeCall) => Promise<string>) =>
    work(fakeCall)) as unknown as typeof import("../../lib/passport/link").withPassport;

  const kernel = {} as never;
  const first = await passportContext(kernel, "person-1", "hello", 3500, { with: withImpl });
  const second = await passportContext(kernel, "person-1", "again", 3500, { with: withImpl });

  assert.match(first, /## Profile\nget_profile-text/);
  assert.match(first, /## Projects\nlist_projects-text/);
  assert.match(second, /## Profile\nget_profile-text/, "profile still present on the second message");

  assert.equal(calls.filter((c) => c === "get_profile").length, 1, "profile read once");
  assert.equal(calls.filter((c) => c === "list_projects").length, 1, "projects read once");
  assert.equal(calls.filter((c) => c === "search_context").length, 2, "related facts read every message");
});

it("passportContext returns nothing when there is no link", async () => {
  clearPassportCache();
  const withImpl = (async () => null) as unknown as typeof import("../../lib/passport/link").withPassport;
  const out = await passportContext({} as never, "person-2", "hi", 3500, { with: withImpl });
  assert.equal(out, "");
});
