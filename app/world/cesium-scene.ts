// The CesiumJS renderer behind the SceneController contract. Every Cesium call in the product lives
// in this file. CesiumJS is loaded untouched from /public/cesium (Cesium.js, Workers, Assets,
// ThirdParty, Widgets, base URL /cesium/) with a script tag, never bundled. Swapping renderers means
// writing another SceneController, not touching domain code.
import type * as CesiumNS from "cesium";
import type { GeoPoint, SceneCallbacks, SceneController, SceneMetrics } from "@/lib/world/scene";
import { bandCeiling, bandForHeight, type SpatialLink, type SpatialMarker, type SpatialView, type ZoomBand } from "@/lib/world/spatial";

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

const HOME = { longitude: 12, latitude: 32, height: 17_000_000 };
const EFFECT_MS = 1600;

// A geodesic arc lifted off the surface (lines on the ellipsoid hide under the globe).
function arc(C: CesiumModule, a: SpatialMarker, b: SpatialMarker, lift: number) {
  const geodesic = new C.EllipsoidGeodesic(C.Cartographic.fromDegrees(a.longitude, a.latitude), C.Cartographic.fromDegrees(b.longitude, b.latitude));
  const peak = Math.min(900_000, Math.max(30_000, geodesic.surfaceDistance * lift));
  const points: CesiumNS.Cartesian3[] = [];
  for (let i = 0; i <= 48; i++) {
    const t = i / 48;
    const p = geodesic.interpolateUsingFraction(t);
    points.push(C.Cartesian3.fromRadians(p.longitude, p.latitude, 20_000 + Math.sin(Math.PI * t) * peak));
  }
  return points;
}

export class CesiumScene implements SceneController {
  private markers = new Map<string, SpatialMarker>();
  // Cesium entity id → the canonical ref a pick selects (null: not selectable).
  private registry = new Map<string, string | null>();
  private played = new Set<string>();
  private effects: CesiumNS.CustomDataSource;
  private handler: CesiumNS.ScreenSpaceEventHandler;
  private currentBand: ZoomBand = "ORBIT";
  private world: { ref: string; camera: { destination: CesiumNS.Cartesian3; heading: number; pitch: number; roll: number } } | null = null;
  private metrics: SceneMetrics = { initMs: 0, markers: 0, links: 0, lastRenderMs: 0 };
  private animating = 0;

  private constructor(
    private readonly C: CesiumModule,
    private readonly viewer: CesiumNS.Viewer,
    private readonly callbacks: SceneCallbacks,
    private readonly reducedMotion: () => boolean,
  ) {
    this.effects = new C.CustomDataSource("effects");
    void viewer.dataSources.add(this.effects);
    const scene = viewer.scene;
    this.handler = new C.ScreenSpaceEventHandler(scene.canvas);
    const pick = (additive: boolean) => (event: { position: CesiumNS.Cartesian2 }) => {
      const id = scene.pick(event.position)?.id?.id as string | undefined;
      const ref = id === undefined ? null : (this.registry.get(id) ?? null);
      if (id !== undefined && ref === null) return; // a decorative line: not a thing to select
      this.callbacks.onSelect(ref, additive);
    };
    this.handler.setInputAction(pick(false), C.ScreenSpaceEventType.LEFT_CLICK);
    this.handler.setInputAction(pick(true), C.ScreenSpaceEventType.LEFT_CLICK, C.KeyboardEventModifier.SHIFT);
    this.handler.setInputAction(pick(true), C.ScreenSpaceEventType.LEFT_CLICK, C.KeyboardEventModifier.CTRL);

    // Semantic zoom: report a band only when it changes, never the camera itself.
    viewer.camera.percentageChanged = 0.05;
    viewer.camera.changed.addEventListener(() => {
      if (this.world) return;
      const band = bandForHeight(viewer.camera.positionCartographic.height);
      if (band !== this.currentBand) {
        this.currentBand = band;
        this.callbacks.onBand(band);
      }
    });
    viewer.camera.moveEnd.addEventListener(() => {
      const rect = viewer.camera.computeViewRectangle();
      if (!rect) return;
      this.callbacks.onVisible(
        [...this.markers.values()].filter((m) => C.Rectangle.contains(rect, C.Cartographic.fromDegrees(m.longitude, m.latitude))).map((m) => m.ref),
      );
    });
    // Entity polylines build in workers and explicit rendering only requests a frame the first time
    // entity geometry becomes ready: keep rendering while data sources report unfinished geometry,
    // and while an effect plays.
    viewer.clock.onTick.addEventListener(() => {
      if (!viewer.clockViewModel.canAnimate || this.animating > 0) scene.requestRender();
    });
  }

