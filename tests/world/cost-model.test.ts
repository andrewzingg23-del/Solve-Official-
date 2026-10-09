import assert from "node:assert/strict";
import { it } from "node:test";
import { calculateCost, costDocument, formatCost } from "../../lib/world/cost-model";
import { parseRoomTurn } from "../../lib/world/room";

const input = { currency: "USD" as const, batchSize: 100, wastePercent: 10, overhead: "25.00", assumptions: "Supplier prices are estimates; excludes tax and shipping.",
  items: [{ name: "Cartridge", quantityPerUnit: 2, unitCost: "1.25" }, { name: "Clip", quantityPerUnit: 1, unitCost: "0.10" }] };

it("calculates exact decimal material, waste, fixed overhead and per-unit estimates", () => {
  const result = calculateCost(input);
  assert.equal(result.materialPerUnitMinor, "260");
  assert.equal(result.totalMinor, "31100");
  assert.equal(result.perUnitMinor, "311");
  assert.equal(formatCost(result.totalMinor, "USD"), "$311.00");
  const doc = costDocument(input);
  assert.match(doc, /Estimate/);
  assert.match(doc, /Supplier prices are estimates/);
  assert.match(doc, /100/);
});

it("rounds fractional cents up once per batch and preserves exact large totals", () => {
  const small = calculateCost({ ...input, items: [{ name: "Part", quantityPerUnit: 1, unitCost: "0.01" }], batchSize: 3, wastePercent: 10, overhead: "0" });
  assert.equal(small.totalMinor, "4");
  assert.equal(small.perUnitMinor, "2");
  const large = calculateCost({ ...input, items: Array.from({ length: 20 }, () => ({ name: "Part", quantityPerUnit: 1000, unitCost: "1000000.00" })), batchSize: 1000000, wastePercent: 100, overhead: "0" });
  assert.equal(large.totalMinor, "4000000000000000000");
  assert.equal(formatCost(large.totalMinor, "EUR"), "€40,000,000,000,000,000.00");
});

it("rejects ambiguous currency, malformed decimals, missing parts and unbounded quantities", () => {
  for (const bad of [{ ...input, currency: "BTC" }, { ...input, batchSize: Infinity }, { ...input, batchSize: 0 },
    { ...input, items: [] }, { ...input, wastePercent: -1 }, { ...input, overhead: "1e9" },
    { ...input, items: [{ name: "Part", quantityPerUnit: 1.5, unitCost: "0.25" }] },
    { ...input, items: [{ name: "Part", quantityPerUnit: 1, unitCost: "0.001" }] }]) assert.throws(() => calculateCost(bad as typeof input));
});

it("validates shared-turn input without trusting browser attribution or supplied history", () => {
  const valid = { requestId: "request-1", text: "Hello", intent: "message" };
  for (const b of [null, [], { ...valid, intent: "execute" }, { ...valid, text: " " }, { ...valid, text: "x".repeat(8001) }, { ...valid, requestId: "" }])
    assert.equal(parseRoomTurn("world", b), null);
  assert.deepEqual(parseRoomTurn("world", { ...valid, actorId: "forged", history: ["private"] }), { ...valid, worldId: "world" });
});
