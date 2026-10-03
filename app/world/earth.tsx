"use client";

// The Earth: a CesiumJS scene controller. CesiumJS is loaded untouched from /public/cesium with a
// script tag (no bundler transformation). React hands this component semantic state only — nodes,
// highlights, routes, selection, dimming — and every Cesium call lives here.
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type * as CesiumNS from "cesium";
import type { Edge, Node } from "@/lib/world/types";

type CesiumModule = typeof CesiumNS;

declare global {
  interface Window {
    Cesium?: CesiumModule;
    CESIUM_BASE_URL?: string;
  }
}

let loading: Promise<CesiumModule> | undefined;
function loadCesium(): Promise<CesiumModule> {
  if (window.Cesium) return Promise.resolve(window.Cesium);
  loading ??= new Promise((resolve, reject) => {
    window.CESIUM_BASE_URL = "/cesium/";
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "/cesium/Widgets/widgets.css";
    document.head.appendChild(css);
    const script = document.createElement("script");
    script.src = "/cesium/Cesium.js";
    script.async = true;
    script.onload = () => (window.Cesium ? resolve(window.Cesium) : reject(new Error("CesiumJS did not load")));
    script.onerror = () => reject(new Error("CesiumJS failed to load"));
    document.head.appendChild(script);
  });
  return loading;
}

export type EarthHandle = {
  focus(ref: string): void;
  frame(refs: string[]): void;
  home(): void;
  screenX(ref: string): number | undefined;
};

type Props = {
  nodes: Node[];
  edges: Edge[];
  highlights: string[];
  selected: string | null;
  routes: string[];
  fields: { ref: string; label: string }[];
  dimmed: boolean;
  reducedMotion: boolean;
  onSelect(ref: string | null): void;
  onVisible(refs: string[]): void;
  onStatus(status: "loading" | "ready" | "failed", detail?: string): void;
};

const HOME = { lon: 12, lat: 32, height: 17_000_000 };

// A geodesic arc lifted off the surface (lines on the ellipsoid hide under the globe), rising
// with distance like a route.
function arc(C: CesiumModule, a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }, lift = 0.12) {
  const start = C.Cartographic.fromDegrees(a.longitude, a.latitude);
  const end = C.Cartographic.fromDegrees(b.longitude, b.latitude);
  const geodesic = new C.EllipsoidGeodesic(start, end);
  const peak = Math.min(900_000, Math.max(30_000, geodesic.surfaceDistance * lift));
  const points: CesiumNS.Cartesian3[] = [];
  for (let i = 0; i <= 48; i++) {
    const t = i / 48;
    const p = geodesic.interpolateUsingFraction(t);
    points.push(C.Cartesian3.fromRadians(p.longitude, p.latitude, 20_000 + Math.sin(Math.PI * t) * peak));
  }
  return points;
}

