import { listCapabilities } from "@/lib/capabilities/registry";
import type { CapabilityDescriptor, CapabilityStatus } from "@/lib/capabilities/contracts";

/**
 * A SOLVE Pack is a versioned recipe, not executable code or a source of
 * authority. Activation, OAuth grants, credential handling, task creation,
 * execution and billing remain separate authenticated workflows.
 */
export type PackPhase = "organize" | "execute" | "verify";
export type PackRequirement = {
  capabilityId: string;
  phase: PackPhase;
  required: boolean;
  purpose: string;
};
export type PackManifest = {
  schema: "solve.pack.v1";
  id: string;
  version: string;
  title: string;
  summary: string;
  audience: string[];
  inputs: { key: string; label: string; required: boolean }[];
  outcomes: string[];
  requirements: PackRequirement[];
  privacy: "private_by_default";
  installation: "explicit_user_action";
  execution: "separate_approval";
};
export type RequirementResolution = PackRequirement & {
  capabilityLabel: string;
  status: CapabilityStatus | "unregistered";
};
export type PackPreview = {
  manifest: PackManifest;
  requirements: RequirementResolution[];
  readiness: Record<PackPhase, "ready" | "needs_setup">;
  fullyOperational: boolean;
};

const ID = /^[a-z][a-z0-9._:-]{1,79}$/;
const VERSION = /^\d+\.\d+\.\d+$/;

export function validatePack(manifest: PackManifest): void {
  if (manifest.schema !== "solve.pack.v1" || !ID.test(manifest.id) || !VERSION.test(manifest.version) ||
    !manifest.title.trim() || !manifest.summary.trim() ||
    manifest.privacy !== "private_by_default" ||
    manifest.installation !== "explicit_user_action" ||
    manifest.execution !== "separate_approval") throw new Error("Invalid Pack manifest");
  const seen = new Set<string>();
  if (!manifest.requirements.length || !manifest.outcomes.length) throw new Error("Pack needs requirements and outcomes");
  for (const item of manifest.requirements) {
    const key = `${item.phase}:${item.capabilityId}`;
    if (!ID.test(item.capabilityId) || !["organize","execute","verify"].includes(item.phase) ||
      !item.purpose.trim() || seen.has(key)) throw new Error("Invalid or repeated Pack capability");
    seen.add(key);
  }
  const inputs = new Set<string>();
  for (const input of manifest.inputs) {
    if (!ID.test(input.key) || !input.label.trim() || inputs.has(input.key)) throw new Error("Invalid or repeated Pack input");
    inputs.add(input.key);
  }
}

/**
 * First real Pack: the building workflow SOLVE uses on itself.
 * The existing kernel stores tasks and approvals. No worker is claimed live.
 * Additional domain Packs should reuse this format only after a real use case
 * passes its acceptance test.
 */
export const DEVELOPMENT_PACK: PackManifest = {
  schema:"solve.pack.v1",
  id:"solve.development",
  version:"1.0.0",
  title:"Build software together",
  summary:"Turn an intention into a World task, approved implementation, reviewable code and verified results.",
  audience:["software builders","teams","SOLVE internal development"],
  inputs:[
    { key:"goal", label:"What should be built?", required:true },
    { key:"repository", label:"Approved code repository", required:false },
  ],
  outcomes:[
    "A task saved with World context and an accountable author",
    "Human authorization before external code execution",
    "A reviewable change with source-backed test results",
  ],
  requirements:[
    { capabilityId:"solve.world.conversation", phase:"organize", required:true, purpose:"Collaborate on the goal in a persistent World" },
    { capabilityId:"solve.world.task", phase:"organize", required:true, purpose:"Create and approve kernel-native work" },
    { capabilityId:"github.repository.read", phase:"verify", required:true, purpose:"Read repository evidence from authorized GitHub access" },
    { capabilityId:"github.coding.worker", phase:"execute", required:true, purpose:"Run an approved coding agent with explicit authorization" },
  ],
  privacy:"private_by_default",
  installation:"explicit_user_action",
  execution:"separate_approval",
};

const SYSTEM_PACKS: readonly PackManifest[] = [DEVELOPMENT_PACK];

export function getPack(id: string): PackManifest | null {
  return SYSTEM_PACKS.find(pack => pack.id === id) ?? null;
}
export function listPacks(): PackManifest[] {
  return [...SYSTEM_PACKS];
}

/**
 * Read-only dependency resolution. Configured credentials are NOT equivalent
 * to a tested, authorized connection. Missing capabilities are visible and
 * never silently replaced with arbitrary remote tools.
 */
export function previewPack(pack: PackManifest, capabilities: readonly CapabilityDescriptor[]): PackPreview {
  validatePack(pack);
  const catalog = new Map(capabilities.map(item => [item.id, item]));
  const requirements: RequirementResolution[] = pack.requirements.map(item => {
    const capability = catalog.get(item.capabilityId);
    return { ...item, capabilityLabel: capability?.label ?? item.capabilityId,
      status: capability?.status ?? "unregistered" };
  });
  const phases: PackPhase[] = ["organize","execute","verify"];
  const readiness = Object.fromEntries(phases.map(phase => [
    phase,
    requirements.some(item => item.phase === phase && item.required && item.status !== "available") ? "needs_setup" : "ready",
  ])) as Record<PackPhase, "ready" | "needs_setup">;
  return { manifest:pack, requirements, readiness,
    fullyOperational:phases.every(phase => readiness[phase] === "ready") };
}
export function listPackPreviews(env: Record<string,string|undefined> = process.env): PackPreview[] {
  const capabilities = listCapabilities(env);
  return listPacks().map(pack => previewPack(pack, capabilities));
}
