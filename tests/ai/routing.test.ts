// Which engine answers. Five rules in order; the sensitivity rule refuses rather than
// degrades, because disclosure cannot be undone.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { chooseEngine, type Engine } from "../../lib/ai/routing";

const claude: Engine = { id: "anthropic", location: "cloud", model: "claude-opus-5-5", outputPricePerMTok: 20, configured: true };
const haiku: Engine = { id: "anthropic-cheap", location: "cloud", model: "claude-haiku-5-5", outputPricePerMTok: 0.5, configured: true };
const gpt: Engine = { id: "openai", location: "cloud", model: "gpt-6.1-sol", outputPricePerMTok: 10, configured: true };
const local: Engine = { id: "ollama", location: "local", model: "qwen", outputPricePerMTok: 0, configured: true };

describe("engine routing", () => {
  it("1. a local-only turn never reaches a cloud engine — it fails instead", () => {
    const refused = chooseEngine([claude, gpt], { localOnly: true, prefer: "anthropic" });
    assert.equal(refused.engine, null);
    assert.equal(refused.rule, "sensitivity");
    assert.match(refused.why, /Nothing was sent/);
    // With a local engine present, the same turn is served.
    const served = chooseEngine([claude, local], { localOnly: true });
    assert.equal(served.engine?.id, "ollama");
  });

  it("2. otherwise the configured engine wins", () => {
    const choice = chooseEngine([claude, gpt], { prefer: "openai" });
    assert.equal(choice.engine?.id, "openai");
    assert.equal(choice.rule, "preference");
  });

  it("3. two malformed tool calls escalate", () => {
    const one = chooseEngine([haiku, claude], { prefer: "anthropic-cheap", escalateTo: "anthropic", malformedToolCalls: 1 });
    assert.equal(one.engine?.id, "anthropic-cheap", "one failure is not enough");
    const two = chooseEngine([haiku, claude], { prefer: "anthropic-cheap", escalateTo: "anthropic", malformedToolCalls: 2 });
    assert.equal(two.engine?.id, "anthropic", "two failures escalate");
    assert.equal(two.rule, "escalation");
  });

  it("4. an exhausted budget outranks the preference, and pauses when nothing is cheaper", () => {
    const dropped = chooseEngine([claude, haiku], { prefer: "anthropic", overBudget: true });
    assert.equal(dropped.engine?.id, "anthropic-cheap");
    assert.equal(dropped.rule, "budget");
    // Already on the cheapest: pause rather than pretend a switch saved anything.
    const paused = chooseEngine([haiku], { prefer: "anthropic-cheap", overBudget: true });
    assert.equal(paused.engine, null);
    assert.equal(paused.rule, "budget");
    assert.match(paused.why, /Nothing was sent/);
  });

  it("4+1. budget still never breaks the sensitivity rule", () => {
    const refused = chooseEngine([claude, haiku], { localOnly: true, overBudget: true });
    assert.equal(refused.engine, null);
    assert.equal(refused.rule, "sensitivity");
  });

  it("5. a failed engine is skipped, and the fallback is the cheapest left", () => {
    const choice = chooseEngine([claude, gpt, haiku], { prefer: "anthropic", failed: ["anthropic"] });
    assert.equal(choice.engine?.id, "anthropic-cheap", "a fallback is never a surprise bill");
    assert.equal(choice.rule, "availability");
    assert.match(choice.why, /failed/);
  });

  it("an unconfigured engine is never chosen, and no engine at all is said plainly", () => {
    const choice = chooseEngine([{ ...claude, configured: false }, gpt], { prefer: "anthropic" });
    assert.equal(choice.engine?.id, "openai");
    const none = chooseEngine([{ ...claude, configured: false }]);
    assert.equal(none.engine, null);
    assert.match(none.why, /No engine is configured/);
  });

  it("every engine having failed ends the turn with a reason, not a crash", () => {
    const none = chooseEngine([claude, gpt], { failed: ["anthropic", "openai"] });
    assert.equal(none.engine, null);
    assert.equal(none.rule, "availability");
    assert.match(none.why, /already failed/);
  });

  it("is deterministic on a price tie", () => {
    const a: Engine = { ...gpt, id: "b-engine" };
    const b: Engine = { ...gpt, id: "a-engine" };
    assert.equal(chooseEngine([a, b]).engine?.id, "a-engine");
    assert.equal(chooseEngine([b, a]).engine?.id, "a-engine");
  });
});
