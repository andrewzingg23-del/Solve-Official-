import type { CreativePosition } from "@/lib/world/creative";

// Where a new piece goes: the first free spot on a loose ring around the goal, so pieces don't stack.
const RING = [[24, 30], [76, 30], [24, 72], [76, 72], [50, 82], [50, 14], [12, 50], [88, 50], [36, 52], [64, 52]] as const;

export function nextSpot(taken: CreativePosition[]): CreativePosition {
  for (const [x, y] of RING) if (!taken.some((p) => Math.abs(p.x - x) < 9 && Math.abs(p.y - y) < 9)) return { x, y };
  return { x: 20 + ((taken.length * 17) % 60), y: 20 + ((taken.length * 29) % 60) };
}
