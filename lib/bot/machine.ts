// What the agent screen's Machine view draws: the bot's reach, from real records only. Which
// assistants speak through it and how, which Worlds it was let into, how much it remembers and how
// active it has been. No figure here is simulated; anything unknown is simply absent.
import type { Connection, Memory } from "./memory";
import type { WorldWithAccess } from "./worlds";

export type MachineData = {
  assistants: { name: string; mode: "read" | "remember" }[];
  worlds: { title: string; access: "read" | "add" }[];
  memories: number;
  // Persona versions plus memories: the bot's own kernel records shown on this screen.
  records: number;
  // Memories added per day over the last 14 days, oldest first.
  activity: number[];
};

export const ACTIVITY_DAYS = 14;

export function machineData(input: { connections: Connection[]; worlds: WorldWithAccess[]; memories: Memory[]; versions: number; now: Date }): MachineData {
  const today = Math.floor(input.now.getTime() / 86_400_000);
  const activity = Array.from({ length: ACTIVITY_DAYS }, () => 0);
  for (const m of input.memories) {
    const age = today - Math.floor(Date.parse(m.at) / 86_400_000);
    if (age >= 0 && age < ACTIVITY_DAYS) activity[ACTIVITY_DAYS - 1 - age]++;
  }
  return {
    assistants: input.connections.map((c) => ({ name: c.clientName, mode: c.mode })),
    worlds: input.worlds.filter((w) => w.access !== "none").map((w) => ({ title: w.title, access: w.access as "read" | "add" })),
    memories: input.memories.length,
    records: input.versions + input.memories.length,
    activity,
  };
}

export const EMPTY_MACHINE: MachineData = { assistants: [], worlds: [], memories: 0, records: 0, activity: Array.from({ length: ACTIVITY_DAYS }, () => 0) };
