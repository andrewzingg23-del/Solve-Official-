"use client";

// Walk the development: a concept model of the three phases on one parcel. Homes along the loop road,
// the commercial block by the boulevard, and the estate on the rise. Turn it, switch phases on and
// off, or fly through. A concept, not a site plan.
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export const PHASES = [
  { id: 1, name: "Phase one · Homes", note: "Sixteen homes on the loop road" },
  { id: 2, name: "Phase two · Commercial", note: "Offices over retail, with parking" },
  { id: 3, name: "Phase three · The Estate", note: "The residence on the rise" },
] as const;

type Build = { group: THREE.Group; phase: number; target: number };

function house(walls: THREE.Material, roof: THREE.Material, w = 6, d = 8, h = 3.4) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), walls);
  body.position.y = h / 2;
  body.castShadow = body.receiveShadow = true;
  const rise = 2;
  const shape = new THREE.Shape([new THREE.Vector2(-w / 2 - 0.3, 0), new THREE.Vector2(w / 2 + 0.3, 0), new THREE.Vector2(0, rise)]);
  const top = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: d + 0.6, bevelEnabled: false }), roof);
  top.position.set(0, h, -d / 2 - 0.3);
  top.castShadow = true;
  g.add(body, top);
  return g;
}

function tree(leaf: THREE.Material, trunk: THREE.Material, s = 1) {
  const g = new THREE.Group();
  const t = new THREE.Mesh(new THREE.CylinderGeometry(0.15 * s, 0.2 * s, 1.6 * s), trunk);
  t.position.y = 0.8 * s;
  const c = new THREE.Mesh(new THREE.SphereGeometry(1.1 * s, 12, 10), leaf);
  c.position.y = 2.2 * s;
  c.castShadow = true;
  g.add(t, c);
  return g;
}

