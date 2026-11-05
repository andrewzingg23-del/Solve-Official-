import assert from "node:assert/strict";
import { it } from "node:test";
import {
  asksDevelopmentStatus,
  developmentRoomReply,
  developmentStatus,
  provenanceLine,
  whatIsWorkingOn,
} from "../../lib/github/status";
import type { RepoView } from "../../lib/github/repo";

const NOW = Date.parse("2026-10-31T12:00:00Z");

function view(partial: Partial<RepoView> = {}): RepoView {
  return {
    ref: { owner: "andrewzingg23-del", repo: "Solve-Official-", trunk: "main" },
    url: "https://github.com/andrewzingg23-del/Solve-Official-",
    trunk: "main",
    readAt: "2026-10-31T11:59:00Z",
    trunkBuilds: [{ id: 1, number: 1, branch: "main", sha: "abc", title: "merge", event: "push", state: "passed", url: "u", at: "2026-10-31T11:55:00Z" }],
    commits: [],
    lanes: [],
    builders: [
      {
        builder: "Claude",
        open: [{ number: 25, title: "wire passport into the prompt budget", branch: "claude/x", base: "main", state: "open", url: "u", at: "2026-10-31T11:50:00Z" }],
        merged: 6,
        commits: 3,
        build: { id: 2, number: 2, branch: "claude/x", sha: "d", title: "t", event: "pull_request", state: "passed", url: "u", at: "2026-10-31T11:50:00Z" },
        at: "2026-10-31T11:50:00Z",
      },
    ],
    source: "github",
    ...partial,
  };
}

it("answers what a builder is working on, with source and read time", () => {
  const out = whatIsWorkingOn(view(), "Claude", NOW);
  assert.match(out, /andrewzingg23-del\/Solve-Official-/);
  assert.match(out, /GitHub\/CI evidence \(not live terminal activity\)/);
  assert.match(out, /#25 wire passport into the prompt budget \(open\)/);
  assert.match(out, /latest CI passed/);
  assert.match(out, /6 merged/);
});

it("is honest when the builder has no GitHub activity", () => {
  const out = whatIsWorkingOn(view(), "Codex", NOW);
  assert.match(out, /No GitHub activity from Codex/);
  assert.match(out, /Observed builders: Claude/);
});

it("will not fake PR/CI detail when only the deployed commit log is available", () => {
  const out = whatIsWorkingOn(view({ source: "deployment", builders: [] }), "Claude", NOW);
  assert.match(out, /deployed build's own commit log/);
  assert.match(out, /can't say what Claude specifically has open/);
});

it("summarizes the whole development status including trunk CI", () => {
  const out = developmentStatus(view(), NOW);
  assert.match(out, /• Claude: 1 open PR/);
  assert.match(out, /Trunk \(main\): latest CI passed/);
});

it("developmentRoomReply answers dev questions and defers everything else", () => {
  const v = view();
  assert.match(developmentRoomReply("What is Claude working on?", v)!, /#25 wire passport/);
  assert.match(developmentRoomReply("what's the dev status", v)!, /• Claude:/);
  assert.equal(developmentRoomReply("write a poem", v), null, "not a dev question → defer");
  assert.match(developmentRoomReply("What is Claude working on?", null)!, /Development status unavailable/, "missing evidence must never defer to a model");
});

it("reports the actual observation age and absolute timestamp, not an always-fresh self comparison", () => {
  const out = provenanceLine(view(), NOW + 60 * 60 * 1000);
  assert.match(out, /2026-10-31T11:59:00/);
  assert.match(out, /1h ago/);
  assert.doesNotMatch(out, /just now/);
});

it("separates repository observations from unavailable runner telemetry", () => {
  const out = developmentRoomReply("Is Codex running?", view(), NOW);
  assert.match(out!, /Runner status: unavailable/);
  assert.match(developmentStatus(view(), NOW), /Runner status: unavailable/);
  assert.doesNotMatch(whatIsWorkingOn(view(), "Claude", NOW), /last active/);
});

it("recognizes development-status questions and extracts the builder", () => {
  assert.deepEqual(asksDevelopmentStatus("What is Claude working on?"), { match: true, builder: "claude" });
  assert.equal(asksDevelopmentStatus("what's the dev status").match, true);
  assert.equal(asksDevelopmentStatus("show me open PRs").match, true);
  assert.equal(asksDevelopmentStatus("write me a poem about the ocean").match, false);
  for(const message of ['Is Codex still running?','Is ChatGPT running?','What are the agents doing?','What is the runner doing?','Did the build pass?']){
    assert.equal(asksDevelopmentStatus(message).match,true,message);
    assert.match(developmentRoomReply(message,null)!,/Development status unavailable/);
  }
});
