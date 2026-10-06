import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { candleStats, symbolLabel, type Candle } from "../../lib/packs/trading";

const candles: Candle[] = [
  { openTime: 1, open: 100, high: 110, low: 95, close: 105, volume: 10 },
  { openTime: 2, open: 105, high: 115, low: 100, close: 112, volume: 12 },
];

describe("trading pack", () => {
  it("labels symbols", () => {
    assert.equal(symbolLabel("BTCUSDT"), "Bitcoin");
    assert.equal(symbolLabel("SOLUSDT"), "Solana");
  });

  it("summarizes candles for the bot", () => {
    const stats = candleStats(candles);
    assert.match(stats, /112/);
    assert.match(stats, /\+12\.00%/);
  });

  it("handles empty data", () => {
    assert.equal(candleStats([]), "no data");
  });
});
