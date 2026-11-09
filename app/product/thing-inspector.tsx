import Link from "next/link";
import {
  SIX_PARTS, proofWording, provenanceLine,
  type ThingAccess, type ThingAct, type ThingField, type ThingProof,
} from "@/lib/product/thing";

// The one view every thing is guaranteed to have. Specialised editors may show the same thing as
// a document, a map or a canvas; this is what can be inspected when something is questioned, so
// its six parts are always present and always in the same order. Absence is rendered, never
// hidden: a part with nothing in it says so.

export type ThingInspectorProps = {
  title: string;
  typeName: string;
  fields: ThingField[];
  scope: string;
  ownerLabel: string;
  acts: ThingAct[];
  proof: ThingProof;
  next: { label: string; href: string } | null;
  access: ThingAccess[];
  /** Set only for a design fixture, which must never be mistaken for a real record. */
  fixture?: boolean;
};

function fieldValue(field: ThingField) {
  if (!field.present) {
    return <span className="solve-muted">Not recorded{field.required ? " · required" : ""}</span>;
  }
  if (field.kind === "boolean") return field.value ? "Yes" : "No";
  if (field.kind === "list" && Array.isArray(field.value)) {
    return field.value.length ? field.value.map(item => String(item)).join(", ") : <span className="solve-muted">None</span>;
  }
  return String(field.value);
}

function Part({ name, children }: { name: string; children: React.ReactNode }) {
  return <section className="solve-panel" aria-labelledby={`part-${name.replace(/[^a-z]+/gi, "-")}`}>
    <span className="solve-kicker" id={`part-${name.replace(/[^a-z]+/gi, "-")}`}>{name}</span>
    <div className="mt-3">{children}</div>
  </section>;
}

export function ThingInspector(props: ThingInspectorProps) {
  const { title, typeName, fields, scope, ownerLabel, acts, proof, next, access, fixture } = props;
  const [whatItIs, whoseItIs, whatHappened, whatsProven, whatsNext, whoCanReach] = SIX_PARTS;

  return <main className="solve-page">
    <header className="solve-page-heading">
      {fixture ? <p role="note" className="solve-kicker">Design fixture — not a real record</p> : null}
      <span className="solve-kicker">{typeName}</span>
      <h1>{title}</h1>
    </header>

    <Part name={whatItIs}>
      {fields.length === 0
        ? <p className="solve-muted">This has no fields yet. Giving it a type says what it is.</p>
        : <dl className="solve-field-list">
            {fields.map(field => <div key={field.name} className="solve-field">
              <dt>{field.label}</dt>
              <dd>{fieldValue(field)}</dd>
            </div>)}
          </dl>}
    </Part>

    <Part name={whoseItIs}>
      <p>{ownerLabel}</p>
      <p className="solve-muted">{scope}</p>
    </Part>

    <Part name={whatHappened}>
      {acts.length === 0
        ? <p className="solve-muted">Nothing has happened to this yet.</p>
        : <ol className="solve-history">
            {acts.map((act, index) => <li key={`${act.at}-${index}`}>
              <strong>{act.type}</strong>
              <span className="solve-muted"> {provenanceLine(act)}</span>
            </li>)}
          </ol>}
    </Part>

    <Part name={whatsProven}>
      <p>{proofWording(proof)}</p>
      {proof.items.length > 0
        ? <ul className="solve-evidence">
            {proof.items.map((item, index) => <li key={`${item.basis}-${index}`}>
              <strong>{item.basis}</strong>{item.description ? ` · ${item.description}` : ""}
              {item.at ? <span className="solve-muted"> · {item.at.slice(0, 10)}</span> : null}
            </li>)}
          </ul>
        : null}
    </Part>

    <Part name={whatsNext}>
      {next
        ? <Link href={next.href} className="solve-button">{next.label}</Link>
        : <p className="solve-muted">Nothing is waiting on you here.</p>}
    </Part>

    <Part name={whoCanReach}>
      {access.length === 0
        ? <p className="solve-muted">Only you.</p>
        : <ul className="solve-access">
            {access.map(entry => <li key={entry.grantId}>
              {entry.actorLabel} <span className="solve-muted">· {entry.capability} on {entry.scope}</span>
            </li>)}
          </ul>}
    </Part>
  </main>;
}
