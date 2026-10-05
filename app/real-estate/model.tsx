"use client";

// The development model, loaded only in the browser.
import dynamic from "next/dynamic";

export const DevelopmentModel = dynamic(() => import("./development-3d").then((m) => m.Development3D), {
  ssr: false,
  loading: () => <div className="grid h-[520px] place-items-center rounded-xl border border-[#d3dde6] text-sm text-[#4d5b6c] md:h-[620px]">Loading the model…</div>,
});
