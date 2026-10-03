"use client";

// The context drawer: what the current selection is, why it matters, what supports it, and what
// you can do next. With nothing selected it is an index of the World, the keyboard and
// screen-reader equivalent of the map.
import type { WorldModel } from "@/lib/world/engine";
import type { Node } from "@/lib/world/types";
import { label, quietLink } from "@/app/ui";
import { ProofMark } from "./lenses";

const KIND: Record<string, string> = {
  organization: "Organization",
  place: "Place",
  world: "World",
  capability: "Capability",
  need: "Need",
  milestone: "Milestone",
  actor: "Principal",
  payment: "Payment",
  settlement: "Settlement",
};

const TRUTH: Record<string, string> = {
  declared: "declared location",
  estimated: "estimated location",
  device_observed: "observed location",
  provider_derived: "provider location",
  legal_address: "legal address",
};

function Attributes({ node }: { node: Node }) {
  const a = node.attributes;
  const rows: [string, string][] = [];
  if (a.city) rows.push(["City", String(a.city)]);
  if (a.capacity_per_year) rows.push(["Capacity", `${Number(a.capacity_per_year).toLocaleString("en-US")} a year (claimed)`]);
  if (a.lead_time_days) rows.push(["Lead time", `${a.lead_time_days} days`]);
  if (a.unit_price_usd) rows.push(["Unit price", `$${Number(a.unit_price_usd).toLocaleString("en-US")}`]);
  if (a.members) rows.push(["Members", String(a.members)]);
  if (a.currency) rows.push(["Currency", String(a.currency)]);
  if (a.capital_usd) rows.push(["Capital (estimate)", `$${(Number(a.capital_usd) / 1e6).toFixed(0)}M`]);
  if (a.role) rows.push(["Role", String(a.role).replace(/_/g, " ")]);
  if (!rows.length) return null;
  return (
    <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted">{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ContextDrawer(props: {
  model: WorldModel;
  selected: string | null;
  onSelect(ref: string | null): void;
  onAsk(text: string): void;
}) {
  const { model, selected, onSelect, onAsk } = props;
  const node = selected ? model.nodes.get(selected) : undefined;

  if (!node) {
    const groups: [string, Node[]][] = [
      ["Your World", [...model.nodes.values()].filter((n) => n.scope === model.venture?.scope && n.kind === "world")],
      ["Market", [...model.nodes.values()].filter((n) => n.kind === "organization")],
      ["Network States", [...model.nodes.values()].filter((n) => n.kind === "world" && n.attributes.type === "network_state")],
    ];
    return (
      <nav aria-label="World index" className="flex flex-col gap-5">
        {groups.map(([title, list]) =>
          list.length ? (
            <section key={title} className="flex flex-col gap-1.5">
              <p className={label}>{title}</p>
              {list.map((n) => (
                <button key={n.ref} type="button" onClick={() => onSelect(n.ref)} className="flex items-center justify-between gap-2 text-left text-sm hover:text-accent focus-visible:text-accent">
                  <span>{n.title}</span>
                  {n.kind === "organization" && <ProofMark state={n.proof} size={12} />}
                </button>
              ))}
            </section>
          ) : null,
        )}
      </nav>
    );
  }

  const relations = model.edges.filter((e) => e.from === node.ref || e.to === node.ref).slice(0, 12);
  const suggestions =
    node.kind === "organization"
      ? ["Can they make 10,000?", "Who controls this?", "Is this true?"]
      : node.kind === "world" && node.scope === model.venture?.scope
        ? ["What is blocking us?", "Find them"]
        : node.kind === "payment"
          ? ["Where did my money go?"]
          : ["Who controls this?"];
  return (
    <article aria-label={node.title} className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className={label}>{KIND[node.kind] ?? node.kind}</p>
          <h2 className="text-xl font-semibold tracking-tight">{node.title}</h2>
        </div>
        <button type="button" className={quietLink} onClick={() => onSelect(null)} aria-label="Close">
          Close
        </button>
      </div>
      {node.summary && <p className="text-sm leading-6 text-muted">{node.summary}</p>}
      {node.kind === "organization" && <ProofMark state={node.proof} />}
      {node.location && (
        <p className="font-mono text-xs text-muted">
          {node.location.latitude.toFixed(2)}, {node.location.longitude.toFixed(2)} · {TRUTH[node.location.truth]}
        </p>
      )}
      <Attributes node={node} />
      {relations.length > 0 && (
        <section className="flex flex-col gap-1">
          <p className={label}>Relations</p>
          {relations.map((e) => {
            const other = e.from === node.ref ? e.to : e.from;
            const otherNode = model.nodes.get(other);
            return (
              <button key={e.id} type="button" onClick={() => otherNode && onSelect(other)} className="text-left text-sm hover:text-accent">
                <span className="text-muted">{e.from === node.ref ? e.kind : `${e.kind} ←`}</span> {otherNode?.title ?? other.split(":")[0]}
              </button>
            );
          })}
        </section>
      )}
      <section className="flex flex-col gap-2">
        <p className={label}>Ask</p>
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button key={s} type="button" onClick={() => onAsk(s)} className="rounded-full border border-line px-3 py-1 text-xs hover:border-accent hover:text-accent">
              {s}
            </button>
          ))}
        </div>
      </section>
    </article>
  );
}
