"use client";

// The Earth surface: mounts a renderer behind the SceneController contract and hands it spatial
// views. React holds semantic state only; the camera and every renderer call live in the scene
// (app/world/cesium-scene.ts).
import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import type { SceneCallbacks, SceneController } from "@/lib/world/scene";
import type { SpatialView } from "@/lib/world/spatial";
import { CesiumScene } from "./cesium-scene";

type Props = SceneCallbacks & { view: SpatialView; dimmed: boolean; reducedMotion: boolean };

// Until the renderer is ready, semantic calls are answered honestly: nothing is drawn.
const idle: SceneController = {
  render: () => {},
  focusEntity: () => false,
  focusBounds: () => false,
  frameRoute: () => false,
  teleportTo: () => {},
  returnHome: () => {},
  enterWorld: () => {},
  exitWorld: () => {},
  screenPosition: () => null,
  renderedRefs: () => [],
  band: () => "ORBIT",
  destroy: () => {},
};

export const Earth = forwardRef<SceneController, Props>(function Earth(props, ref) {
  const container = useRef<HTMLDivElement>(null);
  const scene = useRef<SceneController>(idle);
  const latest = useRef(props);
  latest.current = props;

  useImperativeHandle(ref, () => ({
    render: (v) => scene.current.render(v),
    focusEntity: (r) => scene.current.focusEntity(r),
    focusBounds: (r) => scene.current.focusBounds(r),
    frameRoute: (r) => scene.current.frameRoute(r),
    teleportTo: (p) => scene.current.teleportTo(p),
    returnHome: () => scene.current.returnHome(),
    enterWorld: (r) => scene.current.enterWorld(r),
    exitWorld: () => scene.current.exitWorld(),
    screenPosition: (r) => scene.current.screenPosition(r),
    renderedRefs: () => scene.current.renderedRefs(),
    band: () => scene.current.band(),
    destroy: () => scene.current.destroy(),
  }));

  useEffect(() => {
    let cancelled = false;
    let created: CesiumScene | null = null;
    const callbacks: SceneCallbacks = {
      onSelect: (r, additive) => latest.current.onSelect(r, additive),
      onVisible: (refs) => latest.current.onVisible(refs),
      onBand: (band) => latest.current.onBand(band),
      onStatus: (status, detail) => latest.current.onStatus(status, detail),
      onMetrics: (m) => latest.current.onMetrics?.(m),
    };
    callbacks.onStatus("loading");
    CesiumScene.create(container.current!, callbacks, { reducedMotion: () => latest.current.reducedMotion })
      .then((s) => {
        if (cancelled) return s.destroy();
        created = s;
        scene.current = s;
        s.render(latest.current.view);
        callbacks.onStatus("ready");
      })
      .catch((error: unknown) => callbacks.onStatus("failed", error instanceof Error ? error.message : String(error)));
    return () => {
      cancelled = true;
      created?.destroy();
      scene.current = idle;
    };
  }, []);

  useEffect(() => {
    scene.current.render(props.view);
  }, [props.view]);

  return (
    <div
      ref={container}
      aria-hidden="true"
      className="absolute inset-0 transition-opacity duration-700 ease-calm [&_.cesium-viewer]:h-full [&_.cesium-widget]:h-full [&_canvas]:outline-none"
      style={{ opacity: props.dimmed ? 0.22 : 1 }}
    />
  );
});
