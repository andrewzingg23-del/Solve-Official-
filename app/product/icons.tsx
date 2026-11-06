import type { SVGProps } from "react";
export type IconName = "home" | "control" | "projects" | "community" | "ai" | "profile" | "plus" | "arrow" | "lock" | "document" | "chat" | "check";
const paths: Record<IconName, React.ReactNode> = {
  home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z" /></>,
  control: <><path d="M4 7h16M4 17h16M9 4v6m6 4v6" /><circle cx="9" cy="7" r="2" /><circle cx="15" cy="17" r="2" /></>,
  projects: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><path d="M14 17.5h7m-3.5-3.5v7" /></>,
  community: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2m20 0v-2a4 4 0 0 0-3-3.87" /><circle cx="9" cy="7" r="4" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
  ai: <><rect x="4" y="7" width="16" height="13" rx="4" /><path d="M12 3v4M2 12v4m20-4v4M9 16h6" /><path d="M8 11v1m8-1v1" /></>,
  profile: <><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3" /></>,
  document: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6M8 13h8m-8 4h6" /></>,
  chat: <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H3l1.5-4.5A8.5 8.5 0 1 1 21 11.5Z" />,
  check: <path d="m5 12 4 4L19 6" />,
};
export function Icon({ name, ...props }: SVGProps<SVGSVGElement> & { name: IconName }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name]}</svg>;
}
