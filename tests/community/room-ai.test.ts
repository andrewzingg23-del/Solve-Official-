import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildAskRoomPrompt,
  buildRoomBriefPrompt,
  toBriefNotes,
} from "../../lib/community/room-ai";
import type { Note } from "../../lib/community/community";

const note = (over: Partial<Note> = {}): Note => ({
  id: "n1",
  fromId: "a1",
  from: "Mara",
  via: null,
  text: "Jupiter fees are lower on Sunday nights, measured it twice.",
  at: "2026-10-07T12:00:00.000Z",
  inReplyTo: null,
  ...over,
});

describe("toBriefNotes", () => {
  it("trims long note text", () => {
    const [b] = toBriefNotes([note({ text: "x".repeat(500) })]);
    assert.equal(b.text.length, 300);
    assert.equal(b.from, "Mara");
  });
});

describe("buildRoomBriefPrompt", () => {
  it("grounds on real notes and names people", () => {
    const p = buildRoomBriefPrompt({
      botName: "Vance",
      communityName: "Traders",
      notes: toBriefNotes([note()]),
      memberNames: ["Mara", "Darius"],
      sinceLabel: "in the last day",
    });
    assert.match(p, /Mara/);
    assert.match(p, /Jupiter fees/);
    assert.match(p, /Never invent/);
  });

  it("says nothing when the room is quiet", () => {
    const p = buildRoomBriefPrompt({
      botName: "Vance",
      communityName: "Traders",
      notes: [],
      memberNames: [],
      sinceLabel: "in the last day",
    });
    assert.match(p, /None\./);
    assert.match(p, /quiet/);
  });
});

describe("buildAskRoomPrompt", () => {
  it("attributes claims and carries the question", () => {
    const p = buildAskRoomPrompt({
      communityName: "Traders",
      about: "A room for traders.",
      notes: toBriefNotes([note()]),
      question: "When are Jupiter fees lowest?",
    });
    assert.match(p, /Mara/);
    assert.match(p, /When are Jupiter fees lowest\?/);
    assert.match(p, /Attribute every claim/);
  });

  it("is honest when nothing was discussed", () => {
    const p = buildAskRoomPrompt({
      communityName: "Traders",
      about: "",
      notes: [],
      question: "Anything about HYPE?",
    });
    assert.match(p, /No discussion yet/);
    assert.match(p, /hasn't discussed it/);
  });
});
