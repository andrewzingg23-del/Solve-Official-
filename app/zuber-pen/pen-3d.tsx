"use client";

// The pen, turning in the light. "Ring it" shows what Find-My does: the cap light pulses. A render of
// the design, not a photo of a shipping product.
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export function Pen3D() {
  const host = useRef<HTMLDivElement>(null);
  const ring = useRef<() => void>(() => {});

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    camera.position.set(0, 0.6, 16);
    scene.add(new THREE.HemisphereLight("#ffffff", "#b9c7d4", 1.2));
    const key = new THREE.DirectionalLight("#ffffff", 2.4);
    key.position.set(4, 6, 5);
    scene.add(key);
    const rim = new THREE.DirectionalLight("#bfe9f5", 1.4);
    rim.position.set(-5, 2, -4);
    scene.add(rim);

    const pen = new THREE.Group();
    const body = new THREE.MeshStandardMaterial({ color: "#04070d", metalness: 0.65, roughness: 0.28 });
    const steel = new THREE.MeshStandardMaterial({ color: "#c9d3dc", metalness: 1, roughness: 0.22 });
    const glow = new THREE.MeshStandardMaterial({ color: "#0891b2", emissive: "#22d3ee", emissiveIntensity: 0.15 });
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 4.2, 48), body);
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.2, 1.1, 48), steel);
    grip.position.y = -2.65;
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.55, 48), steel);
    tip.position.y = -3.48;
    tip.rotation.x = Math.PI;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 1.4, 48), body);
    cap.position.y = 2.75;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.285, 0.285, 0.12, 48), glow);
    band.position.y = 2.1;
    const end = new THREE.Mesh(new THREE.SphereGeometry(0.28, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), steel);
    end.position.y = 3.45;
    const clip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.5, 0.08), steel);
    clip.position.set(0, 2.55, 0.33);
    pen.add(barrel, grip, tip, cap, band, end, clip);
    pen.rotation.z = -0.5;
    pen.position.y = 0.5;
    scene.add(pen);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.autoRotate = !reduce;
    controls.autoRotateSpeed = 1.2;

    let ringing = 0;
    ring.current = () => {
      ringing = reduce ? 0.01 : 3;
    };

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
    let id = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (ringing > 0) {
        ringing = Math.max(0, ringing - dt);
        glow.emissiveIntensity = 0.3 + 1.7 * Math.abs(Math.sin(ringing * 8));
      } else {
        glow.emissiveIntensity = 0.15;
      }
      controls.update();
      renderer.render(scene, camera);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(id);
      observer.disconnect();
      controls.dispose();
      scene.traverse((o) => (o as THREE.Mesh).geometry?.dispose?.());
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div className="relative h-[460px] overflow-hidden rounded-xl border border-[#d3dde6] bg-[radial-gradient(70%_70%_at_50%_45%,#ffffff_0%,#e8eff5_100%)]">
      <div ref={host} role="img" aria-label="The Zuber pen, turning. Drag to turn it." className="h-full w-full cursor-grab touch-none active:cursor-grabbing" />
      <button type="button" onClick={() => ring.current()} className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-md bg-[#04070d] px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#f2f7fb] hover:opacity-85">
        Ring it
      </button>
      <span className="absolute left-4 top-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#4d5b6c]">A render of the design</span>
    </div>
  );
}
