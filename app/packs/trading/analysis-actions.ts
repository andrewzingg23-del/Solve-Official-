"use server";

import Anthropic from "@anthropic-ai/sdk";
import { getUser } from "@/lib/supabase/server";
import { candleStats, marketSnapshot, symbolLabel, type SymbolId } from "@/lib/packs/trading";

export type MarketTicket = {
  trend: { label: string; detail: string; confidence: string };
  momentum: { label: string; detail: string; confidence: string };
  watch: { label: string; detail: string };
};

export async function analyzeMarket(): Promise<{ ok: boolean; ticket?: MarketTicket; error?: string }> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Sign in first." };
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return { ok: false, error: "The bot isn't configured on this deployment." };

  let snapshot;
  try {
    snapshot = await marketSnapshot();
  } catch {
    return { ok: false, error: "Market data is unavailable right now." };
  }

  const lines = (Object.keys(snapshot) as SymbolId[]).map(
    (s) => `${symbolLabel(s)} (${s}): ${candleStats(snapshot[s])}`,
  );
  const prompt = [
    "You are a market analyst bot. Read these 96-hour hourly stats.",
    "Return ONLY valid JSON with this shape:",
    '{"trend":{"label":"Bullish|Bearish|Neutral","detail":"one sentence","confidence":"High|Medium|Low"},"momentum":{"label":"Accelerating|Fading|Stable","detail":"one sentence","confidence":"High|Medium|Low"},"watch":{"label":"short phrase","detail":"one sentence"}}',
    "No financial advice, no buy/sell calls — observation only.",
    "",
    ...lines,
  ].join("\n");

  try {
    const client = new Anthropic({ apiKey });
    const res = await client.messages.create({
      model: "anthropic/claude-haiku-4-5",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });
    const text = res.content.find((b) => b.type === "text");
    const out = text?.type === "text" ? text.text.trim() : "";
    if (!out) return { ok: false, error: "The bot had nothing to say." };
    const ticket = JSON.parse(out) as MarketTicket;
    if (!ticket.trend || !ticket.momentum || !ticket.watch) throw new Error("bad shape");
    return { ok: true, ticket };
  } catch {
    return { ok: false, error: "The analysis failed. Try again." };
  }
}
