import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { listCapabilities } from "../../lib/capabilities/registry";
import {
  DEVELOPMENT_PACK, getPack, listPackPreviews, listPacks,
  previewPack, validatePack,
} from "../../lib/packs/registry";

describe("SOLVE reusable Packs", () => {
  it("exposes one declarative development Pack, not a hidden installer", () => {
    assert.equal(getPack("solve.development")?.version, "1.0.0");
    assert.equal(getPack("unknown"), null);
    assert.equal(listPacks().length, 1);
    assert.equal(DEVELOPMENT_PACK.privacy, "private_by_default");
    assert.equal(DEVELOPMENT_PACK.installation, "explicit_user_action");
    assert.equal(DEVELOPMENT_PACK.execution, "separate_approval");
    assert.doesNotThrow(() => validatePack(DEVELOPMENT_PACK));
    assert.equal(DEVELOPMENT_PACK.requirements.some(r => r.capabilityId === "github.coding.worker"), true);
  });

  it("can organize work without pretending to execute it", () => {
    const preview = listPackPreviews({})[0];
    assert.equal(preview.manifest.id, "solve.development");
    assert.equal(preview.readiness.organize, "ready");
    assert.equal(preview.readiness.execute, "needs_setup");
    assert.equal(preview.readiness.verify, "needs_setup");
    assert.equal(preview.fullyOperational, false);
    assert.equal(preview.requirements.find(r => r.capabilityId === "github.coding.worker")?.status, "disabled");
  });

  it("a configured token is not proof of a verified, authorized connection", () => {
    const preview = listPackPreviews({ GITHUB_TOKEN:"test-placeholder" })[0];
    assert.equal(preview.requirements.find(r => r.capabilityId === "github.repository.read")?.status,"configured_unverified");
    assert.equal(preview.readiness.verify,"needs_setup");
    assert.equal(preview.fullyOperational,false);
  });

  it("unknown capabilities remain explicitly unregistered rather than auto-installed", () => {
    const pack = { ...DEVELOPMENT_PACK, requirements: [
      ...DEVELOPMENT_PACK.requirements,
      { capabilityId:"future.spatial.editor", phase:"execute" as const, required:true, purpose:"External 3D editor" },
    ] };
    const preview = previewPack(pack, listCapabilities({}));
    assert.equal(preview.requirements.at(-1)?.status,"unregistered");
    assert.equal(preview.readiness.execute,"needs_setup");
  });

  it("rejects ambiguous capability and input declarations", () => {
    assert.throws(() => validatePack({ ...DEVELOPMENT_PACK, requirements:[
      ...DEVELOPMENT_PACK.requirements, DEVELOPMENT_PACK.requirements[0],
    ] }),/repeated/);
    assert.throws(() => validatePack({ ...DEVELOPMENT_PACK, id:"https://unsafe" }),/Invalid Pack/);
    assert.throws(() => validatePack({ ...DEVELOPMENT_PACK, inputs:[
      ...DEVELOPMENT_PACK.inputs, DEVELOPMENT_PACK.inputs[0],
    ] }),/repeated/);
  });
});
