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

it("draws the machine view from real records only", async () => {
  const { machineData, EMPTY_MACHINE } = await import("../../lib/bot/machine");
  const { reachNodes, MachineReadouts } = await import("../../app/bot/machine-view");
  const now = new Date("2026-10-14T12:00:00Z");
  const mem = (at: string) => ({ id: at, text: "x", source: { kind: "note" as const, title: null, url: null }, via: { client_id: null, client_name: null }, by: "a", at, sealed: true });
  const world = (title: string, access: "add" | "read" | "none") => ({ worldId: title, scope: `world:${title}`, entityId: title, title, summary: "", updatedAt: "", access, url: "" });
  const m = machineData({
    connections: [{ clientId: "c", clientName: "Claude", mode: "remember", since: "" }],
    worlds: [world("Kitchen", "add"), world("Band", "read"), world("Old", "none")],
    memories: [mem("2026-10-14T08:00:00Z"), mem("2026-10-14T09:00:00Z"), mem("2026-10-13T09:00:00Z"), mem("2026-09-01T09:00:00Z")],
    versions: 3,
    now,
  });
  assert.deepEqual(m.worlds, [{ title: "Kitchen", access: "add" }, { title: "Band", access: "read" }], "Worlds it was not let into are not drawn");
  assert.deepEqual([m.memories, m.records, m.activity.at(-1), m.activity.at(-2), m.activity.reduce((a, b) => a + b, 0)], [4, 7, 2, 1, 3], "activity counts only the last 14 days, by day");

  const nodes = reachNodes({ ...EMPTY_MACHINE, assistants: Array.from({ length: 6 }, (_, i) => ({ name: `A${i}`, mode: "read" as const })), worlds: Array.from({ length: 7 }, (_, i) => ({ title: `World number ${i} with a long name`, access: "add" as const })) });
  assert.deepEqual(nodes.map((n) => n.label).slice(0, 1), ["You"]);
  assert.ok(nodes.some((n) => n.label === "+2") && nodes.some((n) => n.label === "Memory"), "long lists collapse into a count");
  assert.ok(nodes.every((n) => n.label.length <= 14), "labels are kept short");

  const empty = renderToStaticMarkup(createElement(MachineReadouts, { machine: EMPTY_MACHINE }));
  assert.match(empty, /No assistant connected/);
  assert.match(empty, /0 add · 0 read/);
  const full = renderToStaticMarkup(createElement(MachineReadouts, { machine: m }));
  assert.match(full, /Claude/);
  assert.match(full, /1 add · 1 read/);
  assert.match(full, />7</);

  const stage = renderToStaticMarkup(createElement(AgentStage, { persona: DEFAULT_PERSONA, state: "idle", machine: m }));
  assert.match(stage, /aria-label="Stage view"/);
  assert.match(stage, />machine</);
});
