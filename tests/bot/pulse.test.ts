// The bot's mood and words follow real records only: an assistant's fresh memory makes it work, a
// fresh change of your own makes it happy, a connected assistant keeps it listening, a quiet week
// puts it to rest, and the relationship numbers are counts.
import assert from "node:assert/strict";
import { it } from "node:test";
import type { Connection, Memory } from "../../lib/bot/memory";
import { DEFAULT_PERSONA } from "../../lib/bot/persona";
import { botPulse } from "../../lib/bot/pulse";

const now = new Date("2026-10-04T12:00:00Z");
const at = (minutesAgo: number) => new Date(now.getTime() - minutesAgo * 60_000).toISOString();
const memory = (minutesAgo: number, client: string | null, text = "something"): Memory => ({
  id: `m-${minutesAgo}-${client}`,
  text,
  source: { kind: client ? "assistant" : "person", title: null, url: null },
  via: { client_id: client ? `id-${client}` : null, client_name: client },
  by: "actor",
  at: at(minutesAgo),
});
const claude: Connection = { clientId: "id-Claude", clientName: "Claude", mode: "remember", since: at(600) };
const persona = { ...DEFAULT_PERSONA, name: "Juno", voice: "On it." };
const base = { persona, since: at(60 * 24 * 9.5), memories: [], connections: [], history: [{ seq: 1, at: at(60 * 24 * 9.5), name: "Juno" }], now };

it("works when an assistant just gave it something, and says who", () => {
  const p = botPulse({ ...base, memories: [memory(1, "Claude")], connections: [claude] });
  assert.equal(p.mood, "working");
  assert.equal(p.line, "Claude just gave me something to remember. Got it.");
  assert.deepEqual(p.latest, { what: "Claude added a memory", at: "1 min ago" });
});

it("is happy right after the person's own change, in its own voice", () => {
  const p = botPulse({ ...base, history: [{ seq: 2, at: at(0.5), name: "Juno" }, ...base.history] });
  assert.equal(p.mood, "happy");
  assert.equal(p.line, "On it.");
});

it("listens while an assistant is connected and recently active, rests after a quiet week", () => {
  const recent = botPulse({ ...base, connections: [{ ...claude, since: at(10) }] });
  assert.equal(recent.mood, "listening");
  assert.equal(recent.line, "Claude can speak as me now. Tell me something worth keeping.");

  const quiet = botPulse({ ...base, memories: [memory(60 * 24 * 5, null)], connections: [{ ...claude, since: at(60 * 24 * 6) }], history: [{ seq: 1, at: at(60 * 24 * 7), name: "Juno" }] });
  assert.equal(quiet.mood, "sleeping");
  assert.equal(quiet.line, "It's been quiet. I'm still holding 1 memory for you.");
});

it("idles between moments, and counts the relationship from records", () => {
  const chatgpt: Connection = { clientId: "id-ChatGPT", clientName: "ChatGPT", mode: "read", since: at(300) };
  const p = botPulse({ ...base, memories: [memory(120, "Claude"), memory(180, null), memory(240, "ChatGPT")], connections: [claude, chatgpt] });
  assert.equal(p.mood, "idle");
  assert.equal(p.line, "I'm keeping 3 memories for you, and Claude and ChatGPT speak as me.");
  assert.deepEqual(p.bond, { days: 10, memories: 3, fromAssistants: 2, assistants: 2, versions: 1 });
  const lonely = botPulse({ ...base, history: [{ seq: 1, at: at(90), name: "Juno" }] });
  assert.equal(lonely.line, "Connect Claude, ChatGPT or Meta AI and I'll be the same me in each of them.");
});
