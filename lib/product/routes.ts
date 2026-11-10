import { externalFinancialActionsEnabled, moneyEnabled } from "../flags";

export type LaunchRoute = { kind: "allow" } | { kind: "redirect"; href: string } | { kind: "deny" };

const within = (pathname: string, root: string) => pathname === root || pathname.startsWith(`${root}/`);
const experiments = ["/studio", "/map", "/arcadia", "/solar", "/insurance", "/zuber-pen", "/ventures", "/solve", "/meta-ads", "/membership"];
const experimentalApis = ["/api/market", "/api/studio", "/api/auth/meta", "/api/avatar/generate"];
const aliases: Record<string, string> = { "/command": "/", "/sov-id": "/account", "/claim": "/account", "/start": "/account", "/avatar": "/account" };

// The experience was rebuilt from zero on 2026-11-10. Until a route is rebuilt on the new system it
// sends the person to the rebuilt destination it belongs to, so nothing from the earlier interface
// is ever seen. Its data and kernel logic are untouched; only the old screen is out of reach.
const notYetRebuilt: Record<string, string> = {
  "/projects": "/space", "/communities": "/space", "/community": "/space", "/worlds": "/",
  "/bot": "/account", "/onboarding": "/account", "/personalize": "/account",
  "/apps": "/control", "/saved": "/",
};
/** Every older view of a thing opens its record, which has been rebuilt. */
const olderThingView = /^\/world\/([^/]+)(?:\/(?:room|ideas|studio|workbench))?\/?$/;

export function rebuiltRoute(pathname: string): string | null {
  const thing = olderThingView.exec(pathname);
  if (thing) return `/world/${thing[1]}/record`;
  const hit = Object.entries(notYetRebuilt).find(([root]) => within(pathname, root));
  return hit ? hit[1] : null;
}

export function experimentalFeaturesEnabled(env: Partial<NodeJS.ProcessEnv> = process.env): boolean {
  return env.ENABLE_EXPERIMENTAL_FEATURES === "true" || env.ENABLE_EXPERIMENTAL_FEATURES === "1";
}

// A release surface policy, not authorization. Core handlers still verify identity and grants.
// Experimental/financial implementations and their data stay intact behind explicit deployment flags.
export function launchRoute(pathname: string, env: Partial<NodeJS.ProcessEnv> = process.env): LaunchRoute {
  const financialEnv: NodeJS.ProcessEnv = { ...env, NODE_ENV: env.NODE_ENV ?? "production" };
  const experimental = experimentalFeaturesEnabled(env);
  const hidden = { kind: "redirect", href: "/" } as const;
  // The sandbox card has no per-person issuance/ownership flow. Never expose it as a launch card.
  if (within(pathname, "/card")) return hidden;
  if (within(pathname, "/money")) return experimental && moneyEnabled(financialEnv) ? { kind: "allow" } : hidden;
  if (within(pathname, "/packs") || within(pathname, "/trading")) {
    return experimental && externalFinancialActionsEnabled(financialEnv) ? { kind: "allow" } : hidden;
  }
  const rebuilt = rebuiltRoute(pathname);
  if (rebuilt) return { kind: "redirect", href: rebuilt };
  if (!experimental) {
    if (experimentalApis.some(root => within(pathname, root))) return { kind: "deny" };
    if (experiments.some(root => within(pathname, root)) || /^\/world\/[^/]+\/studio(?:\/|$)/.test(pathname)) return hidden;
    const alias = Object.entries(aliases).find(([root]) => within(pathname, root));
    if (alias) return { kind: "redirect", href: alias[1] };
  }
  return { kind: "allow" };
}
