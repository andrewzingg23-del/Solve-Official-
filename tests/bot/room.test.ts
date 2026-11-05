// The room consumes authorized data. This checks attribution, access-aware
// controls and real repository evidence; browser fixtures cover interaction and layout.
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
  const { createElement } = await import("react");
  const { AppRouterContext } = await import("next/dist/shared/lib/app-router-context.shared-runtime");
  const { RoomView } = await import("../../app/world/[worldId]/room/view");
  const data = {
    worldId: WORLD, title: "Build solve", goal: "Ship solve to the founder first", now: NOW, lens: "build" as const,
    pieces: [], people: [{ id: "a", label: "Andrew", kind: "human" as const, you: true }], botName: null, assistants: [],
    journeys: [], waiting: [], gaps: [], saves: [], activity: [], repo: null,
    ...over,
  };
  return renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: {
    back() {}, forward() {}, refresh() {}, push() {}, replace() {}, prefetch() {}, bfcacheId: "room-render-fixture",
  } }, RoomView({ data })));
}

it("shows the build from GitHub: builders, the trunk's latest build, and pull requests waiting to merge", async () => {
  const html = await render({ repo: { read: ok, paired: true } });
  assert.match(html, /Ship solve to the founder first/);
  assert.match(html, /Manus[\s\S]*Claude/);
  assert.match(html, /build 137 passed · 33 min ago/);
  assert.match(html, /Review to merge[\s\S]*#9 Document agent builder MCP connections/);
  assert.match(html, /build 135 failed/);
  assert.match(html, /observed 2026-10-05T05:59:00.000Z \(1m ago\)/);
  assert.match(html, /GitHub\/CI evidence/);
  assert.match(html, /Runner status: unavailable/);
});

it("says plainly why a repository isn't showing, with the exact pairing to add", async () => {
  const html = await render({ repo: { read: { ok: false, reason: "not_connected", ref: { owner: "o", repo: "r", trunk: "main" } }, paired: false } });
  assert.match(html, /o\/r isn&#x27;t showing yet/);
  assert.match(html, new RegExp(`GITHUB_ROOMS=${WORLD}=o/r@main`));
  assert.doesNotMatch(html, /Review to merge/);
});

it("keeps saved resource links and repository linking available while excluding unfinished route and outreach tools", async () => {
  const linkRepo = async () => {};
  const html = await render({
    lens: "pieces",
    linkRepo,
    pieces: [
      { id: "g", title: "Ship solve", x: 50, y: 25, kind: "goal", detail: null, saved: false },
      { id: "n", title: "Ask Manus for the builders doc", x: 24, y: 30, kind: "text", detail: null, saved: true },
      { id: "o", title: "Practice outreach", x: 24, y: 30, kind: "outreach", detail: null, saved: false },
      { id: "p", title: "Proposed capability", x: 24, y: 30, kind: "proposal", detail: null, saved: false },
      { id: "r", title: "Non-executable route", x: 24, y: 30, kind: "routes", detail: null, saved: false },
    ],
  });
  assert.match(html, new RegExp(`href="/world/${WORLD}#piece-n"`));
  assert.match(html, /Ask Manus for the builders doc/);
  assert.match(html, /Saved with proof/);
  assert.match(html, /Link repository/);
  assert.doesNotMatch(html, /Practice outreach|Proposed capability|Non-executable route/);
});

it("lets readers see attributed conversation while keeping publishing and write controls for editors", async () => {
  const conversation = { beforeSeq: null, messages: [{ message_id: "m", seq: 1, occurred_at: NOW, actor_id: "b", actor_kind: "human", actor_label: "Ana", kind: "decision", text: "Prototype the cartridge first", reply_to: null, source_refs: [], ask_ai: false, reply_state: null, request_id: "request" }] };
  const reader = await render({ conversation, canWrite: false });
  assert.match(reader, /Ana · recorded decision/);
  assert.match(reader, /Prototype the cartridge first/);
  assert.match(reader, /Ask the owner for editor access/);
  assert.doesNotMatch(reader, /Send to room|Publish shared source|name="note"/);
  const editor = await render({ conversation, canWrite: true });
  assert.match(editor, /Ana · recorded decision/);
  assert.match(editor, /Send to room/);
  assert.match(editor, /Bring selected AI knowledge into this room/);
  assert.match(editor, /Publish shared source/);
});

it("attributes a saved self-reported result to its author rather than the viewer", async () => {
  const html = await render({
    people: [{ id: "a", label: "Andrew", kind: "human", you: true }, { id: "b", label: "Ana", kind: "human", you: false }],
    saves: [{ pieceId: "r", what: "Prototype assembled", proof: "", link: null, basis: "self_reported", at: NOW, recordId: "e1", number: 41, by: "b" }],
  });
  assert.match(html, /On Ana&#x27;s word/);
  assert.doesNotMatch(html, /On your word/);
});

it("offers to save the trunk's passed build as proof, and shows it saved once it is", async () => {
  const saveBuild = async () => {};
  const unsaved = await render({ repo: { read: ok, paired: true }, saveBuild });
  assert.match(unsaved, /name="buildId" value="3"/);
  assert.match(unsaved, /Save as proof/);
  const saved = await render({
    repo: { read: ok, paired: true }, saveBuild,
    saves: [{ pieceId: "r", what: "Build 137 passed on claude/keen-cerf-tpd7io", proof: "", link: "https://github.com/o/r/actions/runs/3", basis: "artifact", at: NOW, recordId: "e1", number: 41, by: "a" }],
  });
  assert.doesNotMatch(saved, /Save as proof/);
  assert.match(saved, /With the record attached/);
});

it("shows the deployed trunk when GitHub can't be read, and asks only for the token when paired", async () => {
  const deployed = { ...ok.view, source: "deployment" as const, trunkBuilds: [], lanes: [] };
  const html = await render({ repo: { read: { ok: true, view: deployed }, paired: true, unread: "not_connected" } });
  assert.match(html, /The trunk as this app was deployed/);
  assert.match(html, /GITHUB_TOKEN=/);
  assert.doesNotMatch(html, /GITHUB_ROOMS=/, "paired already, so only the token");
  assert.match(html, /snapshot recorded 2026-10-05T05:59:00.000Z/);
  assert.match(html, /no live GitHub/);
});
