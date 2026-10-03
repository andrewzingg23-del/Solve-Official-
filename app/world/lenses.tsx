"use client";

// Lens planes: the same reality, projected. Each reads only the World model and the kernel.
// Proof states are shape + label, never colour alone.
import { useEffect, useState } from "react";
import type { Grant, RepresentationKind } from "@/lib/kernel/client";
import type { ProofDetail, WorldEngine, WorldModel } from "@/lib/world/engine";
import type { InteractionContext, LensId, Node, ProofState } from "@/lib/world/types";
import { label } from "@/app/ui";
import { AvatarArt, type Seed } from "./avatar-art";

const fmtUsd = (n: number) => (n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `$${Math.round(n / 1e6)}M` : `$${n.toLocaleString("en-US")}`);

export function ProofMark({ state, size = 14 }: { state: ProofState; size?: number }) {
  const text = { verified: "Verified", self_reported: "Self-reported", challenged: "Challenged", none: "No claim" }[state];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em]">
      <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
        {state === "verified" && <circle cx="10" cy="10" r="7" fill="none" stroke="#00e5a0" strokeWidth="2.2" />}
        {state === "self_reported" && <circle cx="10" cy="10" r="7" fill="none" stroke="#f2f7fb" strokeOpacity="0.7" strokeWidth="2" strokeDasharray="3 3" />}
        {state === "challenged" && <path d="M5 4 A7 7 0 0 1 15 4 M16.5 8 A7 7 0 0 1 12 16.6 M8 16.6 A7 7 0 0 1 3.5 8" fill="none" stroke="#ff4d5e" strokeWidth="2" />}
        {state === "none" && <circle cx="10" cy="10" r="2" fill="#f2f7fb" fillOpacity="0.5" />}
      </svg>
      <span className={state === "verified" ? "text-positive" : state === "challenged" ? "text-negative" : "text-muted"}>{text}</span>
    </span>
  );
}

const Truth = ({ kind }: { kind: string }) => <span className="rounded-sm border border-line px-1.5 py-0.5 text-[10px] uppercase tracking-[0.16em] text-muted">{kind}</span>;

function Cause({ model, ctx, onSelect }: { model: WorldModel; ctx: InteractionContext; onSelect(ref: string): void }) {
  const v = model.venture;
  if (!v) return <Empty text="Nothing is underway, so nothing is blocked. Tell Horizon what you want to make real." />;
  const engaged = new Set(ctx.conversationRefs);
  const answered = model.companionInbox.length > 0;
  const firstOpen = v.milestones.find((m) => m.attributes.status !== "done" && !(m.attributes.key === "manufacturing" && answered) && ((m.attributes.needs as string[]) ?? []).some((n) => !engaged.has(n)));
  const world = model.nodes.get(v.worldRef);
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold tracking-tight">{world?.title ?? "Your World"}</h2>
        <p className="text-xs text-muted">
          <Truth kind="estimate" /> about {fmtUsd(Number(world?.attributes.capital_usd ?? 0))} upfront · own plant {fmtUsd(Number((world?.attributes.alternative as { capitalUsd?: number })?.capitalUsd ?? 0))}
        </p>
      </div>
      <ol className="flex flex-col gap-0 md:flex-row md:items-stretch">
        {v.milestones.map((m, i) => {
          const done = m.attributes.status === "done";
          const blocked = m === firstOpen;
          return (
            <li key={m.ref} className="flex flex-1 flex-col md:flex-row md:items-center">
              <button
                type="button"
                onClick={() => onSelect(m.ref)}
                className={`flex min-w-0 flex-1 flex-col gap-1 rounded-md border p-3 text-left transition-colors ${blocked ? "border-negative/70" : done ? "border-positive/50" : "border-line"} hover:border-accent`}
              >
                <span className="text-[10px] uppercase tracking-[0.2em] text-muted">{done ? "✓ Done" : blocked ? "⚠ Blocking" : "Open"}</span>
                <span className="text-sm font-medium">{m.title}</span>
                {Number(m.attributes.capital_usd) > 0 && <span className="font-mono text-xs text-muted">{fmtUsd(Number(m.attributes.capital_usd))}</span>}
              </button>
              {i < v.milestones.length - 1 && <span aria-hidden="true" className="mx-auto my-1 text-muted md:mx-1 md:my-0">{blocked ? "┆" : "→"}</span>}
            </li>
          );
        })}
      </ol>
      <div className="flex flex-col gap-2">
        <p className={label}>Needs</p>
        <div className="flex flex-wrap gap-2">
          {v.needs.map((n) => (
            <button key={n.ref} type="button" onClick={() => onSelect(n.ref)} className="rounded-full border border-dashed border-line px-3 py-1 text-xs hover:border-accent">
              ◌ {n.title}
            </button>
          ))}
        </div>
      </div>
      {v.tasks.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className={label}>Work</p>
          {v.tasks.map((t) => (
            <p key={t.task_id} className="text-sm">
              <span className="text-muted">{t.status.replace(/_/g, " ")}</span> · {t.title}
            </p>
          ))}
        </div>
      )}
      <p className="text-xs text-muted">{String(world?.attributes.source ?? "")}</p>
    </div>
  );
}

