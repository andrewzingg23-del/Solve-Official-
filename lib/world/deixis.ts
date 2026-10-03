// Resolves spatial references ("this", "that", "them", "this one", "the one on the left",
// "this payment", "here") from the shared context. Order: explicit reference → selection →
// focus → comparison set → active route → visible entities → conversation. When a consequential
// reference stays ambiguous, it returns candidates instead of guessing.
import type { InteractionContext, Node } from "./types";

export type Resolution =
  | { kind: "resolved"; refs: string[]; source: string }
  | { kind: "ambiguous"; candidates: string[]; reason: string }
  | { kind: "none" };

const PLURAL = /\b(them|these|those|they|their)\b/i;
const SINGULAR = /\b(this|that|it|this one|that one|here|there|him|her)\b/i;

export function hasDeixis(text: string) {
  return PLURAL.test(text) || SINGULAR.test(text);
}

export function resolveDeixis(
  text: string,
  ctx: InteractionContext,
  nodes: Map<string, Node>,
  opts: { consequential?: boolean; explicit?: string[]; kind?: Node["kind"]; screenX?: (ref: string) => number | undefined } = {},
): Resolution {
  if (opts.explicit && opts.explicit.length) return { kind: "resolved", refs: opts.explicit, source: "explicit" };
  const plural = PLURAL.test(text);
  const typed = (refs: string[]) => (opts.kind ? refs.filter((r) => nodes.get(r)?.kind === opts.kind) : refs);
  const layers: [string, string[]][] = [
    ["selection", ctx.currentSelectionIds],
    ["focus", ctx.currentFocusId ? [ctx.currentFocusId] : []],
    ["comparison", ctx.comparisonIds],
    ["route", ctx.currentRouteId ? [ctx.currentRouteId] : []],
    ["visible", ctx.visibleEntityIds],
    ["conversation", ctx.conversationRefs],
  ];

  // "the one on the left / right" picks by screen position among the comparison or selection set.
  const side = /\b(left|right)\b/i.exec(text)?.[1]?.toLowerCase();
  if (side && opts.screenX) {
    const pool = typed(ctx.comparisonIds.length ? ctx.comparisonIds : ctx.visibleEntityIds).filter((r) => opts.screenX!(r) !== undefined);
    if (pool.length) {
      const sorted = [...pool].sort((a, b) => opts.screenX!(a)! - opts.screenX!(b)!);
      return { kind: "resolved", refs: [side === "left" ? sorted[0] : sorted[sorted.length - 1]], source: `screen ${side}` };
    }
  }

  for (const [source, refs] of layers) {
    const pool = typed(refs.filter((r) => nodes.has(r)));
    if (pool.length === 0) continue;
    if (plural || pool.length === 1) return { kind: "resolved", refs: plural ? pool : [pool[0]], source };
    // Several candidates for a singular reference.
    if (source === "selection" || source === "focus") return { kind: "resolved", refs: [pool[0]], source };
    if (opts.consequential) return { kind: "ambiguous", candidates: pool.slice(0, 6), reason: `"${text}" could mean ${pool.length} things` };
    return { kind: "resolved", refs: [pool[0]], source };
  }
  return { kind: "none" };
}
