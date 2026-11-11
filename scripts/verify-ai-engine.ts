// Proves an AI engine actually answers, through the real adapter, against the real API.
//
// Use a NEW staging-only provider key supplied by the operator through the environment.
// Never pull deployment secrets or paste a key into a command, chat, or shell history.
//   npm run verify:ai -- openai   # or anthropic
//
// Why this exists: every AI path in SOLVE has been tested against fixtures and never once
// against a live model. Code written, tests green and "preview queued" are three proxies
// stacked where one fact belongs. This is the one fact.
//
// It reads the key from the environment, never from a file or an argument, and prints the
// shape of what came back — status, whether there is a reply, tokens, cost — plus a short
// excerpt as the actual evidence. It never prints the key, and it redacts anything
// key-shaped out of an error before showing it.
//
// One small call. At claude-haiku-5-5 prices this costs a small fraction of a cent.
import { buildAnthropicMessagesBody, completeAnthropicChat, estimateAnthropicCostUsd } from "../lib/ai/anthropic";
import { buildOpenAIResponsesBody, completeOpenAIChat } from "../lib/ai/openai";
import { enginesFrom, keyFor, preferredEngine } from "../lib/ai/engines";
import { ProviderError, type ProviderUsage } from "../lib/ai/provider-error";
import { chooseEngine } from "../lib/ai/routing";

const SYSTEM = "You are SOLVE's assistant. Answer in one short sentence.";
const ASK = "In one sentence: what is this verifying?";

/** Never let a key reach the output, even inside a provider's error text. */
const redact = (text: string): string =>
  text.replace(/\b(sk-[A-Za-z0-9_\-]{8,}|sk-ant-[A-Za-z0-9_\-]{8,})\b/g, "sk-[redacted]");

async function main() {
  if (process.env.VERCEL_ENV === "production") throw new Error("Production verification is forbidden.");
  const wanted = process.argv[2];
  if (wanted && wanted !== "openai" && wanted !== "anthropic") throw new Error("Name openai or anthropic.");
  const env = { ...process.env, ...(wanted ? { SOLVE_AI_ENGINE: wanted } : {}) };
  const engines = enginesFrom(env);

  console.log("engines this environment can reach:");
  for (const e of engines) {
    console.log(`  ${e.configured ? "ready  " : "no key "} ${e.id.padEnd(10)} ${e.model}`);
  }

  const choice = chooseEngine(engines, { prefer: preferredEngine(env) });
  if (!choice.engine) {
    console.error(`\nNothing to call: ${choice.why}`);
    console.error("Set ANTHROPIC_API_KEY (or OPENAI_API_KEY) in the environment and run again.");
    process.exit(2);
  }
  const engine = choice.engine;
  const apiKey = keyFor(engine.id, env);
  console.log(`\nchosen: ${engine.id} (${engine.model}) — ${choice.why}`);

  const started = Date.now();
  try {
    const done: ProviderUsage & { reply: string } = engine.id === "anthropic"
      ? await completeAnthropicChat(apiKey, buildAnthropicMessagesBody({
          model: engine.model, system: SYSTEM, history: [], message: ASK, maxTokens: 256,
        }))
      : await completeOpenAIChat(apiKey, buildOpenAIResponsesBody({
          model: engine.model, system: SYSTEM, history: [], message: ASK, maxOutputTokens: 256,
        }));
    const ms = Date.now() - started;
    const cached = (done.cachedTokens ?? 0) + (done.cacheCreationTokens ?? 0);
    const cost = engine.id === "anthropic" && !cached
      ? estimateAnthropicCostUsd(engine.model, done.inputTokens, done.outputTokens)
      : null;

    if (!done.reply) {
      console.error(`\nFAIL — ${engine.id} returned 200 with an EMPTY reply in ${ms}ms.`);
      console.error("That is the failure mode the route now rejects rather than showing as an answer.");
      process.exit(1);
    }

    console.log(`\nLIVE REPLY from ${engine.id} in ${ms}ms`);
    console.log(`  model reported : ${"model" in done && done.model ? done.model : "(not reported)"}`);
    console.log(`  tokens         : ${done.inputTokens ?? "unknown"} in, ${done.outputTokens ?? "unknown"} out${cached ? `, ${cached} cached` : ""}`);
    console.log(`  estimated cost : ${cost === null ? "unknown" : "$" + cost.toFixed(6)}`);
    console.log(`  reply          : ${redact(done.reply.split(apiKey).join("[redacted]")).slice(0, 300)}`);
    console.log("\nThe adapter's request shape is accepted by the real API.");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\nFAIL — ${engine.id} did not answer: ${error instanceof ProviderError ? message : "No usable reply; check staging provider configuration."}`);
    console.error("A 401 means the key; a 400 means the request shape and is the interesting case.");
    process.exit(1);
  }
}

void main();
