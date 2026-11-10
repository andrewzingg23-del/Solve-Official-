import Link from "next/link";
import { Icon, type IconName } from "./icons";
import styles from "./list.module.css";

export { styles as listStyles };

/** One row of a settings-style list. A row with an href is a link; without one it is just information. */
export function Row({ icon, title, note, href, children }: {
  icon?: IconName; title: string; note?: React.ReactNode; href?: string; children?: React.ReactNode;
}) {
  const body = <>
    {icon ? <span className={styles.rowIcon}><Icon name={icon} /></span> : null}
    <span className={styles.rowText}><span className={styles.rowTitle}>{title}</span>{note ? <span className={styles.rowNote}>{note}</span> : null}</span>
    {children}
    {href ? <span className={styles.chevron}><Icon name="down" /></span> : null}
  </>;
  return href ? <Link href={href} className={styles.row}>{body}</Link> : <div className={styles.row}>{body}</div>;
}

/** The boards' empty state: an icon, what's missing, and the one thing to do about it. */
export function Empty({ icon, title, children }: { icon: IconName; title: string; children?: React.ReactNode }) {
  return <div className={styles.empty}>
    <span className={styles.emptyIcon}><Icon name={icon} size={26} /></span>
    <strong>{title}</strong>
    {children}
  </div>;
}
