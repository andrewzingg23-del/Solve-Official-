// The spatial view model: what a renderer needs to draw the World and nothing more. Built from the
// authorized World model (engine.load reads only through kernel_api as the viewer), so nothing the
// viewer may not see ever reaches a renderer. Pure: no React, no Cesium, testable in Node.
//
//   DOMAIN STATE → AUTHORIZED QUERY (WorldEngine.load) → SPATIAL VIEW (here) → SCENE CONTROLLER → RENDERER
//
// Identity is canonical: every marker and selectable line carries the ref of the thing it stands
// for. Only things with real geography become markers; digital things (Worlds, Network States,
// people, payments) are listed off Earth rather than given convenient coordinates. Effects come only
// from kernel events, so the World shows consequence, not decoration.
import type { KernelEvent, LocationTruth } from "../kernel/client";
import type { Edge, Node, ProofState } from "./types";

// Semantic zoom. Representation and meaning change with the band; identity never does.
export type ZoomBand = "ORBIT" | "PLANET" | "REGION" | "METRO" | "SITE" | "WORLD" | "ROOM";

// Camera height (metres above the ellipsoid) at which each Earth band begins. WORLD and ROOM are
// entered (SceneController.enterWorld), not zoomed into.
export const EARTH_BANDS: readonly { band: ZoomBand; from: number }[] = [
  { band: "ORBIT", from: 25_000_000 },
  { band: "PLANET", from: 8_000_000 },
  { band: "REGION", from: 1_500_000 },
  { band: "METRO", from: 150_000 },
  { band: "SITE", from: 0 },
];

export function bandForHeight(height: number): ZoomBand {
  return (EARTH_BANDS.find((b) => height >= b.from) ?? EARTH_BANDS[EARTH_BANDS.length - 1]).band;
}

// Highest camera height at which something shown "from" this band is still drawn.
export function bandCeiling(band: ZoomBand): number {
  const i = EARTH_BANDS.findIndex((b) => b.band === band);
  return i <= 0 ? Number.POSITIVE_INFINITY : EARTH_BANDS[i - 1].from;
}

export type Emphasis = "selected" | "lit" | "normal" | "quiet";

export type SpatialMarker = {
  ref: string;
  kind: Node["kind"];
  title: string;
  latitude: number;
  longitude: number;
  truth: LocationTruth;
  proof: ProofState;
  emphasis: Emphasis;
  field: string | null;
  // The coarsest band at which the marker carries a label.
  labelFrom: ZoomBand;
  // Consequence state from kernel records: an agreement made, or contact refused.
  state: "normal" | "committed" | "blocked";
  importance: number;
};

export type SpatialLink = {
  id: string;
  kind: "constellation" | "relation" | "route";
  from: string;
  to: string;
  // The canonical thing the line stands for, when it is selectable (a Network State, a relation).
  ref: string | null;
  style: "quiet" | "lit" | "warning" | "committed";
};

export type SpatialEffect = {
  // The kernel event that caused it: a renderer plays each one once.
  id: string;
  kind: "commitment" | "route_stopped" | "proof_closed" | "route_pulse";
  refs: string[];
  label: string;
};

export type OffEarth = { ref: string; title: string; kind: string; why: string };

export type SpatialView = {
  markers: SpatialMarker[];
  links: SpatialLink[];
  effects: SpatialEffect[];
  offEarth: OffEarth[];
};

export type SpatialModel = { nodes: Map<string, Node>; edges: Edge[]; events: KernelEvent[] };

export type SpatialInput = {
  selected: string[];
  highlights: string[];
  // [origin, ...destinations]: reach from the origin to each destination.
  routes: string[];
  fields: { ref: string; label: string }[];
  // Only events after this sequence number become effects: history is state, not animation.
  effectsAfterSeq: number;
};

type Proposed = { payload?: { type?: string; organization?: string }; capability?: string; decision?: string; reasons?: string[]; action_id?: string };

// The latest contact decision and any acceptance per organization, from the viewer's own records.
function consequences(model: SpatialModel) {
  const blocked = new Map<string, KernelEvent>();
  const accepted = new Map<string, KernelEvent>();
  const acceptanceActions = new Map<string, string>();
  for (const e of [...model.events].sort((a, b) => a.seq - b.seq)) {
    const p = e.payload as Proposed;
    if (e.type === "kernel.action.proposed" && p.payload?.organization) {
      const org = p.payload.organization;
      if (p.payload.type === "ACCEPTANCE") acceptanceActions.set(String(p.action_id), org);
      else if (p.decision === "DENY") blocked.set(org, e);
      else blocked.delete(org);
    }
    if (e.type === "kernel.action.completed") {
      const org = acceptanceActions.get(String((e.payload as { action_id?: string }).action_id));
      if (org) accepted.set(org, e);
    }
  }
  return { blocked, accepted };
}

