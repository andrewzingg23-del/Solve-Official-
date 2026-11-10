// The shell's four places (DECISIONS.md, 2026-11-10: "the shell being truth"), and which one every
// route belongs to. A person's Spaces, and everything in one, live under Space; the people they
// share Spaces with under People; the apps and AI they connect under Apps; who they are, what they
// can reach and how to leave under Control.

export const DESTINATIONS = [
  { href: "/", label: "Space", icon: "space" },
  { href: "/people", label: "People", icon: "people" },
  { href: "/apps", label: "Apps", icon: "apps" },
  { href: "/control", label: "Control", icon: "control" },
] as const;

const within = (path: string, root: string) => path === root || path.startsWith(root + "/");

export function destinationOf(path: string): string {
  if (path === "/" || ["/world", "/space", "/search"].some(root => within(path, root))) return "/";
  if (within(path, "/people")) return "/people";
  if (within(path, "/apps")) return "/apps";
  if (["/control", "/account"].some(root => within(path, root))) return "/control";
  return path;
}
