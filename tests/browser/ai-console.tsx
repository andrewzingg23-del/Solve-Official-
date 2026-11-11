// Browser fixture for the actual conversation component. No authentication or live provider.
import { useState } from "react";
import { createRoot } from "react-dom/client";
import { BASE_LOOK } from "../../lib/product/card";
import { environmentFor, environmentStyle } from "../../lib/product/environment";
import { AiConsole } from "../../app/ui/ai-console";
import "../../app/ui/system.css";
function applyTone(tone: "light" | "dark") {
  const env = environmentFor({ ...BASE_LOOK, tone });
  for (const [key, value] of Object.entries(environmentStyle(env))) document.documentElement.style.setProperty(key === "colorScheme" ? "color-scheme" : key, value);
  document.documentElement.dataset.tone = tone;
}
Object.assign(window, { fixtureTone: applyTone });
applyTone("light");
document.documentElement.style.setProperty("--font-sans", "system-ui");
function Fixture() {
  const [path, setPath] = useState("/world/a40c239c-f086-4f7b-919f-0b1a5d17791b");
  const [identity, setIdentity] = useState("fixture-one");
  return <>
    <p>Simulated provider responses. No live AI calls.</p>
    <button onClick={() => setPath("/people")}>Go to People</button>
    <button onClick={() => setIdentity("fixture-two")}>Switch fixture identity</button>
    <AiConsole identityKey={identity} open signedIn pathname={path} onClose={() => {}} />
  </>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
