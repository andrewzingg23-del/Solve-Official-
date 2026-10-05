// Saving a passed build as proof: only a build GitHub reports as passed is saved, once, on the World's
// repository resource, as an artifact linking to the run. The GitHub view is built here; the kernel
// is the embedded one.
import assert from "node:assert/strict";
import { it } from "node:test";
import { kernelClient, KernelError } from "../../lib/kernel/client";
import { localSupabase } from "../../lib/kernel/local";
import { proofsIn } from "../../lib/bot/proof";
import { BUILD_PROOF_TYPE, BuildProofError, saveBuild } from "../../lib/github/build-proof";
import type { Build, RepoView } from "../../lib/github/repo";
import { createCreativeResourceEntry, createCreativeWorld } from "../../lib/world/creative";
import { createKernelDb, user } from "../kernel/harness";

const WORLD = "7a1d2c3b-4a59-4687-9a0b-1c2d3e4f5a6c";
const TRUNK = "claude/keen-cerf-tpd7io";
const build = (id: number, state: Build["state"]): Build => ({ id, number: id, branch: TRUNK, sha: `${id}`.repeat(40).slice(0, 40), title: "x", event: "push", state, url: `https://github.com/o/r/actions/runs/${id}`, at: "2026-10-05T07:00:00.000Z" });
const view: RepoView = {
  ref: { owner: "o", repo: "r", trunk: TRUNK }, url: "https://github.com/o/r", trunk: TRUNK, readAt: "2026-10-05T07:10:00.000Z",
  trunkBuilds: [build(9, "failed"), build(8, "passed")], commits: [], lanes: [], builders: [],
};

it("saves a build GitHub reports as passed, once, as a record linking to the run", async () => {
  const db = await createKernelDb();
  const ana = kernelClient(localSupabase(db, user("auth:build-ana")));
  await ana.register("Ana");
  const world = await createCreativeWorld(ana, { worldId: WORLD, title: "Build solve" });
  const repoId = await createCreativeResourceEntry(ana, { scope: world.scope, worldEntityId: world.entityId, requestId: "repo-1", entryType: "offer", category: "resource", title: "o/r", description: "The code", sourceUrl: `https://github.com/o/r/tree/${TRUNK}` });

  await assert.rejects(saveBuild(ana, { scope: world.scope, entityId: repoId, view, buildId: 9 }), BuildProofError, "a failed build is never saved");
  await assert.rejects(saveBuild(ana, { scope: world.scope, entityId: repoId, view, buildId: 404 }), BuildProofError, "nor one GitHub didn't report");

  const first = await saveBuild(ana, { scope: world.scope, entityId: repoId, view, buildId: 8 });
  const again = await saveBuild(ana, { scope: world.scope, entityId: repoId, view, buildId: 8 });
  assert.equal(again, first, "saving the same build again is one save");

  const saves = await proofsIn(ana, world.scope);
  assert.equal(saves.length, 1);
  assert.equal(saves[0].pieceId, repoId);
  assert.equal(saves[0].basis, "artifact", "a record, not anyone's word, and not claimed as seen by solve");
  assert.equal(saves[0].link, "https://github.com/o/r/actions/runs/8");
  assert.equal(saves[0].what, `Build 8 passed on ${TRUNK}`);
  assert.match(saves[0].proof, /read from GitHub by solve at 2026-10-05T07:10:00.000Z/);
  const [attached] = (await ana.readEvents(world.scope, { newestFirst: true, limit: 1 }));
  assert.equal(((attached.payload as { items: { media_type: string }[] }).items[0]).media_type, BUILD_PROOF_TYPE);

  // Someone with no access to the World can't save into it.
  const ben = kernelClient(localSupabase(db, user("auth:build-ben")));
  await ben.register("Ben");
  await assert.rejects(saveBuild(ben, { scope: world.scope, entityId: repoId, view, buildId: 8 }), (e: unknown) => e instanceof KernelError);
});
