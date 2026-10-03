// The scene controller contract: the only way the product moves the camera or draws the World.
// Callers speak in meaning (focus this entity, frame this route, enter this World), never in camera
// coordinates, and the camera never lives in React state. Any renderer that implements this
// (CesiumJS today) is replaceable without touching domain code.
import type { SpatialView, ZoomBand } from "./spatial";

export type GeoPoint = { latitude: number; longitude: number; height?: number };

export interface SceneController {
  // Draws a spatial view. Called on semantic change only, never per frame.
  render(view: SpatialView): void;
  focusEntity(ref: string): boolean;
  focusBounds(refs: string[]): boolean;
  frameRoute(refs: string[]): boolean;
  teleportTo(point: GeoPoint): void;
  returnHome(): void;
  // Into a World's own space; a World with no geography leaves Earth behind instead of pretending
  // to be somewhere on it.
  enterWorld(ref: string): void;
  exitWorld(): void;
  // Where a canonical entity is on screen, for tests and anchored UI.
  screenPosition(ref: string): { x: number; y: number } | null;
  // Every canonical ref the scene currently draws.
  renderedRefs(): string[];
  band(): ZoomBand;
  destroy(): void;
}

export type SceneMetrics = { initMs: number; markers: number; links: number; lastRenderMs: number };

export type SceneCallbacks = {
  // A pick resolved to its canonical ref; additive picks build a set ("these", "them").
  onSelect(ref: string | null, additive: boolean): void;
  // Settled camera only (move end), never per frame.
  onVisible(refs: string[]): void;
  onBand(band: ZoomBand): void;
  onStatus(status: "loading" | "ready" | "failed", detail?: string): void;
  onMetrics?(metrics: SceneMetrics): void;
};
