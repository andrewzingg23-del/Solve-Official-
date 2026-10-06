import { getUser } from "@/lib/supabase/server";
import { getKernel } from "@/lib/kernel/server";
import { loadBot } from "@/lib/bot/store";
import { readBrief } from "@/lib/bot/brief";
import { BotCompanion } from "./bot-companion";

export async function CompanionMount() {
  const user = await getUser().catch(() => null);
  if (!user) return null;
  const kernel = await getKernel().catch(() => null);
  if (!kernel) return null;
  const bot = await loadBot(kernel).catch(() => null);
  if (!bot) return null;
  const brief = await readBrief(kernel, bot.ownerId).catch(() => null);
  return <BotCompanion portraitUrl={null} hasUnread={Boolean(brief)} />;
}
