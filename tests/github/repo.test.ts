// The repo as a source for a Build Room: GitHub read-only, shaped into the trunk's builds and each
// builder's lanes. The fixtures follow GitHub's real response shapes; no network is used.
import assert from "node:assert/strict";
import { it } from "node:test";
import { builderOf, buildState, lanesFrom, parseRepoUrl, readRepo, repoForWorld, roomRepos, shapeBuilds, shapeCommits, shapePulls } from "../../lib/github/repo";

const TRUNK = "claude/keen-cerf-tpd7io";
const WORLD = "0b6a3f5e-1d2c-4e5f-8a9b-0c1d2e3f4a5b";
const NOW = new Date("2026-10-05T06:00:00Z");

const runs = {
  total_count: 4,
  workflow_runs: [
    { id: 4, run_number: 138, name: "Build", display_title: "Founder Room", head_branch: TRUNK, head_sha: "e".repeat(40), status: "in_progress", conclusion: null, event: "push", created_at: "2026-10-05T05:58:00Z", html_url: "https://github.com/o/r/actions/runs/4" },
    { id: 3, run_number: 137, name: "Build", display_title: "Put /start on the brand", head_branch: TRUNK, head_sha: "c".repeat(40), status: "completed", conclusion: "success", event: "push", created_at: "2026-10-05T05:27:12Z", html_url: "https://github.com/o/r/actions/runs/3" },
    { id: 2, run_number: 135, name: "Build", display_title: "Add the real app start route", head_branch: "manus/start-route-clean", head_sha: "3".repeat(40), status: "completed", conclusion: "failure", event: "pull_request", created_at: "2026-10-05T05:09:45Z", html_url: "https://github.com/o/r/actions/runs/2" },
    { id: 1, run_number: 90, name: "Build", display_title: "Old", head_branch: "codex/old", head_sha: "1".repeat(40), status: "completed", conclusion: "success", event: "push", created_at: "2026-09-20T00:00:00Z", html_url: "https://github.com/o/r/actions/runs/1" },
    { id: 9, head_branch: TRUNK, html_url: "javascript:alert(1)", created_at: "2026-10-05T05:00:00Z" },
  ],
};

const prs = [
  { number: 9, title: "Document agent builder MCP connections", state: "open", draft: false, merged_at: null, updated_at: "2026-10-05T05:33:06Z", html_url: "https://github.com/o/r/pull/9", head: { ref: "manus/start-route-clean" }, base: { ref: TRUNK } },
  { number: 8, title: "Add the real app start route", state: "closed", draft: false, merged_at: "2026-10-05T05:11:01Z", updated_at: "2026-10-05T05:11:02Z", html_url: "https://github.com/o/r/pull/8", head: { ref: "manus/start-route-clean" }, base: { ref: TRUNK } },
  { number: 2, title: "Build World Idea Graph and collaboration v1", state: "open", draft: true, merged_at: null, updated_at: "2026-09-20T05:02:57Z", html_url: "https://github.com/o/r/pull/2", head: { ref: "codex/development-memory-v1" }, base: { ref: TRUNK } },
  { number: 1, title: "Closed long ago", state: "closed", draft: false, merged_at: null, updated_at: "2026-09-01T00:00:00Z", html_url: "https://github.com/o/r/pull/1", head: { ref: "codex/stale" }, base: { ref: TRUNK } },
];

const commits = [
  { sha: "c".repeat(40), html_url: "https://github.com/o/r/commit/ccc", commit: { message: "Put /start on the brand\n\nCo-Authored-By: …", committer: { date: "2026-10-05T05:27:08Z" } } },
];

it("reads a GitHub repository link, with an optional trunk, and nothing else", () => {
  assert.deepEqual(parseRepoUrl("https://github.com/andrewzingg23-del/Solve-Official-"), { owner: "andrewzingg23-del", repo: "Solve-Official-", trunk: null });
  assert.deepEqual(parseRepoUrl(`https://github.com/andrewzingg23-del/Solve-Official-/tree/${TRUNK}`), { owner: "andrewzingg23-del", repo: "Solve-Official-", trunk: TRUNK });
  assert.deepEqual(parseRepoUrl("https://github.com/o/r.git"), { owner: "o", repo: "r", trunk: null });
  for (const bad of ["http://github.com/o/r", "https://gitlab.com/o/r", "https://github.com/o", "https://github.com/o/r/pull/1", "not a url", "https://github.com/o/r/tree/a b"]) {
    assert.equal(parseRepoUrl(bad), null, bad);
  }
});

