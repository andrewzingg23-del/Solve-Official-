import { listRoomAgents } from "@/lib/world/agent-models";
import type { CapabilityDescriptor, CapabilityStatus } from "./contracts";

type Env = Record<string, string | undefined>;
const descriptor = (entry: Omit<CapabilityDescriptor, "schema" | "version">): CapabilityDescriptor =>
  ({ schema: "solve.capability.v1", version: "1", ...entry });

const configured = (key?: string): CapabilityStatus => key?.trim() ? "configured_unverified" : "needs_connection";

/**
 * Server-owned registry. A key being present is NOT evidence that a provider works.
 * No arbitrary user-supplied endpoint, token or tool manifest is executable.
 */
export function listCapabilities(env: Env = process.env): CapabilityDescriptor[] {
  const native: CapabilityDescriptor[] = [
    descriptor({ id:"solve.world.conversation", label:"World conversation", kind:"communication", provider:"solve",
      sideEffect:"write_world", status:"available", requiresScopes:["world.entity.write"],
      inputSchema:"solve.room-turn.v1", outputSchema:"solve.room-message.v1" }),
    descriptor({ id:"solve.world.document", label:"World documents", kind:"workspace", provider:"solve",
      sideEffect:"write_world", status:"available", requiresScopes:["world.entity.write"],
      inputSchema:"solve.document.v1", outputSchema:"solve.document.v1" }),
    descriptor({ id:"solve.world.task", label:"World task planning", kind:"workspace", provider:"solve",
      sideEffect:"write_world", status:"available", requiresScopes:["world.entity.write"],
      inputSchema:"solve.task.v1", outputSchema:"solve.task.v1",
      note:"Planning and recording only; no coding worker is dispatched automatically." }),
    descriptor({ id:"solve.passport", label:"SOV Passport", kind:"memory", provider:"sov-passport",
      sideEffect:"read_only", status:"needs_connection", requiresScopes:["passport"],
      inputSchema:"solve.context.v1", outputSchema:"solve.context.v1",
      note:"A connection requires per-user OAuth authorization; a global API key is not sufficient." }),
    descriptor({ id:"github.repository.read", label:"GitHub repository information", kind:"tool", provider:"github",
      sideEffect:"read_only", status:configured(env.GITHUB_TOKEN), requiresScopes:["world:repo:read"],
      inputSchema:"github.repo-ref.v1", outputSchema:"github.repo-read.v1",
      note:"Public repositories may be readable without a token. Private repositories need owner-approved access." }),
    descriptor({ id:"github.coding.worker", label:"GitHub coding worker", kind:"execution", provider:"github",
      sideEffect:"execute_code", status:"disabled", requiresScopes:["world:code:execute"],
      inputSchema:"solve.task.v1", outputSchema:"solve.evidence.v1",
      note:"No real worker or scoped dispatch authorization is connected yet." }),
    descriptor({ id:"perplexity.research", label:"Perplexity research", kind:"research", provider:"perplexity",
      sideEffect:"read_only", status:configured(env.PERPLEXITY_API_KEY), requiresScopes:["world:research:read"],
      inputSchema:"solve.research.v1", outputSchema:"solve.evidence.v1",
      note:"Requires an API integration; a personal Perplexity subscription is not an API grant." }),
  ];
  const inference = listRoomAgents(env).map(a => descriptor({
    id: "model." + a.id, label: a.label, kind:"inference" as const, provider:a.provider,
    sideEffect:"read_only" as const, status:configured(a.configured ? "configured" : undefined),
    requiresScopes:["world:context:read"], inputSchema:"solve.room-context.v1", outputSchema:"solve.model-reply.v1",
    note: a.configured ? "Server key present; live call and quota not yet verified." : "Connect the provider in deployment settings.",
  }));
  return [...native, ...inference];
}

export function capabilityById(id: string, env: Env = process.env): CapabilityDescriptor | null {
  return listCapabilities(env).find(item => item.id === id) ?? null;
}
