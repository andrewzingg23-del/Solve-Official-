import assert from "node:assert/strict";
import { it } from "node:test";
import { estimateTokens, packContext, truncateToTokens, type ContextLayer } from "../../lib/ai/context";

const txt = (chars: number, c = "x") => c.repeat(chars);

it("estimateTokens is ~4 chars/token, never negative", () => {
  assert.equal(estimateTokens(""), 0);
  assert.equal(estimateTokens("abcd"), 1);
  assert.equal(estimateTokens("abcde"), 2);
  assert.equal(estimateTokens(txt(400)), 100);
});

it("truncateToTokens never exceeds the cap and marks a cut", () => {
  assert.equal(truncateToTokens("anything", 0), "");
  assert.equal(truncateToTokens(txt(40), 100), txt(40), "short text passes through");
  const cut = truncateToTokens(txt(400), 10); // cap 10 tokens = 40 chars
  assert.ok(estimateTokens(cut) <= 10, "estimate within cap");
  assert.ok(cut.endsWith("…"), "cut is marked");
  assert.equal(cut.length, 40);
});

it("caps every layer and the whole pack, deterministically", () => {
  const layers: ContextLayer[] = [
    { name: "rules", text: txt(1000), cap: 10 }, // wants 10 tokens
    { name: "profile", text: txt(1000), cap: 20 },
    { name: "ask", text: txt(1000), cap: 5, required: true },
  ];
  const a = packContext(layers, 1000);
  const b = packContext(layers, 1000);
  assert.deepEqual(a, b, "deterministic");
  for (const l of a.layers) {
    const cap = layers.find((x) => x.name === l.name)!.cap;
    assert.ok(l.tokens <= cap, `${l.name} within its cap`);
  }
  assert.ok(a.totalTokens <= a.budgetTokens);
  // All three fit comfortably: 10 + 20 + 5 = 35 tokens.
  assert.equal(a.layers.find((l) => l.name === "rules")!.tokens, 10);
  assert.equal(a.layers.find((l) => l.name === "profile")!.tokens, 20);
  assert.equal(a.layers.find((l) => l.name === "ask")!.tokens, 5);
});

it("drops the lowest-priority optional layers first when the budget is tight", () => {
  const layers: ContextLayer[] = [
    { name: "rules", text: txt(400), cap: 100 }, // wants 100
    { name: "profile", text: txt(400), cap: 100 }, // wants 100
    { name: "facts", text: txt(400), cap: 100 }, // wants 100
  ];
  const packed = packContext(layers, 150); // only 150 of the wanted 300
  const got = (n: string) => packed.layers.find((l) => l.name === n)!.tokens;
  assert.equal(got("rules"), 100, "highest priority filled");
  assert.equal(got("profile"), 50, "next takes what's left");
  assert.equal(got("facts"), 0, "lowest priority dropped");
  assert.ok(packed.totalTokens <= 150);
});

it("reserves the required ask before optional layers, even under pressure", () => {
  const layers: ContextLayer[] = [
    { name: "rules", text: txt(4000), cap: 1000 }, // would eat everything
    { name: "ask", text: txt(80), cap: 50, required: true }, // 20 tokens wanted
  ];
  const packed = packContext(layers, 100);
  assert.equal(packed.layers.find((l) => l.name === "ask")!.tokens, 20, "ask kept whole");
  assert.equal(packed.layers.find((l) => l.name === "rules")!.tokens, 80, "rules take the remaining 80");
  assert.ok(packed.totalTokens <= 100);
  // Output order follows the given order (rules before ask), not allocation order.
  assert.ok(packed.text.indexOf("x".repeat(10)) < packed.text.lastIndexOf("x"));
});

it("omits blank layers from the assembled text but still accounts for them", () => {
  const layers: ContextLayer[] = [
    { name: "rules", text: "RULES", cap: 100 },
    { name: "profile", text: "", cap: 100 },
    { name: "ask", text: "HELLO", cap: 100, required: true },
  ];
  const packed = packContext(layers, 100);
  assert.equal(packed.text, "RULES\n\nHELLO");
  assert.equal(packed.layers.length, 3, "every layer is accounted for");
  assert.equal(packed.layers.find((l) => l.name === "profile")!.tokens, 0);
});

it("a zero budget yields nothing", () => {
  const packed = packContext([{ name: "ask", text: "hi", cap: 10, required: true }], 0);
  assert.equal(packed.text, "");
  assert.equal(packed.totalTokens, 0);
});
