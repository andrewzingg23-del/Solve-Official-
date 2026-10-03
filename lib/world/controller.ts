// The response planner: turns an interpreted intent into kernel actions (through the engine) and
// a HorizonResult — one spatial consequence, one concise explanation, at most three next actions.
// Statements carry their truth kind; commands are validated against the World before use.
import { resolveDeixis } from "./deixis";
import { avatarAgent, type WorldEngine, type WorldModel } from "./engine";
import type { Intent } from "./horizon";
import { validateCommands, type HorizonResult, type PresentationCommand, type ProposedAction, type Statement } from "./presentation";
import type { InteractionContext, Node } from "./types";

export type Outcome = {
  result: HorizonResult;
  reload: boolean;
  patch: Partial<InteractionContext>;
};

const usd = (n: number) =>
  n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `$${Math.round(n / 1e6)}M` : `$${n.toLocaleString("en-US")}`;

const PROOF_WORD = { verified: "verified on site", self_reported: "self-reported, unverified", challenged: "challenged by an audit", none: "no claim on record" };

function result(kind: HorizonResult["kind"], statements: Statement[], commands: PresentationCommand[], actions: ProposedAction[], model: WorldModel): HorizonResult {
  const { valid } = validateCommands(commands, (ref) => model.nodes.has(ref));
  return { kind, statements, commands: valid, actions: actions.slice(0, 3) };
}

const ACT = {
  findThem: { id: "find-them", label: "Find them", capability: "kernel.read", consequence: "Search the market for the capabilities you lack." },
  allowContact: {
    id: "allow-contact",
    label: "Let your companion contact suppliers (not purchase)",
    capability: "message.send",
    consequence: "Delegates message.send in your car company World for 7 days. No commitment or payment authority.",
  },
  commitAsYou: { id: "commit-as-you", label: "Accept as you", capability: "commitment.make", consequence: "You accept the quoted terms under your own authority." },
  showProof: { id: "lens:proof", label: "Is this true?", capability: "kernel.read", consequence: "Show the evidence behind this claim." },
  showFlow: { id: "lens:flow", label: "Where did my $10 go?", capability: "kernel.read", consequence: "Trace your payment." },
  build: { id: "suggest:build", label: "Help me build a car company with the least upfront capital", capability: "world.entity.write", consequence: "Create a World and a route." },
} satisfies Record<string, ProposedAction>;

function blocker(model: WorldModel, ctx: InteractionContext): Node | null {
  const v = model.venture;
  if (!v) return null;
  const engaged = new Set(ctx.conversationRefs);
  const accepted = model.companionInbox.length > 0;
  for (const m of v.milestones) {
    if (m.attributes.status === "done") continue;
    if (m.attributes.key === "manufacturing" && accepted) continue;
    const needs = (m.attributes.needs as string[]) ?? [];
    if (needs.length && !needs.every((n) => engaged.has(n))) return m;
  }
  return null;
}

