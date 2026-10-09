"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getUser } from "@/lib/supabase/server";
import { getKernel } from "@/lib/kernel/server";
import { KernelError } from "@/lib/kernel/client";
import { cancelWorldInvitation, createWorldInvitation } from "@/lib/world/invitations";
import type { InvitationState } from "./invitation-panel";

export async function createInvitationAction(worldId: string, _previous: InvitationState, formData: FormData): Promise<InvitationState> {
  if (!(await getUser())) return { error: "Sign in to manage invitations." };
  const role = formData.get("role");
  if (role !== "editor" && role !== "viewer") return { error: "Choose a role." };
  try {
    const invitation = await createWorldInvitation(await getKernel(), worldId, role, randomUUID());
    revalidatePath(`/world/${worldId}`);
    return { path: `/world-invite/${invitation.token}`, invitationId: invitation.invitationId, expiresAt: invitation.expiresAt };
  } catch (error) {
    return { error: error instanceof KernelError && error.name === "forbidden" ? "Only the World owner can create invitations." : "Could not create an invitation. Try again." };
  }
}

export async function cancelInvitationAction(worldId: string, invitationId: string): Promise<{ error?: string }> {
  if (!(await getUser())) return { error: "Sign in to manage invitations." };
  try {
    await cancelWorldInvitation(await getKernel(), invitationId);
    revalidatePath(`/world/${worldId}`);
    return {};
  } catch { return { error: "Could not cancel this link. Accepted access is removed using the member list." }; }
}
