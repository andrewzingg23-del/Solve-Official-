// A World's room: the build read from GitHub for a World that links a repository, its pieces where
// they were placed otherwise, and what is waiting on the person, including pull requests asking to
// merge into the trunk. Rendered as markup; nothing here reaches GitHub or a kernel.
import assert from "node:assert/strict";
import { it } from "node:test";
import type { RepoRead } from "../../lib/github/repo";

const NOW = "2026-10-05T06:00:00.000Z";
const WORLD = "0b6a3f5e-1d2c-4e5f-8a9b-0c1d2e3f4a5b";

const ok: RepoRead = {
  ok: true,
  view: {
    ref: { owner: "o", repo: "r", trunk: "claude/keen-cerf-tpd7io" },
    url: "https://github.com/o/r",
    trunk: "claude/keen-cerf-tpd7io",
    readAt: "2026-10-05T05:59:00.000Z",
    trunkBuilds: [{ id: 3, number: 137, branch: "claude/keen-cerf-tpd7io", sha: "c".repeat(40), title: "Put /start on the brand", event: "push", state: "passed", url: "https://github.com/o/r/actions/runs/3", at: "2026-10-05T05:27:12.000Z" }],
    commits: [{ sha: "c".repeat(40), message: "Put /start on the brand", at: "2026-10-05T05:27:08.000Z", url: "https://github.com/o/r/commit/c", builder: "Claude" }],
    lanes: [{
      branch: "manus/start-route-clean",
      builder: "Manus",
      pulls: [{ number: 9, title: "Document agent builder MCP connections", branch: "manus/start-route-clean", base: "claude/keen-cerf-tpd7io", state: "open", url: "https://github.com/o/r/pull/9", at: "2026-10-05T05:33:06.000Z" }],
      build: { id: 2, number: 135, branch: "manus/start-route-clean", sha: "3".repeat(40), title: "", event: "pull_request", state: "failed", url: "https://github.com/o/r/actions/runs/2", at: "2026-10-05T05:09:45.000Z" },
      at: "2026-10-05T05:33:06.000Z",
    }],
    builders: [
      { builder: "Manus", open: [], merged: 1, commits: 0, build: null, at: "2026-10-05T05:33:06.000Z" },
      { builder: "Claude", open: [], merged: 0, commits: 1, build: null, at: "2026-10-05T05:27:08.000Z" },
    ],
  },
};

async function render(over: Record<string, unknown>) {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { RoomView } = await import("../../app/world/[worldId]/room/view");
  const data = {
    worldId: WORLD, title: "Build solve", goal: "Ship solve to the founder first", now: NOW, lens: "build" as const,
    pieces: [], people: [{ id: "a", label: "Andrew", kind: "human" as const, you: true }], botName: null, assistants: [],
    journeys: [], waiting: [], gaps: [], saves: [], activity: [], repo: null,
    ...over,
  };
  return renderToStaticMarkup(RoomView({ data }));
}

it("shows the build from GitHub: builders, the trunk's latest build, and pull requests waiting to merge", async () => {
  const html = await render({ repo: { read: ok, paired: true } });
  assert.match(html, /Ship solve to the founder first/);
  assert.match(html, /Manus[\s\S]*Claude/);
  assert.match(html, /build 137 passed · 33 min ago/);
  assert.match(html, /Review to merge[\s\S]*#9 Document agent builder MCP connections/);
  assert.match(html, /build 135 failed/);
  assert.match(html, /Read from GitHub 1 min ago/);
  assert.match(html, /Nothing here is anyone&#x27;s word/);
});

it("says plainly why a repository isn't showing, with the exact pairing to add", async () => {
  const html = await render({ repo: { read: { ok: false, reason: "not_connected", ref: { owner: "o", repo: "r", trunk: "main" } }, paired: false } });
  assert.match(html, /o\/r isn&#x27;t showing yet/);
  assert.match(html, new RegExp(`GITHUB_ROOMS=${WORLD}=o/r@main`));
  assert.doesNotMatch(html, /Review to merge/);
});

it("shows pieces where they were placed, with the point only on a saved one, and offers to link a repository", async () => {
  const linkRepo = async () => {};
  const html = await render({
    lens: "pieces",
    linkRepo,
    pieces: [
      { id: "g", title: "Ship solve", x: 50, y: 25, kind: "goal", detail: null, saved: false },
      { id: "n", title: "Ask Manus for the builders doc", x: 24, y: 30, kind: "text", detail: null, saved: true },
    ],
  });
  assert.match(html, /left:24%;top:30%/);
  assert.equal((html.match(/aria-label="Saved with proof"/g) ?? []).length, 2); // the canvas and the phone list
  assert.match(html, /Link repository/);
  assert.doesNotMatch(html, /role="tab"[^>]*>Build</); // no Build lens without a repository
});
