"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";

// Snapshot from the Oct 7, 2026 FOMO feed read — labeled as a snapshot, not live.
interface Cloud {
  label: string;
  value: string;
  change: string;
  up: boolean;
  orbit: number;
  speed: number;
  phase: number;
  yBase: number;
}

const CLOUDS: Cloud[] = [
  { label: "LONG", value: "$1.95M MC", change: "-11.36%", up: false, orbit: 1.0, speed: 0.11, phase: 0.0, yBase: 0.9 },
  { label: "RHEA", value: "$79.1M MC", change: "+3.25%", up: true, orbit: 1.18, speed: -0.09, phase: 1.4, yBase: -0.7 },
  { label: "PONKE", value: "$12.6M MC", change: "-6.50%", up: false, orbit: 1.0, speed: 0.13, phase: 2.6, yBase: 1.3 },
  { label: "PRIORS", value: "$6.58M MC", change: "+5.13%", up: true, orbit: 1.32, speed: -0.07, phase: 3.5, yBase: -1.2 },
  { label: "SI", value: "$24.0M MC", change: "-10.26%", up: false, orbit: 1.18, speed: 0.1, phase: 4.7, yBase: 0.3 },
  { label: "BTC", value: "$83,316", change: "-2.59%", up: false, orbit: 0.82, speed: -0.14, phase: 0.8, yBase: -0.4 },
  { label: "ETH", value: "$2,577", change: "-4.58%", up: false, orbit: 0.82, speed: 0.12, phase: 2.2, yBase: 1.0 },
  { label: "SOL", value: "$116.46", change: "-3.47%", up: false, orbit: 1.32, speed: 0.08, phase: 5.4, yBase: -1.5 },
  { label: "HYPE", value: "$88.44", change: "-3.82%", up: false, orbit: 1.0, speed: -0.12, phase: 5.9, yBase: 0.1 },
];

const CYAN = new THREE.Color("#22d3ee");
const ICE = new THREE.Color("#f2f7fb");
const WARM = new THREE.Color("#e8a34c");
const DEEP = new THREE.Color("#04070d");

function easeOutExpo(x: number): number {
  return x >= 1 ? 1 : 1 - Math.pow(2, -10 * x);
}

function makeGlowTexture(inner: string, mid: string): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, inner);
  grad.addColorStop(0.35, mid);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeTextTexture(): THREE.Texture {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = 256;
  const g = c.getContext("2d")!;
  g.font = "900 170px Archivo, system-ui, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = "rgba(150,190,210,1)";
  g.fillText("ARGUS", 512, 140);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const PLASMA_VERT = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const PLASMA_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
}
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x),
             mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = p * 2.03 + vec2(1.7, 9.2);
    a *= 0.5;
  }
  return v;
}

void main() {
  vec2 uv = vUv;
  vec2 p = uv * vec2(3.2, 2.0);
  float t = uTime * 0.05;
  // domain warp — the classic shadertoy plasma drift
  vec2 q = vec2(fbm(p + vec2(t, -t * 0.6)), fbm(p + vec2(5.2 - t * 0.8, 1.3 + t)));
  vec2 r = vec2(fbm(p + 2.6 * q + vec2(1.7 + t * 0.5, 9.2)), fbm(p + 2.4 * q + vec2(8.3, 2.8 - t * 0.4)));
  float f = fbm(p + 2.8 * r);

  vec3 deep = vec3(0.016, 0.027, 0.051);   // abyssal blue-black
  vec3 mid  = vec3(0.035, 0.16, 0.23);     // deep sea
  vec3 vein = vec3(0.13, 0.83, 0.93);      // cyan #22d3ee
  vec3 warm = vec3(0.91, 0.64, 0.30);      // faint warm spark

  vec3 col = mix(deep, mid, smoothstep(0.25, 0.75, f));
  col = mix(col, vein, smoothstep(0.62, 0.92, f) * 0.55);
  col = mix(col, warm, smoothstep(0.78, 0.99, fbm(p * 1.7 - r)) * 0.10);

  // vignette
  float d = distance(uv, vec2(0.5));
  col *= smoothstep(0.95, 0.35, d);

  gl_FragColor = vec4(col, 1.0);
}
`;

const PARTICLE_VERT = /* glsl */ `
precision highp float;
attribute float aBand;
attribute float aAngle;
attribute float aRadius;
attribute float aSpeed;
attribute float aSize;
attribute float aSeed;
attribute float aWarm;
uniform float uTime;
varying float vTwinkle;
varying float vWarm;
varying float vDepth;

