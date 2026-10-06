// Public market sparkline data. Real Binance klines, 5-minute cache.
// Powers card micro-visualizations (packs page, home verb dock) without
// leaking the server-side trading lib to the client.
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const ALLOWED = new Set(["BTCUSDT", "SOLUSDT"]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const symbol = (url.searchParams.get("symbol") ?? "BTCUSDT").toUpperCase();
  if (!ALLOWED.has(symbol)) {
    return NextResponse.json({ error: "Unknown symbol." }, { status: 400 });
  }
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 48, 2), 96);
  try {
    const res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=${limit}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`Binance ${res.status}`);
    const klines = (await res.json()) as unknown[][];
    const closes = klines.map((k) => Number(k[4])).filter(Number.isFinite);
    if (closes.length < 2) throw new Error("No closes");
    const price = closes[closes.length - 1];
    const dayAgo = closes[Math.max(0, closes.length - 25)];
    const changePct24h = ((price - dayAgo) / dayAgo) * 100;
    return NextResponse.json({ symbol, closes, price, changePct24h });
  } catch {
    return NextResponse.json({ error: "Market data unavailable." }, { status: 502 });
  }
}
