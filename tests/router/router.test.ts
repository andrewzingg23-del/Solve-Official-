import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateKeyPairSigner } from "@solana/kit";
import { solve } from "../../lib/chain/solve";
import { formatRatio } from "../../lib/router/math";
import type { Quote, Route } from "../../lib/router/types";
import { ARC, DEFAULT_VENUES, paymentMarket, USD, type AmmSpec, type Market } from "../support/payment-fixture";

async function setup(options?: Parameters<typeof paymentMarket>[0], holdings: Record<string, bigint> = { ARC: ARC(1_000), DEV_SOLVE: solve(1_000) }) {
  const market = await paymentMarket(options);
  const alice = await generateKeyPairSigner();
  const bob = await generateKeyPairSigner();
  for (const [code, amount] of Object.entries(holdings)) await market.fund(alice.address, code, amount);
  const quote = (overrides: Partial<Parameters<Market["router"]["quote"]>[0]> = {}) =>
    market.router.quote({
      payer: alice.address,
      recipient: bob.address,
      denomination: "DEV_USDC",
      amount: USD(10),
      accepts: ["DEV_USDC"],
      maxSlippageBps: 50,
      ...overrides,
    });
  return { market, alice, bob, quote };
}

const venues = (route: Route) => route.legs.map((l) => l.venue).join(">") || "transfer";
const reasons = (quote: Quote) => quote.rejected.map((r) => r.reason).join("\n");

describe("route search", () => {
  it("compares every route, ranks by cost in the denomination, and accounts for every unit", async () => {
    const { quote } = await setup();
    const q = await quote();
    assert.ok(q.routes.length >= 6, `expected the full set of routes, got ${q.routes.length}`);
    assert.equal(q.best, q.routes[0]);
    for (let i = 1; i < q.routes.length; i++) assert.ok(q.routes[i - 1].costs.total <= q.routes[i].costs.total);

    for (const route of q.routes) {
      const c = route.costs;
      // NetOutput = Gross − NetworkCost − TradingFees − ProviderFees − Slippage, exactly.
      assert.equal(c.netOutput, c.gross - c.networkCost - c.tradingFees - c.providerFees - c.slippage);
      assert.equal(c.netOutput, USD(10));
      // Spot value of the input exceeds what it executes for.
      assert.ok(c.gross > c.netOutput);
      assert.ok(c.slippage >= BigInt(0));
      assert.equal(route.deliverAmount, USD(10));
      assert.equal(route.network.paidBy, "sponsor");
      for (const leg of route.legs) {
        assert.ok(leg.spot.num > BigInt(0) && leg.depth.output > leg.amountOut);
        assert.ok(Date.parse(leg.observedAt) > 0);
      }
    }
    // State-market legs carry the provider fee separately from the trading fee.
    const viaState = q.routes.find((r) => r.legs.some((l) => l.kind === "state_market"))!;
    assert.ok(viaState.costs.providerFees > BigInt(0));
    assert.ok(Date.parse(q.expiresAt) - Date.parse(q.quotedAt) === 30_000);
    assert.equal(formatRatio(q.marks.ARC.price, 6, 6), "0.5");
    assert.equal(formatRatio(q.marks.DEV_SOLVE.price, 9, 6), "0.1");
  });

  it("transfers directly when the payer already holds what the recipient accepts", async () => {
    const { quote } = await setup(undefined, { DEV_USDC: USD(50), ARC: ARC(100) });
    const q = await quote();
    assert.equal(venues(q.best!), "transfer");
    assert.equal(q.best!.costs.total, BigInt(0));
    assert.equal(q.best!.inputAmount, USD(10));
  });

  it("never forces SOLVE: the direct State-coin pool wins when it is cheaper", async () => {
    const { quote } = await setup(undefined, { ARC: ARC(1_000) });
    const q = await quote();
    assert.equal(venues(q.best!), "arc-usdc");
    assert.ok(q.routes.some((r) => venues(r) === "arc-solve>solve-usdc"), "the SOLVE path was still compared");
  });

  it("uses SOLVE as the intermediary only when that path is cheaper", async () => {
    const shallow: AmmSpec = { ...(DEFAULT_VENUES["arc-usdc"] as AmmSpec), reserves: [ARC(2_000), USD(1_000)] };
    const { quote } = await setup({ venues: { ...DEFAULT_VENUES, "arc-usdc": shallow } }, { ARC: ARC(1_000) });
    const q = await quote();
    assert.equal(venues(q.best!), "arc-solve>solve-usdc");
    const direct = q.routes.find((r) => venues(r) === "arc-usdc")!;
    assert.ok(direct.costs.total > q.best!.costs.total);
  });

  it("rejects routes the venues cannot fill", async () => {
    const { quote } = await setup(undefined, { ARC: ARC(10_000_000), DEV_SOLVE: solve(10_000_000) });
    const q = await quote({ amount: USD(150_000) });
    assert.equal(q.best, null);
    assert.match(reasons(q), /insufficient_liquidity/);
  });

  it("rejects routes the payer cannot afford", async () => {
    const { quote } = await setup(undefined, { ARC: ARC(5) });
    const q = await quote();
    assert.equal(q.best, null);
    assert.match(reasons(q), /insufficient_balance: needs \d+ ARC, holds 5000000/);
  });

  it("routes around a venue that is down (partial provider failure)", async () => {
    const { market, quote } = await setup(undefined, { ARC: ARC(1_000) });
    market.venue("arc-usdc").offline = true;
    const q = await quote();
    assert.equal(venues(q.best!), "arc-solve>solve-usdc");
    assert.ok(q.rejected.some((r) => r.path === "venue arc-usdc" && /provider_unavailable/.test(r.reason)));
    assert.ok(q.routes.every((r) => !venues(r).includes("arc-usdc")));
  });

  it("delivers another accepted asset sized by what it sells for, not by a price feed", async () => {
    const { market, quote } = await setup(undefined, { DEV_USDC: USD(100) });
    const q = await quote({ accepts: ["ARC"] });
    const best = q.best!;
    assert.equal(best.deliver, "ARC");
    // Selling what Bob receives yields at least $10 at executable prices.
    const sold = await market.venue("arc-usdc").quoteExactIn("ARC", "DEV_USDC", best.deliverAmount, market.clock.now());
    assert.ok(sold.amountOut >= USD(10));
    assert.equal(best.costs.netOutput, best.costs.gross - best.costs.networkCost - best.costs.tradingFees - best.costs.providerFees - best.costs.slippage);
  });

  it("reports venue TWAPs and refuses legs whose spot was pushed away from them", async () => {
    const { market, quote } = await setup(undefined, { ARC: ARC(1_000) });
    const pool = market.venue("arc-usdc");
    await pool.observe(market.clock.now());
    market.advance(600);
    let q = await quote({ maxSpotTwapDeviationBps: 100 });
    const leg = q.best!.legs[0];
    assert.equal(leg.venue, "arc-usdc");
    assert.equal(leg.twap!.samples, 1);
    assert.equal(formatRatio(leg.twap!.price, 6, 6), "0.5");

    // Someone drains USDC from the pool: ARC's spot there collapses relative to its history.
    await market.withdraw(market.venueSigners["arc-usdc"], "DEV_USDC", USD(30_000));
    q = await quote({ maxSpotTwapDeviationBps: 100 });
    assert.ok(q.rejected.some((r) => r.path.includes("arc-usdc") && /deviates \d+ bps from its TWAP/.test(r.reason)));
    assert.ok(q.routes.every((r) => !venues(r).includes("arc-usdc")));
  });
});
