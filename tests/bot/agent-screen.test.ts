// The agent screen: older saved bots keep working with the new look options, every combination of
// body, finish and state renders, the HUD stage names the state, and the agent contract says only
// what the bot's connections and grants really allow.
import assert from "node:assert/strict";
import { it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BODIES, DEFAULT_PERSONA, MATERIALS, validatePersona, type Persona } from "../../lib/bot/persona";
import { BotCharacter, STATE_LABELS, type BotState } from "../../app/bot/character";
import { AgentStage } from "../../app/bot/stage";
import { AgentContract } from "../../app/bot/contract";

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

it("labels the stage with the bot's state and build", () => {
  const html = renderToStaticMarkup(createElement(AgentStage, { persona: { ...DEFAULT_PERSONA, material: "chrome" }, state: "waiting" }));
  assert.match(html, /Agent · Nova/);
  assert.match(html, /Waiting for approval/);
  assert.match(html, />chrome</);
});

it("states only what the bot's connections and grants allow", () => {
  const none = renderToStaticMarkup(createElement(AgentContract, { botName: "Nova", connections: [], worlds: [] }));
  assert.match(none, /No assistant connected yet\./);
  assert.match(none, /Nothing can add memories yet except you\./);
  assert.match(none, /Not let into any World yet\./);
  assert.match(none, /no tool to spend, sign, publish or change who has access/);

  const world = (access: "add" | "read", id: string) => ({ worldId: id, scope: `world:${id}`, entityId: id, title: id, summary: "", updatedAt: "2026-10-04T00:00:00Z", access, url: `/world/${id}` });
  const some = renderToStaticMarkup(
    createElement(AgentContract, {
      botName: "Nova",
      connections: [
        { clientId: "a", clientName: "Claude", mode: "remember", since: "2026-10-04T00:00:00Z" },
        { clientId: "b", clientName: "ChatGPT", mode: "read", since: "2026-10-04T00:00:00Z" },
      ],
      worlds: [world("add", "w1"), world("add", "w2"), world("read", "w3")],
    }),
  );
  assert.match(some, /Claude \(read and add\), ChatGPT \(read only\)/);
  assert.match(some, /or Claude give it/);
  assert.match(some, /Adds drafts in 2 Worlds, reads 1\. Each grant lasts 30 days/);
});
