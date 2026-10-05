"use client";

// The proposal's 3D home, loaded only in the browser.
import dynamic from "next/dynamic";

const House3D = dynamic(() => import("../house-3d").then((m) => m.House3D), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-[#4d5b6c]">Loading the model…</div>,
});

export function ProposalModel({ panels }: { panels: number }) {
  return <House3D panels={panels} label={`Your home with ${panels} solar panels. Drag to turn it.`} />;
}
