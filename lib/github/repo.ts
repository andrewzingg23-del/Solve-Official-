// The repo as a source for a Build Room (founder-first slice 5). solve reads a GitHub repository,
// read-only, and shows what is actually happening in it: the builds on the trunk, each builder's
// branches with their pull requests, and whether their latest build passed. What it shows is read from
// GitHub at the time stated, never a builder's word.
//
// A private repository is read with a token, and only where the deployment pairs it (GITHUB_ROOMS):
// in one World, or for one signed-in person in any of their Worlds that links that same repository.
// Otherwise anyone could link the private repo into a World of their own and read it through solve.
// A public repository a World's resource map links to is read without the token.

export type RepoRef = { owner: string; repo: string; trunk: string | null };

export type Builder = string; // a builder's name, from its branches: Claude, Codex, Manus, Doris…
export type BuildState = "running" | "passed" | "failed" | "cancelled" | "other";
export type Build = { id: number; number: number; branch: string; sha: string; title: string; event: string; state: BuildState; url: string; at: string };
export type PullState = "open" | "draft" | "merged" | "closed";
export type Pull = { number: number; title: string; branch: string; base: string; state: PullState; url: string; at: string };
export type Commit = { sha: string; message: string; at: string; url: string; builder: Builder | null };
export type Lane = { branch: string; builder: Builder | null; pulls: Pull[]; build: Build | null; at: string };

export type BuilderSummary = { builder: Builder; open: Pull[]; merged: number; commits: number; build: Build | null; at: string };

export type RepoView = {
  ref: RepoRef;
  url: string;
  trunk: string;
  readAt: string;
  trunkBuilds: Build[]; // latest first
  commits: Commit[]; // on the trunk, latest first
  lanes: Lane[]; // branches with something happening, latest first
  builders: BuilderSummary[]; // who has been working, latest first
};

export type RepoReadFailure = "not_connected" | "not_found" | "rate_limited" | "unavailable";
export type RepoRead = { ok: true; view: RepoView } | { ok: false; reason: RepoReadFailure; ref: RepoRef };

export const REPO_LIMITS = { builds: 40, pulls: 30, commits: 20, lanes: 8, laneDays: 7, title: 160 } as const;

const NAME = /^[A-Za-z0-9_.-]{1,100}$/;
const BRANCH = /^[A-Za-z0-9._/-]{1,200}$/;

// https://github.com/<owner>/<repo>[.git][/tree/<branch>]. Anything else is not a repository link.
export function parseRepoUrl(raw: string): RepoRef | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || (url.hostname !== "github.com" && url.hostname !== "www.github.com")) return null;
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/, "");
  if (!NAME.test(owner) || !NAME.test(repo)) return null;
  if (parts.length === 2) return { owner, repo, trunk: null };
  if (parts[2] !== "tree" || parts.length < 4) return null;
  const trunk = decodeURIComponent(parts.slice(3).join("/"));
  return BRANCH.test(trunk) ? { owner, repo, trunk } : null;
}

// GITHUB_ROOMS: "<key>=<owner>/<repo>[@<trunk>]", several separated by commas or semicolons. The key
// is a World id, or the email a person signs in with.
export function roomRepos(value: string | undefined): Map<string, RepoRef> {
  const rooms = new Map<string, RepoRef>();
  for (const entry of (value ?? "").split(/[;,]/)) {
    const m = /^\s*([0-9a-f-]{36}|[^\s=@]+@[^\s=@]+\.[^\s=@]+)\s*=\s*([^/\s@]+)\/([^/\s@]+)(?:@(\S+))?\s*$/i.exec(entry);
    if (!m || !NAME.test(m[2]) || !NAME.test(m[3]) || (m[4] && !BRANCH.test(m[4]))) continue;
    rooms.set(m[1].toLowerCase(), { owner: m[2], repo: m[3], trunk: m[4] ?? null });
  }
  return rooms;
}

