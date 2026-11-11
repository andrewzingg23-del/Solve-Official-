// The engines a deployment can actually reach. An engine exists only if its credential is
// present, so the routing policy never picks something that would 503 a moment later.
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  anyEngineConfigured,
  enginesFrom,
  keyFor,
  preferredEngine,
  UNKNOWN_PRICE,
} from "../../lib/ai/engines";
import { chooseEngine } from "../../lib/ai/routing";
import { ANTHROPIC_DEFAULT_MODEL } from "../../lib/ai/anthropic";
import { OPENAI_DEFAULT_MODEL } from "../../lib/ai/openai";

const byId = (env: Record<string, string | undefined>) =>
  Object.fromEntries(enginesFrom(env).map(e => [e.id, e]));

describe("the engine table", () => {
  it("an engine is configured only when its key is present and not blank", () => {
    const none = byId({});
    assert.equal(none.anthropic.configured, false);
    assert.equal(none.openai.configured, false);
    assert.equal(anyEngineConfigured({}), false);

    const blank = byId({ ANTHROPIC_API_KEY: "   " });
    assert.equal(blank.anthropic.configured, false, "whitespace is not a key");

    const set = byId({ ANTHROPIC_API_KEY: "sk-a" });
    assert.equal(set.anthropic.configured, true);
    assert.equal(anyEngineConfigured({ ANTHROPIC_API_KEY: "sk-a" }), true);
  });

  it("uses the configured model, or the adapter's default", () => {
    assert.equal(byId({}).anthropic.model, ANTHROPIC_DEFAULT_MODEL);
    assert.equal(byId({}).openai.model, OPENAI_DEFAULT_MODEL);
    assert.equal(byId({ ANTHROPIC_MODEL: "claude-haiku-5-5" }).anthropic.model, "claude-haiku-5-5");
    assert.equal(byId({ OPENAI_MODEL: "gpt-x" }).openai.model, "gpt-x");
  });

  it("prices a known model and refuses to invent a price for an unknown one", () => {
    assert.equal(byId({ ANTHROPIC_MODEL: "claude-haiku-5-5" }).anthropic.outputPricePerMTok, 0.5);
    assert.equal(byId({ ANTHROPIC_MODEL: "claude-opus-5-5" }).anthropic.outputPricePerMTok, 20);
    assert.equal(byId({ ANTHROPIC_MODEL: "something-new" }).anthropic.outputPricePerMTok, UNKNOWN_PRICE);
    // This repo has no published price for the OpenAI model: unknown, never zero.
    assert.equal(byId({}).openai.outputPricePerMTok, UNKNOWN_PRICE);
  });

  it("an unknown price is never chosen as a cost saving, but can still answer", () => {
    const env = { ANTHROPIC_API_KEY: "sk-a", OPENAI_API_KEY: "sk-o", ANTHROPIC_MODEL: "claude-haiku-5-5" };
    // Over budget: the engine with a known, lower price wins; the unpriced one never
    // pretends to be the cheaper option.
    const saving = chooseEngine(enginesFrom(env), { prefer: "openai", overBudget: true });
    assert.equal(saving.engine?.id, "anthropic");
    // But preference still reaches it when budget is not the question.
    const preferred = chooseEngine(enginesFrom(env), { prefer: "openai" });
    assert.equal(preferred.engine?.id, "openai");
  });

  it("honours a named preference and ignores a bogus one", () => {
    assert.equal(preferredEngine({ SOLVE_AI_ENGINE: "anthropic" }), "anthropic");
    assert.equal(preferredEngine({ SOLVE_AI_ENGINE: "openai" }), "openai");
    assert.equal(preferredEngine({ SOLVE_AI_ENGINE: "something-else" }), undefined);
    assert.equal(preferredEngine({}), undefined);
  });

  it("hands back the right key, and nothing for an unknown engine", () => {
    const env = { ANTHROPIC_API_KEY: "sk-a", OPENAI_API_KEY: "sk-o" };
    assert.equal(keyFor("anthropic", env), "sk-a");
    assert.equal(keyFor("openai", env), "sk-o");
    assert.equal(keyFor("mystery", env), "");
  });

  it("with only one key set, that engine answers — whichever it is", () => {
    const claudeOnly = chooseEngine(enginesFrom({ ANTHROPIC_API_KEY: "sk-a" }));
    assert.equal(claudeOnly.engine?.id, "anthropic");
    const gptOnly = chooseEngine(enginesFrom({ OPENAI_API_KEY: "sk-o" }));
    assert.equal(gptOnly.engine?.id, "openai");
    // With neither, the turn ends with a reason rather than a crash.
    const neither = chooseEngine(enginesFrom({}));
    assert.equal(neither.engine, null);
    assert.match(neither.why, /No engine is configured/);
  });
});
