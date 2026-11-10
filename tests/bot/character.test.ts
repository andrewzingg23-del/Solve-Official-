// The bot character on the connector consent screen, and the persona options it draws from.
import assert from "node:assert/strict";
import { it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BODIES, DEFAULT_PERSONA, MATERIALS, validatePersona, type Persona } from "../../lib/bot/persona";
import { BotCharacter, STATE_LABELS, type BotState } from "../../app/bot/character";

it("keeps older saved bots working and cleans the new look options", () => {
  const { material, brows, marks, motion, ...older } = DEFAULT_PERSONA;
  void material; void brows; void marks; void motion;
  const restored = validatePersona({ ...older, name: "Juno", body: "orb" });
  assert.deepEqual([restored.material, restored.brows, restored.marks, restored.motion], ["glass", "none", "none", { energy: 50, idle: "bob" }], "missing fields take the defaults");
  const p = validatePersona({ material: "gold", brows: "sharp", marks: "tattoo", motion: { energy: 340, idle: "teleport" } });
  assert.deepEqual([p.material, p.brows, p.marks, p.motion], ["glass", "sharp", "none", { energy: 100, idle: "bob" }], "unknown values fall back; energy is clamped");
  assert.equal(validatePersona({ motion: { energy: "12", idle: "drift" } }).motion.idle, "drift");
});

it("draws every body in every finish and every state", () => {
  const states = Object.keys(STATE_LABELS) as BotState[];
  for (const body of BODIES) {
    for (const material of MATERIALS) {
      for (const state of states) {
        const persona: Persona = { ...DEFAULT_PERSONA, body, material, brows: "raised", marks: "circuit", motion: { energy: 80, idle: "float" } };
        const svg = renderToStaticMarkup(createElement(BotCharacter, { persona, state, size: 120 }));
        assert.match(svg, new RegExp(`aria-label="Nova, ${STATE_LABELS[state].toLowerCase()}"`));
        assert.match(svg, /--k:0\.80/, "energy sets the motion speed");
        if (body !== "pixel" && material === "hologram") assert.match(svg, /<pattern/, "holograms get scanlines");
        if (state === "unavailable") assert.doesNotMatch(svg, /sovbot-spin"/, "an unavailable bot shows no aura motion");
      }
    }
  }
});