it("uses the token only where the deployment pairs the repository: a World, or a person", () => {
  const rooms = roomRepos(`${WORLD}=andrewzingg23-del/Solve-Official-@${TRUNK}; Founder@Example.com=andrewzingg23-del/Solve-Official-@${TRUNK}; nonsense; ${"f".repeat(36)}=x`);
  assert.equal(rooms.size, 2);
  const solve = { owner: "andrewzingg23-del", repo: "Solve-Official-", trunk: TRUNK };
  assert.deepEqual(repoForWorld({ worldId: WORLD.toUpperCase(), links: [], rooms }), { ref: solve, paired: true });
  const other = "11111111-2222-4333-8444-555555555555";
  const link = "https://github.com/andrewzingg23-del/solve-official-";
  // The paired person sees it in any World of theirs that links the same repository.
  assert.deepEqual(repoForWorld({ worldId: other, viewerEmail: "founder@example.com", links: [link], rooms }), { ref: { owner: "andrewzingg23-del", repo: "solve-official-", trunk: TRUNK }, paired: true });
  // Anyone else linking it reads it without the token, so a private repo stays private.
  assert.deepEqual(repoForWorld({ worldId: other, viewerEmail: "someone@example.com", links: ["https://example.com", link], rooms }), { ref: { owner: "andrewzingg23-del", repo: "solve-official-", trunk: null }, paired: false });
  // The paired person's token is never used for a different repository.
  assert.equal(repoForWorld({ worldId: other, viewerEmail: "founder@example.com", links: ["https://github.com/someone/else"], rooms })?.paired, false);
  assert.equal(repoForWorld({ worldId: other, links: ["https://example.com"], rooms }), null);
});

it("names the builder from the branch", () => {
  assert.equal(builderOf("claude/keen-cerf-tpd7io"), "Claude");
  assert.equal(builderOf("codex/need-to-route"), "Codex");
  assert.equal(builderOf("manus/start-route-clean"), "Manus");
  assert.equal(builderOf("main"), null);
  assert.equal(builderOf("doris/landing-routes"), "Doris");
  assert.equal(builderOf("chatgpt/higgsfield-staging"), "ChatGPT");
  assert.equal(builderOf("ana/first-try"), "Ana", "a new builder is named by its prefix");
  assert.equal(builderOf("feature/login"), null, "a conventional prefix names no one");
});

it("shapes builds, pull requests and commits, dropping anything that isn't a GitHub link", () => {
  const builds = shapeBuilds(runs);
  assert.deepEqual(builds.map((b) => [b.number, b.state]), [[138, "running"], [137, "passed"], [135, "failed"], [90, "passed"]]);
  assert.equal(buildState("completed", "cancelled"), "cancelled");
  assert.equal(buildState("completed", "timed_out"), "failed");
  const pulls = shapePulls(prs);
  assert.deepEqual(pulls.map((p) => [p.number, p.state]), [[9, "open"], [8, "merged"], [2, "draft"], [1, "closed"]]);
  assert.deepEqual(shapeCommits(commits).map((c) => c.message), ["Put /start on the brand"]);
  assert.deepEqual(shapeBuilds({}), []);
  assert.deepEqual(shapePulls(null), []);
});

it("shows the branches with something happening, each with its builder, latest build and pull requests", () => {
  const lanes = lanesFrom(shapePulls(prs), shapeBuilds(runs), TRUNK, NOW);
  assert.deepEqual(lanes.map((l) => l.branch), ["manus/start-route-clean", "codex/development-memory-v1"]);
  const [manus, codex] = lanes;
  assert.equal(manus.builder, "Manus");
  assert.deepEqual(manus.pulls.map((p) => p.number), [9, 8]);
  assert.equal(manus.build?.state, "failed");
  // An open draft stays visible however old; a stale closed one and an old build don't.
  assert.equal(codex.builder, "Codex");
  assert.equal(codex.build, null);
});

