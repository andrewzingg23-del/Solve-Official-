import {
  SIX_PARTS, actWording, confirmationWording, proofWording, provenanceLine,
  type ThingAccess, type ThingAct, type ThingConfirmation, type ThingField, type ThingProof,
} from "@/lib/product/thing";
import styles from "./record.module.css";

// The guaranteed view of any thing: six parts, always present, always in this order, absence shown
// rather than hidden. Rebuilt from zero (2026-11-10); the rules it renders live in lib/product/thing.ts.

export type RecordProps = {
  title: string;
  typeName: string | null;
  fields: ThingField[];
  ownerLabel: string;
  context: string;
  acts: ThingAct[];
  proof: ThingProof;
  confirmations: ThingConfirmation[];
  nextAction?: React.ReactNode;
  access: ThingAccess[];
};

function value(field: ThingField) {
  if (!field.present) return <span className="s-muted">Not recorded{field.required ? " · required" : ""}</span>;
  if (field.kind === "boolean") return field.value ? "Yes" : "No";
  if (field.kind === "list" && Array.isArray(field.value)) return field.value.length ? field.value.map(String).join(", ") : <span className="s-muted">None</span>;
  return String(field.value);
}

/** The kernel stores "confirmed: Saw it…"; a person reads "Confirmed: Saw it…". */
const sentence = (text: string) => text ? text.charAt(0).toUpperCase() + text.slice(1) : text;

function Part({ name, children }: { name: string; children: React.ReactNode }) {
  return <section className={styles.part} aria-label={name} data-part={name}>
    <h2 className="s-label">{name}</h2>
    <div className={styles.body}>{children}</div>
  </section>;
}

export function Record(p: RecordProps) {
  const [whatItIs, whoseItIs, whatHappened, whatsProven, whatsNext, whoCanReach] = SIX_PARTS;

  return <article className={styles.record}>
    <header className={styles.head}>
      <span className="s-label">{p.typeName ?? "No type yet"}</span>
      <h1>{p.title}</h1>
      <p className={styles.proofLine} data-proof={p.proof.status}>{proofWording(p.proof)}</p>
    </header>

    <div className={styles.parts}>
      <Part name={whatItIs}>
        {p.fields.length === 0
          ? <p className="s-muted">No fields yet. Giving it a type says what it is.</p>
          : <dl className={styles.fields}>{p.fields.map(f => <div key={f.name}><dt className="s-muted s-small">{f.label}</dt><dd>{value(f)}</dd></div>)}</dl>}
      </Part>

      <Part name={whoseItIs}>
        <p className={styles.owner}>{p.ownerLabel}</p>
        <p className="s-muted s-small">{p.context}</p>
      </Part>

      <Part name={whatHappened}>
        {p.acts.length === 0
          ? <p className="s-muted">Nothing has happened to this yet.</p>
          : <ol className={styles.timeline}>{p.acts.map((a, i) => <li key={`${a.at}-${i}`}>
              <span className={styles.act}>{actWording(a.type)}</span>
              <span className="s-muted s-small"> — {provenanceLine(a)}</span>
            </li>)}</ol>}
      </Part>

      <Part name={whatsProven}>
        <p>{proofWording(p.proof)}</p>
        {p.confirmations.length > 0
          ? <ul className={styles.asked} aria-label="Asked to confirm">{p.confirmations.map(c => <li key={c.id} data-state={c.state}>
              <span><strong>{c.askedOf || "Someone"}</strong>{c.question ? <span className="s-muted"> · “{c.question}”</span> : null}</span>
              <span className={styles.state}>{confirmationWording(c)}</span>
            </li>)}</ul>
          : null}
        {p.proof.items.length > 0
          ? <ul className={styles.evidence}>{p.proof.items.map((e, i) => <li key={`${e.basis}-${i}`} className="s-small">
              <span>{sentence(e.description || e.basis)}</span>{e.at ? <span className="s-muted"> · {e.at.slice(0, 10)}</span> : null}
            </li>)}</ul>
          : null}
      </Part>

      <Part name={whatsNext}>
        {p.nextAction ?? <p className="s-muted">Nothing is waiting on you here.</p>}
      </Part>

      <Part name={whoCanReach}>
        {p.access.length === 0
          ? <p>Only you.</p>
          : <ul className={styles.access}>{p.access.map(a => <li key={a.grantId}>{a.actorLabel} <span className="s-muted s-small">· {a.capability}</span></li>)}</ul>}
      </Part>
    </div>
  </article>;
}