void main() {
  float ang = aAngle + uTime * aSpeed;
  float bandY = (aBand - 1.5) * 0.85;
  vec3 pos = vec3(
    cos(ang) * aRadius,
    bandY + sin(uTime * 0.6 + aSeed * 6.28) * 0.22,
    sin(ang) * aRadius * 0.62
  );
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  float tw = 0.55 + 0.45 * sin(uTime * (1.2 + aSeed * 2.0) + aSeed * 40.0);
  vTwinkle = tw;
  vWarm = aWarm;
  vDepth = clamp((-mv.z - 6.0) / 10.0, 0.0, 1.0);
  gl_PointSize = aSize * tw * (240.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}
`;

const PARTICLE_FRAG = /* glsl */ `
precision highp float;
varying float vTwinkle;
varying float vWarm;
varying float vDepth;
uniform vec3 uCyan;
uniform vec3 uIce;
uniform vec3 uWarm;

void main() {
  vec2 pc = gl_PointCoord - 0.5;
  float d = length(pc);
  if (d > 0.5) discard;
  float soft = smoothstep(0.5, 0.05, d);
  vec3 col = mix(mix(uIce, uCyan, 0.65), uWarm, vWarm);
  float a = soft * vTwinkle * (0.35 + 0.65 * (1.0 - vDepth));
  gl_FragColor = vec4(col * a, a);
}
`;

const CORE_VERT = /* glsl */ `
precision highp float;
varying vec3 vNormal;
varying vec3 vView;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vNormal = normalMatrix * normal;
  vView = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}
`;

const CORE_FRAG = /* glsl */ `
precision highp float;
varying vec3 vNormal;
varying vec3 vView;
uniform float uTime;
void main() {
  vec3 n = normalize(vNormal);
  vec3 v = normalize(vView);
  float fres = pow(1.0 - abs(dot(n, v)), 2.0);
  float pulse = 0.85 + 0.15 * sin(uTime * 1.7);
  vec3 deep = vec3(0.02, 0.10, 0.16);
  vec3 cyan = vec3(0.13, 0.83, 0.93);
  vec3 hot  = vec3(0.95, 0.98, 1.0);
  vec3 col = mix(deep, cyan, fres * pulse);
  col = mix(col, hot, pow(fres, 3.0) * 0.9);
  gl_FragColor = vec4(col, 1.0);
}
`;

// Energy beam as a shader ribbon: the cubic bezier is evaluated in the
// vertex shader from 4 uniforms, so anchors can orbit with zero re-uploads.
const BEAM_VERT = /* glsl */ `
precision highp float;
attribute float aT;
attribute float aSide;
uniform vec3 uP0, uP1, uP2, uP3;
uniform float uWidth;
varying vec2 vUv;

vec3 bez(float t) {
  float it = 1.0 - t;
  return it*it*it*uP0 + 3.0*it*it*t*uP1 + 3.0*it*t*t*uP2 + t*t*t*uP3;
}
vec3 bezD(float t) {
  float it = 1.0 - t;
  return 3.0*it*it*(uP1-uP0) + 6.0*it*t*(uP2-uP1) + 3.0*t*t*(uP3-uP2);
}

void main() {
  vUv = vec2(aT, aSide);
  vec3 p = bez(aT);
  vec3 tangent = normalize(bezD(aT));
  // offset the ribbon in view space so it always faces the camera
  vec4 mvP = modelViewMatrix * vec4(p, 1.0);
  vec3 tangentView = normalize((modelViewMatrix * vec4(tangent, 0.0)).xyz);
  vec3 viewDir = normalize(-mvP.xyz);
  vec3 side = normalize(cross(tangentView, viewDir));
  float taper = 0.3 + 0.7 * pow(sin(3.14159 * clamp(aT, 0.0, 1.0)), 0.7);
  vec3 offsetP = mvP.xyz + side * aSide * uWidth * taper;
  gl_Position = projectionMatrix * vec4(offsetP, 1.0);
}
`;

const BEAM_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uFlow;
uniform vec3 uColor;

void main() {
  float t = vUv.x;
  float edge = abs(vUv.y);
  float flow = fract(t * 2.5 - uTime * uFlow);
  float pulse = smoothstep(0.0, 0.12, flow) * smoothstep(0.42, 0.18, flow);
  float base = 0.22 + 0.78 * pulse;
  float coreLine = smoothstep(1.0, 0.15, edge);
  float endFade = smoothstep(1.0, 0.55, t) * smoothstep(0.0, 0.08, t);
  float a = base * coreLine * endFade;
  vec3 col = mix(uColor * 0.35, vec3(0.9, 0.98, 1.0), pulse * 0.85);
  gl_FragColor = vec4(col * a * 1.6, a);
}
`;

