// Pack panels: how sector packs surface inside Talk, Dots-style.
// A panel is a pack's conversational surface. Every action it exposes
// carries a permission level, and the gate decides before anything runs.
//
// Levels:
//   open      — reads and safe views; runs without asking.
//   approval  — moves something real (sends, posts, spends); needs the
//               person's explicit yes, every time.
//   forbidden — never runnable from a panel (deletes, grants, withdrawals).
//               These go through the kernel's own gates, not conversation.
//
// Pure logic only — rendering belongs to the redesign. This is the contract
// the redesign will honor: no panel action runs without passing gateAction.

export type PanelActionLevel = "open" | "approval" | "forbidden";

export type PanelAction = {
  id: string;
  label: string;
  level: PanelActionLevel;
  /** Plain-language why — shown when approval is asked or access denied. */
  reason: string;
};

export type PackPanel = {
  packId: string;
  title: string;
  actions: PanelAction[];
};

export type GateDecision =
  | { decision: "allow"; actionId: string }
  | { decision: "needs-approval"; actionId: string; reason: string }
  | { decision: "deny"; actionId: string; reason: string };

const panels = new Map<string, PackPanel>();

export function registerPanel(panel: PackPanel): void {
  panels.set(panel.packId, panel);
}

export function getPanel(packId: string): PackPanel | null {
  return panels.get(packId) ?? null;
}

export function clearPanels(): void {
  panels.clear();
}

/**
 * The gate. Returns what may happen with this action, and why.
 * Unknown pack or unknown action is a deny — closed by default.
 */
export function gateAction(packId: string, actionId: string): GateDecision {
  const panel = panels.get(packId);
  if (!panel) return { decision: "deny", actionId, reason: `No panel registered for pack "${packId}".` };
  const action = panel.actions.find((a) => a.id === actionId);
  if (!action)
    return { decision: "deny", actionId, reason: `"${actionId}" is not an action of "${panel.title}".` };
  switch (action.level) {
    case "open":
      return { decision: "allow", actionId };
    case "approval":
      return { decision: "needs-approval", actionId, reason: action.reason };
    case "forbidden":
      return { decision: "deny", actionId, reason: action.reason };
  }
}

/**
 * Suggested level for a new action id, by verb convention.
 * Explicit beats suggested — this is a starting point, not a rule.
 */
export function suggestLevel(actionId: string): PanelActionLevel {
  const id = actionId.toLowerCase();
  if (/^(view|read|list|search|chart|quote|preview|explain)/.test(id)) return "open";
  if (/^(delete|destroy|withdraw|grant|revoke|transfer|custody)/.test(id)) return "forbidden";
  return "approval";
}