it("reads the repository into a room, and says why when it can't", async () => {
  const seen: string[] = [];
  const fake = async (url: string, init: RequestInit) => {
    seen.push(`${url} ${(init.headers as Record<string, string>).authorization ?? "no token"}`);
    const body = url.endsWith("/repos/o/r") ? { default_branch: "main" } : url.includes("/actions/runs") ? runs : url.includes("/pulls") ? prs : commits;
    return new Response(JSON.stringify(body), { status: 200 });
  };
  const read = await readRepo({ owner: "o", repo: "r", trunk: TRUNK }, { token: "t", fetch: fake, now: NOW });
  assert.ok(read.ok);
  assert.equal(read.view.trunk, TRUNK);
  assert.deepEqual(read.view.trunkBuilds.map((b) => b.number), [138, 137]);
  assert.equal(read.view.lanes.length, 2);
  assert.equal(read.view.readAt, NOW.toISOString());
  assert.ok(seen.every((s) => s.endsWith("Bearer t")));
  assert.ok(seen.some((s) => s.includes(`/commits?sha=${encodeURIComponent(TRUNK)}`)));

  const status = (code: number) => async () => new Response("{}", { status: code });
  assert.deepEqual(await readRepo({ owner: "o", repo: "r", trunk: null }, { fetch: status(404) }), { ok: false, reason: "not_connected", ref: { owner: "o", repo: "r", trunk: null } });
  assert.equal((await readRepo({ owner: "o", repo: "r", trunk: null }, { token: "t", fetch: status(404) })).ok, false);
  const limited = await readRepo({ owner: "o", repo: "r", trunk: null }, { fetch: status(403) });
  assert.equal(!limited.ok && limited.reason, "rate_limited");
  const down = await readRepo({ owner: "o", repo: "r", trunk: null }, { fetch: async () => { throw new Error("offline"); } });
  assert.equal(!down.ok && down.reason, "unavailable");
});

it("credits each builder with its part: open pull requests, merges, trunk commits and latest build", async () => {
  const { builderOfCommit, buildersFrom } = await import("../../lib/github/repo");
  assert.equal(builderOfCommit("Merge pull request #8 from andrewzingg23-del/manus/start-route-clean\n\nAdd the real app start route"), "Manus");
  assert.equal(builderOfCommit("Link a wallet\n\nCo-Authored-By: Claude Opus <noreply@anthropic.com>"), "Claude");
  assert.equal(builderOfCommit("A change by hand"), null);
  const trunkCommits = shapeCommits([
    ...commits,
    { sha: "d".repeat(40), html_url: "https://github.com/o/r/commit/ddd", commit: { message: "Merge pull request #8 from o/manus/start-route-clean", committer: { date: "2026-10-05T05:11:01Z" } } },
    { sha: "a".repeat(40), html_url: "https://github.com/o/r/commit/aaa", commit: { message: "Founder Room\n\nCo-Authored-By: Claude <noreply@anthropic.com>", committer: { date: "2026-10-05T05:57:00Z" } } },
  ]);
  const builders = buildersFrom(lanesFrom(shapePulls(prs), shapeBuilds(runs), TRUNK, NOW), trunkCommits);
  assert.deepEqual(builders.map((b) => [b.builder, b.open.map((p) => p.number), b.merged, b.commits]), [
    ["Claude", [], 0, 1],
    ["Manus", [9], 1, 0],
    ["Codex", [2], 0, 0],
  ]);
});

it("gives one person's room on one repository the same World id every time, a valid one", async () => {
  const { repoRoomId, repoRoomTitle } = await import("../../lib/github/room-id");
  const ref = { owner: "andrewzingg23-del", repo: "Solve-Official-", trunk: TRUNK };
  const id = repoRoomId("actor-1", ref);
  assert.match(id, /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.equal(repoRoomId("actor-1", { ...ref, owner: "AndrewZingg23-del", trunk: null }), id, "case and trunk don't change the room");
  assert.notEqual(repoRoomId("actor-2", ref), id, "each person has their own room");
  assert.equal(repoRoomTitle(ref), "Build solve");
  assert.equal(repoRoomTitle({ owner: "o", repo: "bakery", trunk: null }), "Build bakery");
});