export function Development3D() {
  const host = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState<Record<number, boolean>>({ 1: true, 2: true, 3: true });
  const api = useRef<{ setPhase: (p: number, v: boolean) => void; fly: () => void } | null>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#f2f7fb");
    scene.fog = new THREE.Fog("#f2f7fb", 120, 260);
    const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 600);
    camera.position.set(-95, 70, 95);

    scene.add(new THREE.HemisphereLight("#ffffff", "#c9d6e2", 1.05));
    const sun = new THREE.DirectionalLight("#fff6e5", 2.1);
    sun.position.set(-60, 90, 50);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -110, right: 110, top: 110, bottom: -110, far: 300 });
    scene.add(sun);

    const mat = {
      ground: new THREE.MeshStandardMaterial({ color: "#e2ebe6", roughness: 1 }),
      road: new THREE.MeshStandardMaterial({ color: "#c7d1da", roughness: 1 }),
      walls: new THREE.MeshStandardMaterial({ color: "#fbfcfd", roughness: 0.85 }),
      roof: new THREE.MeshStandardMaterial({ color: "#5b6673", roughness: 0.85 }),
      glass: new THREE.MeshStandardMaterial({ color: "#7fa9bf", roughness: 0.15, metalness: 0.4 }),
      accent: new THREE.MeshStandardMaterial({ color: "#0891b2", roughness: 0.4 }),
      water: new THREE.MeshStandardMaterial({ color: "#9fd6e6", roughness: 0.1, metalness: 0.2 }),
      leaf: new THREE.MeshStandardMaterial({ color: "#8fb39b", roughness: 1 }),
      trunk: new THREE.MeshStandardMaterial({ color: "#8a7a68", roughness: 1 }),
      lot: new THREE.MeshStandardMaterial({ color: "#d9e1e8", roughness: 1 }),
    };

    const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 180), mat.ground);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);
    const strip = (w: number, d: number, x: number, z: number, m = mat.road) => {
      const r = new THREE.Mesh(new THREE.PlaneGeometry(w, d), m);
      r.rotation.x = -Math.PI / 2;
      r.position.set(x, 0.02, z);
      r.receiveShadow = true;
      scene.add(r);
    };
    strip(220, 9, 0, 60); // the boulevard
    strip(9, 110, -20, 5); // the entry road
    strip(70, 7, -55, 5); // the loop
    strip(70, 7, -55, -30);
    strip(7, 42, -88, -12.5);

    const builds: Build[] = [];
    const add = (group: THREE.Group, phase: number) => {
      scene.add(group);
      builds.push({ group, phase, target: 1 });
    };

    // phase one: sixteen homes facing the loop
    const homes = new THREE.Group();
    for (let i = 0; i < 8; i++) {
      for (const [z, rot] of [[15, Math.PI], [-5, 0], [-20, Math.PI], [-40, 0]] as const) {
        if ((z === -20 || z === -40) && i > 3) continue;
        const h = house(mat.walls, mat.roof);
        h.position.set(-82 + i * 8.5, 0, z);
        h.rotation.y = rot;
        homes.add(h);
      }
    }
    for (let i = 0; i < 14; i++) {
      const t = tree(mat.leaf, mat.trunk, 0.9);
      t.position.set(-86 + i * 5, 0, 9 + (i % 2) * 0.5);
      homes.add(t);
    }
    add(homes, 1);

    // phase two: offices over retail by the boulevard, with parking
    const commercial = new THREE.Group();
    const tower = new THREE.Mesh(new THREE.BoxGeometry(26, 22, 18), mat.walls);
    tower.position.set(20, 11, 38);
    tower.castShadow = tower.receiveShadow = true;
    commercial.add(tower);
    for (let f = 0; f < 5; f++) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(26.2, 1.6, 18.2), mat.glass);
      band.position.set(20, 4.5 + f * 3.6, 38);
      commercial.add(band);
    }
    const retail = new THREE.Mesh(new THREE.BoxGeometry(44, 5, 12), mat.walls);
    retail.position.set(52, 2.5, 40);
    retail.castShadow = retail.receiveShadow = true;
    const awning = new THREE.Mesh(new THREE.BoxGeometry(44, 0.4, 2), mat.accent);
    awning.position.set(52, 4, 46.6);
    commercial.add(retail, awning);
    const lot = new THREE.Mesh(new THREE.PlaneGeometry(50, 20), mat.lot);
    lot.rotation.x = -Math.PI / 2;
    lot.position.set(42, 0.03, 20);
    commercial.add(lot);
    add(commercial, 2);

    // phase three: the estate on the rise, with a long drive and a pool
    const estate = new THREE.Group();
    const rise = new THREE.Mesh(new THREE.CylinderGeometry(30, 38, 4, 48), mat.ground);
    rise.position.set(60, 2, -40);
    rise.receiveShadow = true;
    estate.add(rise);
    const main = house(mat.walls, mat.roof, 26, 14, 6);
    main.position.set(60, 4, -44);
    const wing = house(mat.walls, mat.roof, 10, 18, 5);
    wing.position.set(77, 4, -38);
    const pool = new THREE.Mesh(new THREE.BoxGeometry(14, 0.3, 6), mat.water);
    pool.position.set(58, 4.2, -28);
    estate.add(main, wing, pool);
    const drive = new THREE.Mesh(new THREE.PlaneGeometry(6, 70), mat.road);
    drive.rotation.x = -Math.PI / 2;
    drive.rotation.z = 0.25;
    drive.position.set(46, 0.04, 10);
    estate.add(drive);
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      const t = tree(mat.leaf, mat.trunk, 1.2);
      t.position.set(60 + Math.cos(a) * 34, 0, -40 + Math.sin(a) * 30);
      estate.add(t);
    }
    add(estate, 3);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.minDistance = 30;
    controls.maxDistance = 220;
    controls.maxPolarAngle = Math.PI / 2.2;
    controls.target.set(0, 0, 5);
    controls.autoRotate = !reduce;
    controls.autoRotateSpeed = 0.35;

    // a flight along the entry road, past the homes, up to the estate
    const path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-20, 14, 110), new THREE.Vector3(-20, 9, 40), new THREE.Vector3(-55, 10, 22),
      new THREE.Vector3(-70, 14, -50), new THREE.Vector3(10, 24, -70), new THREE.Vector3(95, 26, -10), new THREE.Vector3(60, 60, 90),
    ]);
    const look = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-20, 2, 40), new THREE.Vector3(-40, 2, 5), new THREE.Vector3(-60, 2, -10),
      new THREE.Vector3(-30, 2, -30), new THREE.Vector3(55, 4, -40), new THREE.Vector3(60, 4, -42), new THREE.Vector3(10, 0, 5),
    ]);
    let flight: number | null = null;

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
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      for (const b of builds) {
        const s = b.group.scale.y + (b.target - b.group.scale.y) * Math.min(1, dt * (reduce ? 60 : 4));
        b.group.scale.set(1, Math.max(0.001, s), 1);
        b.group.visible = s > 0.01;
      }
      if (flight !== null) {
        flight += dt / 22;
        if (flight >= 1) {
          flight = null;
          controls.enabled = true;
        } else {
          camera.position.copy(path.getPoint(flight));
          camera.lookAt(look.getPoint(flight));
        }
      }
      if (flight === null) controls.update();
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);

    api.current = {
      setPhase: (p, v) => builds.filter((b) => b.phase === p).forEach((b) => (b.target = v ? 1 : 0)),
      fly: () => {
        if (reduce) return;
        controls.enabled = false;
        controls.autoRotate = false;
        flight = 0;
      },
    };

    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
      controls.dispose();
      scene.traverse((o) => (o as THREE.Mesh).geometry?.dispose?.());
      Object.values(mat).forEach((m) => m.dispose());
      renderer.dispose();
      renderer.domElement.remove();
      api.current = null;
    };
  }, []);

  const toggle = (p: number) => {
    const v = !on[p];
    setOn({ ...on, [p]: v });
    api.current?.setPhase(p, v);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="relative h-[520px] overflow-hidden rounded-xl border border-[#d3dde6] md:h-[620px]">
        <div ref={host} role="img" aria-label="A concept model of the development: homes, commercial and the estate. Drag to turn it." className="h-full w-full cursor-grab touch-none active:cursor-grabbing" />
        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          {PHASES.map((p) => (
            <button key={p.id} type="button" aria-pressed={on[p.id]} onClick={() => toggle(p.id)}
              className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] backdrop-blur transition-colors ${on[p.id] ? "border-[#04070d] bg-[#04070d] text-[#f2f7fb]" : "border-[#d3dde6] bg-white/80 text-[#4d5b6c]"}`}>
              {p.name}
            </button>
          ))}
        </div>
        <button type="button" onClick={() => api.current?.fly()} className="absolute bottom-3 right-3 rounded-md bg-[#04070d] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#f2f7fb] hover:opacity-85">
          Fly through
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {PHASES.map((p) => (
          <div key={p.id} className="flex flex-col gap-1 border-t border-[#d3dde6] pt-3">
            <span className="text-sm font-semibold">{p.name}</span>
            <span className="text-sm text-[#4d5b6c]">{p.note}</span>
          </div>
        ))}
      </div>
      <p className="text-xs leading-5 text-[#4d5b6c]">A concept model, not a site plan: drag to turn it, scroll to zoom, switch phases on and off. The real site plan replaces it as each phase is designed.</p>
    </div>
  );
}
