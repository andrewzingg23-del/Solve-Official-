import { WorldShell } from "./world/shell";

// The World is the interface: Earth, You, Horizon. Sign-in is off for now; the World runs on the
// real kernel in your browser, seeded from Arcadia.
export default function Home() {
  return <WorldShell />;
}
