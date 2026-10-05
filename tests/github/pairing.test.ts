// Pairing a repository from inside the repository (solve.rooms.json, readers by email fingerprint),
// and the deployed trunk shown when GitHub can't be read. No network.
import assert from "node:assert/strict";
import { it } from "node:test";
import { deployedView } from "../../lib/github/deployed";
import { repoForViewer, repoForWorld, roomsFromFile, viewerKey } from "../../lib/github/repo";
import { deploymentRooms } from "../../lib/github/rooms";

const TRUNK = "claude/keen-cerf-tpd7io";

it("pairs a repository with a reader by the fingerprint of their email, never the email itself", () => {
  const key = viewerKey(" Founder@Example.com ");
  assert.match(key, /^sha256:[0-9a-f]{64}$/);
  assert.equal(key, viewerKey("founder@example.com"));
  const rooms = roomsFromFile({ rooms: [
    { repo: "o/r", trunk: TRUNK, readers: [key, "0b6a3f5e-1d2c-4e5f-8a9b-0c1d2e3f4a5b", "someone@example.com", 7] },
    { repo: "not a repo", readers: [key] },
    { repo: "o/r/extra", readers: [key] },
  ] });
  assert.deepEqual([...rooms.keys()], [key, "0b6a3f5e-1d2c-4e5f-8a9b-0c1d2e3f4a5b"], "plain emails and junk are ignored");
  assert.deepEqual(repoForViewer("FOUNDER@example.com", rooms), { owner: "o", repo: "r", trunk: TRUNK });
  assert.equal(repoForViewer("someone@example.com", rooms), undefined);
  assert.deepEqual(repoForWorld({ worldId: "11111111-2222-4333-8444-555555555555", viewerEmail: "founder@example.com", links: ["https://github.com/o/r"], rooms }), { ref: { owner: "o", repo: "r", trunk: TRUNK }, paired: true });
  assert.equal(repoForWorld({ worldId: "11111111-2222-4333-8444-555555555555", viewerEmail: "someone@example.com", links: ["https://github.com/o/r"], rooms })?.paired, false);
  assert.equal(roomsFromFile(null).size, 0);
});

it("reads the committed solve.rooms.json, and lets the deployment add pairings", () => {
  const rooms = deploymentRooms("");
  assert.ok([...rooms.values()].some((r) => r.owner === "andrewzingg23-del" && r.repo === "Solve-Official-" && r.trunk === TRUNK));
  assert.ok([...rooms.keys()].every((k) => k.startsWith("sha256:") || /^[0-9a-f-]{36}$/.test(k)), "no email is spelled out in the repository");
  assert.ok(deploymentRooms("ana@example.com=o/r").has("ana@example.com"));
});

it("shows the deployed trunk's history for its own repository, and nothing for any other", () => {
  const log = JSON.stringify([
    { sha: "a".repeat(40), at: "2026-10-05T07:50:00Z", message: "Polish the room\n\nCo-Authored-By: Claude <noreply@anthropic.com>" },
    { sha: "b".repeat(40), at: "2026-10-05T06:55:00Z", message: "Merge pull request #10 from andrewzingg23-del/doris/landing-routes" },
    { sha: "not-a-sha", at: "2026-10-05T06:00:00Z", message: "dropped" },
  ]);
  const env = { repo: "andrewzingg23-del/Solve-Official-", ref: TRUNK, at: "2026-10-05T08:00:00Z", log };
  const view = deployedView({ owner: "andrewzingg23-del", repo: "solve-official-", trunk: TRUNK }, env)!;
  assert.equal(view.source, "deployment");
  assert.equal(view.trunk, TRUNK);
  assert.equal(view.commits.length, 2);
  assert.deepEqual(view.trunkBuilds, [], "builds need GitHub");
  assert.deepEqual(view.builders.map((b) => [b.builder, b.commits, b.merged]), [["Claude", 1, 0], ["Doris", 0, 1]]);
  assert.equal(deployedView({ owner: "someone", repo: "else", trunk: null }, env), null, "never another repository");
  assert.equal(deployedView({ owner: "andrewzingg23-del", repo: "Solve-Official-", trunk: "main" }, env), null, "never another branch");
  assert.equal(deployedView({ owner: "andrewzingg23-del", repo: "Solve-Official-", trunk: null }, { ...env, repo: "" }), null, "not deployed from git");
});
