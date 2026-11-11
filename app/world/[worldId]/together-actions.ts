"use server";

import { createHash, randomUUID } from "node:crypto";
import { getKernel } from "@/lib/kernel/server";
import { createClient as createSupabase, getUser } from "@/lib/supabase/server";
import { PHOTO_BUCKET, checkPhoto, isPhotoOf, photoProblem } from "@/lib/product/photo";
import { createCreativeArtifact, loadCreativeWorld, updateCreativeArtifact } from "@/lib/world/creative";
import { KernelError } from "@/lib/kernel/client";
import { runCapability } from "@/lib/product/run";
import { linkAdapter } from "@/lib/product/adapters/link";
import { BASE_PRESENTATION, normalizePresentation, readPresentation, samePresentation, writePresentation, type SpaceResources } from "@/lib/product/presentation";
import { createWorldInvitation } from "@/lib/world/invitations";
import { readWorldMembers } from "@/lib/world/collaboration";
import { cleanSelection, setPublished } from "@/lib/product/page";
import { setBotAccess, type WorldAccess } from "@/lib/bot/worlds";

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

// Let one connected app into this Space, at the level the person chooses, or take it out. The app
// acts as its own agent (connect_app), so these grants are the whole of what it can do here. Only
// the Space's owner holds grants to pass on; the kernel refuses anyone else.
export async function setAppAccess(worldId: string, clientId: string, access: WorldAccess): Promise<SimpleResult> {
  if (!["none", "read", "add"].includes(access)) return { ok: false, error: "Choose Off, Read or Add." };
  if (!(await getUser())) return { ok: false, error: "Your identity isn't ready yet. Reload and try again." };
  try {
    const kernel = await getKernel();
    const { world } = await loadCreativeWorld(kernel, worldId);
    const app = (await kernel.myConnections()).find(c => c.client_id === clientId && !c.disconnected_at);
    if (!app) return { ok: false, error: "That app isn't connected any more." };
    await setBotAccess(kernel, { scope: world.scope, botAgentId: app.agent_id, access }, `space-app:${world.worldId}:${randomUUID()}`);
    return { ok: true };
  } catch {
    return { ok: false, error: "That didn't change. Only the Space's owner can let apps in; nothing else changed." };
  }
}

export type ReviseResult =
  | { ok: true; version: number }
  | { ok: false; error: string; latest?: { version: number; text: string } };

const REQUEST = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Revise one piece (the "revise" capability, lib/product/capabilities.ts). The kernel decides: it
// needs world.entity.write on this Space, and it refuses a revision of a version the person wasn't
// looking at, so nobody silently overwrites someone else. The request id comes from the screen and
// is reused on a retry, so a save that was sent twice is one change, not two.
export async function revisePiece(worldId: string, entityId: string, expectedVersion: number, words: string, requestId: string): Promise<ReviseResult> {
  const text = typeof words === "string" ? words.trim() : "";
  if (!text) return { ok: false, error: "Write something, or cancel to keep it as it was." };
  if (text.length > 5000 || CONTROL.test(text)) return { ok: false, error: "That can't be saved as written. Try shorter, plain text." };
  if (!Number.isInteger(expectedVersion) || expectedVersion < 1 || !REQUEST.test(requestId)) return { ok: false, error: "This couldn't be saved. Reload and try again." };
  if (!(await getUser())) return { ok: false, error: "Your identity isn't ready yet. Reload and try again." };
  const kernel = await getKernel();
  let world, piece;
  try {
    const loaded = await loadCreativeWorld(kernel, worldId);
    world = loaded.world;
    piece = loaded.artifacts.find(a => a.entityId === entityId);
  } catch {
    return { ok: false, error: "This Space can't be reached right now. Nothing changed." };
  }
  if (!piece) return { ok: false, error: "That piece isn't here any more." };
  const first = text.split("\n")[0].trim();
  try {
    await updateCreativeArtifact(kernel, {
      scope: world.scope, entityId, requestId, expectedVersion,
      title: first.length > 80 ? first.slice(0, 77).trimEnd() + "…" : first,
      body: text, position: piece.position,
    });
  } catch (error) {
    if (error instanceof KernelError && error.name === "conflict") {
      const now = (await loadCreativeWorld(kernel, worldId).catch(() => null))?.artifacts.find(a => a.entityId === entityId);
      return { ok: false, error: "Someone changed this while you were editing. Their version is shown; your words are kept here — save again to replace it.",
        latest: now ? { version: now.version, text: now.body || now.title } : undefined };
    }
    if (error instanceof KernelError && error.name === "forbidden") return { ok: false, error: "You can see this Space but not change it." };
    return { ok: false, error: "It wasn't saved. Your words are still here; try again." };
  }
  const saved = (await loadCreativeWorld(kernel, worldId).catch(() => null))?.artifacts.find(a => a.entityId === entityId);
  return { ok: true, version: saved?.version ?? expectedVersion + 1 };
}

