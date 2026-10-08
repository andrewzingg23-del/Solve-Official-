"use client";

// The homeowner's system as a model they can turn: a typical Florida home with the estimated panel
// count laid out on the roof, south face first. It is an illustration of the count, not their roof;
// the installer designs the real layout in Aurora.
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

const PANEL = { w: 1.13, h: 1.75, gap: 0.04 };
const PITCH = (24 * Math.PI) / 180;
const MARGIN = 0.45;

// How many panels fit on one roof face of a given width and slope length.
function fit(width: number, slope: number) {
  const cols = Math.max(0, Math.floor((width - 2 * MARGIN + PANEL.gap) / (PANEL.w + PANEL.gap)));
  const rows = Math.max(0, Math.floor((slope - 2 * MARGIN + PANEL.gap) / (PANEL.h + PANEL.gap)));
  return { cols, rows, count: cols * rows };
}

// The home grows with the system, so the panels always fit on two faces.
export function houseFor(panels: number) {
  let width = 13;
  let depth = 9.5;
  for (let i = 0; i < 20; i++) {
    const slope = depth / 2 / Math.cos(PITCH);
    if (fit(width, slope).count * 2 >= panels) break;
    width += 1.2;
    depth += 0.5;
  }
  const slope = depth / 2 / Math.cos(PITCH);
  return { width, depth, slope, perFace: fit(width, slope) };
}

export function House3D({ panels, label }: { panels: number; label: string }) {
  const host = useRef<HTMLDivElement>(null);
  const roof = useRef<THREE.Group | null>(null);
  const state = useRef<{ render: () => void; layout: (n: number) => void } | null>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = null; // transparent: the dark panel shows through
    scene.fog = new THREE.Fog("#0a1220", 40, 90);
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
    camera.position.set(-18, 13, 22);

    scene.add(new THREE.HemisphereLight("#ffffff", "#1a2b45", 1.1));
    const sun = new THREE.DirectionalLight("#fff6e5", 2.2);
    sun.position.set(-12, 22, 18); // from the south, early afternoon
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -25;
    sun.shadow.camera.right = 25;
    sun.shadow.camera.top = 25;
    sun.shadow.camera.bottom = -25;
    scene.add(sun);

    const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 64), new THREE.MeshStandardMaterial({ color: "#101c30", roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    const rim = new THREE.DirectionalLight("#22d3ee", 0.5);
    rim.position.set(18, 8, -14);
    scene.add(rim);

    const home = new THREE.Group();
    scene.add(home);
    const walls = new THREE.MeshStandardMaterial({ color: "#fbfcfd", roughness: 0.9 });
    const shingles = new THREE.MeshStandardMaterial({ color: "#5b6673", roughness: 0.85 });
    const glass = new THREE.MeshStandardMaterial({ color: "#9fb6c8", roughness: 0.2, metalness: 0.3 });
    const cell = new THREE.MeshStandardMaterial({ color: "#0b1a2e", roughness: 0.25, metalness: 0.55 });
    const frame = new THREE.LineBasicMaterial({ color: "#22d3ee", transparent: true, opacity: 0.55 });

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 14;
    controls.maxDistance = 55;
    controls.maxPolarAngle = Math.PI / 2.15;
    controls.target.set(0, 3, 0);
    controls.autoRotate = !reduce;
    controls.autoRotateSpeed = 0.6;

    function layout(n: number) {
      home.clear();
      const { width, depth, slope, perFace } = houseFor(n);
      const wallH = 3.2;
      const body = new THREE.Mesh(new THREE.BoxGeometry(width, wallH, depth), walls);
      body.position.y = wallH / 2;
      body.castShadow = body.receiveShadow = true;
      home.add(body);
      // windows and a door on the south face
      for (let i = 0; i < 4; i++) {
        const w = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.1), glass);
        w.position.set(-width / 2 + (i + 0.5) * (width / 4), 1.8, depth / 2 + 0.01);
        home.add(w);
      }
      const door = new THREE.Mesh(new THREE.PlaneGeometry(1, 2.1), new THREE.MeshStandardMaterial({ color: "#04070d" }));
      door.position.set(0.4, 1.05, depth / 2 + 0.02);
      home.add(door);

      const rise = (depth / 2) * Math.tan(PITCH);
      const faces = new THREE.Group();
      roof.current = faces;
      // two roof faces, south (+z) and north (-z), meeting at the ridge
      for (const side of [1, -1]) {
        const face = new THREE.Group();
        face.position.set(0, wallH + rise / 2, (side * depth) / 4);
        face.rotation.x = side * PITCH;
        const plane = new THREE.Mesh(new THREE.BoxGeometry(width + 0.6, 0.12, slope + 0.35), shingles);
        plane.castShadow = plane.receiveShadow = true;
        face.add(plane);
        faces.add(face);
      }
      // gable ends
      const tri = new THREE.Shape([new THREE.Vector2(-depth / 2, 0), new THREE.Vector2(depth / 2, 0), new THREE.Vector2(0, rise)]);
      for (const x of [width / 2, -width / 2]) {
        const g = new THREE.Mesh(new THREE.ShapeGeometry(tri), walls);
        g.rotation.y = Math.PI / 2;
        g.position.set(x, wallH, 0);
        home.add(g);
      }
      home.add(faces);

      // panels: fill the south face row by row from the ridge, then the north face
      let left = n;
      faces.children.forEach((face, f) => {
        const take = Math.min(left, perFace.count);
        left -= take;
        for (let k = 0; k < take; k++) {
          const r = Math.floor(k / perFace.cols);
          const c = k % perFace.cols;
          const x = -((perFace.cols * (PANEL.w + PANEL.gap)) / 2) + c * (PANEL.w + PANEL.gap) + PANEL.w / 2;
          const z = (f === 0 ? -1 : 1) * (slope / 2 - MARGIN - r * (PANEL.h + PANEL.gap) - PANEL.h / 2);
          const p = new THREE.Mesh(new THREE.BoxGeometry(PANEL.w, 0.05, PANEL.h), cell);
          p.position.set(x, 0.1, f === 0 ? -z : z);
          p.castShadow = true;
          const edges = new THREE.LineSegments(new THREE.EdgesGeometry(p.geometry), frame);
          p.add(edges);
          face.add(p);
        }
      });
      controls.target.set(0, wallH * 0.8, 0);
    }

    function size() {
      const { clientWidth: w, clientHeight: h } = el!;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
    }
    const observer = new ResizeObserver(size);
    observer.observe(el);
    size();

    let frameId = 0;
    const render = () => {
      controls.update();
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(render);
    };
    state.current = { render, layout };
    layout(panels);
    render();

    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
      controls.dispose();
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
      });
      renderer.dispose();
      renderer.domElement.remove();
      state.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    state.current?.layout(panels);
  }, [panels]);

  return <div ref={host} role="img" aria-label={label} className="h-full w-full cursor-grab touch-none active:cursor-grabbing" />;
}
