// Trading pack market data: live klines from Binance's public API (no key).
// Server-side only — the page fetches, the chart renders, the bot analyzes.
// This is real market data; anything that looks like trading is labeled Practice.
export type Candle = {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type SymbolId = "BTCUSDT" | "SOLUSDT";

const SYMBOLS: SymbolId[] = ["BTCUSDT", "SOLUSDT"];

async function fetchKlines(symbol: SymbolId, limit = 96): Promise<Candle[]> {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=${limit}`;
  const res = await fetch(url, { next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`Market data unavailable (${res.status})`);
  const rows: unknown[][] = await res.json();
  return rows.map((r) => ({
    openTime: Number(r[0]),
    open: Number(r[1]),
    high: Number(r[2]),
    low: Number(r[3]),
    close: Number(r[4]),
    volume: Number(r[5]),
  }));
}

export async function marketSnapshot(): Promise<Record<SymbolId, Candle[]>> {
  const [btc, sol] = await Promise.all([fetchKlines("BTCUSDT"), fetchKlines("SOLUSDT")]);
  return { BTCUSDT: btc, SOLUSDT: sol };
}

export function symbolLabel(s: SymbolId): string {
  return s === "BTCUSDT" ? "Bitcoin" : "Solana";
}

// Compact stats for the bot's analysis prompt.
export function candleStats(candles: Candle[]): string {
  if (candles.length === 0) return "no data";
  const last = candles[candles.length - 1];
  const first = candles[0];
  const change = ((last.close - first.open) / first.open) * 100;
  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const recent = candles.slice(-24);
  const up = recent.filter((c) => c.close >= c.open).length;
  return [
    `last $${last.close.toLocaleString("en-US", { maximumFractionDigits: 2 })}`,
    `${change >= 0 ? "+" : ""}${change.toFixed(2)}% over ${candles.length}h`,
    `range $${Math.min(...lows).toLocaleString("en-US", { maximumFractionDigits: 2 })}–$${Math.max(...highs).toLocaleString("en-US", { maximumFractionDigits: 2 })}`,
    `${up}/24 recent hours green`,
  ].join(", ");
}

export const TRADING_SYMBOLS = SYMBOLS;