function Flow({ model, onSelect }: { model: WorldModel; onSelect(ref: string): void }) {
  const s = model.settlement;
  const p = model.payment;
  const sym = (code: string) => model.nodes && code.replace("_", "-");
  const amount = (raw: string | null | undefined, code: string) => (raw ? `${(Number(raw) / (code === "DEV_SOLVE" ? 1e9 : 1e6)).toLocaleString("en-US", { maximumFractionDigits: 6 })} ${sym(code)}` : "");
  return (
    <div className="flex flex-col gap-8">
      {s && (
        <section className="flex flex-col gap-3">
          <p className={label}>Earned</p>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="rounded-md border border-line px-3 py-2">Earn Vault</span>
            <span className="text-muted">— {amount(s.amount, "DEV_SOLVE")} →</span>
            <button type="button" onClick={() => onSelect(`settlement:${s.settlement_id}`)} className="rounded-md border border-accent px-3 py-2 text-accent">
              You
            </button>
            <ProofMark state={s.status === "confirmed" ? "verified" : "none"} />
          </div>
          <p className="break-all font-mono text-xs text-muted">released for verified work · settlement {s.settlement_id.slice(0, 16)}… · tx {s.tx_signature?.slice(0, 20)}…</p>
        </section>
      )}
      {p && (
        <section className="flex flex-col gap-3">
          <p className={label}>Paid</p>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="rounded-md border border-accent px-3 py-2 text-accent">You</span>
            {p.legs.length === 0 && <span className="text-muted">— direct →</span>}
            {p.legs.map((l, i) => (
              <span key={i} className="flex items-center gap-3">
                <span className="text-muted">— {amount(l.amountIn, l.input)} →</span>
                <span className="rounded-md border border-line px-3 py-2">
                  {l.venue} <span className="text-xs text-muted">({l.kind})</span>
                </span>
              </span>
            ))}
            <span className="text-muted">— {amount(p.deliver_amount, p.deliver_asset ?? "DEV_USDC")} →</span>
            <button type="button" onClick={() => onSelect(`payment:${p.payment_id}`)} className="rounded-md border border-line px-3 py-2">
              Bob
            </button>
            <ProofMark state={p.status === "confirmed" ? "verified" : "none"} />
          </div>
          {p.costs && (
            <p className="font-mono text-xs text-muted">
              net {Number(p.costs.netOutput) / 1e6} = gross {Number(p.costs.gross) / 1e6} − network {Number(p.costs.networkCost) / 1e6} − fees {Number(p.costs.tradingFees) / 1e6} − provider{" "}
              {Number(p.costs.providerFees) / 1e6} − slippage {Number(p.costs.slippage) / 1e6} (DEV-USDC; network fees paid by the sponsor)
            </p>
          )}
          <p className="break-all font-mono text-xs text-muted">one atomic transaction · tx {p.tx_signature?.slice(0, 24)}…</p>
        </section>
      )}
      {!s && !p && <Empty text="No value has moved yet." />}
    </div>
  );
}

