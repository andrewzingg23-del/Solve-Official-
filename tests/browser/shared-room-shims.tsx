import type { AnchorHTMLAttributes } from "react";

export function useRouter() {
  return { refresh: () => window.dispatchEvent(new Event("fixture-refresh")), push: (path: string) => { window.location.href = path; } };
}
export default function Link(props: AnchorHTMLAttributes<HTMLAnchorElement>) { return <a {...props} />; }
