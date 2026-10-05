import { createHash } from "node:crypto";
import type { RepoRef } from "./repo";

// The World id for one person's room on one repository, the same every time, so opening it twice
// opens the same World.
export function repoRoomId(actorId: string, ref: RepoRef): string {
  const h = createHash("sha256").update(`solve:repo-room:v1:${actorId}:${ref.owner.toLowerCase()}/${ref.repo.toLowerCase()}`).digest();
  h[6] = (h[6] & 0x0f) | 0x50; // version 5
  h[8] = (h[8] & 0x3f) | 0x80; // RFC 4122 variant
  const x = h.subarray(0, 16).toString("hex");
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20, 32)}`;
}

export const repoRoomTitle = (ref: RepoRef) => (/solve/i.test(ref.repo) ? "Build solve" : `Build ${ref.repo}`);