function Proof({ engine, model, ctx }: { engine: WorldEngine; model: WorldModel; ctx: InteractionContext }) {
  const selected = ctx.currentSelectionIds[0];
  const target = selected && (model.nodes.get(selected)?.claimEventId || selected.startsWith("payment:") || selected.startsWith("settlement:")) ? selected : model.settlement ? `settlement:${model.settlement.settlement_id}` : null;
  const [detail, setDetail] = useState<{ ref: string; data: ProofDetail } | null>(null);
  useEffect(() => {
    let live = true;
    if (target) void engine.proofOf(target, model).then((data) => live && setDetail({ ref: target, data }));
    return () => {
      live = false;
    };
  }, [engine, model, target]);
  if (!target) return <Empty text="Select a claim, a payment or a settlement to see what supports it." />;
  const node = model.nodes.get(target);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">{node?.title ?? target}</h2>
        <ProofMark state={node?.proof ?? "none"} size={18} />
      </div>
      <ol className="flex flex-col gap-4 border-l border-line pl-5">
        {detail?.ref === target &&
          detail.data.steps.map((s, i) => (
            <li key={i} className="relative flex flex-col gap-1">
              <span aria-hidden="true" className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full border border-accent bg-background" />
              <span className="text-xs uppercase tracking-[0.2em] text-muted">{s.title}</span>
              <span className="text-sm">{s.detail}</span>
              {s.evidence.map((e, j) => (
                <span key={j} className="font-mono text-xs text-muted">
                  {e.basis.replace(/_/g, " ")} · {e.description} · {e.content_hash.slice(0, 18)}…
                </span>
              ))}
            </li>
          ))}
      </ol>
      <p className="text-xs text-muted">Claims, observations and verifications are kept apart. Evidence hashes point at the documents; Arcadia&apos;s documents are synthetic.</p>
    </div>
  );
}

function Power({ engine, model, ctx, onSelect }: { engine: WorldEngine; model: WorldModel; ctx: InteractionContext; onSelect(ref: string): void }) {
  const companion = model.avatars.find((a) => a.avatar_type === "ai_companion") ?? model.avatars[0];
  const [grants, setGrants] = useState<Grant[]>([]);
  useEffect(() => {
    let live = true;
    if (companion) void engine.companionGrants(companion.agent_id).then((g) => live && setGrants(g));
    return () => {
      live = false;
    };
  }, [engine, companion, model]);
  const selected = ctx.currentSelectionIds[0] ?? model.venture?.worldRef;
  const node = selected ? model.nodes.get(selected) : undefined;
  const controllers = model.edges.filter((e) => e.to === selected && ["controls", "owns", "represents"].includes(e.kind));
  const controlled = selected?.startsWith("actor:") ? model.edges.filter((e) => e.from === selected) : [];
  const can = (cap: string) => grants.some((g) => g.capability === cap || g.capability === "*" || (g.capability.endsWith(".*") && cap.startsWith(g.capability.slice(0, -1))));
  const rings: [string, boolean][] = [
    ["Observe", can("kernel.read")],
    ["Talk", can("message.send")],
    ["Act", can("commitment.make") || can("payment.send")],
  ];
  return (
    <div className="grid gap-8 md:grid-cols-2">
      <section className="flex flex-col gap-3">
        <p className={label}>{node ? `Who controls ${node.title}` : "Control"}</p>
        {selected === model.venture?.worldRef && <p className="text-sm">You control it (you claimed its scope).</p>}
        {controllers.map((e) => (
          <button key={e.id} type="button" onClick={() => onSelect(e.from)} className="text-left text-sm hover:text-accent">
            {model.nodes.get(e.from)?.title ?? e.from} <span className="text-muted">{e.kind}</span>
          </button>
        ))}
        {controlled.map((e) => (
          <button key={e.id} type="button" onClick={() => onSelect(e.to)} className="text-left text-sm hover:text-accent">
            <span className="text-muted">{e.kind}</span> {model.nodes.get(e.to)?.title ?? e.to}
          </button>
        ))}
        {node && !controllers.length && !controlled.length && selected !== model.venture?.worldRef && <p className="text-sm text-muted">No control relation on record.</p>}
      </section>
      {companion && (
        <section className="flex flex-col items-center gap-3">
          <p className={label}>{companion.name}&apos;s authority</p>
          <svg viewBox="0 0 200 200" width="200" height="200" role="img" aria-label={`Authority: ${rings.map(([n, on]) => `${n} ${on ? "granted" : "not granted"}`).join(", ")}`}>
            {rings.map(([name, on], i) => {
              const r = 88 - i * 26;
              return (
                <g key={name}>
                  <circle cx="100" cy="100" r={r} fill="none" stroke={on ? "#22d3ee" : "#f2f7fb"} strokeOpacity={on ? 0.8 : 0.15} strokeWidth="1.5" strokeDasharray={on ? undefined : "4 4"} />
                  <text x="100" y={100 - r + 13} textAnchor="middle" fontSize="9" letterSpacing="2" fill={on ? "#22d3ee" : "#f2f7fb"} fillOpacity={on ? 1 : 0.4}>
                    {name.toUpperCase()}
                  </text>
                </g>
              );
            })}
            <circle cx="100" cy="100" r="6" fill="#22d3ee" />
          </svg>
          <p className="text-center text-xs text-muted">From real delegation records: {grants.map((g) => `${g.capability} on ${g.scope.split(":")[0]}`).join(", ") || "none"}.</p>
        </section>
      )}
    </div>
  );
}

