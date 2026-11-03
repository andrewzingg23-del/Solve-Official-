"use server";
import { getUser } from "@/lib/supabase/server";
import { getKernel } from "@/lib/kernel/server";
import { createCreativeWorld } from "@/lib/world/creative";
import { ACCOUNT_CHANGED, sameDisplayedAccount } from "@/lib/product/account-guard";
import { validateProjectDraft } from "@/lib/product/draft";

export async function createProject(input: unknown, expectedUserId: string): Promise<{ ok: true; worldId: string } | { ok: false; error: string }> {
  const user = await getUser();
  if (!sameDisplayedAccount(expectedUserId, user?.id)) return { ok: false, error: ACCOUNT_CHANGED };
  if (!user) return { ok: false, error: "Your workspace could not connect yet. Your draft is still here; refresh and retry." };
  const checked = validateProjectDraft(input);
  if (!checked.ok) return checked;
  try {
    const world = await createCreativeWorld(await getKernel(), { worldId: checked.draft.id, title: checked.draft.title, goal: checked.draft.goal });
    // The client navigates straight to the new project; "/" and "/worlds" are dynamic (auth-bound,
    // no-store) so they refresh on their next visit. Re-rendering those lists inside the action would
    // bundle two more kernel round-trips into this response and, on a cold worker, push it past the
    // function limit — leaving creation stuck. Creation is idempotent (worldId), so retries are safe.
    return { ok: true, worldId: world.worldId };
  } catch { return { ok: false, error: "Your project couldn't be saved yet. Your draft is kept here; try again." }; }
}