export const repoUrl = (ref: RepoRef) => `https://github.com/${ref.owner}/${ref.repo}`;
export const sameRepo = (a: RepoRef, b: RepoRef) => a.owner.toLowerCase() === b.owner.toLowerCase() && a.repo.toLowerCase() === b.repo.toLowerCase();

// Which repository a World's room shows, and whether the token may be used for it: a pairing for the
// World wins; then the World's first GitHub link, with the token only if the viewer is paired with
// that same repository.
export function repoForWorld(input: { worldId: string; viewerEmail?: string | null; links: string[]; rooms: Map<string, RepoRef> }): { ref: RepoRef; paired: boolean } | null {
  const forWorld = input.rooms.get(input.worldId.toLowerCase());
  if (forWorld) return { ref: forWorld, paired: true };
  const ref = input.links.map(parseRepoUrl).find((r): r is RepoRef => r !== null);
  if (!ref) return null;
  const forViewer = input.viewerEmail ? input.rooms.get(input.viewerEmail.trim().toLowerCase()) : undefined;
  if (forViewer && sameRepo(ref, forViewer)) return { ref: { ...ref, trunk: ref.trunk ?? forViewer.trunk }, paired: true };
  return { ref, paired: false };
}

// Each builder works on branches named for it (claude/…, codex/…, manus/…, doris/…). The pull requests
// all come from the founder's account, so the branch is what says who did the work. Conventional
// prefixes (feature/, fix/…) name no one.
const KNOWN: Record<string, Builder> = { claude: "Claude", codex: "Codex", manus: "Manus", chatgpt: "ChatGPT", doris: "Doris" };
const NOT_A_BUILDER = new Set(["feature", "feat", "fix", "bugfix", "hotfix", "chore", "release", "docs", "refactor", "test", "dependabot", "renovate", "main", "master", "dev", "develop", "staging"]);

export function builderOf(branch: string): Builder | null {
  const parts = branch.split("/");
  if (parts.length < 2) return null;
  const prefix = parts[0].toLowerCase();
  if (KNOWN[prefix]) return KNOWN[prefix];
  if (NOT_A_BUILDER.has(prefix) || !/^[a-z][a-z0-9-]{1,30}$/.test(prefix)) return null;
  return prefix[0].toUpperCase() + prefix.slice(1);
}

const text = (v: unknown, max: number = REPO_LIMITS.title) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max) : "");
const time = (v: unknown) => (typeof v === "string" && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null);
const githubUrl = (v: unknown) => (typeof v === "string" && v.startsWith("https://github.com/") ? v : null);

export function buildState(status: unknown, conclusion: unknown): BuildState {
  if (status !== "completed") return status === "queued" || status === "in_progress" || status === "waiting" || status === "pending" || status === "requested" ? "running" : "other";
  if (conclusion === "success") return "passed";
  if (conclusion === "failure" || conclusion === "timed_out" || conclusion === "startup_failure") return "failed";
  if (conclusion === "cancelled") return "cancelled";
  return "other";
}

export function shapeBuilds(json: unknown): Build[] {
  const runs = (json as { workflow_runs?: unknown })?.workflow_runs;
  if (!Array.isArray(runs)) return [];
  const builds: Build[] = [];
  for (const r of runs as Record<string, unknown>[]) {
    const url = githubUrl(r.html_url);
    const at = time(r.created_at);
    if (typeof r.id !== "number" || typeof r.head_branch !== "string" || !url || !at) continue;
    builds.push({
      id: r.id,
      number: typeof r.run_number === "number" ? r.run_number : 0,
      branch: r.head_branch,
      sha: typeof r.head_sha === "string" ? r.head_sha.slice(0, 40) : "",
      title: text(r.display_title) || text(r.name),
      event: text(r.event, 40),
      state: buildState(r.status, r.conclusion),
      url,
      at,
    });
  }
  return builds.sort((a, b) => b.at.localeCompare(a.at));
}

