import { externalFinancialActionsEnabled, moneyEnabled } from "../flags";

export type LaunchRoute = { kind: "allow" } | { kind: "redirect"; href: string } | { kind: "deny" };

const within = (pathname: string, root: string) => pathname === root || pathname.startsWith(`${root}/`);
const experiments = ["/studio", "/map", "/arcadia", "/solar", "/insurance", "/zuber-pen", "/ventures", "/solve", "/meta-ads", "/membership"];
const experimentalApis = ["/api/market", "/api/studio", "/api/auth/meta", "/api/avatar/generate"];
const aliases: Record<string, string> = { "/command": "/", "/sov-id": "/account", "/claim": "/account", "/start": "/account", "/avatar": "/bot" };

// A release surface policy, not authorization. Core handlers still verify identity and grants.
// Experimental/financial implementations and their data stay intact behind explicit deployment flags.
export function launchRoute(pathname: string, env: NodeJS.ProcessEnv = process.env): LaunchRoute {
  const experimental = env.ENABLE_EXPERIMENTAL_FEATURES === "true" || env.ENABLE_EXPERIMENTAL_FEATURES === "1";
  const hidden = { kind: "redirect", href: "/" } as const;
  // The sandbox card has no per-person issuance/ownership flow. Never expose it as a launch card.
  if (within(pathname, "/card")) return hidden;
  if (within(pathname, "/money")) return experimental && moneyEnabled(env) ? { kind: "allow" } : hidden;
  if (within(pathname, "/packs") || within(pathname, "/trading")) {
    return experimental && externalFinancialActionsEnabled(env) ? { kind: "allow" } : hidden;
  }
  if (!experimental) {
    if (experimentalApis.some(root => within(pathname, root))) return { kind: "deny" };
    if (experiments.some(root => within(pathname, root)) || /^\/world\/[^/]+\/studio(?:\/|$)/.test(pathname)) return hidden;
    const alias = Object.entries(aliases).find(([root]) => within(pathname, root));
    if (alias) return { kind: "redirect", href: alias[1] };
  }
  return { kind: "allow" };
}
