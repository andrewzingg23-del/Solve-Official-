"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { KernelError } from "@/lib/kernel/client";
import { getKernel } from "@/lib/kernel/server";
import { getUser } from "@/lib/supabase/server";
import { setWorldBotAccess, type WorldBotAccess } from "@/lib/world/bot-access";

const text = (value: FormDataEntryValue | null) => typeof value === "string" ? value : "";
const ACCESS: readonly string[] = ["none", "read", "add"];

function fail(worldId: string, code: string): never {
  redirect(`/world/${encodeURIComponent(worldId)}?error=${code}`);
}

function errorCode(error: unknown) {
  if (!(error instanceof KernelError)) return "bot-access-save";
  if (error.name === "invalid") return "bot-access-input";
  if (error.name === "forbidden") return "bot-access-owner";
  if (error.name === "not_found") return "bot-access-missing";
  return "bot-access-save";
}

export async function setWorldBotAccessAction(worldId: string, formData: FormData) {
  if (!(await getUser())) redirect("/login?next=" + encodeURIComponent("/world/" + worldId));
  const botAgentId = text(formData.get("bot_agent_id"));
  const access = text(formData.get("access"));
  const requestId = text(formData.get("request_id"));
  if (!ACCESS.includes(access)) fail(worldId, "bot-access-input");
  try {
    await setWorldBotAccess(await getKernel(), {
      worldId,
      botAgentId,
      access: access as WorldBotAccess["access"],
      requestId,
    });
  } catch (error) {
    fail(worldId, errorCode(error));
  }
  revalidatePath("/world/" + worldId);
  redirect("/world/" + worldId + "?saved=bot-access");
}
