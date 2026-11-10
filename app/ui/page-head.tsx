import styles from "./page-head.module.css";

/** The top of a destination: the card's label voice, a heading, and one sentence of purpose. */
export function PageHead({ label, title, children }: { label: string; title: string; children?: React.ReactNode }) {
  return <header className={styles.head}>
    <span className="s-label">{label}</span>
    <h1>{title}</h1>
    {children ? <p className="s-muted">{children}</p> : null}
  </header>;
}