function People({ model, onSelect }: { model: WorldModel; onSelect(ref: string): void }) {
  const actors = [...model.nodes.values()].filter((n) => n.kind === "actor");
  const groups: [string, Node[]][] = [
    ["You and your agents", actors.filter((a) => a.ref === `actor:${model.avatars[0]?.agent_id}` || a.importance === 100 || model.avatars.some((v) => `actor:${v.agent_id}` === a.ref))],
    ["People", actors.filter((a) => a.attributes.kind === "human" && a.importance !== 100)],
    ["Organization agents", actors.filter((a) => a.attributes.role === "organization_agent")],
  ];
  return (
    <div className="grid gap-6 md:grid-cols-3">
      {groups.map(([title, list]) => (
        <section key={title} className="flex flex-col gap-2">
          <p className={label}>{title}</p>
          {list.map((a) => (
            <button key={a.ref} type="button" onClick={() => onSelect(a.ref)} className="text-left text-sm hover:text-accent">
              {a.attributes.kind === "agent" ? "◌" : "◉"} {a.title}
            </button>
          ))}
        </section>
      ))}
    </div>
  );
}

function Time({ model }: { model: WorldModel }) {
  return (
    <ol className="flex max-h-[50vh] flex-col gap-2 overflow-y-auto pr-2">
      {model.events.slice(0, 60).map((e) => (
        <li key={e.id} className="grid grid-cols-[6.5rem_1fr] gap-3 text-sm">
          <span className="font-mono text-xs text-muted">{new Date(e.occurred_at).toLocaleTimeString()}</span>
          <span>
            {e.type.replace(/^kernel\./, "").replace(/[._]/g, " ")}{" "}
            <span className="text-muted">by {model.nodes.get(`actor:${e.actor_id}`)?.title ?? "the kernel"}</span>
          </span>
        </li>
      ))}
      {model.events.length === 0 && <Empty text="No history yet." />}
    </ol>
  );
}

