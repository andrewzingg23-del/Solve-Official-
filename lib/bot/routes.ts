// Routes: "I found 3 ways forward" (VISION-CANON, Wayfinder). A person asks their own assistant for a
// way to do something. The assistant researches with its own tools and proposes up to three routes,
// each with real steps and the link a step needs. Sovereign keeps them in a World as a proposal and
// never picks one. Taking a route is the person's own choice: each step becomes a kernel task they
// created, so the path and its progress are on the record. A step marked done is done on their word;
// nothing here calls it verified.
//
// The fields follow Codex's route cards (docs/superpowers/specs/2026-10-04-need-to-route-network-state-design.md
// §5.3, on codex/need-to-route-network-state-spec): why it fits, what it takes, what is uncertain, and
// what would show it worked. This is the one route object; other surfaces build on it.
//
// Steps need `route.step`, a capability the World's owner holds and a bot let in to add does not, so
// a bot can propose routes but cannot take one or mark its steps done.
import type { Kernel, Task } from "@/lib/kernel/client";
import { loadCreativeWorld } from "@/lib/world/creative";
import { cleanText } from "./memory";
import { WORLD_LIMITS, WorldInputError } from "./worlds";

export const ROUTE_LIMITS = { ask: 300, routes: 3, title: 120, why: 400, note: 300, steps: 8, step: 300, link: 2000 } as const;
export const STEP_CAPABILITY = "route.step";

export type RouteStep = { do: string; link?: string };
export type Route = {
  title: string;
  why: string; // why it fits this person
  takes?: string; // effort, time, cost, prerequisites and risks
  unknowns?: string; // what is uncertain or not yet checked
  doneWhen?: string; // what would show it worked
  steps: RouteStep[];
};
export type Routes = { ask: string; routes: Route[] };

export type TakenStep = { taskId: string; step: number; do: string; link: string | null; status: Task["status"]; doneAt: string | null };
export type TakenRoute = { pieceId: string; route: number; takenBy: string; takenAt: string; steps: TakenStep[] };

const PREFIX = "SOV_ROUTES_V1\n";

function cleanLink(value: unknown): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || value.length > ROUTE_LIMITS.link) throw new WorldInputError("a step's link is too long");
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new WorldInputError("a step's link is not a web address");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new WorldInputError("a step's link must start with https:// or http://");
  return url.toString();
}

function readRoutes(input: { ask: unknown; routes: unknown }): Routes {
  const ask = cleanText(input.ask, ROUTE_LIMITS.ask);
  if (!ask) throw new WorldInputError("say what the person asked for");
  if (!Array.isArray(input.routes) || input.routes.length < 1) throw new WorldInputError("propose at least one route");
  if (input.routes.length > ROUTE_LIMITS.routes) throw new WorldInputError(`propose at most ${ROUTE_LIMITS.routes} routes`);
  const routes = input.routes.map((raw, i): Route => {
    const r = (raw ?? {}) as Record<string, unknown>;
    const title = cleanText(r.title, ROUTE_LIMITS.title);
    const why = cleanText(r.why, ROUTE_LIMITS.why);
    const notes = {
      takes: cleanText(r.takes, ROUTE_LIMITS.note),
      unknowns: cleanText(r.unknowns, ROUTE_LIMITS.note),
      doneWhen: cleanText(r.doneWhen ?? r.done_when, ROUTE_LIMITS.note),
    };
    if (!title) throw new WorldInputError(`route ${i + 1} needs a title`);
    if (!Array.isArray(r.steps) || r.steps.length < 1) throw new WorldInputError(`route ${i + 1} needs at least one step`);
    if (r.steps.length > ROUTE_LIMITS.steps) throw new WorldInputError(`route ${i + 1} has more than ${ROUTE_LIMITS.steps} steps`);
    const steps = r.steps.map((rawStep, j): RouteStep => {
      const s = (rawStep ?? {}) as Record<string, unknown>;
      const what = cleanText(s.do, ROUTE_LIMITS.step);
      if (!what) throw new WorldInputError(`step ${j + 1} of route ${i + 1} needs to say what to do`);
      const link = cleanLink(s.link);
      return link ? { do: what, link } : { do: what };
    });
    return { title, why, ...Object.fromEntries(Object.entries(notes).filter(([, v]) => v)), steps };
  });
  return { ask, routes };
}

// The piece body for a set of routes. Throws WorldInputError with a reason the assistant can fix.
export function encodeRoutes(input: { ask: unknown; routes: unknown }): string {
  const body = PREFIX + JSON.stringify(readRoutes(input));
  if (body.length > WORLD_LIMITS.body) throw new WorldInputError("the routes are too long for one piece; shorten the steps or links");
  return body;
}

