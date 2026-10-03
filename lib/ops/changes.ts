// Change classes for SOV improving SOV. The class of a change comes from what it touches, never from
// what its proposer claims, and the rules that decide it (this file) are themselves Class D: no
// agent can lower the bar that governs its own work.
//
//   A  autonomous            tests, diagnostics, non-consequential polish
//   B  supervised autonomy   ordinary product capability; independent promotion policy
//   C  high consequence      authority, identity, privacy, payments, settlement, security;
//                            explicit authorized human approval before production
//   D  constitutional        kernel invariants, money constitution, governance, these guardrails;
//                            agents may research and propose, never enact
export type ChangeClass = "A" | "B" | "C" | "D";

const ORDER: ChangeClass[] = ["A", "B", "C", "D"];

type Rule = { cls: ChangeClass; why: string; path?: RegExp; capability?: RegExp };

// Most severe first; the first matching rule classifies a path or capability.
const RULES: Rule[] = [
  { cls: "D", why: "kernel schema and invariants", path: /^supabase\/migrations\// },
  { cls: "D", why: "founder directives and canon", path: /^(DIRECTIVES|VISION-CANON|BUILD-BOOK)\.md$/ },
  { cls: "D", why: "money constitution", path: /^docs\/MONETARY-CONSTITUTION\.md$/ },
  { cls: "D", why: "domain contracts and security invariants", path: /^(DOMAIN-CONTRACTS|SECURITY-INVARIANTS)\.md$/ },
  { cls: "D", why: "the guardrails of autonomous creation", path: /^lib\/ops\/changes\.ts$/ },
  { cls: "D", why: "the promotion gate (CI)", path: /^\.github\// },
  { cls: "D", why: "root authority and governance", capability: /^(\*|kernel\.policy\.|kernel\.grant\.|kernel\.root)/ },
  { cls: "C", why: "kernel access and authority", path: /^lib\/kernel\// },
  { cls: "C", why: "money, payments and settlement", path: /^lib\/(money|router|chain)\// },
  { cls: "C", why: "identity and sessions", path: /^(lib\/supabase\/|proxy\.ts$|app\/(auth|login|account)\/)/ },
  { cls: "C", why: "operational authority", path: /^lib\/ops\// },
  { cls: "C", why: "consequential capability", capability: /^(payment|settlement|kernel\.ledger|kernel\.payment|kernel\.settlement|identity|wallet)\b/ },
  { cls: "A", why: "tests", path: /^tests\// },
  { cls: "A", why: "diagnostics", path: /^scripts\/diagnostics\// },
  { cls: "B", why: "product code", path: /^(app|lib|scripts|public)\// },
];

export type Classification = { cls: ChangeClass; reasons: string[] };

export function classifyChange(affected: { paths: string[]; capabilities?: string[] }): Classification {
  const items = [
    ...affected.paths.map((p) => ({ label: p, match: (r: Rule) => r.path?.test(p) ?? false })),
    ...(affected.capabilities ?? []).map((c) => ({ label: c, match: (r: Rule) => r.capability?.test(c) ?? false })),
  ];
  if (items.length === 0) throw new Error("a change must name what it touches");
  let cls: ChangeClass = "A";
  const reasons: string[] = [];
  for (const item of items) {
    // Anything no rule names is ordinary product work, never autonomous by default.
    const rule = RULES.find((r) => item.match(r)) ?? ({ cls: "B", why: "unclassified" } as Rule);
    reasons.push(`${item.label}: ${rule.cls} (${rule.why})`);
    if (ORDER.indexOf(rule.cls) > ORDER.indexOf(cls)) cls = rule.cls;
  }
  return { cls, reasons };
}

export const PROMOTION: Record<ChangeClass, string> = {
  A: "autonomous: independent review, tests and CI, then promotion",
  B: "supervised: build, test and preview autonomously; promotion by an independent policy",
  C: "explicit authorized human approval before production",
  D: "agents may research, simulate and propose; never enact",
};

export type BuildProposal = {
  problem: string;
  cause: string;
  // Refs to the events and tasks that show the problem is real: why was this built?
  evidence: string[];
  expected_outcome: string;
  affected: { paths: string[]; capabilities: string[] };
  risk: "low" | "medium" | "high" | "critical";
  // Compose before extend before create.
  reuse: { decision: "compose" | "extend" | "create"; existing: string[] };
  rollback: string;
  status: "proposed";
  change_class: ChangeClass;
  class_reasons: string[];
  promotion: string;
};

export function proposeBuild(input: Omit<BuildProposal, "status" | "change_class" | "class_reasons" | "promotion">): BuildProposal {
  if (input.evidence.length === 0) throw new Error("a build proposal needs causal evidence");
  if (input.reuse.decision === "create" && input.reuse.existing.length > 0) {
    throw new Error("existing primitives were found: compose or extend them before creating");
  }
  if (!input.rollback.trim()) throw new Error("a build proposal needs a rollback path");
  const { cls, reasons } = classifyChange(input.affected);
  return { ...input, status: "proposed", change_class: cls, class_reasons: reasons, promotion: PROMOTION[cls] };
}
