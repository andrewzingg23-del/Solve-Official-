// Presentation commands: the only way reasoning (rule-based or a model) changes what the World
// shows. The model proposes, this module validates against the World, the UI executes. Commands
// never touch kernel state and never reach the scene unvalidated.
import { LENSES, type LensId, type TruthKind } from "./types";

export type PresentationCommand =
  | { type: "focus"; refs: string[] }
  | { type: "highlight"; refs: string[] }
  | { type: "show_route"; refs: string[] }
  | { type: "suggest_lens"; lens: LensId }
  | { type: "open_context"; ref: string }
  | { type: "show_field"; ref: string; label: string }
  | { type: "compare"; refs: string[] }
  | { type: "anchor"; ref: string; emphasis: string };

export type Statement = { truth: TruthKind; text: string };

export type ProposedAction = {
  id: string;
  label: string;
  // What it does, in kernel terms, for the authority check and for the user.
  capability: string;
  consequence: string;
};

export type HorizonResult = {
  kind: "explanation" | "route" | "comparison" | "question" | "proposed_edit" | "focus" | "search_result" | "warning";
  statements: Statement[];
  commands: PresentationCommand[];
  actions: ProposedAction[];
};

const REF = /^(entity|actor|task|payment|settlement|action|event):[0-9a-f-]{36,64}$/;

// Drops anything that does not name a real, visible thing or a known lens. Returns the commands
// that survive and the reasons for any that did not.
export function validateCommands(commands: unknown[], known: (ref: string) => boolean) {
  const valid: PresentationCommand[] = [];
  const rejected: string[] = [];
  for (const raw of commands) {
    const c = raw as Partial<PresentationCommand> & Record<string, unknown>;
    const refsOk = (refs: unknown) =>
      Array.isArray(refs) && refs.length > 0 && refs.length <= 50 && refs.every((r) => typeof r === "string" && REF.test(r) && known(r));
    switch (c?.type) {
      case "focus":
      case "highlight":
      case "show_route":
      case "compare":
        if (refsOk(c.refs)) valid.push({ type: c.type, refs: c.refs as string[] });
        else rejected.push(`${c.type}: unknown or invalid refs`);
        break;
      case "suggest_lens":
        if (LENSES.some((l) => l.id === c.lens)) valid.push({ type: "suggest_lens", lens: c.lens as LensId });
        else rejected.push("suggest_lens: unknown lens");
        break;
      case "open_context":
        if (typeof c.ref === "string" && REF.test(c.ref) && known(c.ref)) valid.push({ type: "open_context", ref: c.ref });
        else rejected.push("open_context: unknown ref");
        break;
      case "show_field":
        if (typeof c.ref === "string" && known(c.ref) && typeof c.label === "string" && c.label.length <= 80) {
          valid.push({ type: "show_field", ref: c.ref, label: c.label });
        } else rejected.push("show_field: invalid");
        break;
      case "anchor":
        if (typeof c.ref === "string" && known(c.ref) && typeof c.emphasis === "string") valid.push({ type: "anchor", ref: c.ref, emphasis: c.emphasis });
        else rejected.push("anchor: invalid");
        break;
      default:
        rejected.push(`unknown command ${String(c?.type)}`);
    }
  }
  return { valid, rejected };
}