export function shapePulls(json: unknown): Pull[] {
  if (!Array.isArray(json)) return [];
  const pulls: Pull[] = [];
  for (const p of json as Record<string, unknown>[]) {
    const head = (p.head as { ref?: unknown } | undefined)?.ref;
    const base = (p.base as { ref?: unknown } | undefined)?.ref;
    const url = githubUrl(p.html_url);
    const at = time(p.updated_at);
    if (typeof p.number !== "number" || typeof head !== "string" || typeof base !== "string" || !url || !at) continue;
    const state: PullState = p.merged_at ? "merged" : p.state === "open" ? (p.draft ? "draft" : "open") : "closed";
    pulls.push({ number: p.number, title: text(p.title), branch: head, base, state, url, at });
  }
  return pulls.sort((a, b) => b.at.localeCompare(a.at));
}

export function shapeCommits(json: unknown): Commit[] {
  if (!Array.isArray(json)) return [];
  const commits: Commit[] = [];
  for (const c of json as Record<string, unknown>[]) {
    const commit = c.commit as { message?: unknown; committer?: { date?: unknown } } | undefined;
    const url = githubUrl(c.html_url);
    const at = time(commit?.committer?.date);
    if (typeof c.sha !== "string" || !url || !at) continue;
    const message = typeof commit?.message === "string" ? commit.message : "";
    commits.push({ sha: c.sha.slice(0, 40), message: text(message.split("\n")[0]), at, url, builder: builderOfCommit(message) });
  }
  return commits;
}

// A commit on the trunk names its builder in a co-author line, or by the branch it merged.
export function builderOfCommit(message: string): Builder | null {
  const merged = /^Merge pull request #\d+ from [^/\s]+\/(\S+)/.exec(message);
  if (merged) return builderOf(merged[1]);
  const coauthor = /^Co-Authored-By:\s*([A-Za-z][A-Za-z0-9-]{1,30})\b/im.exec(message);
  return coauthor ? (KNOWN[coauthor[1].toLowerCase()] ?? coauthor[1]) : null;
}

// Each builder's part, from the lanes and the trunk: open pull requests, what merged, their commits on
// the trunk, and their latest build.
export function buildersFrom(lanes: Lane[], commits: Commit[], trunkBuilds: Build[] = []): BuilderSummary[] {
  const trunkBuild = new Map<string, Build>();
  for (const b of trunkBuilds) if (!trunkBuild.has(b.sha) || b.at > trunkBuild.get(b.sha)!.at) trunkBuild.set(b.sha, b);
  const by = new Map<Builder, BuilderSummary>();
  const of = (builder: Builder) => {
    let b = by.get(builder);
    if (!b) by.set(builder, (b = { builder, open: [], merged: 0, commits: 0, build: null, at: "" }));
    return b;
  };
  for (const lane of lanes) {
    if (!lane.builder) continue;
    const b = of(lane.builder);
    b.open.push(...lane.pulls.filter((p) => p.state === "open" || p.state === "draft"));
    b.merged += lane.pulls.filter((p) => p.state === "merged").length;
    if (lane.build && (!b.build || lane.build.at > b.build.at)) b.build = lane.build;
    if (lane.at > b.at) b.at = lane.at;
  }
  for (const c of commits) {
    if (!c.builder || c.message.startsWith("Merge pull request")) continue;
    const b = of(c.builder);
    b.commits += 1;
    if (c.at > b.at) b.at = c.at;
    // A builder working on the trunk is built there: its latest commit's build is its build.
    const built = trunkBuild.get(c.sha);
    if (built && (!b.build || built.at > b.build.at)) b.build = built;
  }
  return [...by.values()].sort((a, b) => b.at.localeCompare(a.at));
}