export async function respond(intent: Intent, input: { engine: WorldEngine; model: WorldModel; ctx: InteractionContext; text: string }): Promise<Outcome> {
  const { engine, model, ctx, text } = input;
  const venture = model.venture;
  const companion = avatarAgent(model);
  const companionName = companion?.name ?? "Your companion";

  switch (intent.type) {
    case "build_venture": {
      if (venture) {
        return {
          reload: false,
          patch: { currentLens: "cause", currentWorldId: venture.scope },
          result: result("route", [{ truth: "fact", text: "Your car company World already exists. Here is its route." }], [{ type: "suggest_lens", lens: "cause" }, { type: "focus", refs: [venture.worldRef] }], [ACT.findThem], model),
        };
      }
      const { scope, plan } = await engine.buildVenture(intent.objective, intent.strategy === "least_capital", model);
      return {
        reload: true,
        patch: { currentLens: "cause", currentWorldId: scope, currentIntentId: `intent:${Date.now()}`, conversationRefs: [] },
        result: {
          kind: "route",
          statements: [
            { truth: "estimate", text: plan.explanation },
            { truth: "estimate", text: `About ${usd(plan.capitalUsd)} upfront, against ${usd(plan.alternative.capitalUsd)} with an own plant.` },
          ],
          commands: [{ type: "suggest_lens", lens: "cause" }],
          actions: [ACT.findThem],
        },
      };
    }

    case "discover": {
      let capabilities: string[];
      if (intent.capability) capabilities = [intent.capability];
      else if (venture) capabilities = [...new Set(venture.needs.map((n) => String(n.attributes.capability)))];
      else return { reload: false, patch: {}, result: result("question", [{ truth: "unknown", text: "Find whom? Tell me what you need, or start with a goal." }], [], [ACT.build], model) };
      // "Find them" while looking at a route means the manufacturing need first: it carries the most capital.
      if (!intent.capability && capabilities.includes("contract_manufacturing")) capabilities = ["contract_manufacturing"];
      const candidates = engine.discover(model, capabilities);
      const nodes = candidates.map((r) => model.nodes.get(r)!);
      const verified = nodes.filter((n) => n.proof === "verified").length;
      const capTitle = capabilities.map((c) => model.nodes.get(`entity:${engine.manifest.capabilities[c]}`)?.title ?? c).join(", ");
      return {
        reload: false,
        patch: { currentLens: "space", comparisonIds: candidates, currentSelectionIds: [], conversationRefs: [...candidates, ...ctx.conversationRefs].slice(0, 20) },
        result: result(
          "search_result",
          [
            { truth: "fact", text: `${candidates.length} organizations offer ${capTitle.toLowerCase()}. ${verified} with verified capacity.` },
            ...(nodes.some((n) => n.proof === "challenged") ? [{ truth: "observation" as const, text: `${nodes.find((n) => n.proof === "challenged")!.title}'s capacity claim was challenged by an audit.` }] : []),
          ],
          [{ type: "suggest_lens", lens: "space" }, { type: "highlight", refs: candidates }, ...(venture?.worldRef ? [{ type: "show_route" as const, refs: [venture.worldRef, ...candidates] }] : [])],
          [],
          model,
        ),
      };
    }

    case "capability_query": {
      const target = resolveDeixis(text, ctx, model.nodes, { consequential: true, kind: "organization" });
      if (target.kind === "ambiguous") {
        return { reload: false, patch: {}, result: result("question", [{ truth: "unknown", text: "Which one? Select a supplier." }], [{ type: "highlight", refs: target.candidates }], [], model) };
      }
      if (target.kind === "none") {
        return { reload: false, patch: {}, result: result("question", [{ truth: "unknown", text: "Which supplier? Select one on the map or find candidates first." }], [], [ACT.findThem], model) };
      }
      const orgRef = target.refs[0];
      const org = model.nodes.get(orgRef)!;
      if (!venture) return { reload: false, patch: {}, result: result("question", [{ truth: "unknown", text: "Start a goal first so the inquiry has a World to belong to." }], [], [ACT.build], model) };
      if (!companion) return { reload: false, patch: {}, result: result("question", [{ truth: "unknown", text: "Create your companion first; it makes the inquiry." }], [], [], model) };
      const asked = await engine.capabilityQuery(companion.agent_id, orgRef, intent.quantity, venture.scope, model);
      if (asked.decision.decision !== "ALLOW" || !asked.answer) {
        return {
          reload: false,
          patch: { currentSelectionIds: [orgRef] },
          result: result(
            "warning",
            [{ truth: "fact", text: `${companionName} isn't allowed to contact suppliers yet. ${asked.decision.reasons[0] ?? ""}`.trim() }],
            [{ type: "focus", refs: [orgRef] }],
            [ACT.allowContact],
            model,
          ),
        };
      }
      const a = asked.answer;
      const qty = intent.quantity ? intent.quantity.toLocaleString("en-US") : "that many";
      return {
        reload: true,
        patch: { currentSelectionIds: [orgRef], conversationRefs: [orgRef, "contract_manufacturing", ...ctx.conversationRefs].slice(0, 20) },
        result: result(
          "explanation",
          [
            { truth: "fact", text: `${org.title}'s agent: capacity ${a.capacity_per_year?.toLocaleString("en-US")} a year (${PROOF_WORD[org.proof]}), ${a.lead_time_days} days lead time, $${a.unit_price_usd?.toLocaleString("en-US")} a unit.` },
            { truth: "inference", text: a.can_fulfill ? `They can make ${qty}.` : `They cannot make ${qty} a year.` },
          ],
          [{ type: "focus", refs: [orgRef] }, { type: "show_field", ref: orgRef, label: a.can_fulfill ? "Can build" : "Short of capacity" }],
          a.can_fulfill ? [ACT.commitAsYou, ACT.showProof] : [ACT.showProof],
          model,
        ),
      };
    }

    case "delegate_contact": {
      if (!venture || !companion) {
        return { reload: false, patch: {}, result: result("question", [{ truth: "unknown", text: "There is no World or companion to delegate to yet." }], [], [ACT.build], model) };
      }
      await engine.delegateContact(companion.agent_id, venture.scope);
      return {
        reload: true,
        patch: {},
        result: result(
          "proposed_edit",
          [{ truth: "fact", text: `${companionName} may contact suppliers for your car company for 7 days. It cannot commit or pay.` }],
          [],
          [],
          model,
        ),
      };
    }

    case "commit": {
      const target = resolveDeixis(text, ctx, model.nodes, { consequential: true, kind: "organization" });
      if (!venture || !companion || target.kind !== "resolved") {
        return { reload: false, patch: {}, result: result("question", [{ truth: "unknown", text: "Commit to what? Select the supplier and ask what they can do first." }], [], [], model) };
      }
      const decision = await engine.commitDecision(companion.agent_id, venture.scope);
      return {
        reload: false,
        patch: { currentSelectionIds: target.refs },
        result: result(
          "warning",
          [{ truth: "fact", text: decision.decision === "ALLOW" ? `${companionName} holds commitment authority here.` : `${companionName} can't make commitments: that needs your authority.` }],
          [{ type: "focus", refs: target.refs }],
          [ACT.commitAsYou],
          model,
        ),
      };
    }

    case "expand_control": {
      const sel = ctx.currentSelectionIds[0];
      const controller = sel?.startsWith("actor:") ? sel : model.edges.find((e) => e.kind === "controls" && e.to === sel)?.from;
      if (!controller) return { reload: false, patch: {}, result: result("question", [{ truth: "unknown", text: "Select something first; then I can show who controls it." }], [], [], model) };
      const controlled = model.edges.filter((e) => e.from === controller && ["controls", "owns", "member_of"].includes(e.kind)).map((e) => e.to);
      return {
        reload: false,
        patch: { currentLens: "power", currentSelectionIds: [controller] },
        result: result(
          "explanation",
          [{ truth: "fact", text: `${model.nodes.get(controller)?.title ?? "They"} control${controlled.length === 1 ? "s" : ""} ${controlled.length} thing${controlled.length === 1 ? "" : "s"} on record.` }],
          [{ type: "suggest_lens", lens: "power" }, { type: "highlight", refs: [controller, ...controlled] }],
          [],
          model,
        ),
      };
    }

    case "lens": {
      const statements: Statement[] = [{ truth: "fact", text: intent.reason }];
      if (intent.lens === "cause") {
        const b = blocker(model, ctx);
        if (b) statements.unshift({ truth: "inference", text: `${b.title} is the next blocker: no partner yet for what it needs.` });
        else if (!venture) statements.unshift({ truth: "unknown", text: "Nothing is blocked because nothing is underway. Start with a goal." });
      }
      if (intent.lens === "flow" && model.payment) {
        statements.unshift({ truth: "fact", text: `Your $10 reached Bob in one transaction through ${model.payment.legs.map((l) => l.venue).join(" → ") || "a direct transfer"}.` });
      }
      if (intent.lens === "proof") {
        const sel = model.nodes.get(ctx.currentSelectionIds[0] ?? "");
        if (sel && sel.kind === "organization") statements.unshift({ truth: "fact", text: `${sel.title}'s claim is ${PROOF_WORD[sel.proof]}.` });
      }
      return { reload: false, patch: { currentLens: intent.lens }, result: result("focus", statements, [{ type: "suggest_lens", lens: intent.lens }], intent.lens === "flow" ? [] : [], model) };
    }

    case "focus_search": {
      const q = intent.query.toLowerCase();
      const match = [...model.nodes.values()].find((n) => n.title.toLowerCase().includes(q) || String(n.attributes.city ?? "").toLowerCase().includes(q));
      if (!match) return { reload: false, patch: {}, result: result("question", [{ truth: "unknown", text: `Nothing called "${intent.query}" is on record.` }], [], [], model) };
      return { reload: false, patch: { currentSelectionIds: [match.ref], currentLens: "space" }, result: result("focus", [{ truth: "fact", text: match.title }], [{ type: "focus", refs: [match.ref] }, { type: "open_context", ref: match.ref }], [], model) };
    }

    default:
      return {
        reload: false,
        patch: {},
        result: result(
          "question",
          [{ truth: "unknown", text: "I can't do that yet. Try a goal, a question about what you've selected, or a lens." }],
          [],
          venture ? [ACT.findThem, ACT.showFlow] : [ACT.build, ACT.showFlow],
          model,
        ),
      };
  }
}
