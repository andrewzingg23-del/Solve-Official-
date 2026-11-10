"use server";

import { randomUUID } from "node:crypto";
import { getKernel } from "@/lib/kernel/server";
import { getUser } from "@/lib/supabase/server";
import { createCreativeArtifact, loadCreativeWorld } from "@/lib/world/creative";
import { createWorldInvitation } from "@/lib/world/invitations";

export type AddResult = { ok: true } | { ok: false; error: string };
export type InviteResult = { ok: true; path: string; expiresAt: string } | { ok: false; error: string };

const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/;

// Add one piece to a shared thing. The kernel decides whether this person may: the owner and anyone
// invited to build can; anyone else is refused, whatever this screen shows.
export async function addPiece(worldId: string, words: string): Promise<AddResult> {
  const text = typeof words === "string" ? words.trim() : "";
  if (!text) return { ok: false, error: "Write something to add." };
  if (text.length > 5000 || CONTROL.test(text)) return { ok: false, error: "That can't be added as written. Try shorter, plain text." };
  if (!(await getUser())) return { ok: false, error: "Your identity isn't ready yet. Reload and try again." };
  try {
    const kernel = await getKernel();
    const { world } = await loadCreativeWorld(kernel, worldId);
    const first = text.split("\n")[0].trim();
    await createCreativeArtifact(kernel, {
      scope: world.scope, worldEntityId: world.entityId, requestId: randomUUID(),
      title: first.length > 80 ? first.slice(0, 77).trimEnd() + "…" : first,
      body: text, position: { x: 0, y: 0 },
    });
    return { ok: true };
  } catch {
    return { ok: false, error: "It wasn't added. Your words are still here; try again." };
  }
}

// One invitation is one link for one person: it works once, for two days, and only for this thing.
// The token is shown once and never stored; only its hash reaches the kernel.
export async function makeInvite(worldId: string): Promise<InviteResult> {
  if (!(await getUser())) return { ok: false, error: "Your identity isn't ready yet. Reload and try again." };
  try {
    const { token, expiresAt } = await createWorldInvitation(await getKernel(), worldId, "editor", randomUUID());
    return { ok: true, path: `/world-invite/${token}`, expiresAt };
  } catch {
    return { ok: false, error: "The invite couldn't be made. Only the person who started this can invite people to it." };
  }
}