  static async create(container: HTMLElement, callbacks: SceneCallbacks, options: { reducedMotion: () => boolean }) {
    const started = performance.now();
    const C = await loadCesium();
    const imagery = await C.TileMapServiceImageryProvider.fromUrl(C.buildModuleUrl("Assets/Textures/NaturalEarthII"));
    const credits = document.createElement("div");
    credits.style.display = "none";
    const viewer = new C.Viewer(container, {
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
    viewer.camera.setView({ destination: C.Cartesian3.fromDegrees(HOME.longitude, HOME.latitude, HOME.height) });

    const s = new CesiumScene(C, viewer, callbacks, options.reducedMotion);
    s.currentBand = bandForHeight(HOME.height);
    s.metrics.initMs = Math.round(performance.now() - started);
    callbacks.onMetrics?.({ ...s.metrics });
    return s;
  }

  render(view: SpatialView) {
    const started = performance.now();
    const { C, viewer } = this;
    const font = getComputedStyle(document.body).fontFamily || "sans-serif";
    const ice = C.Color.fromCssColorString("#f2f7fb");
    const cyan = C.Color.fromCssColorString("#22d3ee");
    const emerald = C.Color.fromCssColorString("#00e5a0");
    const red = C.Color.fromCssColorString("#ff4d5e");
    const night = C.Color.fromCssColorString("#04070d");
    viewer.entities.removeAll();
    this.registry.clear();
    this.markers = new Map(view.markers.map((m) => [m.ref, m]));

    for (const m of view.markers) {
      const selected = m.emphasis === "selected";
      const lit = m.emphasis === "lit";
      const quiet = m.emphasis === "quiet";
      const outline = m.state === "committed" ? emerald : m.state === "blocked" ? red : m.proof === "verified" ? emerald : m.proof === "challenged" ? red : ice.withAlpha(0.6);
      const suffix = m.state === "committed" ? " · AGREED" : m.state === "blocked" ? " · NOT ALLOWED" : "";
      const text = `${m.title.toUpperCase()}${suffix}${m.field ? `\n${m.field}` : ""}`;
      viewer.entities.add({
        id: m.ref,
        position: C.Cartesian3.fromDegrees(m.longitude, m.latitude),
        point: {
          pixelSize: selected ? 14 : lit ? 11 : m.kind === "place" ? 4 : 7,
          color: selected ? cyan : lit ? ice : ice.withAlpha(quiet ? 0.3 : m.kind === "place" ? 0.45 : 0.85),
          outlineColor: outline,
          outlineWidth: m.kind === "place" ? 0 : m.state === "normal" ? 2 : 3,
          scaleByDistance: new C.NearFarScalar(5e5, 1.4, 2e7, 0.7),
        },
        label: {
          text,
          font: `500 ${selected ? 13 : 11}px ${font}`,
          fillColor: selected ? cyan : m.state === "committed" ? emerald : ice.withAlpha(lit ? 1 : 0.8),
          outlineColor: night,
          outlineWidth: 3,
          style: C.LabelStyle.FILL_AND_OUTLINE,
          pixelOffset: new C.Cartesian2(0, -16),
          verticalOrigin: C.VerticalOrigin.BOTTOM,
          distanceDisplayCondition: new C.DistanceDisplayCondition(0, bandCeiling(m.labelFrom)),
        },
      });
      this.registry.set(m.ref, m.ref);
    }

    for (const l of view.links) {
      const a = this.markers.get(l.from);
      const b = this.markers.get(l.to);
      if (!a || !b) continue;
      viewer.entities.add({ id: l.id, polyline: this.polyline(l, a, b, { ice, cyan, emerald, red }) });
      this.registry.set(l.id, l.ref);
    }

    for (const effect of view.effects) {
      if (this.played.has(effect.id)) continue;
      this.played.add(effect.id);
      for (const ref of effect.refs) {
        const m = this.markers.get(ref);
        if (m) this.play(effect.kind === "route_stopped" ? red : effect.kind === "route_pulse" ? cyan : emerald, m);
      }
    }

    this.metrics.markers = view.markers.length;
    this.metrics.links = view.links.length;
    this.metrics.lastRenderMs = Math.round(performance.now() - started);
    this.callbacks.onMetrics?.({ ...this.metrics });
    viewer.scene.requestRender();
  }

  private polyline(l: SpatialLink, a: SpatialMarker, b: SpatialMarker, c: Record<"ice" | "cyan" | "emerald" | "red", CesiumNS.Color>) {
    const { C } = this;
    if (l.kind === "constellation") {
      return { positions: arc(C, a, b, 0.05), width: 1, arcType: C.ArcType.NONE, material: c.ice.withAlpha(l.style === "lit" ? 0.55 : 0.18) };
    }
    const color = l.style === "warning" ? c.red : l.style === "committed" ? c.emerald : l.style === "quiet" ? c.ice.withAlpha(0.35) : c.cyan;
    return {
      positions: arc(C, a, b, 0.12),
      width: l.style === "quiet" ? 2 : 6,
      arcType: C.ArcType.NONE,
      material: l.style === "quiet" ? color : new C.PolylineGlowMaterialProperty({ glowPower: 0.22, taperPower: 0.9, color: color.withAlpha(0.9) }),
    };
  }

  // A one-shot ring at a marker, caused by a kernel event. Never a loop.
  private play(color: CesiumNS.Color, m: SpatialMarker) {
    const { C } = this;
    const started = performance.now();
    const still = this.reducedMotion();
    const radius = () => {
      const t = Math.min(1, (performance.now() - started) / EFFECT_MS);
      return 30_000 + (still ? 1 : t) * 220_000;
    };
    const entity = this.effects.entities.add({
      position: C.Cartesian3.fromDegrees(m.longitude, m.latitude),
      ellipse: {
        semiMajorAxis: new C.CallbackProperty(radius, false),
        semiMinorAxis: new C.CallbackProperty(radius, false),
        material: color.withAlpha(0.18),
        outline: true,
        outlineColor: color.withAlpha(0.9),
        height: 0,
      },
    });
    this.animating++;
    setTimeout(() => {
      this.effects.entities.remove(entity);
      this.animating--;
      this.viewer.scene.requestRender();
    }, EFFECT_MS + 400);
  }

  private fly(destination: CesiumNS.Cartesian3 | CesiumNS.Rectangle, orientation?: { heading: number; pitch: number; roll: number }) {
    this.viewer.camera.flyTo({ destination, orientation, duration: this.reducedMotion() ? 0 : 1.6 });
  }

  focusEntity(ref: string) {
    const m = this.markers.get(ref);
    if (!m) return false;
    this.fly(this.C.Cartesian3.fromDegrees(m.longitude, m.latitude - 4, 1_400_000), { heading: 0, pitch: this.C.Math.toRadians(-62), roll: 0 });
    return true;
  }

  focusBounds(refs: string[], pad = 4) {
    const placed = refs.map((r) => this.markers.get(r)).filter((m): m is SpatialMarker => !!m);
    if (placed.length === 0) return false;
    if (placed.length === 1) return this.focusEntity(placed[0].ref);
    const lats = placed.map((m) => m.latitude);
    const lons = placed.map((m) => m.longitude);
    this.fly(this.C.Rectangle.fromDegrees(Math.min(...lons) - pad, Math.min(...lats) - pad, Math.max(...lons) + pad, Math.max(...lats) + pad));
    return true;
  }

  frameRoute(refs: string[]) {
    return this.focusBounds(refs, 6);
  }

  teleportTo(point: GeoPoint) {
    this.viewer.camera.setView({ destination: this.C.Cartesian3.fromDegrees(point.longitude, point.latitude, point.height ?? 1_400_000) });
  }

  returnHome() {
    this.fly(this.C.Cartesian3.fromDegrees(HOME.longitude, HOME.latitude, HOME.height));
  }

  enterWorld(ref: string) {
    const camera = this.viewer.camera;
    this.world = { ref, camera: { destination: camera.positionWC.clone(), heading: camera.heading, pitch: camera.pitch, roll: camera.roll } };
    const m = this.markers.get(ref);
    if (m) this.fly(this.C.Cartesian3.fromDegrees(m.longitude, m.latitude, 40_000));
    this.callbacks.onBand("WORLD");
  }

  exitWorld() {
    if (!this.world) return;
    const { destination, heading, pitch, roll } = this.world.camera;
    this.world = null;
    this.fly(destination, { heading, pitch, roll });
    this.currentBand = bandForHeight(this.C.Cartographic.fromCartesian(destination).height);
    this.callbacks.onBand(this.currentBand);
  }

  screenPosition(ref: string) {
    const m = this.markers.get(ref);
    if (!m) return null;
    const p = this.viewer.scene.cartesianToCanvasCoordinates(this.C.Cartesian3.fromDegrees(m.longitude, m.latitude));
    return p ? { x: p.x, y: p.y } : null;
  }

  renderedRefs() {
    return [...this.markers.keys()];
  }

  band() {
    return this.world ? "WORLD" : this.currentBand;
  }

  destroy() {
    this.handler.destroy();
    this.viewer.destroy();
  }
}
