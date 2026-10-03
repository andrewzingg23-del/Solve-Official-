import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  capLadder,
  constantProductExactIn,
  constantProductExactOut,
  formatRatio,
  ladderExactIn,
  ladderExactOut,
  QuoteError,
  ratio,
  splitFees,
} from "../../lib/router/math";

const B = (n: number | string) => BigInt(n);
const fees = { tradingFeeBps: 30, providerFeeBps: 10 };
const liquidity = (error: unknown) => error instanceof QuoteError && error.reason === "insufficient_liquidity";

describe("constant product", () => {
  it("exact-out quotes the smallest input that delivers the amount", () => {
    for (const [out, rIn, rOut] of [
      [B(10_000_000), B(200_000_000_000), B(100_000_000_000)],
      [B(1), B(7), B(13)],
      [B(999_999), B(1_000_000), B(1_000_000)],
      [B("123456789012"), B("987654321098765"), B("555555555555")],
    ]) {
      const q = constantProductExactOut(out, rIn, rOut, fees);
      assert.equal(q.amountOut, out);
      assert.ok(constantProductExactIn(q.amountIn, rIn, rOut, fees).amountOut >= out);
      if (q.amountIn > B(1)) assert.ok(constantProductExactIn(q.amountIn - B(1), rIn, rOut, fees).amountOut < out, "not minimal");
    }
  });

  it("cannot sell what the pool does not hold", () => {
    assert.throws(() => constantProductExactOut(B(100), B(1_000), B(100), fees), liquidity);
    assert.throws(() => constantProductExactOut(B(1), B(0), B(100), fees), liquidity);
  });

  it("splits fees so the provider share plus the trading fee is the whole fee", () => {
    let previousNet = B(-1);
    for (let a = 1; a < 5000; a += 7) {
      const { tradingFee, providerFee, netIn } = splitFees(B(a), fees);
      assert.equal(tradingFee + providerFee + netIn, B(a));
      assert.ok(netIn >= previousNet, "net input must not fall as gross input rises");
      previousNet = netIn;
    }
  });
});

describe("price ladder", () => {
  const levels = [
    { price: ratio(B(2), B(1)), size: B(100) },
    { price: ratio(B(3), B(2)), size: B(300) },
  ];

  it("walks levels best first and quotes exact-out minimally", () => {
    const none = { tradingFeeBps: 0, providerFeeBps: 0 };
    assert.equal(ladderExactIn(B(50), levels, none).amountOut, B(100));
    assert.equal(ladderExactIn(B(60), levels, none).amountOut, B(115));
    const q = ladderExactOut(B(250), levels, fees);
    assert.ok(ladderExactIn(q.amountIn, levels, fees).amountOut >= B(250));
    assert.ok(ladderExactIn(q.amountIn - B(1), levels, fees).amountOut < B(250));
  });

  it("never quotes beyond the maker's inventory", () => {
    const capped = capLadder(levels, B(150));
    assert.deepEqual(capped.map((l) => l.size), [B(100), B(50)]);
    assert.throws(() => ladderExactOut(B(151), capped, fees), liquidity);
  });
});

it("formats base-unit ratios as human prices", () => {
  // 100,000 DEV-USDC (6 decimals) per 200,000 ARC (6 decimals)
  assert.equal(formatRatio(ratio(B(100_000_000_000), B(200_000_000_000)), 6, 6), "0.5");
  // 50,000 DEV-USDC (6) per 500,000 DEV-SOLVE (9)
  assert.equal(formatRatio(ratio(B(50_000_000_000), B("500000000000000")), 9, 6), "0.1");
});
