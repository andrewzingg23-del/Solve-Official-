// Saving a passed build as proof (founder-first slice 5; the founder's problem 6, "never report green
// until CI"). The server reads the build from GitHub itself and saves it only if GitHub reports it
// passed; nothing in the request is taken on anyone's word. The save is an artifact: the run's link
// and a fingerprint of what GitHub said, attached to the World's repository resource (or the World
// itself). It isn't "seen by solve" in the kernel's sense, which needs a service actor; that comes later.
import { createHash } from "node:crypto";
import type { Kernel, KernelEvent } from "@/lib/kernel/client";
import { history } from "@/lib/bot/proof";
import type { Build, RepoView } from "./repo";

export const BUILD_PROOF_TYPE = "application/vnd.sov.ci-run+json";

export class BuildProofError extends Error {}

const ENTITY_EVENTS = new Set(["kernel.entity.created", "kernel.entity.updated"]);

export function buildFacts(view: RepoView, build: Build) {
  return {
    repo: `${view.ref.owner}/${view.ref.repo}`,
    branch: build.branch,
    run_id: build.id,
    run_number: build.number,
    sha: build.sha,
    state: build.state,
    started_at: build.at,
    read_at: view.readAt,
    url: build.url,
  };
}

export function buildProofText(view: RepoView, build: Build) {
  return `Build ${build.number} passed on ${build.branch}\nProof: GitHub Actions run ${build.number} for ${build.sha.slice(0, 7)}, read from GitHub by solve at ${view.readAt}`;
}

// Attaches the build to the latest version of an entity in the World. A retry saves once.
export async function saveBuild(kernel: Kernel, input: { scope: string; entityId: string; view: RepoView; buildId: number }): Promise<string> {
  const build = input.view.trunkBuilds.find((b) => b.id === input.buildId) ?? input.view.lanes.map((l) => l.build).find((b) => b?.id === input.buildId);
  if (!build || build.state !== "passed") throw new BuildProofError("GitHub doesn't report that build as passed");
  let latest: KernelEvent | null = null;
  for await (const e of history(kernel, input.scope)) {
    if (ENTITY_EVENTS.has(e.type) && (e.payload as { entity_id?: unknown }).entity_id === input.entityId) latest = e;
  }
  if (!latest) throw new BuildProofError("there is nothing in this World to save it on");
  const facts = buildFacts(input.view, build);
  const hash = createHash("sha256").update(JSON.stringify(facts)).digest("hex");
  return kernel.attachEvidence(
    latest.id,
    { basis: "artifact", content_hash: `sha256:${hash}`, media_type: BUILD_PROOF_TYPE, uri: build.url, description: buildProofText(input.view, build) },
    `build:${input.scope}:${build.id}`.slice(0, 200),
  );
}
