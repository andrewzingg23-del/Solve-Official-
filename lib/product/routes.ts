export type LaunchRoute = { kind: "allow" } | { kind: "redirect"; href: string } | { kind: "deny" };

const within = (pathname: string, root: string) => pathname === root || pathname.startsWith(`${root}/`);

// Addresses from before the rebuild (2026-11-10). Their screens and code were removed; a link
// someone kept still lands somewhere real — the place that thing lives now — instead of a dead end.
// Nothing here can be switched back on: there is nothing left behind these addresses to expose.
const retired: Record<string, string> = {
  "/projects": "/space", "/communities": "/space", "/community": "/space", "/worlds": "/", "/saved": "/",
  "/bot": "/account", "/onboarding": "/account", "/personalize": "/account", "/sov-id": "/account",
  "/claim": "/account", "/start": "/account", "/avatar": "/account",
  "/apps": "/control",
  "/command": "/", "/card": "/", "/money": "/", "/packs": "/", "/trading": "/", "/studio": "/", "/map": "/",
  "/arcadia": "/", "/solar": "/", "/insurance": "/", "/zuber-pen": "/", "/ventures": "/", "/solve": "/",
  "/meta-ads": "/", "/membership": "/",
};
// Retired programmatic endpoints answer a plain, uncached 404.
const retiredApis = ["/api/market", "/api/studio", "/api/auth/meta", "/api/avatar", "/api/bot", "/api/ideas", "/api/passport", "/api/reason", "/api/worlds"];
/** Every older view of a thing opens the thing itself. */
const olderThingView = /^\/world\/([^/]+)\/(?:room|ideas|studio|workbench)\/?$/;

export function rebuiltRoute(pathname: string): string | null {
  const thing = olderThingView.exec(pathname);
  if (thing) return `/world/${thing[1]}`;
  const hit = Object.entries(retired).find(([root]) => within(pathname, root));
  return hit ? hit[1] : null;
}

// A release surface policy, not authorization. Every handler still verifies identity and grants.
export function launchRoute(pathname: string): LaunchRoute {
  if (retiredApis.some(root => within(pathname, root))) return { kind: "deny" };
  const rebuilt = rebuiltRoute(pathname);
  return rebuilt ? { kind: "redirect", href: rebuilt } : { kind: "allow" };
}
