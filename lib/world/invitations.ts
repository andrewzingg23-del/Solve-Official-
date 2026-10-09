import { createHash, randomBytes } from "node:crypto";
import { KernelError, type Kernel } from "../kernel/client";
import type { WorldAccessRole } from "./collaboration";

function tokenHash(token: string): string {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new KernelError("invalid", "Invalid invitation link", "KA003");
  return createHash("sha256").update(token).digest("hex");
}

export async function createWorldInvitation(kernel: Kernel, worldId: string, role: WorldAccessRole, requestId: string) {
  const token = randomBytes(32).toString("hex");
  const result = await kernel.createWorldInvitation({ worldId, tokenHash: tokenHash(token), role, requestId });
  return { token, invitationId: result.invitation_id, expiresAt: new Date(result.expires_at).toISOString() };
}

export function acceptWorldInvitation(kernel: Kernel, token: string): Promise<string> {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new KernelError("invalid", "Invalid invitation link", "KA003");
  return kernel.acceptWorldInvitation(token);
}

export function cancelWorldInvitation(kernel: Kernel, invitationId: string): Promise<void> {
  return kernel.cancelWorldInvitation(invitationId);
}