// A branch still in flight: an open pull request, or recent builds with no pull request yet. A branch
// whose pull requests all merged or closed has landed; it counts toward its builder, not here.
export const inFlight = (lane: Lane) => lane.pulls.some((p) => p.state === "open" || p.state === "draft") || lane.pulls.length === 0;

// The branches with something happening: an open pull request, or a build or pull request in the
// last few days. The trunk is shown on its own.
export function lanesFrom(pulls: Pull[], builds: Build[], trunk: string, now = new Date(), limit: number = REPO_LIMITS.lanes): Lane[] {
  const since = now.getTime() - REPO_LIMITS.laneDays * 86_400_000;
  const lanes = new Map<string, Lane>();
  const lane = (branch: string) => {
    let l = lanes.get(branch);
    if (!l) lanes.set(branch, (l = { branch, builder: builderOf(branch), pulls: [], build: null, at: "" }));
    return l;
  };
  for (const p of pulls) {
    if (p.branch === trunk) continue;
    if (p.state !== "open" && p.state !== "draft" && Date.parse(p.at) < since) continue;
    const l = lane(p.branch);
    l.pulls.push(p);
    if (p.at > l.at) l.at = p.at;
  }
  for (const b of builds) {
    if (b.branch === trunk) continue;
    if (!lanes.has(b.branch) && Date.parse(b.at) < since) continue;
    const l = lane(b.branch);
    if (!l.build || b.at > l.build.at) l.build = b;
    if (b.at > l.at) l.at = b.at;
  }
  return [...lanes.values()].sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

type Fetch = (url: string, init: RequestInit) => Promise<Response>;

// Reads the repository. Returns why not, rather than throwing, so a room still opens without GitHub.
export async function readRepo(ref: RepoRef, opts: { token?: string | null; fetch?: Fetch; now?: Date } = {}): Promise<RepoRead> {
  const get = opts.fetch ?? fetch;
  const now = opts.now ?? new Date();
  const headers: Record<string, string> = { accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28", "user-agent": "solve-build-room" };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  const base = `https://api.github.com/repos/${encodeURIComponent(ref.owner)}/${encodeURIComponent(ref.repo)}`;
  const call = async (path: string) => {
    const res = await get(`${base}${path}`, { headers, cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (res.ok) return res.json() as Promise<unknown>;
    if (res.status === 404 || res.status === 401) throw new RepoReadError(opts.token ? "not_found" : "not_connected");
    if (res.status === 403 || res.status === 429) throw new RepoReadError("rate_limited");
    throw new RepoReadError("unavailable");
  };
  try {
    const info = (await call("")) as { default_branch?: unknown };
    const trunk = ref.trunk ?? (typeof info.default_branch === "string" ? info.default_branch : "main");
    const [runs, prs, log] = await Promise.all([
      call(`/actions/runs?per_page=${REPO_LIMITS.builds}`),
      call(`/pulls?state=all&sort=updated&direction=desc&per_page=${REPO_LIMITS.pulls}`),
      call(`/commits?sha=${encodeURIComponent(trunk)}&per_page=${REPO_LIMITS.commits}`),
    ]);
    const builds = shapeBuilds(runs);
    const pulls = shapePulls(prs);
    const commits = shapeCommits(log);
    const lanes = lanesFrom(pulls, builds, trunk, now, Infinity);
    return {
      ok: true,
      view: {
        ref: { ...ref, trunk },
        url: repoUrl(ref),
        trunk,
        readAt: now.toISOString(),
        trunkBuilds: builds.filter((b) => b.branch === trunk),
        commits,
        lanes: lanes.filter(inFlight).slice(0, REPO_LIMITS.lanes),
        builders: buildersFrom(lanes, commits, builds.filter((b) => b.branch === trunk)),
      },
    };
  } catch (error) {
    return { ok: false, reason: error instanceof RepoReadError ? error.reason : "unavailable", ref };
  }
}

class RepoReadError extends Error {
  constructor(readonly reason: RepoReadFailure) {
    super(reason);
  }
}