// Reads routes back from a piece, checking them again: a piece's text can be edited by hand.
export function parseRoutes(body: string): Routes | null {
  if (!body.startsWith(PREFIX)) return null;
  try {
    return readRoutes(JSON.parse(body.slice(PREFIX.length)));
  } catch {
    return null;
  }
}

const stepKey = (pieceId: string, route: number, step: number) => `route:${pieceId}:${route}:${step}`;
const inputOf = (t: Task) => t.inputs as { route_piece?: unknown; route?: unknown; step?: unknown; link?: unknown };

// The routes taken in a World, by routes piece, with each step's status from the kernel.
export async function takenRoutes(kernel: Kernel, scope: string): Promise<Map<string, TakenRoute>> {
  const out = new Map<string, TakenRoute>();
  for (const t of await kernel.readTasks(scope)) {
    const i = inputOf(t);
    if (t.required_capability !== STEP_CAPABILITY || typeof i.route_piece !== "string" || !Number.isInteger(i.route) || !Number.isInteger(i.step)) continue;
    if (t.status === "cancelled") continue;
    const taken = out.get(i.route_piece) ?? { pieceId: i.route_piece, route: i.route as number, takenBy: t.created_by, takenAt: t.created_at, steps: [] };
    if (taken.route !== i.route) continue;
    taken.steps.push({ taskId: t.task_id, step: i.step as number, do: t.title, link: typeof i.link === "string" ? i.link : null, status: t.status, doneAt: t.status === "completed" ? t.updated_at : null });
    out.set(i.route_piece, taken);
  }
  for (const taken of out.values()) taken.steps.sort((a, b) => a.step - b.step);
  return out;
}

export const nextStep = (taken: TakenRoute) => taken.steps.find((s) => s.status !== "completed") ?? null;

// The person takes one of the proposed routes: each step becomes a task they created. Taking the same
// route again changes nothing; a second route for the same ask is refused.
export async function takeRoute(person: Kernel, input: { worldId: string; pieceId: string; route: number }): Promise<TakenRoute> {
  const { world, artifacts } = await loadCreativeWorld(person, input.worldId);
  const piece = artifacts.find((a) => a.entityId === input.pieceId);
  const routes = piece ? parseRoutes(piece.body) : null;
  if (!piece || !routes) throw new WorldInputError("no such routes in this World");
  const route = routes.routes[input.route];
  if (!Number.isInteger(input.route) || !route) throw new WorldInputError("no such route");
  const already = (await takenRoutes(person, world.scope)).get(piece.entityId);
  if (already && already.route !== input.route) throw new WorldInputError("another route is already taken for this");

  for (const [n, step] of route.steps.entries()) {
    const taskId = await person.createTask({
      scope: world.scope,
      title: step.do,
      requiredCapability: STEP_CAPABILITY,
      objective: `${routes.ask} · ${route.title}`,
      causeRef: `entity:${piece.entityId}`,
      inputs: { route_piece: piece.entityId, route: input.route, step: n, ...(step.link ? { link: step.link } : {}) },
      idempotencyKey: stepKey(piece.entityId, input.route, n),
    });
    const status = already?.steps.find((s) => s.taskId === taskId)?.status;
    if (!status || status === "created") await person.transitionTask({ taskId, status: "ready", detail: "Route taken" });
  }
  return (await takenRoutes(person, world.scope)).get(piece.entityId)!;
}

// The person marks a step done. It is done on their word: the kernel records who said so and when.
export async function markStepDone(person: Kernel, input: { worldId: string; taskId: string }): Promise<TakenStep> {
  const { world } = await loadCreativeWorld(person, input.worldId);
  const step = [...(await takenRoutes(person, world.scope)).values()].flatMap((r) => r.steps).find((s) => s.taskId === input.taskId);
  if (!step) throw new WorldInputError("no such step in this World");
  const path: Task["status"][] =
    step.status === "ready" ? ["claimed", "in_progress", "completed"]
    : step.status === "claimed" ? ["in_progress", "completed"]
    : step.status === "in_progress" ? ["completed"]
    : [];
  if (step.status !== "completed" && !path.length) throw new WorldInputError(`that step is ${step.status.replace("_", " ")}`);
  for (const status of path) await person.transitionTask({ taskId: step.taskId, status, detail: status === "completed" ? "Done, on the person's word" : "" });
  return [...(await takenRoutes(person, world.scope)).values()].flatMap((r) => r.steps).find((s) => s.taskId === input.taskId)!;
}
