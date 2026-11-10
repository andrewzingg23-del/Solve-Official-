// The five destinations, and which one every route belongs to. One concept, one home: your things
// (and everything about each one) live on Bench; your public Space on Space; your card on ID;
// connections and data on Control; Home is the doorway.

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
  if (["/workbench", "/world"].some(root => within(path, root))) return "/workbench";
  if (within(path, "/account")) return "/account";
  if (within(path, "/control")) return "/control";
  if (within(path, "/space")) return "/space";
  return path;
}
