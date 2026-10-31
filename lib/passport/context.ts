// What the AI knows from the passport before it answers one message: the person's profile and the
// facts that match what they just said. Bounded in time and size; a slow or missing passport never
// blocks the conversation. Profile and the project list are cached ~10 minutes per person (see
// cache.ts) so each message doesn't write three reads to the passport record — only the
// message-specific facts (search_context) are read every turn.
import type { Kernel } from "@/lib/kernel/client";
import { contextBlock, type ToolResult } from "./client";
import { withPassport } from "./link";
import { TtlCache } from "./cache";

const BUDGET_MS = 3500;

const profileCache = new TtlCache();
const projectsCache = new TtlCache();

/** Clears the per-person caches. For tests. */
export function clearPassportCache(): void {
  profileCache.clear();
  projectsCache.clear();
}

type WithPassport = typeof withPassport;

export async function passportContext(
  kernel: Kernel,
  ownerId: string,
  message: string,
  budgetMs = BUDGET_MS,
  { with: withImpl = withPassport }: { with?: WithPassport } = {},
): Promise<string> {
  const text = (r: ToolResult | null) => (r && !r.isError ? r.text : "");

  const work = withImpl(kernel, ownerId, async (call) => {
    const safeCall = (name: string, args?: Record<string, unknown>) => call(name, args).catch(() => null);
    const cachedProfile = profileCache.get(ownerId);
    const cachedProjects = projectsCache.get(ownerId);

    const [related, profileRes, projectsRes] = await Promise.all([
      safeCall("search_context", { query: message.slice(0, 500), limit: 8 }),
      cachedProfile === null ? safeCall("get_profile") : Promise.resolve(null),
      cachedProjects === null ? safeCall("list_projects") : Promise.resolve(null),
    ]);

    let profile = cachedProfile ?? "";
    if (cachedProfile === null && profileRes && !profileRes.isError) {
      profile = profileRes.text;
      profileCache.set(ownerId, profile);
    }
    let projects = cachedProjects ?? "";
    if (cachedProjects === null && projectsRes && !projectsRes.isError) {
      projects = projectsRes.text;
      projectsCache.set(ownerId, projects);
    }

    return contextBlock([
      { label: "Profile", text: profile },
      { label: "Facts related to this message", text: text(related) },
      { label: "Projects", text: projects },
    ]);
  }).catch(() => null);

  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), budgetMs));
  return (await Promise.race([work, timeout])) ?? "";
}