/** What a Space actually holds, so a presentation can only point at real photos and notes. */
export async function resourcesOf(loaded: Awaited<ReturnType<typeof loadCreativeWorld>>): Promise<SpaceResources> {
  const photos = loaded.entities.filter(e => e.kind === "document" && e.attributes.documentType === "photo").map(e => e.entity_id.toLowerCase());
  return { photos: new Set(photos), notes: new Set(loaded.artifacts.map(a => a.entityId.toLowerCase())) };
}

// Save a composition, undo the last change, or return to Base. Each is a new version of the Space's
// one presentation record; the kernel decides who may write it (world.entity.write on the Space).
export async function changePresentation(worldId: string, mode: "save" | "undo" | "base", raw: unknown, requestId: string): Promise<SimpleResult> {
  if (!REQUEST.test(requestId)) return { ok: false, error: "This couldn't be saved. Reload and try again." };
  if (!(await getUser())) return { ok: false, error: "Your identity isn't ready yet. Reload and try again." };
  try {
    const kernel = await getKernel();
    const loaded = await loadCreativeWorld(kernel, worldId);
    const resources = await resourcesOf(loaded);
    const current = await readPresentation(kernel, loaded.world.worldId, resources);
    const next = mode === "base" ? BASE_PRESENTATION : mode === "undo" ? current.previous ?? BASE_PRESENTATION : normalizePresentation(raw, resources);
    if (current.entityId && samePresentation(current.presentation, next)) return { ok: true };
    await writePresentation(kernel, loaded.world.worldId, current, next, `presentation:${loaded.world.worldId}:${requestId}`);
    return { ok: true };
  } catch (error) {
    if (error instanceof KernelError && error.name === "forbidden") return { ok: false, error: "You can see this Space but not change how it looks." };
    return { ok: false, error: "It wasn't saved. Nothing changed; try again." };
  }
}

// Bring a web page into this Space — the same capability, the same run path, an AI uses.
export async function captureLink(worldId: string, url: string, requestId: string): Promise<SimpleResult> {
  if (!REQUEST.test(requestId)) return { ok: false, error: "This couldn't be added. Reload and try again." };
  if (!(await getUser())) return { ok: false, error: "Your identity isn't ready yet. Reload and try again." };
  const kernel = await getKernel();
  // A GitHub repository, when the person has GitHub connected, is read through their own account;
  // anything else (or GitHub not connected) is brought in as the public page.
  const { repoFrom, githubRepoAdapter, githubToken } = await import("@/lib/product/adapters/github");
  const { readProvider } = await import("@/lib/product/credentials");
  const repo = /^https:\/\/github\.com\//i.test(url) ? repoFrom(url) : null;
  const person = repo ? (await kernel.whoami()).actor_id : null;
  const viaGithub = repo && person && (await readProvider(kernel, person, "github").catch(() => null))?.status === "connected";
  const run = viaGithub
    ? await runCapability(kernel, githubRepoAdapter(() => githubToken(kernel, person!)), worldId, { repo }, requestId)
    : await runCapability(kernel, linkAdapter(), worldId, { url }, requestId);
  return run.ok ? { ok: true } : { ok: false, error: `It wasn't brought in: ${run.error}` };
}