function Self({ model, engine, onRepresent }: { model: WorldModel; engine: WorldEngine; onRepresent(avatarId: string, kind: RepresentationKind): void }) {
  const { balances, symbols, note } = { ...engine.manifest.chain, balances: engine.manifest.chain.balances.you ?? {} };
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <span className="flex h-12 w-12 items-center justify-center rounded-full border border-accent text-lg text-accent">◉</span>
        <div>
          <p className="text-lg font-semibold">You</p>
          <p className="text-xs text-muted">Human present · local sandbox identity (not a SOV ID)</p>
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        <section className="flex flex-col gap-2">
          <p className={label}>Avatars</p>
          {model.avatars.map((a) => (
            <div key={a.avatar_id} className="flex flex-col gap-2 rounded-md border border-line p-3">
              <div className="flex items-center gap-3">
                <AvatarArt kind={a.representation} seed={a.seed as Seed} size={40} />
                <div>
                  <p className="text-sm font-medium">{a.name}</p>
                  <p className="text-xs text-muted">{a.avatar_type === "digital_self" ? "represents you" : a.avatar_type === "ai_companion" ? `works with you (${a.relationship.replace("_", " ")})` : "abstract presence"}</p>
                </div>
              </div>
              <div className="flex gap-2" role="group" aria-label={`${a.name} representation`}>
                {(["abstract", "pixel", "stylized_3d"] as RepresentationKind[]).map((k) => (
                  <button key={k} type="button" aria-pressed={a.representation === k} onClick={() => onRepresent(a.avatar_id, k)} className={`rounded border px-2 py-1 text-[10px] uppercase tracking-[0.16em] ${a.representation === k ? "border-accent text-accent" : "border-line text-muted"}`}>
                    {k === "stylized_3d" ? "stylized" : k}
                  </button>
                ))}
              </div>
              <p className="font-mono text-[10px] text-muted">identity {a.avatar_id.slice(0, 8)} · agent {a.agent_id.slice(0, 8)} · seed v{a.seed_version}</p>
            </div>
          ))}
        </section>
        <section className="flex flex-col gap-2">
          <p className={label}>Worlds</p>
          {model.venture && <p className="text-sm">◎ Your car company</p>}
          {model.settlement && <p className="text-sm">◎ DEV onboarding (where you earned)</p>}
          <p className="text-sm">◎ Arcadia market (member)</p>
        </section>
        <section className="flex flex-col gap-2">
          <p className={label}>History</p>
          <p className="text-sm">{model.events.length} events on record</p>
          {model.settlement && <p className="text-sm">Earned {Number(model.settlement.amount) / 1e9} DEV-SOLVE for verified work</p>}
          {model.payment && <p className="text-sm">Paid Bob $10</p>}
          <p className="text-xs text-muted">Memory: nothing stored. Memory never becomes truth without an event.</p>
        </section>
      </div>
      <section className="flex flex-col gap-2">
        <p className={label}>Assets (observed)</p>
        <div className="flex flex-wrap gap-4 font-mono text-sm">
          {Object.entries(balances).map(([code, raw]) => (
            <span key={code}>
              {(Number(raw) / (code === "DEV_SOLVE" ? 1e9 : 1e6)).toLocaleString("en-US", { maximumFractionDigits: 6 })} {symbols[code] ?? code}
            </span>
          ))}
        </div>
        <p className="text-xs text-muted">{note} Test assets with no value.</p>
      </section>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-muted">{text}</p>;
}

export function LensPlane(props: {
  lens: LensId;
  engine: WorldEngine;
  model: WorldModel;
  ctx: InteractionContext;
  onSelect(ref: string): void;
  onRepresent(avatarId: string, kind: RepresentationKind): void;
}) {
  const { lens, engine, model, ctx, onSelect, onRepresent } = props;
  if (lens === "space") return null;
  return (
    <section aria-label={`${lens} lens`} className="pointer-events-auto absolute inset-x-3 top-[6.75rem] z-10 mx-auto max-h-[calc(100dvh-16rem)] max-w-4xl overflow-y-auto rounded-md border border-line bg-surface/85 p-5 backdrop-blur-md md:inset-x-8 md:top-24">
      {lens === "cause" && <Cause model={model} ctx={ctx} onSelect={onSelect} />}
      {lens === "flow" && <Flow model={model} onSelect={onSelect} />}
      {lens === "proof" && <Proof engine={engine} model={model} ctx={ctx} />}
      {lens === "power" && <Power engine={engine} model={model} ctx={ctx} onSelect={onSelect} />}
      {lens === "people" && <People model={model} onSelect={onSelect} />}
      {lens === "time" && <Time model={model} />}
      {lens === "self" && <Self model={model} engine={engine} onRepresent={onRepresent} />}
    </section>
  );
}
