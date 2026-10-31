// What the AI knows from the passport before it answers one message: the person's profile and the
// facts that match what they just said. Bounded in time and size; a slow or missing passport never
// blocks the conversation.
import type { Kernel } from "@/lib/kernel/client";
import { contextBlock } from "./client";
import { withPassport } from "./link";

const BUDGET_MS = 3500;

export async function passportContext(kernel: Kernel, ownerId: string, message: string, budgetMs = BUDGET_MS): Promise<string> {
  const work = withPassport(kernel, ownerId, async (call) => {
    const [profile, related, projects] = await Promise.allSettled([
      call("get_profile"),
      call("search_context", { query: message.slice(0, 500), limit: 8 }),
      call("list_projects"),
    ]);
    const text = (r: PromiseSettledResult<{ text: string; isError: boolean }>) => (r.status === "fulfilled" && !r.value.isError ? r.value.text : "");
    return contextBlock([
      { label: "Profile", text: text(profile) },
      { label: "Facts related to this message", text: text(related) },
      { label: "Projects", text: text(projects) },
    ]);
  }).catch(() => null);
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), budgetMs));
  return (await Promise.race([work, timeout])) ?? "";
}
