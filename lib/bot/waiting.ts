// Where a person's asks stand, across their Worlds, read from the record with their own sign-in.
// Two views come from one scan:
// - journeys: every ask with routes, proposed, underway or done (the Command Center's "Where
//   you're going");
// - waitingOn: what only they can move forward, routes to choose and next steps (the founder's
//   problem 4 in docs/plans/2026-10-05-founder-first.md).
// A decision is proposed the same way as a route: each option is a route. Nothing is inferred or invented.
import type { Kernel } from "@/lib/kernel/client";
import { loadCreativeWorld } from "@/lib/world/creative";
import { parseCapabilityProposal, type Gap } from "./gaps";
import { proofsIn } from "./proof";
import { nextStep, parseRoutes, STEP_CAPABILITY, takenRoutes } from "./routes";

type Where = { worldId: string; worldTitle: string; pieceId: string; ask: string; at: string };

export type Journey = Where & {
  state: "proposed" | "underway" | "done";
  options: string[]; // the route titles proposed
  canChoose: boolean; // the viewer may take a route here
  route: string | null; // the route taken
  mine: boolean; // the viewer took it
  done: number;
  total: number;
  next: { step: string; link: string | null; since: string } | null;
  saved: boolean; // proof is saved on this ask's piece
};

export type WaitingItem =
  | (Where & { kind: "choose"; options: string[] })
  | (Where & { kind: "next"; route: string; step: string; link: string | null; done: number; total: number });

type WorldRef = { worldId: string; title: string; scope: string };

// One read of each World serves the whole overview: where each ask stands, and what assistants
// recorded that solve can't do yet.
export async function overview(kernel: Kernel, worlds: WorldRef[], me: string): Promise<{ journeys: Journey[]; gaps: Gap[] }> {
  const perWorld = await Promise.all(
    worlds.map(async (w): Promise<{ journeys: Journey[]; gaps: Gap[] }> => {
      try {
        const [{ artifacts }, taken, canChoose, saves] = await Promise.all([
          loadCreativeWorld(kernel, w.worldId),
          takenRoutes(kernel, w.scope),
          kernel.authorize({ capability: STEP_CAPABILITY, scope: w.scope }).then((d) => d.decision === "ALLOW").catch(() => false),
          proofsIn(kernel, w.scope).catch(() => []),
        ]);
        const savedOn = new Set(saves.map((p) => p.pieceId));
        const out: Journey[] = [];
        const gaps: Gap[] = [];
        for (const a of artifacts) {
          const proposal = parseCapabilityProposal(a.body);
          if (proposal) gaps.push({ ...proposal, worldId: w.worldId, worldTitle: w.title, pieceId: a.entityId, at: new Date(a.updatedAt).toISOString() });
          const routes = parseRoutes(a.body);
          if (!routes) continue;
          const t = taken.get(a.entityId);
          const next = t ? nextStep(t) : null;
          out.push({
            worldId: w.worldId,
            worldTitle: w.title,
            pieceId: a.entityId,
            ask: routes.ask,
            at: new Date(a.updatedAt).toISOString(), // the embedded kernel can hand back a Date
            state: !t ? "proposed" : next ? "underway" : "done",
            options: routes.routes.map((r) => r.title),
            canChoose,
            route: t ? (routes.routes[t.route]?.title ?? "") : null,
            mine: t ? t.takenBy === me : false,
            done: t ? t.steps.filter((s) => s.status === "completed").length : 0,
            total: t ? t.steps.length : 0,
            next: next ? { step: next.do, link: next.link, since: next.since } : null,
            saved: savedOn.has(a.entityId),
          });
        }
        return { journeys: out, gaps };
      } catch {
        // A World that can't be read right now (access changed, kernel busy) waits for the next load.
        return { journeys: [], gaps: [] };
      }
    }),
  );
  return {
    journeys: perWorld.flatMap((p) => p.journeys).sort((a, b) => b.at.localeCompare(a.at)),
    gaps: perWorld.flatMap((p) => p.gaps),
  };
}

export async function journeys(kernel: Kernel, worlds: WorldRef[], me: string): Promise<Journey[]> {
  return (await overview(kernel, worlds, me)).journeys;
}

export function waitingFrom(all: Journey[]): WaitingItem[] {
  const items: WaitingItem[] = [];
  for (const j of all) {
    const where = { worldId: j.worldId, worldTitle: j.worldTitle, pieceId: j.pieceId, ask: j.ask, at: j.at };
    if (j.state === "proposed" && j.canChoose) items.push({ ...where, kind: "choose", options: j.options });
    else if (j.state === "underway" && j.mine && j.next) items.push({ ...where, kind: "next", route: j.route ?? "", step: j.next.step, link: j.next.link, done: j.done, total: j.total });
  }
  const order = { choose: 0, next: 1 } as const;
  return items.sort((a, b) => order[a.kind] - order[b.kind] || b.at.localeCompare(a.at));
}

export async function waitingOn(kernel: Kernel, worlds: WorldRef[], me: string): Promise<WaitingItem[]> {
  return waitingFrom(await journeys(kernel, worlds, me));
}

// What the record shows needs attention, noticed without anyone asking (VISION-CANON: "The world
// itself should react"). It only points at things; it never acts, assigns or nudges anyone else.
export type Noticed = { worldId: string; pieceId: string; text: string };
const DAY = 86_400_000;
export const QUIET_DAYS = 3;

export function noticed(all: Journey[], now = new Date()): Noticed[] {
  const daysSince = (iso: string) => Math.floor((now.getTime() - new Date(iso).getTime()) / DAY);
  const out: Noticed[] = [];
  for (const j of all) {
    const at = { worldId: j.worldId, pieceId: j.pieceId };
    if (j.state === "underway" && j.mine && j.next && daysSince(j.next.since) >= QUIET_DAYS) {
      out.push({ ...at, text: `No movement on "${j.next.step}" for ${daysSince(j.next.since)} days.` });
    } else if (j.state === "done" && j.mine && !j.saved) {
      out.push({ ...at, text: `"${j.route}" is done, with nothing saved on it yet. If it became real, save the proof.` });
    } else if (j.state === "proposed" && j.canChoose && daysSince(j.at) >= QUIET_DAYS) {
      out.push({ ...at, text: `Routes for "${j.ask}" have waited ${daysSince(j.at)} days for your choice.` });
    }
  }
  return out;
}

