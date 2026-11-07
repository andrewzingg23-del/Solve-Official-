import assert from "node:assert/strict";
import { test } from "node:test";
import { formatTeamMessage, parseTeamMessage, teamRecipient } from "../../lib/world/team-messages";

test("addressed messages retain the exact teammate and author-written body", () => {
  for (const target of ["team", "claude", "chatgpt", "muse"] as const) {
    const sent = formatTeamMessage(target, " Review this feature and reply in this World. ");
    const decoded = parseTeamMessage(sent);
    assert.equal(decoded.recipient, target);
    assert.equal(decoded.body, "Review this feature and reply in this World.");
    assert.equal(decoded.addressed, true);
  }
});

test("legacy shared messages remain visible to everyone without a fake addressee", () => {
  assert.deepEqual(parseTeamMessage("A real human decision"), {
    recipient: "team", body: "A real human decision", addressed: false,
  });
  assert.deepEqual(parseTeamMessage("@someone This is not a teammate"), {
    recipient: "team", body: "@someone This is not a teammate", addressed: false,
  });
});

test("addressing is explicit and never inferred from text mentions", () => {
  assert.equal(parseTeamMessage("I asked @claude about the API").addressed, false);
  assert.deepEqual(parseTeamMessage("@CLAUDE\nCheck tests"), {
    recipient: "claude", body: "Check tests", addressed: true,
  });
  assert.equal(teamRecipient("MoDeL"), null);
  assert.equal(teamRecipient("CHATGPT"), "chatgpt");
  assert.throws(() => formatTeamMessage("claude", ""), /valid shared message/);
  assert.throws(() => formatTeamMessage("muse", "\u0001unsafe"), /valid shared message/);
  assert.throws(() => formatTeamMessage("team", "x".repeat(8000)), /too long/);
});

test("the parser never grants a model identity or adds a kernel action", () => {
  const parsed = parseTeamMessage("@claude please implement");
  assert.deepEqual(Object.keys(parsed).sort(), ["addressed", "body", "recipient"]);
  assert.equal(parsed.body, "please implement");
});
