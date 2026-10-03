"use client";

// The World. One environment: Earth as the root, You and your avatar inside it, Horizon for
// intent, lenses for how reality is shown, and the context drawer for what matters now. World,
// Horizon and avatar share one interaction context; every change comes from the kernel.
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import type { RepresentationKind } from "@/lib/kernel/client";
import { bootSandbox, resetSandbox, type Sandbox } from "@/lib/sandbox/boot";
import { respond } from "@/lib/world/controller";
import { avatarAgent, WorldEngine, type WorldModel } from "@/lib/world/engine";
import { ruleProvider } from "@/lib/world/horizon";
import type { HorizonResult, PresentationCommand, ProposedAction } from "@/lib/world/presentation";
import { emptyContext, LENSES, type Edge, type InteractionContext, type LensId } from "@/lib/world/types";
import { AvatarArt, type Seed } from "./avatar-art";
import { ContextDrawer } from "./drawer";
import { Earth, type EarthHandle } from "./earth";
import { Horizon } from "./horizon";
import { LensPlane } from "./lenses";
import { Onboarding } from "./onboarding";

const MOTION = "(prefers-reduced-motion: reduce)";

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

const NO_EDGES: Edge[] = [];

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
  const [indexOpen, setIndexOpen] = useState(false);
  const reducedMotion = useReducedMotion();
  const earth = useRef<EarthHandle>(null);
  const engine = useMemo(() => (sandbox ? new WorldEngine(sandbox) : null), [sandbox]);

  useEffect(() => {
    let live = true;
    bootSandbox((s) => live && setStage(s))
      .then(async (sb) => {
        if (!live) return;
        setSandbox(sb);
        setStage("Reading the World");
        const m = await new WorldEngine(sb).load();
        if (!live) return;
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
    const m = await engine.load();
    setModel(m);
    return m;
  }, [engine]);

  const select = useCallback((ref: string | null) => {
    setCtx((c) => ({
      ...c,
      currentSelectionIds: ref ? [ref] : [],
      currentFocusId: ref,
      conversationRefs: ref ? [ref, ...c.conversationRefs.filter((r) => r !== ref)].slice(0, 20) : c.conversationRefs,
    }));
  }, []);

  const apply = useCallback(
    (commands: PresentationCommand[]) => {
      for (const c of commands) {
        if (c.type === "highlight") setHighlights(c.refs);
        if (c.type === "show_route") setRoutes(c.refs);
        if (c.type === "show_field") setFields((f) => [...f.filter((x) => x.ref !== c.ref), { ref: c.ref, label: c.label }]);
        if (c.type === "suggest_lens") setCtx((x) => ({ ...x, currentLens: c.lens }));
        if (c.type === "focus") {
          if (c.refs.length === 1) earth.current?.focus(c.refs[0]);
          else earth.current?.frame(c.refs);
        }
        if (c.type === "open_context") select(c.ref);
      }
      const routeOrHighlight = commands.find((c) => c.type === "show_route" || c.type === "highlight");
      if (routeOrHighlight && "refs" in routeOrHighlight) earth.current?.frame(routeOrHighlight.refs);
    },
    [select],
  );

  const submit = useCallback(
    async (text: string) => {
      if (!engine || !model) return;
      setBusy(true);
      try {
        const intent = await ruleProvider.interpret(text, ctx);
        const acting = intent.type === "capability_query" || intent.type === "discover";
        setCompanionActing(acting);
        const outcome = await respond(intent, { engine, model, ctx, text });
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
    [engine, model, ctx, reload, apply],
  );

  const act = useCallback(
    async (action: ProposedAction) => {
      if (!engine || !model) return;
      if (action.id === "find-them") return submit("Find them");
      if (action.id === "allow-contact") return submit("You may contact suppliers but not make purchases");
      if (action.id === "suggest:build") return submit("Help me build a car company with the least upfront capital possible");
      if (action.id.startsWith("lens:")) {
        setCtx((c) => ({ ...c, currentLens: action.id.slice(5) as LensId }));
        return;
      }
      if (action.id === "commit-as-you") {
        const org = ctx.currentSelectionIds.find((r) => model.nodes.get(r)?.kind === "organization");
        if (!org || !model.venture) return;
        setBusy(true);
        try {
          const reply = model.companionInbox.find((m) => (m.payload as { organization?: string }).organization === org);
          const terms = { quantity: (reply?.payload as { quantity?: number })?.quantity ?? 10000, unit_price_usd: (reply?.payload as { unit_price_usd?: number })?.unit_price_usd };
          await engine.commitAsYou(org, model.venture.scope, terms);
          await reload();
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
      select(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [select]);

  const located = useMemo(() => (model ? [...model.nodes.values()].filter((n) => n.location) : []), [model]);
  const companion = model ? avatarAgent(model) ?? model.avatars[0] ?? null : null;
  const selected = ctx.currentSelectionIds[0] ?? null;
  const lens = ctx.currentLens;

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
        nodes={located}
        edges={model?.edges ?? NO_EDGES}
        highlights={highlights}
        selected={selected}
        routes={routes}
        fields={fields}
        dimmed={lens !== "space"}
        reducedMotion={reducedMotion}
        onSelect={select}
        onVisible={(refs) => setCtx((c) => ({ ...c, visibleEntityIds: refs }))}
        onStatus={(status, detail) => setEarthStatus({ status, detail })}
      />

      <div className="pointer-events-none absolute inset-0">
        {/* Identity: You and your avatar, with presence. */}
        <header className="pointer-events-auto absolute left-3 top-3 z-20 flex items-center gap-3 rounded-md border border-line bg-surface/80 px-3 py-2 backdrop-blur-md md:left-5 md:top-5">
          <button type="button" onClick={() => setCtx((c) => ({ ...c, currentLens: "self" }))} className="flex items-center gap-2" aria-label="You, human present. Open Self">
            <span className="text-accent">{companionActing ? "◎" : "◉"}</span>
            <span className="text-xs font-semibold uppercase tracking-[0.22em]">You</span>
          </button>
          {companion && (
            <span className="flex items-center gap-2 border-l border-line pl-3" aria-label={`${companion.name}, ${companionActing ? "acting" : "present"}`}>
              <AvatarArt kind={companion.representation} seed={companion.seed as Seed} size={22} />
              <span className="text-xs uppercase tracking-[0.18em] text-muted">
                {companionActing ? "◌ " : "• "}
                {companion.name}
              </span>
            </span>
          )}
        </header>

        {/* Lenses: same reality, different projection. */}
        <nav aria-label="Lenses" className="pointer-events-auto absolute inset-x-3 top-[3.75rem] z-20 flex gap-1 overflow-x-auto rounded-md border border-line bg-surface/80 p-1 backdrop-blur-md md:inset-x-auto md:right-5 md:top-5">
          {LENSES.map((l) => (
            <button
              key={l.id}
              type="button"
              aria-pressed={lens === l.id}
              title={l.question}
              onClick={() => setCtx((c) => ({ ...c, currentLens: l.id }))}
              className={`shrink-0 rounded px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] transition-colors ${lens === l.id ? "bg-accent/15 text-accent" : "text-muted hover:text-foreground"}`}
            >
              {l.label}
            </button>
          ))}
        </nav>

        {model && engine && <LensPlane lens={lens} engine={engine} model={model} ctx={ctx} onSelect={(r) => select(r)} onRepresent={represent} />}

        {/* Context drawer (Space lens): the selection, or the World index on request. */}
        {model && lens === "space" && (selected || indexOpen) && (
          <aside
            aria-label="Context"
            className="pointer-events-auto absolute bottom-40 right-3 z-10 max-h-[38vh] w-[min(420px,calc(100vw-1.5rem))] overflow-y-auto rounded-md border border-line bg-surface/85 p-4 backdrop-blur-md md:bottom-auto md:right-5 md:top-20 md:max-h-[calc(100vh-14rem)]"
          >
            <ContextDrawer
              model={model}
              selected={selected}
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
            className="pointer-events-auto absolute right-3 top-[6.75rem] z-10 rounded-md border border-line bg-surface/80 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted backdrop-blur-md hover:text-accent md:right-5 md:top-20"
          >
            Index
          </button>
        )}

        {model && <Horizon busy={busy} result={result} provider={ruleProvider.label} onSubmit={submit} onAction={act} />}

        {/* Status and sandbox notice. */}
        <footer className="pointer-events-auto absolute bottom-1 left-3 z-20 hidden text-[10px] uppercase tracking-[0.16em] text-muted/70 md:block">
          Arcadia sandbox · runs in your browser · fictional data, test assets{" "}
          {sandbox && (
            <button
              type="button"
              className="underline-offset-2 hover:text-accent hover:underline"
              onClick={async () => {
                await resetSandbox(sandbox.manifest);
                window.location.reload();
              }}
            >
              reset
            </button>
          )}
          {earthStatus.status === "failed" && <span className="ml-2 text-negative">3D Earth unavailable ({earthStatus.detail}); the index and Horizon still work</span>}
        </footer>
      </div>

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