export const Earth = forwardRef<EarthHandle, Props>(function Earth(props, ref) {
  const container = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<CesiumNS.Viewer | null>(null);
  const cesiumRef = useRef<CesiumModule | null>(null);
  const propsRef = useRef(props);
  const [ready, setReady] = useState(false);
  const { nodes, edges, highlights, selected, routes, fields } = props;
  propsRef.current = props;

  useImperativeHandle(ref, () => ({
    focus(target) {
      const C = cesiumRef.current;
      const viewer = viewerRef.current;
      const node = propsRef.current.nodes.find((n) => n.ref === target);
      if (!C || !viewer || !node?.location) return;
      viewer.camera.flyTo({
        destination: C.Cartesian3.fromDegrees(node.location.longitude, node.location.latitude - 4, 1_400_000),
        orientation: { heading: 0, pitch: C.Math.toRadians(-62), roll: 0 },
        duration: propsRef.current.reducedMotion ? 0 : 1.6,
      });
    },
    frame(refs) {
      const C = cesiumRef.current;
      const viewer = viewerRef.current;
      const located = propsRef.current.nodes.filter((n) => refs.includes(n.ref) && n.location);
      if (!C || !viewer || located.length === 0) return;
      const lats = located.map((n) => n.location!.latitude);
      const lons = located.map((n) => n.location!.longitude);
      const pad = 4;
      viewer.camera.flyTo({
        destination: C.Rectangle.fromDegrees(Math.min(...lons) - pad, Math.min(...lats) - pad, Math.max(...lons) + pad, Math.max(...lats) + pad),
        duration: propsRef.current.reducedMotion ? 0 : 1.8,
      });
    },
    home() {
      const C = cesiumRef.current;
      const viewer = viewerRef.current;
      if (!C || !viewer) return;
      viewer.camera.flyTo({ destination: C.Cartesian3.fromDegrees(HOME.lon, HOME.lat, HOME.height), duration: propsRef.current.reducedMotion ? 0 : 1.6 });
    },
    screenX(target) {
      const C = cesiumRef.current;
      const viewer = viewerRef.current;
      const node = propsRef.current.nodes.find((n) => n.ref === target);
      if (!C || !viewer || !node?.location) return undefined;
      const p = viewer.scene.cartesianToCanvasCoordinates(C.Cartesian3.fromDegrees(node.location.longitude, node.location.latitude));
      return p?.x;
    },
  }));

  // Create the viewer once per session.
  useEffect(() => {
    let cancelled = false;
    let handler: CesiumNS.ScreenSpaceEventHandler | undefined;
    propsRef.current.onStatus("loading");
    loadCesium()
      .then(async (C) => {
        if (cancelled || !container.current) return;
        cesiumRef.current = C;
        const credits = document.createElement("div");
        credits.style.display = "none";
        const imagery = await C.TileMapServiceImageryProvider.fromUrl(C.buildModuleUrl("Assets/Textures/NaturalEarthII"));
        if (cancelled || !container.current) return;
        const viewer = new C.Viewer(container.current, {
          baseLayer: new C.ImageryLayer(imagery, { brightness: 0.24, contrast: 1.45, saturation: 0, gamma: 1.25 }),
          baseLayerPicker: false,
          geocoder: false,
          homeButton: false,
          sceneModePicker: false,
          navigationHelpButton: false,
          animation: false,
          timeline: false,
          fullscreenButton: false,
          infoBox: false,
          selectionIndicator: false,
          creditContainer: credits,
          requestRenderMode: true,
          maximumRenderTimeChange: Infinity,
          skyBox: false,
          contextOptions: { webgl: { alpha: false } },
        });
        const scene = viewer.scene;
        scene.backgroundColor = C.Color.fromCssColorString("#04070d");
        scene.globe.baseColor = C.Color.fromCssColorString("#0a1220");
        scene.globe.showGroundAtmosphere = false;
        scene.globe.enableLighting = false;
        if (scene.skyAtmosphere) {
          scene.skyAtmosphere.brightnessShift = -0.35;
          scene.skyAtmosphere.saturationShift = -0.6;
        }
        if (scene.sun) scene.sun.show = false;
        if (scene.moon) scene.moon.show = false;
        scene.fog.enabled = true;
        scene.screenSpaceCameraController.minimumZoomDistance = 50_000;
        scene.screenSpaceCameraController.maximumZoomDistance = 40_000_000;
        viewer.camera.setView({ destination: C.Cartesian3.fromDegrees(HOME.lon, HOME.lat, HOME.height) });
        // Entity polylines build in workers, and explicit rendering only requests a frame the
        // first time entity geometry becomes ready. Keep rendering while the data sources report
        // unfinished geometry (the viewer clears canAnimate until they are done).
        viewer.clock.onTick.addEventListener(() => {
          if (!viewer.clockViewModel.canAnimate) scene.requestRender();
        });

        handler = new C.ScreenSpaceEventHandler(scene.canvas);
        handler.setInputAction((event: { position: CesiumNS.Cartesian2 }) => {
          const picked = scene.pick(event.position);
          const id = picked?.id?.id as string | undefined;
          propsRef.current.onSelect(id && !id.startsWith("line:") ? id : null);
        }, C.ScreenSpaceEventType.LEFT_CLICK);
        viewer.camera.moveEnd.addEventListener(() => {
          const rect = viewer.camera.computeViewRectangle();
          if (!rect) return;
          const visible = propsRef.current.nodes
            .filter((n) => n.location && C.Rectangle.contains(rect, C.Cartographic.fromDegrees(n.location.longitude, n.location.latitude)))
            .map((n) => n.ref);
          propsRef.current.onVisible(visible);
        });
        viewerRef.current = viewer;
        setReady(true);
        propsRef.current.onStatus("ready");
      })
      .catch((error: unknown) => {
        propsRef.current.onStatus("failed", error instanceof Error ? error.message : String(error));
      });
    return () => {
      cancelled = true;
      handler?.destroy();
      viewerRef.current?.destroy();
      viewerRef.current = null;
    };
  }, []);

  // Rebuild the entities whenever the semantic state changes. The set is small (tens), so a full
  // rebuild per semantic change is cheaper than diffing, and never happens per frame.
  useEffect(() => {
    const C = cesiumRef.current;
    const viewer = viewerRef.current;
    if (!ready || !C || !viewer) return;
    const font = getComputedStyle(document.body).fontFamily || "sans-serif";
    const ice = C.Color.fromCssColorString("#f2f7fb");
    const cyan = C.Color.fromCssColorString("#22d3ee");
    const emerald = C.Color.fromCssColorString("#00e5a0");
    const red = C.Color.fromCssColorString("#ff4d5e");
    const lit = new Set(highlights);
    const fieldFor = new Map(fields.map((f) => [f.ref, f.label]));
    viewer.entities.removeAll();

    for (const n of nodes) {
      if (!n.location) continue;
      const position = C.Cartesian3.fromDegrees(n.location.longitude, n.location.latitude);
      const isSelected = n.ref === selected;
      const isLit = lit.has(n.ref);
      const outline = n.proof === "verified" ? emerald : n.proof === "challenged" ? red : ice.withAlpha(0.6);
      const isVenture = n.kind === "world";
      const size = isSelected ? 14 : isLit ? 11 : n.kind === "place" ? 4 : isVenture ? 10 : 7;
      const labelText = fieldFor.has(n.ref) ? `${n.title.toUpperCase()}\n${fieldFor.get(n.ref)}` : n.title.toUpperCase();
      // Information budget: while an intent highlights some things, the rest step back.
      const quiet = lit.size > 0 && !isLit && !isSelected && !isVenture;
      viewer.entities.add({
        id: n.ref,
        position,
        point: {
          pixelSize: size,
          color: isSelected || isVenture ? cyan : isLit ? ice : ice.withAlpha(quiet ? 0.3 : n.kind === "place" ? 0.45 : 0.85),
          outlineColor: isVenture ? cyan.withAlpha(0.35) : outline,
          outlineWidth: n.kind === "place" ? 0 : isVenture ? 6 : 2,
          scaleByDistance: new C.NearFarScalar(5e5, 1.4, 2e7, 0.7),
        },
        label: {
          text: labelText,
          font: `500 ${isSelected ? 13 : 11}px ${font}`,
          fillColor: isSelected ? cyan : ice.withAlpha(isLit ? 1 : 0.8),
          outlineColor: C.Color.fromCssColorString("#04070d"),
          outlineWidth: 3,
          style: C.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new C.Cartesian2(0, isVenture ? 16 : -16),
          showBackground: false,
          verticalOrigin: isVenture ? C.VerticalOrigin.TOP : C.VerticalOrigin.BOTTOM,
          // Semantic zoom: important things label from further away; nothing labels at orbit.
          distanceDisplayCondition: new C.DistanceDisplayCondition(
            0,
            isSelected || isLit || isVenture || fieldFor.has(n.ref) ? 2.2e7 : quiet ? 6e5 : n.importance >= 60 ? 7e6 : 2.5e6,
          ),
        },
      });
    }

    // Network States are constellations of member hubs, never borders.
    const byState = new Map<string, Node[]>();
    for (const e of edges) {
      if (e.kind !== "member_of") continue;
      const hub = nodes.find((n) => n.ref === e.from && n.location);
      if (!hub) continue;
      byState.set(e.to, [...(byState.get(e.to) ?? []), hub]);
    }
    for (const [state, hubs] of byState) {
      for (let i = 0; i < hubs.length; i++) {
        const a = hubs[i];
        const b = hubs[(i + 1) % hubs.length];
        if (a === b) continue;
        viewer.entities.add({
          id: `line:${state}:${i}`,
          polyline: {
            positions: arc(C, a.location!, b.location!, 0.05),
            width: 1,
            arcType: C.ArcType.NONE,
            material: ice.withAlpha(lit.has(state) ? 0.55 : 0.18),
          },
        });
      }
    }

    // Routes: agency reaching from the origin to each destination.
    const [origin, ...destinations] = routes;
    const from = nodes.find((n) => n.ref === origin && n.location);
    if (from) {
      for (const d of destinations) {
        const to = nodes.find((n) => n.ref === d && n.location);
        if (!to) continue;
        viewer.entities.add({
          id: `line:route:${d}`,
          polyline: {
            positions: arc(C, from.location!, to.location!),
            width: 6,
            arcType: C.ArcType.NONE,
            material: new C.PolylineGlowMaterialProperty({ glowPower: 0.22, taperPower: 0.9, color: (to.proof === "challenged" ? red : cyan).withAlpha(0.9) }),
          },
        });
      }
    }
    viewer.scene.requestRender();
  }, [ready, nodes, edges, highlights, selected, routes, fields]);

  return (
    <div
      ref={container}
      aria-hidden="true"
      className="absolute inset-0 transition-opacity duration-700 ease-calm [&_.cesium-viewer]:h-full [&_.cesium-widget]:h-full [&_canvas]:outline-none"
      style={{ opacity: props.dimmed ? 0.22 : 1 }}
    />
  );
});
