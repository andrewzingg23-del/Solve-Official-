// Waiting on you: one list, across a person's Worlds, of what only they can move forward. It covers
// routes proposed but not yet taken (a decision is proposed the same way: each option a route) and
// the next step of every route they took. The founder's problem 4 (docs/plans/2026-10-05-founder-first.md):
// decisions and next steps were buried in long chat replies. Everything here is read from the record
// with the person's own sign-in; nothing is inferred or invented.
import type { Kernel } from "@/lib/kernel/client";
import { loadCreativeWorld } from "@/lib/world/creative";
import { nextStep, parseRoutes, STEP_CAPABILITY, takenRoutes } from "./routes";

type Where = { worldId: string; worldTitle: string; pieceId: string; ask: string; at: string };
export type WaitingItem =
  | (Where & { kind: "choose"; options: string[] })
  | (Where & { kind: "next"; route: string; step: string; link: string | null; done: number; total: number });

export async function waitingOn(kernel: Kernel, worlds: { worldId: string; title: string; scope: string }[], me: string): Promise<WaitingItem[]> {
  const perWorld = await Promise.all(
    worlds.map(async (w): Promise<WaitingItem[]> => {
      try {
        const [{ artifacts }, taken, may] = await Promise.all([
          loadCreativeWorld(kernel, w.worldId),
          takenRoutes(kernel, w.scope),
          kernel.authorize({ capability: STEP_CAPABILITY, scope: w.scope }).then((d) => d.decision === "ALLOW").catch(() => false),
        ]);
        const items: WaitingItem[] = [];
        for (const a of artifacts) {
          const routes = parseRoutes(a.body);
          if (!routes) continue;
          const where = { worldId: w.worldId, worldTitle: w.title, pieceId: a.entityId, ask: routes.ask, at: a.updatedAt };
          const t = taken.get(a.entityId);
          if (!t) {
            if (may) items.push({ ...where, kind: "choose", options: routes.routes.map((r) => r.title) });
            continue;
          }
          const next = nextStep(t);
          if (t.takenBy !== me || !next) continue;
          items.push({
            ...where,
            kind: "next",
            route: routes.routes[t.route]?.title ?? "",
            step: next.do,
            link: next.link,
            done: t.steps.filter((s) => s.status === "completed").length,
            total: t.steps.length,
          });
        }
        return items;
      } catch {
        // A World that can't be read right now (access changed, kernel busy) waits for the next load.
        return [];
      }
    }),
  );
  const order = { choose: 0, next: 1 } as const;
  return perWorld.flat().sort((a, b) => order[a.kind] - order[b.kind] || b.at.localeCompare(a.at));
}
