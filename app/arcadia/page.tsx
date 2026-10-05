import { PracticeLabel } from "@/app/save-point";
import { WorldShell } from "@/app/world/shell";

// Arcadia is the sandbox: everything in it is simulated, so it always says Practice
// (docs/brand/BRAND.md §5). Nothing here gets a save point.
export default function ArcadiaPage() {
  return (
    <>
      <WorldShell />
      <div className="pointer-events-none fixed bottom-4 left-4 z-50 rounded-full border border-line bg-background/80 px-3 py-1.5 backdrop-blur-md">
        <PracticeLabel note="Arcadia is simulated, so nothing here counts." />
      </div>
    </>
  );
}
