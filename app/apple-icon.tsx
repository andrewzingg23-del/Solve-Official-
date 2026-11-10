import { ImageResponse } from "next/og";

// The app icon from the launch boards: "S." on a soft lavender tile. Drawn in code, so there is no
// image file to drift from the system.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div style={{
      width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg, #f7f5ff 0%, #e4dcff 55%, #ffe3d6 100%)",
      color: "#15141d", fontSize: 106, fontWeight: 700, letterSpacing: -4, borderRadius: 0,
    }}>S.</div>,
    { ...size },
  );
}