const RING_VERT = /* glsl */ `
precision highp float;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const RING_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime;
uniform float uSpeed;
uniform vec3 uColor;
uniform float uAlpha;
void main() {
  float ang = atan(vUv.y - 0.5, vUv.x - 0.5);
  float dash = step(0.45, fract(ang * 9.549 + uTime * uSpeed));
  float a = dash * uAlpha;
  gl_FragColor = vec4(uColor * a, a);
}
`;

const GRID_FRAG = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uTime;
void main() {
  vec2 g = abs(fract(vUv * 26.0) - 0.5);
  float line = 1.0 - smoothstep(0.0, 0.06, min(g.x, g.y));
  float d = distance(vUv, vec2(0.5));
  float fade = smoothstep(0.5, 0.12, d);
  // slow scanline sweep
  float sweep = smoothstep(0.06, 0.0, abs(vUv.y - fract(uTime * 0.05)));
  vec3 cyan = vec3(0.13, 0.83, 0.93);
  float a = line * fade * 0.35 + sweep * fade * 0.25;
  gl_FragColor = vec4(cyan * a, a);
}
`;

const STAR_VERT = /* glsl */ `
precision highp float;
attribute float aSize;
attribute float aSeed;
uniform float uTime;
varying float vA;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vA = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * (0.8 + aSeed) + aSeed * 50.0));
  gl_PointSize = aSize * (160.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}
