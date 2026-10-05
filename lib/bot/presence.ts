// Live presence for the owner's view of their bot: which assistant is using which tool, right now.
// It is a private Supabase Realtime broadcast on `bot-live:<auth user id>`, which only that signed-in
// person may receive (supabase/migrations/20261004040100_bot_presence.sql). Nothing is stored, and
// no memory content is sent. Best effort: a failed broadcast never affects the tool call.
import type { SupabaseClient } from "@supabase/supabase-js";

export const PRESENCE_EVENT = "activity";
export const presenceTopic = (authUserId: string) => `bot-live:${authUserId}`;
export type Activity = { tool: string; client: string; at: string };

// Sends over HTTP without opening a socket; `service` is a client with the secret key.
export async function broadcastActivity(service: SupabaseClient, authUserId: string, activity: { tool: string; client: string }, now = new Date()) {
  const channel = service.channel(presenceTopic(authUserId), { config: { private: true } });
  try {
    await channel.httpSend(PRESENCE_EVENT, { tool: activity.tool, client: activity.client.slice(0, 80), at: now.toISOString() } satisfies Activity, { timeout: 2000 });
  } catch {
    // Presence is a courtesy, never a dependency.
  } finally {
    await service.removeChannel(channel).catch(() => null);
  }
}

// What the live card says while an assistant works.
export function describeActivity(a: Pick<Activity, "tool" | "client">, botName: string) {
  const doing: Record<string, string> = {
    whoami: `is getting to know ${botName}`,
    get_context: `is reading ${botName}'s context`,
    search: `is searching ${botName}'s memory`,
    fetch: `is reading one of ${botName}'s memories`,
    remember: `is giving ${botName} something to remember`,
    list_worlds: `is looking over ${botName}'s Worlds`,
    read_world: `is reading a World with ${botName}`,
    start_world: `is starting a new World with ${botName}`,
    add_to_world: `is adding to a World as ${botName}`,
    add_proof: `is saving proof with ${botName}`,
    design_part: `is designing a part with ${botName}`,
    propose_routes: `is finding routes with ${botName}`,
    propose_outreach: `is drafting outreach with ${botName}`,
    record_outcome: `is recording what happened with ${botName}`,
  };
  return `${a.client} ${doing[a.tool] ?? `is working with ${botName}`}`;
}
