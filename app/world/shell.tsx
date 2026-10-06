"use client";

// The World. One environment: Earth as the root, You and your avatar inside it, Horizon for
// intent, lenses for how reality is shown, and the context drawer for what matters now. World,
// Horizon and avatar share one interaction context; every change comes from the kernel.
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { RepresentationKind } from "@/lib/kernel/client";
import { bootSandbox, resetSandbox, type Sandbox } from "@/lib/sandbox/boot";
import { kernelDigest } from "@/lib/sandbox/digest";
import { buildContext } from "@/lib/causal/context";
import { respond } from "@/lib/world/controller";
import { avatarAgent, WorldEngine, type WorldModel } from "@/lib/world/engine";
import { ruleProvider, type Intent } from "@/lib/world/horizon";
import { remoteProvider } from "@/lib/world/remote-provider";
import { CONSEQUENTIAL } from "@/lib/world/reasoning";
import type { HorizonResult, PresentationCommand, ProposedAction } from "@/lib/world/presentation";
import type { SceneController, SceneMetrics } from "@/lib/world/scene";
import { buildSpatialView, type SpatialView } from "@/lib/world/spatial";
import { emptyContext, type InteractionContext, type LensId } from "@/lib/world/types";
import { AvatarArt, type Seed } from "./avatar-art";
import { ContextDrawer } from "./drawer";
import { Earth } from "./earth";
import { Horizon } from "./horizon";
import { LensPlane } from "./lenses";
import { Onboarding } from "./onboarding";
import { StewardPanel } from "./steward";
import { SoonCard, TradeCard, VerbDock } from "./verb-dock";

const MOTION = "(prefers-reduced-motion: reduce)";

// Keep the everyday wayfinding visible; specialist readings remain one tap away.
const PRIMARY_VIEWS: { id: LensId; label: string; question: string }[] = [
  { id: "space", label: "World", question: "Explore the living World." },
  { id: "cause", label: "Path", question: "See what is moving and what is blocked." },
  { id: "people", label: "People", question: "See the people and agents in this World." },
  { id: "time", label: "History", question: "See what changed and who changed it." },
];

const MORE_VIEWS: { id: LensId; label: string; question: string }[] = [
  { id: "power", label: "Authority", question: "Who controls this?" },
  { id: "flow", label: "Value", question: "Where did value move?" },
  { id: "proof", label: "Proof", question: "What evidence supports this?" },
  { id: "self", label: "You", question: "What does this mean for me?" },
];

const VERB_NOTES = {
  Build: "Rooms, packs, and tools that compound.",
  Create: "Your avatar, your content, your worlds.",
  Gather: "Communities with portable identity.",
} as const;

function useReducedMotion() {
  return useSyncExternalStore(
    (notify) => {
      const mq = window.matchMedia(MOTION);
      mq.addEventListener("change", notify);
      return () => mq.removeEventListener("change", notify);
    },
    () => window.matchMedia(MOTION).matches,
    () => false,
  );
}

const EMPTY_MODEL = { nodes: new Map(), edges: [], events: [] };

// Timings a future learning loop can compare against: boot stages, World load, scene start.
export type WorldMetrics = { boot: Record<string, number>; restored: boolean; loadMs: number; scene: SceneMetrics | null; queryMs: number[] };

declare global {
  interface Window {
    // The World's own instruments, for automated parity and performance checks.
    __sov?: {
      metrics: WorldMetrics;
      manifest: Sandbox["manifest"];
      view: () => SpatialView;
      scene: () => SceneController | null;
      context: () => InteractionContext;
      // Recomputes the semantic digest of the kernel this browser booted.
      digest: () => Promise<{ digest: string; tables: Record<string, number> }>;
      // An actor's context (who, what it sees, what it can and cannot do), from its own authority.
      actorContext: (actorId: string) => Promise<{ kind: string; scopes: string[]; can: string[]; cannot: string[]; grants: string[]; world: string | null }>;
    };
  }
}

