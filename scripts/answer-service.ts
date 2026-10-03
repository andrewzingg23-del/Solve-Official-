// Runs one organization agent's answer service against a deployed kernel (kernel v4 on the store).
//
//   NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SECRET_KEY=… SOV_AGENT_ID=<agent uuid> SOV_ORG_REF=entity:<uuid> \
//     npx tsx scripts/answer-service.ts
//
// The secret key only lets this process act AS the named agent (kernel_api's p_as_actor): every
// call is still decided by that agent's own grants, and the agent cannot act beyond them. It
// watches the agent's inbox (no push reaches a separate process yet), answers each delivered
// inquiry once, retries failed or unknown passes with backoff, never retries a refusal on a timer,
// and logs one JSON line per pass. SIGINT/SIGTERM finish the pass in flight, then exit.
import { createClient } from "@supabase/supabase-js";
import { AnswerService, watchInbox } from "../lib/agents/answer-service";
import { Providers } from "../lib/causal/providers";
import { kernelClient } from "../lib/kernel/client";

function required(name: string) {
  const value = process.env[name];
  if (!value) {
    console.error(`missing ${name}`);
    process.exit(2);
  }
  return value;
}

const url = required("NEXT_PUBLIC_SUPABASE_URL");
const secret = required("SUPABASE_SECRET_KEY");
const agentId = required("SOV_AGENT_ID");
const orgRef = required("SOV_ORG_REF");
const pollMs = Number(process.env.SOV_POLL_MS ?? 5_000);

const supabase = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const kernelFor = (actorId: string) => kernelClient(supabase, { actAs: actorId });
const kernel = kernelFor(agentId);
const log = (entry: Record<string, unknown>) => console.log(JSON.stringify({ at: new Date().toISOString(), agent: agentId, ...entry }));

async function main() {
  const me = await kernel.whoami();
  if (me.kind !== "agent") {
    console.error(`${agentId} is a ${me.kind}, not an agent`);
    process.exit(2);
  }
  log({ kind: "start", label: me.label, principal: me.owner_id, org: orgRef, pollMs });

  const service = new AnswerService({
    kernel,
    actorId: agentId,
    orgRef,
    kernelFor,
    providers: new Providers([]),
    // needs_review and stalled lines are the operator's queue: reconcile, then restart or release.
    log: (e) => log({ kind: e.kind, detail: e.detail, inquiry: e.inquiry, outcomes: e.report?.outcomes }),
  }).start();
  const watch = watchInbox({ kernel, intervalMs: pollMs, onDelivery: () => service.wake(), onError: (error) => log({ kind: "watch-error", detail: String(error) }) }).start();

  const shutdown = async (signal: string) => {
    log({ kind: "stop", signal });
    watch.stop();
    service.stop();
    await service.idle();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
