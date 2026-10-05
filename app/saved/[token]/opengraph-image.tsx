// The card a shared receipt shows in a link preview: the save, whose word it is and, for a part,
// its outline, on the white floor. Drawn from the same signed snapshot as the page.
import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { partOutlinePath } from "@/lib/bot/part";
import { receiptFromPath } from "@/lib/bot/receipt";
import { saveNumber, vouch } from "@/lib/bot/vouch";

export const alt = "A save on solve";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const INK = "#04070d", FLOOR = "#f2f7fb", MUTED = "#4d5b6c", POINT = "#0891b2";
const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const r = receiptFromPath((await params).token);
  const wordmark = `data:image/svg+xml;base64,${(await readFile(join(process.cwd(), "public/brand/solve-wordmark-on-light.svg"))).toString("base64")}`;
  const outline = r?.part ? partOutlinePath({ profile: r.part.outline, holes: r.part.holes }) : null;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: FLOOR, color: INK, padding: 64, fontSize: 28 }}>
        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "space-between", paddingRight: outline ? 48 : 0 }}>
          <img src={wordmark} alt="solve." height={48} style={{ height: 48 }} />
          {r ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 22, letterSpacing: 5, textTransform: "uppercase" }}>
                <div style={{ width: 16, height: 16, borderRadius: 8, background: POINT }} />
                {`Saved · ${saveNumber(r.n)}`}
              </div>
              <div style={{ display: "flex", fontSize: r.what.length > 60 ? 52 : 64, lineHeight: 1.08, letterSpacing: -1 }}>{r.what}</div>
              <div style={{ display: "flex", color: MUTED }}>{`${vouch(r.basis, r.owner)} · ${day(r.at)}`}</div>
            </div>
          ) : (
            <div style={{ display: "flex", fontSize: 64 }}>Everything here is real.</div>
          )}
          <div style={{ display: "flex", color: MUTED, fontSize: 24 }}>{r ? "Everything here is real." : ""}</div>
        </div>
        {outline ? (
          <div style={{ display: "flex", width: 420, alignItems: "center", justifyContent: "center", background: "#ffffff", border: "1px solid #d3dde6", borderRadius: 24 }}>
            <svg width={340} height={340} viewBox={`-6 -6 ${outline.width + 12} ${outline.height + 12}`}>
              <path d={outline.d} fillRule="evenodd" fill={INK} fillOpacity={0.06} stroke={INK} strokeWidth={1.2} strokeLinejoin="round" />
            </svg>
          </div>
        ) : null}
      </div>
    ),
    { ...size },
  );
}
