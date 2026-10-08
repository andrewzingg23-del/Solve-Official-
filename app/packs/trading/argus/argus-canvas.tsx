"use client";

import { Suspense, lazy, useEffect, useState } from "react";

const ArgusWebGL = lazy(() =>
  import("./argus-webgl").then((m) => ({ default: m.ArgusWebGL }))
);
const ArgusFallback = lazy(() =>
  import("./argus-canvas-2d").then((m) => ({ default: m.ArgusCanvas2D }))
);

function webglAvailable(): boolean {
  try {
    if (typeof window === "undefined" || !window.WebGLRenderingContext) return false;
    const c = document.createElement("canvas");
    return !!(
      c.getContext("webgl2") ||
      c.getContext("webgl") ||
      c.getContext("experimental-webgl")
    );
  } catch {
    return false;
  }
}

function lowPowerDevice(): boolean {
  try {
    const ua = navigator.userAgent;
    // Very old mobile GPUs — the canvas-2D fallback looks better than a slideshow.
    if (/Android.*Chrome\/[0-4][0-9]\./.test(ua)) return true;
    if (/iPhone OS (1[0-3])_/.test(ua)) return true;
    if (typeof navigator.hardwareConcurrency === "number" && navigator.hardwareConcurrency <= 2) return true;
    return false;
  } catch {
    return false;
  }
}

// ARGUS machine v4: three.js + custom GLSL when the GPU is there,
// the canvas-2D v3 build as fallback. Same contract as before.
export function ArgusCanvas() {
  const [mode, setMode] = useState<"webgl" | "2d" | null>(null);

  useEffect(() => {
    // Capability detection must run after mount (needs a real canvas + DOM);
    // one-time, and avoids an SSR hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMode(webglAvailable() && !lowPowerDevice() ? "webgl" : "2d");
  }, []);

  if (mode === null) {
    return <div className="relative h-[480px] w-full md:h-[600px]" aria-hidden="true" />;
  }

  return (
    <Suspense
      fallback={<div className="relative h-[480px] w-full md:h-[600px]" aria-hidden="true" />}
    >
      {mode === "webgl" ? <ArgusWebGL /> : <ArgusFallback />}
    </Suspense>
  );
}
