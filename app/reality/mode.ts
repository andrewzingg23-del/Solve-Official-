export type RealityMode = "base" | "adaptive" | "personal";

export function isRealityMode(value: unknown): value is RealityMode {
  return value === "base" || value === "adaptive" || value === "personal";
}
