"use server";

import { createHash, randomUUID } from "node:crypto";
import { getKernel } from "@/lib/kernel/server";
import { createClient as createSupabase, getUser } from "@/lib/supabase/server";
import { PHOTO_BUCKET, checkPhoto, isPhotoOf, photoProblem } from "@/lib/product/photo";
import { createCreativeArtifact, loadCreativeWorld } from "@/lib/world/creative";
import { createWorldInvitation } from "@/lib/world/invitations";
import { readWorldMembers } from "@/lib/world/collaboration";
import { cleanSelection, setPublished } from "@/lib/product/page";
import { TOOLS, cleanLink } from "@/lib/product/paths";

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

export type PhotoResult = { ok: true } | { ok: false; error: string };

// Record a photo the browser has just stored. The server never trusts the browser about it: it
// reads the stored bytes back as this person (so storage asks the kernel whether they may), checks
// they are a clean photo with no hidden location, and records their SHA-256 on the piece. The
// kernel then decides whether this person may add to the thing at all.
export async function recordPhoto(worldId: string, name: string, caption: string): Promise<PhotoResult> {
  const words = typeof caption === "string" ? caption.trim() : "";
  if (words.length > 500 || CONTROL.test(words)) return { ok: false, error: "That caption can't be added as written. Try shorter, plain text." };
  if (!isPhotoOf(name, String(worldId))) return { ok: false, error: "That photo can't be added here." };
  if (!(await getUser())) return { ok: false, error: "Your identity isn't ready yet. Reload and try again." };
  try {
    const supabase = await createSupabase();
    const { data, error } = await supabase.storage.from(PHOTO_BUCKET).download(name);
    if (error || !data) return { ok: false, error: "The photo didn't arrive. Try adding it again." };
    const bytes = new Uint8Array(await data.arrayBuffer());
    const check = checkPhoto(bytes);
    if (!check.ok) return { ok: false, error: photoProblem(check.reason) };
    const kernel = await getKernel();
    const { world } = await loadCreativeWorld(kernel, worldId);
    await kernel.upsertEntity({
      kind: "document",
      scope: world.scope,
      title: "Photo",
      summary: words.slice(0, 240),
      attributes: {
        documentType: "photo", worldId: world.worldId, caption: words,
        file: { bucket: PHOTO_BUCKET, name, type: check.type, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") },
      },
      visibility: "members",
      idempotencyKey: `photo:${name}`,
    });
    return { ok: true };
  } catch {
    return { ok: false, error: "The photo wasn't added. Try again." };
  }
}

export type SimpleResult = { ok: true } | { ok: false; error: string };

// Share a thing as a public page, or stop. Only its owner can: the record lives in the owner's own
// scope, and the kernel's page reader only honours the owner's record (20261110050000).
export async function setPagePublished(worldId: string, published: boolean, pieces?: string[]): Promise<SimpleResult> {
  if (!(await getUser())) return { ok: false, error: "Your identity isn't ready yet. Reload and try again." };
  try {
    const kernel = await getKernel();
    const { world } = await loadCreativeWorld(kernel, worldId);
    const me = await kernel.whoami();
    const { ownerActorId } = await readWorldMembers(kernel, world.scope);
    if (ownerActorId !== me.actor_id) return { ok: false, error: "Only the person who started this can share it publicly." };
    // What the owner ticked. The kernel shows a ticked piece only while it is purely the owner's own,
    // so a selection can never publish a friend's contribution whatever this request contains.
    await setPublished(kernel, me.actor_id, world.worldId, Boolean(published), randomUUID(),
      pieces === undefined ? undefined : cleanSelection(pieces));
    return { ok: true };
  } catch {
    return { ok: false, error: published ? "It couldn't be shared. Try again." : "It couldn't be taken down. Try again — nothing else changed." };
  }
}

// Bring back what was made elsewhere. SOLVE records the link and who added it; it does not claim the
// thing exists or works — that is shown as the person's own word until a connected tool confirms it.
export async function linkWhatWasMade(worldId: string, url: string, tool: string): Promise<SimpleResult> {
  const link = cleanLink(url);
  if (!link) return { ok: false, error: "Paste a full https:// address." };
  const from = TOOLS.find(t => t.id === tool)?.name ?? "";
  if (!(await getUser())) return { ok: false, error: "Your identity isn't ready yet. Reload and try again." };
  try {
    const kernel = await getKernel();
    const { world } = await loadCreativeWorld(kernel, worldId);
    await kernel.upsertEntity({
      kind: "document", scope: world.scope, title: "Link", summary: link.slice(0, 240),
      attributes: { documentType: "link", worldId: world.worldId, url: link, madeWith: from, checked: false },
      visibility: "members", idempotencyKey: `link:${world.worldId}:${randomUUID()}`,
    });
    return { ok: true };
  } catch {
    return { ok: false, error: "The link wasn't added. Try again." };
  }
}
