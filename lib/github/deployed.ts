// The deployed branch's own history, without GitHub. When a room's repository is the one this app was
// deployed from, and GitHub can't be read (no token yet), the room still shows the trunk's recent
// commits and who made them, from the code that was deployed (next.config.ts records them at build).
// It has no builds and no open pull requests: those need GitHub.
import { buildersFrom, sameRepo, shapeCommits, type RepoRef, type RepoView, type RepoRead, type RepoReadFailure } from "./repo";

type Recorded = { sha?: unknown; at?: unknown; message?: unknown };
type DeploymentRecord = { repo?: string; ref?: string; at?: string; log?: string };

// Offline history is not a connection and must retain the live-read failure. A saved URL alone
// grants no access to this private deployment's history. Public reads still work without pairing.
export function withDeploymentSnapshot(read:RepoRead,paired:boolean,env?:DeploymentRecord):{read:RepoRead;paired:boolean;unread?:RepoReadFailure}{
  if(read.ok||!paired)return{read,paired};
  const view=deployedView(read.ref,env);
  return view?{read:{ok:true,view},paired,unread:read.reason}:{read,paired};
}

export function deployedView(ref: RepoRef, env: DeploymentRecord = {
  repo: process.env.SOLVE_DEPLOYED_REPO,
  ref: process.env.SOLVE_DEPLOYED_REF,
  at: process.env.SOLVE_DEPLOYED_AT,
  log: process.env.SOLVE_DEPLOYED_LOG,
}): RepoView | null {
  const [owner, repo] = (env.repo ?? "").split("/");
  const branch = env.ref ?? "";
  if (!owner || !repo || !branch) return null;
  if (!sameRepo({ owner, repo, trunk: null }, ref) || (ref.trunk && ref.trunk !== branch)) return null;
  let recorded: Recorded[] = [];
  try {
    const parsed = JSON.parse(env.log ?? "[]");
    if (Array.isArray(parsed)) recorded = parsed;
  } catch {
    return null;
  }
  const url = `https://github.com/${owner}/${repo}`;
  const commits = shapeCommits(recorded.map((c) => ({
    sha: typeof c.sha === "string" && /^[0-9a-f]{40}$/.test(c.sha) ? c.sha : null,
    html_url: `${url}/commit/${typeof c.sha === "string" ? c.sha : ""}`,
    commit: { message: c.message, committer: { date: c.at } },
  })));
  if (!commits.length) return null;
  const builders = buildersFrom([], commits);
  // Merged pull requests show in the history as merge commits; credit them to the branch's builder.
  for (const c of commits) {
    if (!c.message.startsWith("Merge pull request") || !c.builder) continue;
    const b = builders.find((x) => x.builder === c.builder);
    if (b) b.merged += 1;
    else builders.push({ builder: c.builder, open: [], merged: 1, commits: 0, build: null, at: c.at });
  }
  return {
    ref: { owner, repo, trunk: branch },
    url,
    trunk: branch,
    // Commit time establishes when code changed, not when this snapshot was recorded.
    readAt: env.at && !Number.isNaN(Date.parse(env.at)) ? env.at : "",
    trunkBuilds: [],
    commits,
    lanes: [],
    builders: builders.sort((a, b) => b.at.localeCompare(a.at)),
    source: "deployment",
  };
}
