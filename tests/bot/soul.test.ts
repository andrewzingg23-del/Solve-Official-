// soul.md: sanitize, vibes, step validation.
import assert from "node:assert/strict";
import { it } from "node:test";
import {
  SOUL_VIBES,
  MAX_SOUL_LENGTH,
  sanitizeSoul,
  isValidVibe,
  getBotSoul,
  ONBOARDING_STEPS,
  isValidStep,
} from "@/lib/bot/soul";

it("trims and caps the soul text", () => {
  assert.equal(sanitizeSoul("  talk straight  "), "talk straight");
  assert.equal(sanitizeSoul("x".repeat(5000)).length, MAX_SOUL_LENGTH);
  assert.equal(sanitizeSoul(""), "");
});

it("validates vibe presets", () => {
  for (const v of SOUL_VIBES) assert.equal(isValidVibe(v), true);
  assert.equal(isValidVibe("mysterious"), false);
  assert.equal(isValidVibe(""), false);
});

it("reads the soul from user_metadata with safe fallbacks", () => {
  assert.equal(getBotSoul(null), "");
  assert.equal(getBotSoul({}), "");
  assert.equal(getBotSoul({ user_metadata: {} }), "");
  assert.equal(getBotSoul({ user_metadata: { bot_soul: "be blunt" } }), "be blunt");
  assert.equal(getBotSoul({ user_metadata: { bot_soul: 42 } }), "");
});

it("defines the onboarding step order", () => {
  assert.deepEqual([...ONBOARDING_STEPS], ["profile", "sovid", "avatar", "soul", "location", "knowyou"]);
  assert.equal(isValidStep("sovid"), true);
  assert.equal(isValidStep("nope"), false);
});
