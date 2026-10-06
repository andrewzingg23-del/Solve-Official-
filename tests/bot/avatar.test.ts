// Per-user bot avatar: guests get the default face, corrupted metadata falls
// back safely, and names are trimmed to 40 chars.
import assert from "node:assert/strict";
import { it } from "node:test";
import {
  AVATAR_PRESETS,
  DEFAULT_AVATAR,
  faceSrc,
  getBotAvatar,
  isValidFace,
  sanitizeBotName,
} from "../../lib/bot/avatar";

it("has six presets with the blank mannequin as default", () => {
  assert.equal(AVATAR_PRESETS.length, 6);
  assert.equal(DEFAULT_AVATAR.face, "blank");
  assert.equal(DEFAULT_AVATAR.name, "");
  assert.ok(AVATAR_PRESETS.every((p) => p.src.startsWith("/avatars/") && p.src.endsWith(".webp")));
});

it("validates faces against the preset list only", () => {
  assert.equal(isValidFace("host"), true);
  assert.equal(isValidFace("monk"), true);
  assert.equal(isValidFace("evil-twin"), false);
  assert.equal(isValidFace(""), false);
  assert.equal(isValidFace("/avatars/host.webp"), false);
});

it("resolves face ids to art, defaulting to the blank mannequin", () => {
  assert.equal(faceSrc("ember"), "/avatars/ember.webp");
  assert.equal(faceSrc("nope"), "/avatars/blank.webp");
});

it("trims and caps names at 40 chars", () => {
  assert.equal(sanitizeBotName("  Vance  "), "Vance");
  assert.equal(sanitizeBotName("x".repeat(100)).length, 40);
  assert.equal(sanitizeBotName(""), "");
});

it("gives guests the default avatar", () => {
  assert.deepEqual(getBotAvatar(null), { face: "blank", name: "" });
  assert.deepEqual(getBotAvatar({}), { face: "blank", name: "" });
  assert.deepEqual(getBotAvatar({ user_metadata: {} }), { face: "blank", name: "" });
});

it("reads a saved avatar from user_metadata", () => {
  assert.deepEqual(
    getBotAvatar({ user_metadata: { bot_avatar: { face: "ember", name: "Nova" } } }),
    { face: "ember", name: "Nova" },
  );
});

it("falls back safely on corrupted metadata", () => {
  assert.deepEqual(getBotAvatar({ user_metadata: { bot_avatar: "ember" } }), {
    face: "blank",
    name: "",
  });
  assert.deepEqual(getBotAvatar({ user_metadata: { bot_avatar: ["ember"] } }), {
    face: "host",
    name: "",
  });
  assert.deepEqual(
    getBotAvatar({ user_metadata: { bot_avatar: { face: "hacker", name: "x".repeat(99) } } }),
    { face: "host", name: "x".repeat(40) },
  );
  assert.deepEqual(getBotAvatar({ user_metadata: { bot_avatar: { face: 42 } } }), {
    face: "host",
    name: "",
  });
});
