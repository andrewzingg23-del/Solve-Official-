import type { MetadataRoute } from "next";

// PWA manifest so Solve installs to the home screen. The icon is drawn in code (app/icon.tsx).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Solve",
    short_name: "Solve",
    description: "Your digital life. In your hands.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f4fa",
    theme_color: "#f5f4fa",
    orientation: "portrait",
    icons: [{ src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" }],
  };
}
