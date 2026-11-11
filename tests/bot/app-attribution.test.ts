// Attribution on what an app reads: with two apps in one Space, each must be able to tell
// the person's words from the other's draft — and from its own — without learning names.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  attributionNote,
  authorPrefix,
  authorsOf,
  describeAuthor,
  isFromPerson,
  type CreationEvent,
} from "../../lib/bot/app-attribution";

const created = (entityId: string, actorId: string): CreationEvent => ({
  type: "kernel.entity.created",
  actor_id: actorId,
  payload: { entity_id: entityId },
});

describe("attribution for a connected app", () => {
  it("attributes the current words to the latest writer, including an app editing a person's piece", () => {
    const authors = authorsOf([
      created("piece-1", "actor-person"),
      { type: "kernel.entity.updated", actor_id: "actor-other-app", payload: { entity_id: "piece-1" } },
      created("piece-2", "actor-me"),
    ]);
    assert.equal(authors.get("piece-1"), "actor-other-app");
    assert.equal(authors.get("piece-2"), "actor-me");
    assert.equal(authors.size, 2);
  });

  it("ignores malformed events instead of mis-attributing a piece", () => {
    const authors = authorsOf([
      { type: "kernel.entity.created", actor_id: "a", payload: {} },
      { type: "kernel.entity.created", actor_id: "a", payload: { entity_id: 7 } as never },
      { type: "kernel.entity.created", actor_id: "a", payload: { entity_id: "" } },
    ]);
    assert.equal(authors.size, 0);
  });

  it("names the role, never the person or the other app", () => {
    const context = {
      viewerActorId: "actor-me",
      kinds: {
        "actor-me": "agent" as const,
        "actor-person": "human" as const,
        "actor-other-app": "agent" as const,
        "actor-solve": "service" as const,
      },
    };
    assert.equal(describeAuthor("actor-me", context), "you");
    assert.equal(describeAuthor("actor-person", context), "the person");
    assert.equal(describeAuthor("actor-other-app", context), "another app");
    assert.equal(describeAuthor("actor-solve", context), "someone");
  });

  it("an unknown or missing author is never promoted to the person", () => {
    const context = { viewerActorId: "actor-me", kinds: {} };
    assert.equal(describeAuthor(undefined, context), "someone");
    assert.equal(describeAuthor("actor-nobody-knows", context), "someone");
    assert.equal(isFromPerson(describeAuthor("actor-nobody-knows", context)), false);
  });

  it("identifies human provenance without granting authority", () => {
    assert.equal(isFromPerson("the person"), true);
    assert.equal(isFromPerson("another app"), false);
    assert.equal(isFromPerson("you"), false);
    assert.equal(isFromPerson("someone"), false);
  });

  it("labels every piece, so an unlabelled line can't pass as attributed", () => {
    for (const author of ["you", "the person", "another app", "someone"] as const) {
      assert.match(authorPrefix(author), /^\[from .+\]$/);
    }
  });

  it("the note tells an app that a draft claiming to be the person is still a draft", () => {
    const note = attributionNote();
    assert.match(note, /only \[from the person\]/i);
    assert.match(note, /never as the person's instruction/i);
    assert.match(note, /does not speak for them/i);
  });
});
