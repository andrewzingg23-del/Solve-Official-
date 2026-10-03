// The vocabulary of SOLVE's causal loop:
//
//   intent → Horizon → route → authorization → attempt → evidence → reconciliation → consequence
//   → canonical World → new Horizon
//
// Everything here is either canonical (read from the kernel: facts, actions, evidence) or
// interpretation (Horizon, routes, rankings, predictions). Interpretation never becomes canonical
// except through an action whose evidence settles it.
import type { Decision, Evidence } from "../kernel/client";

// How strongly the World knows something, from its provenance.
export type TruthStatus =
  | "asserted" // someone said so (self-reported, or written without independent evidence)
  | "observed" // a system observed it
  | "inferred" // interpretation: predicted by Horizon, never stored as truth
  | "authorized" // an action for it is authorized but not yet enacted
  | "attempted" // an action for it is being enacted; the outcome is not known yet
  | "verified" // independently evidenced (externally verified)
  | "disputed" // challenged by evidence
  | "reconciled"; // an action completed and its evidence settled what happened

export type Provenance = { events: string[]; actions: string[]; evidence: string[]; by: string | null };

export type Fact = {
  subject: string; // canonical ref
  predicate: string;
  object: string | null; // canonical ref, when the fact relates two things
  value?: Record<string, unknown>;
  status: TruthStatus;
  provenance: Provenance;
};

export type Binding = Record<string, string>;

// A pattern over facts. A slot may be a canonical ref or a variable ("?org"); `value` is a subset
// the fact's value must contain (its strings may be variables too); `status` restricts the truth
// statuses that count.
export type Pattern = {
  subject?: string;
  predicate: string;
  object?: string;
  status?: TruthStatus[];
  value?: Record<string, unknown>;
};

// What an actor wants the World to become: facts it desires, in a scope it must be able to see.
export type Goal = {
  kind: string;
  title: string;
  scope: string;
  desired: Pattern[];
  // Variables the goal fixes (the World it concerns, the capability it needs).
  bind: Binding;
  // Kept for supply goals: the World entity and the quantity the terms are for.
  world?: string;
  capability?: string;
  quantity?: number | null;
};

export type Check = { label: string; met: boolean; because: string };

// A declared kernel consequence (see kernel.validate_consequences).
export type Consequence =
  | { op: "relation.create"; kind: string; from_ref: string; to_ref: string; scope: string; attributes?: Record<string, unknown>; result_keys?: string[] }
  | { op: "relation.end"; relation_id: string; reason?: string };

// A condition the kernel re-checks when the action is enacted (see kernel.guard_failure).
export type KernelGuard = { op: "relation.exists" | "relation.absent"; kind: string; from_ref?: string; to_ref?: string; attributes?: Record<string, unknown> };

export type Uncertainty = { level: "low" | "medium" | "high"; because: string };

export type StepAuthority = { actorId: string; decision: Decision; reasons: string[] };

export type RouteStep = {
  transition: string;
  title: string;
  binding: Binding;
  // Who would act, and what the kernel decides for them right now.
  actorId: string;
  authority: StepAuthority;
  capability: string;
  scope: string;
  kind: string;
  targetRef: string | null;
  // The message this step answers, when it is a reply.
  inReplyTo: string | null;
  native: boolean;
  provider: { capability: string; id: string | null };
  preconditions: Check[];
  expectedEvidence: string;
  failures: string[];
  uncertainty: Uncertainty;
  consequences: Consequence[];
  guards: KernelGuard[];
  predicted: Fact[];
  payload: Record<string, unknown>;
  // Money the step moves, in minor units: the kernel's leases and policies decide on it.
  amount: string | null;
  asset: string | null;
};

export type Route = {
  id: string; // SHA-256 of the canonical route: the same World and goal give the same id
  goal: Goal;
  orgRef: string;
  title: string;
  steps: RouteStep[];
  executable: boolean;
  blockedBy: string[];
  needsHuman: boolean;
  score: number;
  policy: string;
};

export type Horizon = {
  actorId: string;
  goal: Goal;
  satisfied: Fact | null;
  routes: Route[];
  excluded: { orgRef: string; title: string; reasons: string[] }[];
  // What could happen next from here, for this actor: the first open step of every route.
  next: RouteStep[];
  policy: string;
};

export type ProviderResponse = {
  provider: string;
  status: "succeeded" | "failed" | "unknown";
  result: Record<string, unknown>;
  evidence: Evidence[];
  detail: string;
};

export type StepOutcome = {
  index: number;
  actionId: string | null;
  status: "completed" | "denied" | "awaiting_authority" | "failed" | "unknown" | "blocked";
  detail: string;
  provider: string | null;
};