`;

const STAR_FRAG = /* glsl */ `
precision highp float;
varying float vA;
void main() {
  vec2 pc = gl_PointCoord - 0.5;
  if (length(pc) > 0.5) discard;
  float s = smoothstep(0.5, 0.1, length(pc));
  gl_FragColor = vec4(vec3(0.75, 0.87, 0.95) * s * vA, s * vA * 0.8);
}
`;

export function ArgusWebGL() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const chipsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const el: HTMLDivElement = wrap;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isMobile = window.matchMedia("(pointer: coarse)").matches || el.clientWidth < 640;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: "high-performance" });
    } catch {
      return; // dispatcher falls back only on detection; this is a last guard
    }
    const DPR = Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2);
    renderer.setPixelRatio(DPR);
    renderer.setClearColor(DEEP, 1);
    renderer.domElement.style.position = "absolute";
    renderer.domElement.style.inset = "0";
    renderer.domElement.setAttribute("aria-hidden", "true");
    el.prepend(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x04070d, 0.026);
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
    camera.position.set(0, 1.7, 13.2);

    // ---- plasma background ----
    const plasmaMat = new THREE.ShaderMaterial({
      vertexShader: PLASMA_VERT,
      fragmentShader: PLASMA_FRAG,
      uniforms: { uTime: { value: 0 } },
      depthWrite: false,
    });
    const plasma = new THREE.Mesh(new THREE.PlaneGeometry(64, 36), plasmaMat);
    plasma.position.z = -17;
    scene.add(plasma);

    // ---- starfield ----
    const starN = isMobile ? 130 : 260;
    const starPos = new Float32Array(starN * 3);
    const starSize = new Float32Array(starN);
    const starSeed = new Float32Array(starN);
    for (let i = 0; i < starN; i++) {
      starPos[i * 3] = (Math.random() - 0.5) * 44;
      starPos[i * 3 + 1] = (Math.random() - 0.5) * 26;
      starPos[i * 3 + 2] = -6 - Math.random() * 9;
      starSize[i] = 0.5 + Math.random() * 1.4;
      starSeed[i] = Math.random() * 10;
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    starGeo.setAttribute("aSize", new THREE.BufferAttribute(starSize, 1));
    starGeo.setAttribute("aSeed", new THREE.BufferAttribute(starSeed, 1));
    const starMat = new THREE.ShaderMaterial({
      vertexShader: STAR_VERT,
      fragmentShader: STAR_FRAG,
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    scene.add(new THREE.Points(starGeo, starMat));

    // ---- ghost typography ----
    const ghost = new THREE.Mesh(
      new THREE.PlaneGeometry(11.5, 2.9),
      new THREE.MeshBasicMaterial({
        map: makeTextTexture(),
        transparent: true,
        opacity: 0.09,
        depthWrite: false,
      })
    );
    ghost.position.set(0, 0.5, -5.5);
    scene.add(ghost);

    // ---- volumetric core ----
    const coreGroup = new THREE.Group();
    scene.add(coreGroup);
    const coreMat = new THREE.ShaderMaterial({
      vertexShader: CORE_VERT,
      fragmentShader: CORE_FRAG,
      uniforms: { uTime: { value: 0 } },
    });
    const coreMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1.05, 3), coreMat);
    coreGroup.add(coreMesh);

    const glowTex = makeGlowTexture("rgba(240,252,255,1)", "rgba(34,211,238,0.55)");
    const glowTexWarm = makeGlowTexture("rgba(255,244,230,0.9)", "rgba(232,163,76,0.35)");
    const glowLayers: THREE.Sprite[] = [];
    [
      { tex: glowTex, s: 4.6, o: 0.5, x: 0 },
      { tex: glowTex, s: 7.4, o: 0.26, x: 0 },
      { tex: glowTex, s: 11.5, o: 0.12, x: 0 },
      { tex: glowTexWarm, s: 5.6, o: 0.10, x: 0.35 },
    ].forEach((g) => {
      const sp = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: g.tex,
          transparent: true,
          opacity: g.o,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      sp.scale.set(g.s, g.s, 1);
      sp.position.x = g.x;
      coreGroup.add(sp);
      glowLayers.push(sp);
    });
    // chromatic fringe ring
    const fringe = new THREE.Mesh(
      new THREE.TorusGeometry(1.35, 0.03, 8, 96),
      new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    coreGroup.add(fringe);
    const fringeWarm = new THREE.Mesh(
      new THREE.TorusGeometry(1.42, 0.015, 8, 96),
      new THREE.MeshBasicMaterial({ color: WARM, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false })
    );
    fringeWarm.rotation.x = 0.35;
    coreGroup.add(fringeWarm);

    // energy blades — 5 rotating conic planes
    const bladeMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      uniforms: { uTime: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
      `,
      fragmentShader: /* glsl */ `
        precision highp float;
        varying vec2 vUv;
        void main() {
          float along = vUv.x;
          float edge = abs(vUv.y - 0.5) * 2.0;
          float a = smoothstep(1.0, 0.2, edge) * smoothstep(0.0, 0.25, along) * smoothstep(1.0, 0.45, along);
          vec3 col = mix(vec3(0.13, 0.83, 0.93), vec3(0.9, 0.98, 1.0), smoothstep(0.6, 0.0, edge));
          gl_FragColor = vec4(col * a * 0.9, a * 0.55);
        }
      `,
    });
    const blades = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const blade = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.42), bladeMat);
      const a = (i / 5) * Math.PI * 2;
      blade.position.set(Math.cos(a) * 1.5, 0, Math.sin(a) * 1.5);
      blade.rotation.y = -a + Math.PI / 2;
      blade.rotation.z = 0.35;
      blades.add(blade);
    }
    coreGroup.add(blades);

    const coreLight = new THREE.PointLight(0x22d3ee, 60, 20, 1.8);
    coreGroup.add(coreLight);

    // ---- GPU particle vortex ----
    const pCount = isMobile ? 2200 : 5200;
    const BANDS = [2.0, 2.7, 3.4, 4.1];
    const pBand = new Float32Array(pCount);
    const pAngle = new Float32Array(pCount);
    const pRadius = new Float32Array(pCount);
    const pSpeed = new Float32Array(pCount);
    const pSize = new Float32Array(pCount);
    const pSeed = new Float32Array(pCount);
    const pWarm = new Float32Array(pCount);
    for (let i = 0; i < pCount; i++) {
      const band = i % BANDS.length;
      pBand[i] = band;
      pAngle[i] = Math.random() * Math.PI * 2;
      pRadius[i] = BANDS[band] * (0.88 + Math.random() * 0.24);
      pSpeed[i] = (0.1 + Math.random() * 0.24) * (Math.random() < 0.5 ? 1 : -1);
      pSize[i] = 0.5 + Math.random() * 1.6 + (Math.random() < 0.03 ? 2.4 : 0);
      pSeed[i] = Math.random();
      pWarm[i] = Math.random() < 0.05 ? 1 : 0;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(pCount * 3), 3)); // dummy; real pos in shader
    pGeo.setAttribute("aBand", new THREE.BufferAttribute(pBand, 1));
    pGeo.setAttribute("aAngle", new THREE.BufferAttribute(pAngle, 1));
    pGeo.setAttribute("aRadius", new THREE.BufferAttribute(pRadius, 1));
    pGeo.setAttribute("aSpeed", new THREE.BufferAttribute(pSpeed, 1));
    pGeo.setAttribute("aSize", new THREE.BufferAttribute(pSize, 1));
    pGeo.setAttribute("aSeed", new THREE.BufferAttribute(pSeed, 1));
    pGeo.setAttribute("aWarm", new THREE.BufferAttribute(pWarm, 1));
    const pMat = new THREE.ShaderMaterial({
      vertexShader: PARTICLE_VERT,
      fragmentShader: PARTICLE_FRAG,
      uniforms: { uTime: { value: 0 }, uCyan: { value: CYAN }, uIce: { value: ICE }, uWarm: { value: WARM } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const vortex = new THREE.Points(pGeo, pMat);
    vortex.frustumCulled = false;
    scene.add(vortex);

    // ---- orbital rings (dashed) ----
    const ringUniformsList: THREE.ShaderMaterial[] = [];
    [2.55, 3.35, 4.35].forEach((r, i) => {
      const m = new THREE.ShaderMaterial({
        vertexShader: RING_VERT,
        fragmentShader: RING_FRAG,
        uniforms: {
          uTime: { value: 0 },
          uSpeed: { value: (i % 2 === 0 ? 1 : -1) * (0.05 + i * 0.02) },
          uColor: { value: CYAN },
          uAlpha: { value: 0.4 - i * 0.08 },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(new THREE.RingGeometry(r - 0.02, r + 0.02, 128), m);
      ring.rotation.x = -Math.PI / 2 + 0.28;
      ring.position.y = (i - 1) * 0.35;
      scene.add(ring);
      ringUniformsList.push(m);
    });

    // ---- grid floor ----
    const gridMat = new THREE.ShaderMaterial({
      vertexShader: RING_VERT,
      fragmentShader: GRID_FRAG,
      uniforms: { uTime: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const grid = new THREE.Mesh(new THREE.PlaneGeometry(46, 46), gridMat);
    grid.rotation.x = -Math.PI / 2;
    grid.position.y = -3.8;
    scene.add(grid);

    // ---- beams (shader ribbons) + comets ----
    const SEG = 48;
    const beamGroup = new THREE.Group();
    scene.add(beamGroup);
    interface Beam {
      mat: THREE.ShaderMaterial;
      curve: THREE.CubicBezierCurve3;
      p0: THREE.Vector3; p1: THREE.Vector3; p2: THREE.Vector3; p3: THREE.Vector3;
      comets: THREE.Sprite[];
      speed: number;
      offset: number;
    }
    const beams: Beam[] = [];
    const cometTex = makeGlowTexture("rgba(255,255,255,1)", "rgba(34,211,238,0.7)");
    CLOUDS.forEach(() => {
      const geo = new THREE.BufferGeometry();
      const posArr = new Float32Array((SEG + 1) * 2 * 3);
      const tArr = new Float32Array((SEG + 1) * 2);
      const sArr = new Float32Array((SEG + 1) * 2);
      const idx: number[] = [];
      for (let s = 0; s <= SEG; s++) {
        const t = s / SEG;
        for (let k = 0; k < 2; k++) {
          const vi = s * 2 + k;
          tArr[vi] = t;
          sArr[vi] = k === 0 ? -1 : 1;
        }
        if (s < SEG) {
          const a = s * 2, b = s * 2 + 1, d = s * 2 + 2, e = s * 2 + 3;
          idx.push(a, b, d, b, e, d);
        }
      }
      geo.setAttribute("position", new THREE.BufferAttribute(posArr, 3));
      geo.setAttribute("aT", new THREE.BufferAttribute(tArr, 1));
      geo.setAttribute("aSide", new THREE.BufferAttribute(sArr, 1));
      geo.setIndex(idx);
      const mat = new THREE.ShaderMaterial({
        vertexShader: BEAM_VERT,
        fragmentShader: BEAM_FRAG,
        uniforms: {
          uP0: { value: new THREE.Vector3() },
          uP1: { value: new THREE.Vector3() },
          uP2: { value: new THREE.Vector3() },
          uP3: { value: new THREE.Vector3() },
          uWidth: { value: 0.075 },
          uTime: { value: 0 },
          uFlow: { value: 0.55 + Math.random() * 0.4 },
          uColor: { value: CYAN },
        },
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.frustumCulled = false;
      beamGroup.add(mesh);
      const comets: THREE.Sprite[] = [];
      for (let k = 0; k < 3; k++) {
        const sp = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: cometTex,
            transparent: true,
            opacity: 0.9 - k * 0.28,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          })
        );
        const sc = 0.55 - k * 0.13;
        sp.scale.set(sc, sc, 1);
        beamGroup.add(sp);
        comets.push(sp);
      }
      beams.push({
        mat,
        curve: new THREE.CubicBezierCurve3(new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()),
        p0: new THREE.Vector3(), p1: new THREE.Vector3(), p2: new THREE.Vector3(), p3: new THREE.Vector3(),
        comets,
        speed: 0.16 + Math.random() * 0.1,
        offset: Math.random(),
      });
    });

    // ---- post: real bloom ----
    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 1.05, 0.75, 0.5);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    function resize() {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      composer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    // ---- cloud anchors + HTML overlay ----
    const anchors = CLOUDS.map(() => new THREE.Vector3());
    const projV = new THREE.Vector3();
    const chips = chipsRef.current;

    function anchorAt(i: number, t: number, intro: number, out: THREE.Vector3) {
      const c = CLOUDS[i];
      const ang = c.phase + t * c.speed;
      const radius = 4.6 * c.orbit * (0.25 + 0.75 * intro);
      out.set(
        Math.cos(ang) * radius,
        c.yBase + Math.sin(t * 0.5 + c.phase) * 0.16,
        Math.sin(ang) * radius * 0.62
      );
      return out;
    }

    function updateBeams(t: number) {
      beams.forEach((b, i) => {
        const a = anchors[i];
        b.p3.copy(a);
        const dir = b.p0.copy(a).normalize();
        b.p0.copy(dir).multiplyScalar(1.25);
        b.p1.copy(b.p0).multiplyScalar(1.9).add(new THREE.Vector3(0, 0.7, 0));
        b.p2.copy(a).multiplyScalar(0.72).add(new THREE.Vector3(0, 1.0, 0));
        b.curve.v0.copy(b.p0); b.curve.v1.copy(b.p1); b.curve.v2.copy(b.p2); b.curve.v3.copy(b.p3);
        (b.mat.uniforms.uP0.value as THREE.Vector3).copy(b.p0);
        (b.mat.uniforms.uP1.value as THREE.Vector3).copy(b.p1);
        (b.mat.uniforms.uP2.value as THREE.Vector3).copy(b.p2);
        (b.mat.uniforms.uP3.value as THREE.Vector3).copy(b.p3);
        b.mat.uniforms.uTime.value = t;
        const ct = (t * b.speed + b.offset) % 1;
        b.comets.forEach((sp, k) => {
          const tt = (ct - k * 0.022 + 1) % 1;
          b.curve.getPoint(tt, sp.position);
          const s = (0.55 - k * 0.13) * (0.8 + 0.4 * Math.sin(t * 6 + k));
          sp.scale.set(s, s, 1);
        });
      });
    }

    function updateChips(t: number) {
      const w = el.clientWidth;
      const h = el.clientHeight;
      chips.forEach((chip, i) => {
        if (!chip) return;
        const intro = easeOutExpo(Math.min(1, Math.max(0, (t - i * 0.09) / 1.4)));
        projV.copy(anchors[i]).project(camera);
        const x = (projV.x * 0.5 + 0.5) * w;
        const y = (-projV.y * 0.5 + 0.5) * h;
        const depth = THREE.MathUtils.clamp((anchors[i].z + 5) / 10, 0, 1);
        const s = 0.68 + 0.32 * depth;
        chip.style.transform = `translate(-50%,-50%) translate(${x.toFixed(1)}px,${y.toFixed(1)}px) scale(${s.toFixed(3)})`;
        chip.style.opacity = (intro * (0.35 + 0.65 * depth)).toFixed(3);
        chip.style.zIndex = String(100 + Math.round(depth * 40));
      });
    }

    // ---- pointer parallax ----
    let px = 0, py = 0, tx = 0, ty = 0;
    const onPointer = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
    };
    el.addEventListener("pointermove", onPointer);

    let raf = 0;
    let running = true;
    const io = new IntersectionObserver((es) => {
      running = es[0]?.isIntersecting ?? true;
    });
    io.observe(wrap);

    const clock = new THREE.Clock();

    function frame(t: number) {
      plasmaMat.uniforms.uTime.value = t;
      starMat.uniforms.uTime.value = t;
      pMat.uniforms.uTime.value = t;
      coreMat.uniforms.uTime.value = t;
      gridMat.uniforms.uTime.value = t;
      ringUniformsList.forEach((m) => { m.uniforms.uTime.value = t; });
      bladeMat.uniforms.uTime.value = t;

      coreMesh.rotation.y = t * 0.25;
      coreMesh.rotation.x = Math.sin(t * 0.18) * 0.3;
      blades.rotation.y = -t * 0.35;
      fringe.rotation.z = t * 0.4;
      fringeWarm.rotation.z = -t * 0.3;
      const pulse = 1 + Math.sin(t * 1.7) * 0.05;
      glowLayers.forEach((sp, i) => {
        const base = [4.6, 7.4, 11.5, 5.6][i];
        const sc = base * pulse;
        sp.scale.set(sc, sc, 1);
      });
      coreLight.intensity = 55 + Math.sin(t * 1.7) * 10;

      px += (tx - px) * 0.04;
      py += (ty - py) * 0.04;
      camera.position.x = px * 0.9;
      camera.position.y = 1.7 + py * -0.5;
      camera.lookAt(0, 0.2, 0);

      CLOUDS.forEach((_, i) => {
        const intro = easeOutExpo(Math.min(1, Math.max(0, (t - i * 0.09) / 1.4)));
        anchorAt(i, t, intro, anchors[i]);
      });
      updateBeams(t);
      updateChips(t);

      composer.render();
    }

    if (reduced) {
      frame(6); // intro complete, static frame
    } else {
      const loop = () => {
        raf = requestAnimationFrame(loop);
        if (!running) return;
        frame(clock.getElapsedTime());
      };
      raf = requestAnimationFrame(loop);
    }

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      el.removeEventListener("pointermove", onPointer);
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = (mesh as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
        else if (mat) mat.dispose();
      });
      composer.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === wrap) el.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div ref={wrapRef} className="relative h-[480px] w-full md:h-[600px]">
      {CLOUDS.map((c, i) => (
        <div
          key={c.label}
          ref={(el) => { chipsRef.current[i] = el; }}
          className="glass pointer-events-none absolute left-0 top-0 px-3 py-2"
          style={{ opacity: 0, willChange: "transform" }}
          aria-hidden="true"
        >
          <p className="text-[11px] font-semibold tracking-wide text-foreground">{c.label}</p>
          <p className="text-[10px] tabular-nums text-muted">{c.value}</p>
          <p
            className="mt-0.5 inline-block text-[10px] font-semibold tabular-nums"
            style={{
              color: c.up ? "#00e5a0" : "#ff4d5e",
              textShadow: c.up ? "0 0 12px rgba(0,229,160,0.8)" : "0 0 12px rgba(255,77,94,0.8)",
            }}
          >
            {c.change}
          </p>
          <span
            className="pointer-events-none absolute inset-0 rounded-[inherit]"
            style={{ boxShadow: c.up ? "inset 0 0 0 1px rgba(0,229,160,0.35)" : "inset 0 0 0 1px rgba(255,77,94,0.35)" }}
            aria-hidden="true"
          />
        </div>
      ))}
    </div>
  );
}
