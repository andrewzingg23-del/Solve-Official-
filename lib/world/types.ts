// The World's view model and the one interaction context that World, Horizon and avatar share.
// Everything here is a projection of kernel state; nothing is a second source of truth.
import type { EntityKind, LocationTruth, RelationKind } from "../kernel/client";
import type { ZoomBand } from "./spatial";

export type LensId = "space" | "people" | "power" | "flow" | "cause" | "proof" | "time" | "self";

export const LENSES: { id: LensId; label: string; question: string }[] = [
  { id: "space", label: "Space", question: "Where is this?" },
  { id: "people", label: "People", question: "Who matters?" },
  { id: "power", label: "Power", question: "Who controls this?" },
  { id: "flow", label: "Flow", question: "Where did value move?" },
  { id: "cause", label: "Cause", question: "What is blocking us?" },
  { id: "proof", label: "Proof", question: "Is this true?" },
  { id: "time", label: "Time", question: "What changed?" },
  { id: "self", label: "Self", question: "What does this mean for me?" },
];

// Truth kinds every claim the World shows is labelled with.
export type TruthKind = "fact" | "observation" | "inference" | "estimate" | "recommendation" | "unknown";

// Proof state of a claim, from its evidence: never colour alone in the UI.
export type ProofState = "verified" | "self_reported" | "challenged" | "none";

export type Node = {
  ref: string; // canonical ref: entity:<id>, actor:<id>, payment:<id>, settlement:<id>, task:<id>
  kind: EntityKind | "actor" | "payment" | "settlement" | "task";
  title: string;
  summary: string;
  scope: string;
  attributes: Record<string, unknown>;
  location: { latitude: number; longitude: number; truth: LocationTruth } | null;
  importance: number;
  proof: ProofState;
  claimEventId: string | null;
};

export type Edge = { id: string; kind: RelationKind; from: string; to: string; scope: string; attributes: Record<string, unknown> };

export type PresenceState = "offline" | "human_present" | "avatar_present" | "human_and_avatar";

export type InteractionContext = {
  sessionId: string;
  principalId: string;
  activeAvatarId: string | null;
  currentWorldId: string | null;
  // The World entity the viewer has entered (WORLD band), if any.
  insideWorldRef: string | null;
  zoomBand: ZoomBand;
  currentSelectionIds: string[];
  currentFocusId: string | null;
  comparisonIds: string[];
  currentLens: LensId;
  currentRouteId: string | null;
  currentIntentId: string | null;
  visibleEntityIds: string[];
  pendingProposalIds: string[];
  humanPresence: PresenceState;
  // Recent references from the conversation, newest first (refs only, never memory payloads).
  conversationRefs: string[];
};

export const emptyContext = (principalId: string): InteractionContext => ({
  sessionId: crypto.randomUUID(),
  principalId,
  activeAvatarId: null,
  currentWorldId: null,
  insideWorldRef: null,
  zoomBand: "ORBIT",
  currentSelectionIds: [],
  currentFocusId: null,
  comparisonIds: [],
  currentLens: "space",
  currentRouteId: null,
  currentIntentId: null,
  visibleEntityIds: [],
  pendingProposalIds: [],
  humanPresence: "human_present",
  conversationRefs: [],
});