export function buildSpatialView(model: SpatialModel, input: SpatialInput): SpatialView {
  const selected = new Set(input.selected);
  const lit = new Set([...input.highlights, ...input.routes]);
  const fields = new Map(input.fields.map((f) => [f.ref, f.label]));
  const { blocked, accepted } = consequences(model);
  const agreed = new Set(model.edges.filter((e) => e.kind === "supplies" && e.attributes.status === "agreed").map((e) => e.from));
  const located = (ref: string) => {
    const n = model.nodes.get(ref);
    return n?.location ? n : null;
  };

  const markers: SpatialMarker[] = [];
  for (const n of model.nodes.values()) {
    if (!n.location) continue;
    const emphasis: Emphasis = selected.has(n.ref) ? "selected" : lit.has(n.ref) ? "lit" : lit.size > 0 ? "quiet" : "normal";
    const labelFrom: ZoomBand =
      emphasis === "selected" || emphasis === "lit" || fields.has(n.ref) || agreed.has(n.ref)
        ? "ORBIT"
        : emphasis === "quiet"
          ? "SITE"
          : n.kind === "place"
            ? "REGION"
            : n.importance >= 60
              ? "PLANET"
              : "REGION";
    markers.push({
      ref: n.ref,
      kind: n.kind,
      title: n.title,
      latitude: n.location.latitude,
      longitude: n.location.longitude,
      truth: n.location.truth,
      proof: n.proof,
      emphasis,
      field: fields.get(n.ref) ?? null,
      labelFrom,
      state: agreed.has(n.ref) || accepted.has(n.ref) ? "committed" : blocked.has(n.ref) ? "blocked" : "normal",
      importance: n.importance,
    });
  }

  const links: SpatialLink[] = [];
  // Network States are constellations of member hubs, never borders; the line stands for the State.
  const hubsByState = new Map<string, Node[]>();
  for (const e of model.edges) {
    const hub = e.kind === "member_of" ? located(e.from) : null;
    if (hub) hubsByState.set(e.to, [...(hubsByState.get(e.to) ?? []), hub]);
  }
  for (const [state, hubs] of hubsByState) {
    if (hubs.length < 2) continue;
    hubs.forEach((a, i) => {
      const b = hubs[(i + 1) % hubs.length];
      if (hubs.length === 2 && i === 1) return;
      links.push({ id: `constellation:${state}:${i}`, kind: "constellation", from: a.ref, to: b.ref, ref: state, style: lit.has(state) || selected.has(state) ? "lit" : "quiet" });
    });
  }
  // Real relations between placed things (a supplier shipping through a logistics partner). A
  // relation from an organization you agreed with carries that agreement.
  for (const e of model.edges) {
    if (e.kind !== "supplies") continue;
    if (!located(e.from) || !located(e.to)) continue;
    const committed = agreed.has(e.from) || agreed.has(e.to);
    links.push({ id: `relation:${e.id}`, kind: "relation", from: e.from, to: e.to, ref: null, style: committed ? "committed" : lit.has(e.from) || lit.has(e.to) ? "lit" : "quiet" });
  }
  // Routes reach from a placed origin. An origin with no geography draws no lines: its destinations
  // are lit, and the origin is listed off Earth.
  const [origin, ...destinations] = input.routes;
  if (origin && located(origin)) {
    for (const d of destinations) {
      if (!located(d)) continue;
      links.push({ id: `route:${origin}:${d}`, kind: "route", from: origin, to: d, ref: null, style: blocked.has(d) || model.nodes.get(d)?.proof === "challenged" ? "warning" : "lit" });
    }
  }

  const effects: SpatialEffect[] = [];
  for (const [org, e] of blocked) {
    if (e.seq > input.effectsAfterSeq) effects.push({ id: e.id, kind: "route_stopped", refs: [org], label: ((e.payload as Proposed).reasons ?? []).join("; ") || "not allowed" });
  }
  for (const [org, e] of accepted) {
    if (e.seq > input.effectsAfterSeq) effects.push({ id: e.id, kind: "commitment", refs: [org], label: "agreement recorded" });
  }
  for (const e of model.events) {
    if (e.seq <= input.effectsAfterSeq || e.type !== "kernel.task.completed") continue;
    const cause = (e.payload as { cause_ref?: string }).cause_ref;
    if (cause && located(cause)) effects.push({ id: e.id, kind: "proof_closed", refs: [cause], label: "verified" });
  }

  const relevant = new Set([...input.selected, ...input.highlights, ...input.routes]);
  const offEarth: OffEarth[] = [];
  for (const ref of relevant) {
    const n = model.nodes.get(ref);
    if (!n || n.location) continue;
    offEarth.push({ ref, title: n.title, kind: n.kind, why: n.kind === "world" ? "a World, not a place" : "no physical location" });
  }
  return { markers, links, effects, offEarth };
}
