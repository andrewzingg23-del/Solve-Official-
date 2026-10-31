import type { MetadataRoute } from "next";

// PWA manifest so Solve installs to the home screen (One Solve plan, Step 7
// "Installable"). Brand: abyssal navy #04070d, one cyan accent. The icon is the
// existing square brand mark (public/brand/solve-app-icon.svg). A dedicated
// raster/maskable icon set is a later polish; SVG + sizes "any" installs on
// current browsers and iOS 16.4+.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "solve",
    short_name: "solve",
    description: "A shared place for people, ideas and your AIs. Think, plan and build together.",
    start_url: "/",
    display: "standalone",
    background_color: "#04070d",
    theme_color: "#04070d",
    orientation: "portrait",
    icons: [
      {
        src: "/brand/solve-app-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