// What the person sees, in plain words, for the model: titles only, never ids or records.
function describe(model: WorldModel, ctx: InteractionContext) {
  const title = (ref: string) => model.nodes.get(ref)?.title ?? null;
  const selected = ctx.currentSelectionIds.map(title).filter(Boolean);
  const companion = model.avatars.find((a) => a.avatar_type === "ai_companion") ?? model.avatars[0] ?? null;
  return [
    `Lens: ${ctx.currentLens}.`,
    selected.length ? `Selected: ${selected.join(", ")}.` : "Nothing selected.",
    model.venture ? `Their World: ${title(model.venture.worldRef) ?? "a venture"}.` : "They have no venture World yet.",
    companion ? `Their AI companion: ${companion.name}.` : "No AI companion yet.",
  ].join(" ");
}

export function WorldShell() {
  const [sandbox, setSandbox] = useState<Sandbox | null>(null);
  const [stage, setStage] = useState("Waking the World");
  const [bootError, setBootError] = useState<string | null>(null);
  const [model, setModel] = useState<WorldModel | null>(null);
  const [ctx, setCtx] = useState<InteractionContext>(() => emptyContext(""));
  const [result, setResult] = useState<HorizonResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [highlights, setHighlights] = useState<string[]>([]);
  const [routes, setRoutes] = useState<string[]>([]);
  const [fields, setFields] = useState<{ ref: string; label: string }[]>([]);
  const [earthStatus, setEarthStatus] = useState<{ status: "loading" | "ready" | "failed"; detail?: string }>({ status: "loading" });
  const [companionActing, setCompanionActing] = useState(false);
  // Language goes to the model when one is available to this person, else to the rules.
  const reasoning = useMemo(() => remoteProvider(ruleProvider), []);
  const [providerLabel, setProviderLabel] = useState(ruleProvider.label);
  const [indexOpen, setIndexOpen] = useState(false);
  const [stewardOpen, setStewardOpen] = useState(false);
  const [moreViewsOpen, setMoreViewsOpen] = useState(false);
  // Events up to this sequence were history when the World opened: state, not effects.
  const [watermark, setWatermark] = useState(Number.MAX_SAFE_INTEGER);
  const reducedMotion = useReducedMotion();
  const earth = useRef<SceneController>(null);
  const metrics = useRef<WorldMetrics>({ boot: {}, restored: false, loadMs: 0, scene: null, queryMs: [] });
  const engine = useMemo(() => (sandbox ? new WorldEngine(sandbox) : null), [sandbox]);

  useEffect(() => {
    let live = true;
    const started = performance.now();
    let last = started;
    bootSandbox((s) => {
      const now = performance.now();
      metrics.current.boot[s] = Math.round(now - last);
      last = now;
      if (live) setStage(s);
    })
      .then(async (sb) => {
        if (!live) return;
        metrics.current.boot.total = Math.round(performance.now() - started);
        metrics.current.restored = sb.restored;
        setSandbox(sb);
        setStage("Reading the World");
        const loading = performance.now();
        const m = await new WorldEngine(sb).load();
        metrics.current.loadMs = Math.round(performance.now() - loading);
        if (!live) return;
        setWatermark(m.events.reduce((max, e) => Math.max(max, e.seq), 0));
        setModel(m);
        setCtx((c) => ({ ...c, principalId: sb.manifest.you.actorId, activeAvatarId: m.avatars[0]?.avatar_id ?? null, currentWorldId: m.venture?.scope ?? null }));
      })
      .catch((e: unknown) => live && setBootError(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
    };
  }, []);

  const reload = useCallback(async () => {
    if (!engine) return null;
    const started = performance.now();
    const m = await engine.load();
    metrics.current.queryMs = [...metrics.current.queryMs.slice(-19), Math.round(performance.now() - started)];
    setModel(m);
    return m;
  }, [engine]);

  // Selection is language: it resolves to canonical refs, and additive picks build "these".
  const select = useCallback((ref: string | null, additive = false) => {
    setCtx((c) => {
      const ids = !ref ? [] : additive ? (c.currentSelectionIds.includes(ref) ? c.currentSelectionIds.filter((r) => r !== ref) : [...c.currentSelectionIds, ref]) : [ref];
      return {
        ...c,
        currentSelectionIds: ids,
        currentFocusId: ref && ids.includes(ref) ? ref : (ids[0] ?? null),
        conversationRefs: ref ? [ref, ...c.conversationRefs.filter((r) => r !== ref)].slice(0, 20) : c.conversationRefs,
      };
    });
  }, []);

  const apply = useCallback(
    (commands: PresentationCommand[]) => {
      for (const c of commands) {
        if (c.type === "highlight") setHighlights(c.refs);
        if (c.type === "show_route") setRoutes(c.refs);
        if (c.type === "show_field") setFields((f) => [...f.filter((x) => x.ref !== c.ref), { ref: c.ref, label: c.label }]);
        if (c.type === "suggest_lens") setCtx((x) => ({ ...x, currentLens: c.lens }));
        if (c.type === "focus") {
          // Something with no geography is opened, not flown to.
          const placed = c.refs.length === 1 ? earth.current?.focusEntity(c.refs[0]) : earth.current?.focusBounds(c.refs);
          if (!placed && c.refs.length === 1) select(c.refs[0]);
        }
        if (c.type === "open_context") select(c.ref);
      }
      const route = commands.find((c) => c.type === "show_route");
      const highlight = commands.find((c) => c.type === "highlight");
      if (route && "refs" in route) earth.current?.frameRoute(route.refs);
      else if (highlight && "refs" in highlight) earth.current?.focusBounds(highlight.refs);
    },
    [select],
  );

  const submit = useCallback(
    async (text: string, given?: Intent) => {
      if (!engine || !model) return;
      setBusy(true);
      try {
        // A button is the person's explicit act; typed text is interpreted (by the model when one is
        // available, else by the rules), and a model's reading of a consequential intent is only a
        // proposal to confirm.
        const intent = given ?? (await reasoning.interpret(text, ctx, describe(model, ctx)));
        const confirmed = Boolean(given) || reasoning.lastSource.kind === "rules" || !CONSEQUENTIAL.includes(intent.type);
        setProviderLabel(given ? ruleProvider.label : reasoning.label);
        const acting = intent.type === "capability_query" || intent.type === "discover";
        setCompanionActing(acting);
        const outcome = await respond(intent, { engine, model, ctx, text, confirmed });
        if (outcome.reload) await reload();
        setCtx((c) => ({ ...c, ...outcome.patch }));
        setResult(outcome.result);
        apply(outcome.result.commands);
      } catch (e) {
        setResult({ kind: "warning", statements: [{ truth: "unknown", text: e instanceof Error ? e.message : String(e) }], commands: [], actions: [] });
      } finally {
        setBusy(false);
        setTimeout(() => setCompanionActing(false), 1200);
      }
    },
    [engine, model, ctx, reload, apply, reasoning],
  );

  const act = useCallback(
    async (action: ProposedAction) => {
      if (!engine || !model) return;
      if (action.id === "find-them") return submit("Find them");
      if (action.id === "allow-contact") return submit("You may contact suppliers but not make purchases", { type: "delegate_contact", allowPurchases: false });
      if (action.id === "suggest:build") return submit("Help me launch my insurance agency with the least upfront capital possible");
      if (action.id.startsWith("lens:")) {
        setCtx((c) => ({ ...c, currentLens: action.id.slice(5) as LensId }));
        return;
      }
      if (action.id === "commit-as-you") {
        const org = ctx.currentSelectionIds.find((r) => model.nodes.get(r)?.kind === "organization");
        if (!org || !model.venture) return;
        setBusy(true);
        try {
          const companionId = avatarAgent(model)?.agent_id ?? model.avatars[0]?.agent_id;
          if (!companionId) return;
          const accepted = await engine.acceptAsYou(org, model, companionId);
          await reload();
          if (accepted.outcome?.status !== "completed") {
            setResult({ kind: "warning", statements: [{ truth: "fact", text: accepted.outcome?.detail ?? accepted.excluded?.join("; ") ?? "There is no route to accept." }], commands: [], actions: [] });
            return;
          }
          setResult({
            kind: "proposed_edit",
            statements: [{ truth: "fact", text: `You accepted ${model.nodes.get(org)?.title}'s terms under your own authority. It is recorded as a kernel event.` }],
            commands: [],
            actions: [{ id: "lens:time", label: "What changed?", capability: "kernel.read", consequence: "Show the record." }],
          });
        } finally {
          setBusy(false);
        }
      }
    },
    [engine, model, ctx, submit, reload],
  );

  const represent = useCallback(
    async (avatarId: string, kind: RepresentationKind) => {
      if (!sandbox) return;
      await sandbox.you.setAvatarRepresentation(avatarId, kind);
      await reload();
    },
    [sandbox, reload],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setIndexOpen(false);
      setMoreViewsOpen(false);
      select(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [select]);

  // DOMAIN STATE → AUTHORIZED QUERY (engine.load, as You) → SPATIAL VIEW → SCENE CONTROLLER.
  const view = useMemo(
    () => buildSpatialView(model ?? EMPTY_MODEL, { selected: ctx.currentSelectionIds, highlights, routes, fields, effectsAfterSeq: watermark }),
    [model, ctx.currentSelectionIds, highlights, routes, fields, watermark],
  );

  const loadOperations = useCallback(() => (engine ? engine.operations() : null), [engine]);

  const enterWorld = useCallback((ref: string) => {
    earth.current?.enterWorld(ref);
    const placed = earth.current?.renderedRefs().includes(ref);
    setCtx((c) => ({ ...c, insideWorldRef: ref, currentLens: placed ? c.currentLens : "cause" }));
  }, []);
  const exitWorld = useCallback(() => {
    earth.current?.exitWorld();
    setCtx((c) => ({ ...c, insideWorldRef: null, currentLens: "space" }));
  }, []);

  const latestView = useRef(view);
  const latestCtx = useRef(ctx);
  useEffect(() => {
    latestView.current = view;
    latestCtx.current = ctx;
  });
  useEffect(() => {
    if (!sandbox) return;
    window.__sov = {
      metrics: metrics.current,
      manifest: sandbox.manifest,
      view: () => latestView.current,
      scene: () => earth.current,
      context: () => latestCtx.current,
      digest: () => kernelDigest((sql) => sandbox.k.owner(sql)),
      actorContext: async (actorId) => {
        const m = await engine!.load();
        const goal = engine!.supplyGoal(m);
        const kernel = engine!.kernelFor(actorId);
        const c = await buildContext({ kernel, actorId, goal, kernelFor: (id) => engine!.kernelFor(id), providers: engine!.providers() });
        return {
          kind: c.who.kind,
          scopes: c.sees.scopes,
          can: c.can.map((x) => x.capability),
          cannot: c.cannot.map((x) => x.capability),
          grants: (await kernel.myGrants()).map((g) => `${g.capability}@${g.scope}`),
          world: c.where.world,
        };
      },
    };
  }, [sandbox, engine]);
  const companion = model ? avatarAgent(model) ?? model.avatars[0] ?? null : null;
  const selected = ctx.currentSelectionIds[0] ?? null;
  const lens = ctx.currentLens;

  // The hero composition (headline, verb cards) shows only on the living World itself —
  // lens panels, the steward view, and entering a World take the room instead.
  const heroOpen = Boolean(model && lens === "space" && !ctx.insideWorldRef && !stewardOpen);
  const drawerOpen = Boolean(model && lens === "space" && (selected || indexOpen));

  const lensNav = (className: string) => (
    <nav aria-label="World views" className={className}>
      {PRIMARY_VIEWS.map((l) => (
        <button
          key={l.id}
          type="button"
          aria-pressed={lens === l.id}
          title={l.question}
          onClick={() => {
            setCtx((c) => ({ ...c, currentLens: l.id }));
            setMoreViewsOpen(false);
          }}
          className={`flex-1 rounded-full px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors md:flex-none md:px-3.5 md:tracking-[0.18em] ${lens === l.id ? "bg-accent/15 text-accent" : "text-muted hover:text-foreground"}`}
        >
          {l.label}
        </button>
      ))}
      <div className="relative shrink-0">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={moreViewsOpen}
          aria-label={`More World views${MORE_VIEWS.some((l) => l.id === lens) ? `, current view ${MORE_VIEWS.find((l) => l.id === lens)?.label}` : ""}`}
          title="Specialist views"
          onClick={() => setMoreViewsOpen((open) => !open)}
          className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] transition-colors md:tracking-[0.18em] ${MORE_VIEWS.some((l) => l.id === lens) || moreViewsOpen ? "bg-accent/15 text-accent" : "text-muted hover:text-foreground"}`}
        >
          More
          {MORE_VIEWS.some((l) => l.id === lens) && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent" />}
          <span aria-hidden="true" className="text-[9px]">▾</span>
        </button>
        {moreViewsOpen && (
          <div role="menu" aria-label="Specialist World views" className="absolute right-0 top-full z-30 mt-2 flex min-w-44 flex-col gap-1 rounded-2xl border border-line bg-surface/95 p-1.5 shadow-xl backdrop-blur-md">
            {MORE_VIEWS.map((l) => (
              <button
                key={l.id}
                type="button"
                role="menuitemradio"
                aria-checked={lens === l.id}
                title={l.question}
                onClick={() => {
                  setCtx((c) => ({ ...c, currentLens: l.id }));
                  setMoreViewsOpen(false);
                }}
                className={`rounded-xl px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.16em] transition-colors ${lens === l.id ? "bg-accent/15 text-accent" : "text-muted hover:bg-foreground/5 hover:text-foreground"}`}
              >
                {l.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </nav>
  );

  if (bootError) {
    return (
      <main className="flex flex-1 items-center justify-center p-6">
        <p role="alert" className="max-w-md text-sm text-negative">
          The World could not start: {bootError}
        </p>
      </main>
    );
  }

  return (
    <main className="relative h-dvh w-full overflow-hidden bg-background">
      <Earth
        ref={earth}
        view={view}
        dimmed={lens !== "space"}
        reducedMotion={reducedMotion}
        onSelect={select}
        onVisible={(refs) => setCtx((c) => ({ ...c, visibleEntityIds: refs }))}
        onBand={(band) => setCtx((c) => ({ ...c, zoomBand: band }))}
        onStatus={(status, detail) => setEarthStatus({ status, detail })}
        onMetrics={(m) => (metrics.current.scene = m)}
      />

      {/* The chrome column: identity, views, hero, verbs, the one action, proof. Earth shows through. */}
      <div className="pointer-events-none absolute inset-0 z-10 flex flex-col">
        <header className="pointer-events-auto flex items-start justify-between gap-2 px-3 pt-3 md:px-5 md:pt-5">
          <div className="flex items-center gap-3 rounded-2xl border border-line bg-surface/80 px-3 py-2 backdrop-blur-md">
            <button type="button" onClick={() => setCtx((c) => ({ ...c, currentLens: "self" }))} className="flex items-center gap-2" aria-label="You, human present. Open Self">
              <span className="text-accent">{companionActing ? "◎" : "◉"}</span>
              <span className="text-xs font-semibold uppercase tracking-[0.22em]">You</span>
            </button>
            {sandbox && (
              <button
                type="button"
                aria-pressed={stewardOpen}
                onClick={() => setStewardOpen((o) => !o)}
                className={`border-l border-line pl-3 text-[10px] font-semibold uppercase tracking-[0.18em] ${stewardOpen ? "text-accent" : "text-muted hover:text-foreground"}`}
              >
                Steward
              </button>
            )}
            {companion && (
              <span className="flex items-center gap-2 border-l border-line pl-3" aria-label={`${companion.name}, ${companionActing ? "acting" : "present"}`}>
                <AvatarArt kind={companion.representation} seed={companion.seed as Seed} size={22} />
                <span className="text-xs uppercase tracking-[0.18em] text-muted">
                  {companionActing ? "◌ " : "• "}
                  {companion.name}
                </span>
              </span>
            )}
            {sandbox && (
              <span
                title="Arcadia uses fictional data and test assets; it is not shared live work."
                aria-label="Sandbox: fictional data and test assets"
                className="rounded-full border border-line px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted md:hidden"
              >
                Sandbox
              </span>
            )}
            <Link href="/worlds" aria-label="Your Worlds" className="border-l border-line pl-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted hover:text-accent">
              Worlds
            </Link>
          </div>
          {lensNav("hidden items-center gap-1 rounded-2xl border border-line bg-surface/80 p-1 backdrop-blur-md md:flex")}
        </header>
        {lensNav("pointer-events-auto mx-3 mt-2 flex items-center gap-1 rounded-2xl border border-line bg-surface/80 p-1 backdrop-blur-md md:hidden")}

        {/* One message: the hero. The living object sits behind and below it. */}
        {heroOpen && (
          <div className="px-6 pt-5 text-center md:pt-8">
            <p className="eyebrow eyebrow-accent">The living world</p>
            <h1 className="mx-auto mt-2 max-w-3xl text-5xl font-bold leading-[1.02] tracking-tight text-foreground md:text-7xl">
              Ask for a <span className="serif-accent">way</span>.
            </h1>
            <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-muted">This world grows around you</p>
            <p className="mt-3 hidden text-[10px] uppercase tracking-[0.22em] text-faint md:block" aria-label="The Wayfinder loop: ask, route, room, act, consequence, expand">
              ask <span aria-hidden="true" className="text-accent">→</span> route <span aria-hidden="true" className="text-accent">→</span> room{" "}
              <span aria-hidden="true" className="text-accent">→</span> act <span aria-hidden="true" className="text-accent">→</span> consequence{" "}
              <span aria-hidden="true" className="text-accent">→</span> expand
            </p>
          </div>
        )}

        <div className="min-h-0 flex-1" />

        {/* Verb orbit: a swipeable card row on the phone. */}
        {heroOpen && (
          <div className="pb-3 md:hidden">
            <VerbDock />
          </div>
        )}

        {/* One action: the ask pill. */}
        {model && (
          <div className="px-3 pb-2 md:px-0 md:pb-3">
            <div className="mx-auto flex w-full max-w-2xl flex-col gap-2">
              <Horizon busy={busy} result={result} provider={providerLabel} onSubmit={(text) => submit(text)} onAction={act} />
            </div>
          </div>
        )}

        {/* Ambient proof: real counts, no paragraphs. */}
        <footer className="pointer-events-auto border-t border-line-soft px-4 py-2">
          <p className="text-center text-[10px] uppercase tracking-[0.2em] text-faint">
            {model && <>{model.events.length} events on record · </>}
            private by default · kernel recorded
            <span className="hidden md:inline"> · runs in your browser</span>
            {sandbox && (
              <button
                type="button"
                className="ml-2 underline-offset-2 hover:text-accent hover:underline"
                onClick={async () => {
                  await resetSandbox(sandbox.manifest);
                  window.location.reload();
                }}
              >
                reset
              </button>
            )}
          </p>
        </footer>
      </div>

      {/* Desktop: data docked beside the living object (Alibaba pattern). */}
      {heroOpen && !drawerOpen && (
        <>
          <div className="pointer-events-auto absolute left-5 top-1/2 z-10 hidden w-60 -translate-y-1/2 flex-col gap-4 md:flex">
            <TradeCard />
            <SoonCard verb="Build" note={VERB_NOTES.Build} />
          </div>
          <div className="pointer-events-auto absolute right-5 top-1/2 z-10 hidden w-60 -translate-y-1/2 flex-col gap-4 md:flex">
            <SoonCard verb="Create" note={VERB_NOTES.Create} />
            <SoonCard verb="Gather" note={VERB_NOTES.Gather} />
          </div>
        </>
      )}

      {/* Alert pinned to the thing it describes. */}
      {earthStatus.status === "failed" && (
        <div role="alert" className="alert-pin pointer-events-auto absolute left-1/2 top-1/2 z-20 max-w-[calc(100vw-3rem)] -translate-x-1/2 -translate-y-1/2 rounded-full px-4 py-2 text-center text-xs font-semibold">
          3D Earth unavailable — the index and Horizon still work
        </div>
      )}

      {/* What matters now but has no place on Earth: listed, never given convenient coordinates. */}
      {model && lens === "space" && !ctx.insideWorldRef && view.offEarth.length > 0 && (
        <div aria-label="Not on Earth" className="pointer-events-auto absolute left-3 top-32 z-10 flex max-w-[calc(100vw-7rem)] flex-wrap items-center gap-1.5 md:left-5 md:top-20">
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted">Not on Earth</span>
          {view.offEarth.map((o) => (
            <button key={o.ref} type="button" title={o.why} onClick={() => select(o.ref)} className="rounded-full border border-line bg-surface/80 px-2.5 py-1 text-xs backdrop-blur-md hover:border-accent hover:text-accent">
              {o.title}
            </button>
          ))}
        </div>
      )}
      {ctx.insideWorldRef && (
        <button type="button" onClick={exitWorld} className="pointer-events-auto absolute left-3 top-32 z-20 rounded-full border border-accent bg-surface/90 px-3 py-1 text-xs text-accent md:left-5 md:top-20">
          ← Back to Earth · inside {model?.nodes.get(ctx.insideWorldRef)?.title ?? "World"}
        </button>
      )}

      {stewardOpen && engine && <StewardPanel load={loadOperations} onClose={() => setStewardOpen(false)} />}
      {!stewardOpen && model && engine && <LensPlane lens={lens} engine={engine} model={model} ctx={ctx} onSelect={(r) => select(r)} onRepresent={represent} onChanged={reload} />}

      {/* Context drawer (Space lens): the selection, or the World index on request. */}
      {model && drawerOpen && (
        <aside
          aria-label="Context"
          className="glass pointer-events-auto absolute bottom-48 right-3 z-10 max-h-[36vh] w-[min(420px,calc(100vw-1.5rem))] overflow-y-auto p-5 md:bottom-auto md:right-5 md:top-24 md:max-h-[calc(100dvh-16rem)]"
        >
          <ContextDrawer
            model={model}
            selected={selected}
            selection={ctx.currentSelectionIds}
            onEnterWorld={enterWorld}
            onSelect={(r) => {
              select(r);
              if (!r) setIndexOpen(false);
            }}
            onAsk={submit}
          />
        </aside>
      )}
      {model && lens === "space" && !selected && !indexOpen && (
        <button
          type="button"
          onClick={() => setIndexOpen(true)}
          className="pointer-events-auto absolute right-3 top-32 z-10 rounded-full border border-line bg-surface/80 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted backdrop-blur-md transition-colors hover:border-accent hover:text-accent md:right-5 md:top-20"
        >
          Index
        </button>
      )}

      {!model && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center gap-4 bg-background">
          <span aria-hidden="true" className="h-2 w-2 animate-pulse rounded-full bg-accent" />
          <p className="text-xs uppercase tracking-[0.3em] text-muted" role="status">
            {stage}
          </p>
        </div>
      )}

      {model && engine && model.avatars.length === 0 && (
        <Onboarding
          onCreate={async (input) => {
            await engine.createAvatar(input);
            const m = await reload();
            setCtx((c) => ({ ...c, activeAvatarId: m?.avatars[0]?.avatar_id ?? null }));
          }}
        />
      )}
    </main>
  );
}
