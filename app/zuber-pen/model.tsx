"use client";

// The pen model, loaded only in the browser.
import dynamic from "next/dynamic";

export const PenModel = dynamic(() => import("./pen-3d").then((m) => m.Pen3D), {
  ssr: false,
  loading: () => <div className="grid h-[460px] place-items-center rounded-xl border border-[#d3dde6] text-sm text-[#4d5b6c]">Loading the pen…</div>,
});
