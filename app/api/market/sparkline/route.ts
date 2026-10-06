// Public market sparkline data. Real klines via the shared trading lib
// (Binance first, Coinbase fallback) — no key, 5-minute cache.
// Powers card micro-visualizations (packs page, home verb dock).
import { NextResponse } from "next/server";
import { fetchKlines, type SymbolId } from "@/lib/packs/trading";

export const dynamic = "force-dynamic";

const ALLOWED: SymbolId[] = ["BTCUSDT", "SOLUSDT"];

export async function GET(request: Request) {
  const url = new URL(request.url);
  const symbol = (url.searchParams.get("symbol") ?? "BTCUSDT").toUpperCase() as SymbolId;
  if (!ALLOWED.includes(symbol)) {
    return NextResponse.json({ error: "Unknown symbol." }, { status: 400 });
  }
  const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 48, 2), 96);
  try {
    const candles = await fetchKlines(symbol, limit);
    const closes = candles.map((c) => c.close).filter(Number.isFinite);
    if (closes.length < 2) throw new Error("No closes");
    const price = closes[closes.length - 1];
    const dayAgo = closes[Math.max(0, closes.length - 25)];
    const changePct24h = ((price - dayAgo) / dayAgo) * 100;
    return NextResponse.json({ symbol, closes, price, changePct24h });
  } catch {
    return NextResponse.json({ error: "Market data unavailable." }, { status: 502 });
  }
}
