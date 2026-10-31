// Turn a RepoView (lib/github/repo.ts) into a plain-English, source-backed answer
// for the Development Room: "What is Claude working on?" and "What's the dev status?".
//
// One Solve directive (2026-10-31): make SOLVE build SOLVE. The Development Room
// must answer from connected evidence — real GitHub commits, PRs and CI — and must
// NEVER imply this is live terminal activity. So every answer carries its source
// and read time, and says plainly that it is GitHub/CI evidence, not a live agent feed.
import type { BuilderSummary, Pull, RepoView } from "./repo";

const PROVENANCE_GITHUB = "GitHub/CI evidence (not live terminal activity)";
const PROVENANCE_DEPLOY = "the deployed build's own commit log (no live GitHub — PRs and CI not visible)";

function ago(iso: string, now: number): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "at an unknown time";
  const mins = Math.max(0, Math.round((now - t) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

function pullLine(p: Pull): string {
  const state = p.state === "open" ? "open" : p.state === "draft" ? "draft" : p.state;
  return `#${p.number} ${p.title} (${state})`;
}

function builderLine(b: BuilderSummary, now: number): string {
  const parts: string[] = [];
  if (b.open.length) parts.push(`${b.open.length} open PR${b.open.length > 1 ? "s" : ""}: ${b.open.map(pullLine).join("; ")}`);
  if (b.build) parts.push(`latest CI ${b.build.state}`);
  if (b.merged) parts.push(`${b.merged} merged`);
  if (b.commits) parts.push(`${b.commits} recent commit${b.commits > 1 ? "s" : ""}`);
  const body = parts.length ? parts.join(" · ") : "no open work right now";
  return `${b.builder}: ${body} — last active ${ago(b.at, now)}`;
}

/** The source + read-time line that precedes every answer. */
export function provenanceLine(view: RepoView): string {
  const src = view.source === "deployment" ? PROVENANCE_DEPLOY : PROVENANCE_GITHUB;
  return `From ${view.ref.owner}/${view.ref.repo}, read ${ago(view.readAt, Date.parse(view.readAt) || Date.now())} · ${src}.`;
}

function findBuilder(view: RepoView, name: string): BuilderSummary | undefined {
  const n = name.trim().toLowerCase();
  return view.builders.find((b) => b.builder.toLowerCase() === n);
}

/** Answer "what is <builder> working on?" strictly from the RepoView. */
export function whatIsWorkingOn(view: RepoView, builder: string, now: number = Date.now()): string {
  const head = provenanceLine(view);
  if (view.source === "deployment") {
    return `${head}\nI can see the trunk's recent commits, but not per-person PRs or CI until a GitHub token is connected, so I can't say what ${builder} specifically has open right now.`;
  }
  const b = findBuilder(view, builder);
  if (!b) {
    const names = view.builders.map((x) => x.builder).join(", ") || "no one";
    return `${head}\nNo GitHub activity from ${builder} on this repo. Active right now: ${names}.`;
  }
  return `${head}\n${builderLine(b, now)}`;
}

/** The whole Development Room status: every active builder, plus the trunk's CI. */
export function developmentStatus(view: RepoView, now: number = Date.now()): string {
  const head = provenanceLine(view);
  const lines: string[] = [];
  if (view.builders.length) {
    for (const b of view.builders) lines.push(`• ${builderLine(b, now)}`);
  } else {
    lines.push("• No builder activity visible.");
  }
  const trunkBuild = view.trunkBuilds[0];
  if (trunkBuild) lines.push(`Trunk (${view.trunk}): latest CI ${trunkBuild.state} — ${ago(trunkBuild.at, now)}.`);
  return `${head}\n${lines.join("\n")}`;
}

/**
 * The Development Room's answer for a chat turn, or null to let normal chat handle it.
 * Deterministic and source-backed — no LLM, so it works even without a chat provider key.
 * Returns null when the message isn't a dev-status question, or when no repo view is available
 * (the caller then falls through to the normal bot).
 */
export function developmentRoomReply(message: string, view: RepoView | null, now: number = Date.now()): string | null {
  const q = asksDevelopmentStatus(message);
  if (!q.match || !view) return null;
  return q.builder ? whatIsWorkingOn(view, q.builder, now) : developmentStatus(view, now);
}

/** Light intent match for the chat path: does this message ask about dev status / who's working on what. */
export function asksDevelopmentStatus(message: string): { match: boolean; builder?: string } {
  const m = message.toLowerCase();
  const about = /(working on|what('?s| is| are)\s+\w+\s+(doing|building|working)|dev(elopment)? (status|room)|what('?s| is) (claude|codex|the (ai|team|agents?))\b|ci status|open prs?|pull requests?)/.test(m);
  if (!about) return { match: false };
  const who = m.match(/\b(claude|codex|manus|doris|chatgpt|gpt)\b/);
  return { match: true, builder: who ? who[1] : undefined };
}
