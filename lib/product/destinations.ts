// The five destinations, and which one every route belongs to (DECISIONS.md, 2026-11-09).
// Things, communities and records live in Space; identity and the AI's persona in ID; connections
// in Control. None of them is given a permanent tab of its own.

export const DESTINATIONS = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/account", label: "ID", icon: "id" },
  { href: "/space", label: "Space", icon: "space" },
  { href: "/workbench", label: "Bench", icon: "bench" },
  { href: "/control", label: "Control", icon: "control" },
] as const;

const within = (path: string, root: string) => path === root || path.startsWith(root + "/");

export function destinationOf(path: string): string {
  if (path === "/") return "/";
  if (/^\/world\/[^/]+\/workbench$/.test(path) || within(path, "/workbench")) return "/workbench";
  if (["/account", "/sov-id", "/bot", "/onboarding", "/claim"].some(root => within(path, root))) return "/account";
  if (["/control", "/apps"].some(root => within(path, root))) return "/control";
  if (["/space", "/projects", "/communities", "/community", "/world", "/worlds"].some(root => within(path, root))) return "/space";
  return path;
}
