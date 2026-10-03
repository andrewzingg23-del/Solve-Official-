// Finds every way to pay: from each asset the payer holds to each asset the recipient accepts,
// directly or through up to three venue legs. Routes are ranked only by what they cost the payer
// in the denomination asset. No asset is preferred, so SOLVE is an intermediary only when it is
// the cheapest path.
import type { ChainGateway } from "../chain/gateway";
import { tokenAccountAddress, walletBalance } from "../chain/solve";
import { applyRatio, ceilDiv, compareRatio, mulRatio, QuoteError, UNIT_RATIO, type Ratio } from "./math";
import type { AssetCode, AssetInfo, CostBreakdown, LegQuote, PaymentRequest, Quote, RejectedRoute, Route, Venue } from "./types";

// Solana's base fee per signature.
export const LAMPORTS_PER_SIGNATURE = BigInt(5000);
const TOKEN_ACCOUNT_SIZE = BigInt(165);
const DEFAULT_TTL_SECONDS = 30;
const MAX_TTL_SECONDS = 120;

type Edge = { venue: Venue; input: AssetCode; output: AssetCode };

async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

const describe = (error: unknown) =>
  error instanceof QuoteError ? `${error.reason}: ${error.message}` : error instanceof Error ? error.message : String(error);

export const pathLabel = (from: AssetCode, steps: { venue: Venue | string; output: AssetCode }[]) =>
  steps.reduce((label, s) => `${label} -[${typeof s.venue === "string" ? s.venue : s.venue.id}]-> ${s.output}`, from);

export const maxInputFor = (inputAmount: bigint, maxSlippageBps: number) =>
  inputAmount + ceilDiv(inputAmount * BigInt(maxSlippageBps), BigInt(10_000));

export type RouterConfig = {
  gateway: ChainGateway;
  assets: AssetInfo[];
  venues: Venue[];
  clock?: () => Date;
  // Upper bound on candidate routes evaluated per quote.
  maxCandidates?: number;
};

export class PaymentRouter {
  readonly gateway: ChainGateway;
  private readonly assets = new Map<AssetCode, AssetInfo>();
  private readonly venues = new Map<string, Venue>();
  private readonly clock: () => Date;
  private readonly maxCandidates: number;

  constructor(config: RouterConfig) {
    this.gateway = config.gateway;
    for (const a of config.assets) this.assets.set(a.code, a);
    for (const v of config.venues) {
      if (this.venues.has(v.id)) throw new Error(`duplicate venue ${v.id}`);
      this.venues.set(v.id, v);
    }
    this.clock = config.clock ?? (() => new Date());
    this.maxCandidates = config.maxCandidates ?? 500;
  }

  asset(code: AssetCode) {
    const asset = this.assets.get(code);
    if (!asset) throw new Error(`unknown asset ${code}`);
    return asset;
  }

  venue(id: string) {
    const venue = this.venues.get(id);
    if (!venue) throw new Error(`unknown venue ${id}`);
    return venue;
  }

  now() {
    return this.clock();
  }

  // Simple paths from one asset to another: no asset or venue visited twice.
  private paths(edges: Edge[], from: AssetCode, to: AssetCode, maxHops: number): Edge[][] {
    const found: Edge[][] = [];
    const walk = (at: AssetCode, path: Edge[], seen: Set<AssetCode>) => {
      if (path.length > 0 && at === to) {
        found.push(path);
        return;
      }
      if (path.length === maxHops) return;
      for (const e of edges) {
        if (e.input !== at || seen.has(e.output) || path.some((p) => p.venue === e.venue)) continue;
        seen.add(e.output);
        walk(e.output, [...path, e], seen);
        seen.delete(e.output);
      }
    };
    walk(from, [], new Set([from]));
    return found;
  }

  // Quotes a path backwards so it delivers exactly `amountOut`.
  async quoteExactOut(path: Edge[], amountOut: bigint, now: Date): Promise<LegQuote[]> {
    const legs: LegQuote[] = [];
    let out = amountOut;
    for (let i = path.length - 1; i >= 0; i--) {
      const leg = await path[i].venue.quoteExactOut(path[i].input, path[i].output, out, now);
      legs.unshift(leg);
      out = leg.amountIn;
    }
    return legs;
  }

  private async quoteExactIn(path: Edge[], amountIn: bigint, now: Date) {
    let amount = amountIn;
    for (const e of path) amount = (await e.venue.quoteExactIn(e.input, e.output, amount, now)).amountOut;
    return amount;
  }

  async quote(request: PaymentRequest): Promise<Quote> {
    const now = this.clock();
    const ttl = request.quoteTtlSeconds ?? DEFAULT_TTL_SECONDS;
    const maxHops = request.maxHops ?? 3;
    if (request.amount <= BigInt(0)) throw new Error("amount must be positive");
    if (!Number.isInteger(request.maxSlippageBps) || request.maxSlippageBps < 0 || request.maxSlippageBps > 1000) {
      throw new Error("max slippage must be 0 to 1000 bps");
    }
    if (ttl <= 0 || ttl > MAX_TTL_SECONDS) throw new Error(`quote lifetime must be 1 to ${MAX_TTL_SECONDS} seconds`);
    if (maxHops < 1 || maxHops > 3) throw new Error("routes have 1 to 3 venue legs");
    if (request.accepts.length === 0) throw new Error("the recipient accepts no assets");
    const denomination = this.asset(request.denomination);
    for (const code of request.accepts) this.asset(code);

    const rejected: RejectedRoute[] = [];
    const excluded = new Set(request.excludeVenues ?? []);
    const edges: Edge[] = [];
    for (const venue of this.venues.values()) {
      if (excluded.has(venue.id)) continue;
      for (const [input, output] of venue.pairs()) {
        if (this.assets.has(input) && this.assets.has(output)) edges.push({ venue, input, output });
      }
    }

    // Spot marks: the best composed venue spot from each asset into the denomination.
    const spots = new Map<Edge, Ratio | null>();
    const unavailable = new Set<string>();
    for (const e of edges) {
      try {
        spots.set(e, await e.venue.spot(e.input, e.output));
      } catch (error) {
        spots.set(e, null);
        if (error instanceof QuoteError && error.reason === "provider_unavailable") unavailable.add(e.venue.id);
      }
    }
    for (const id of unavailable) rejected.push({ path: `venue ${id}`, reason: "provider_unavailable: venue did not quote" });
    const live = edges.filter((e) => spots.get(e) && !unavailable.has(e.venue.id));

    const marks: Quote["marks"] = { [denomination.code]: { price: UNIT_RATIO, path: denomination.code } };
    for (const asset of this.assets.values()) {
      if (asset.code === denomination.code) continue;
      for (const path of this.paths(live, asset.code, denomination.code, maxHops)) {
        const price = path.reduce((r, e) => mulRatio(r, spots.get(e)!), UNIT_RATIO);
        if (!marks[asset.code] || compareRatio(price, marks[asset.code].price) > 0) {
          marks[asset.code] = { price, path: pathLabel(asset.code, path) };
        }
      }
    }

    // What the recipient must receive of each accepted asset: the amount itself in the
    // denomination, otherwise the least that sells for the amount at executable prices.
    const deliveries: { asset: AssetCode; amount: bigint; value: bigint; valuation: string | null }[] = [];
    for (const code of new Set(request.accepts)) {
      if (code === denomination.code) {
        deliveries.push({ asset: code, amount: request.amount, value: request.amount, valuation: null });
        continue;
      }
      let best: { amount: bigint; path: Edge[] } | null = null;
      for (const path of this.paths(live, code, denomination.code, maxHops)) {
        try {
          const legs = await this.quoteExactOut(path, request.amount, now);
          if (!best || legs[0].amountIn < best.amount) best = { amount: legs[0].amountIn, path };
        } catch (error) {
          rejected.push({ path: `valuation ${pathLabel(code, path)}`, reason: describe(error) });
        }
      }
      if (!best) {
        rejected.push({ path: `deliver ${code}`, reason: `no executable valuation of ${code} in ${denomination.code}` });
        continue;
      }
      const value = await this.quoteExactIn(best.path, best.amount, now);
      deliveries.push({ asset: code, amount: best.amount, value, valuation: pathLabel(code, best.path) });
    }

    const balances = new Map<AssetCode, bigint>();
    for (const asset of this.assets.values()) balances.set(asset.code, await walletBalance(this.gateway, request.payer, asset.mint));

    const rentZero = await this.gateway.minimumBalanceForRentExemption(BigInt(0));
    const rentToken = await this.gateway.minimumBalanceForRentExemption(TOKEN_ACCOUNT_SIZE);
    const routes: Route[] = [];
    let candidates = 0;

    for (const delivery of deliveries) {
      const recipientAccount = await tokenAccountAddress(request.recipient, this.asset(delivery.asset).mint);
      const recipientRent = (await this.gateway.getAccount(recipientAccount)) ? BigInt(0) : rentToken;
      for (const source of this.assets.values()) {
        const balance = balances.get(source.code)!;
        if (balance === BigInt(0)) continue;
        const options: (Edge[] | null)[] =
          source.code === delivery.asset ? [null] : this.paths(live, source.code, delivery.asset, maxHops);
        for (const path of options) {
          if (++candidates > this.maxCandidates) break;
          const label = path ? pathLabel(source.code, path) : `${source.code} -[transfer]-> ${delivery.asset}`;
          let legs: LegQuote[] = [];
          try {
            if (path) legs = await this.quoteExactOut(path, delivery.amount, now);
          } catch (error) {
            rejected.push({ path: label, reason: describe(error) });
            continue;
          }
          const inputAmount = path ? legs[0].amountIn : delivery.amount;
          if (inputAmount > balance) {
            rejected.push({ path: label, reason: `insufficient_balance: needs ${inputAmount} ${source.code}, holds ${balance}` });
            continue;
          }
          const guard = this.twapGuard(legs, request.maxSpotTwapDeviationBps);
          if (guard) {
            rejected.push({ path: label, reason: guard });
            continue;
          }
          const mark = marks[source.code];
          if (!mark || legs.some((l) => !marks[l.input])) {
            rejected.push({ path: label, reason: `no spot mark for ${source.code} in ${denomination.code}` });
            continue;
          }
          const value = (amount: bigint, asset: AssetCode) => applyRatio(amount, marks[asset].price);
          const gross = value(inputAmount, source.code);
          const tradingFees = legs.reduce((s, l) => s + value(l.tradingFee, l.input), BigInt(0));
          const providerFees = legs.reduce((s, l) => s + value(l.providerFee, l.input), BigInt(0));
          const networkCost = BigInt(0);
          const netOutput = delivery.value;
          const costs: CostBreakdown = {
            denomination: denomination.code,
            gross,
            networkCost,
            tradingFees,
            providerFees,
            slippage: gross - netOutput - networkCost - tradingFees - providerFees,
            netOutput,
            total: gross - netOutput,
          };
          const signatures = 2 + new Set(legs.map((l) => l.venue)).size;
          const route: Omit<Route, "id"> = {
            hops: legs.length,
            input: source.code,
            inputAmount,
            maxInput: maxInputFor(inputAmount, request.maxSlippageBps),
            deliver: delivery.asset,
            deliverAmount: delivery.amount,
            legs,
            costs,
            network: {
              lamports: LAMPORTS_PER_SIGNATURE * BigInt(signatures) + rentZero + recipientRent,
              signatures,
              paidBy: "sponsor",
            },
          };
          const id = await sha256Hex(
            JSON.stringify([request.recipient, delivery.asset, delivery.amount, legs.map((l) => [l.venue, l.input, l.output, l.amountIn, l.amountOut])], (_, v) =>
              typeof v === "bigint" ? v.toString() : v,
            ),
          );
          routes.push({ id, ...route });
        }
      }
    }
    if (candidates > this.maxCandidates) rejected.push({ path: "search", reason: `stopped after ${this.maxCandidates} candidates` });

    routes.sort(
      (a, b) =>
        cmp(a.costs.total, b.costs.total) ||
        cmp(a.network.lamports, b.network.lamports) ||
        a.hops - b.hops ||
        (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
    const quotedAt = now.toISOString();
    const expiresAt = new Date(now.getTime() + ttl * 1000).toISOString();
    const id = await sha256Hex(`${quotedAt}|${request.payer}|${request.recipient}|${routes.map((r) => r.id).join(",")}`);
    return { id, quotedAt, expiresAt, request, marks, routes, best: routes[0] ?? null, rejected };
  }

  private twapGuard(legs: LegQuote[], maxDeviationBps: number | undefined) {
    if (maxDeviationBps === undefined) return null;
    for (const leg of legs) {
      if (!leg.twap) return `no TWAP from ${leg.venue} to check its spot against`;
      const { price } = leg.twap;
      // |spot − twap| / twap in bps
      const diff = leg.spot.num * price.den - price.num * leg.spot.den;
      const deviation = ((diff < BigInt(0) ? -diff : diff) * BigInt(10_000)) / (price.num * leg.spot.den);
      if (deviation > BigInt(maxDeviationBps)) return `spot on ${leg.venue} deviates ${deviation} bps from its TWAP`;
    }
    return null;
  }
}

const cmp = (a: bigint, b: bigint) => (a < b ? -1 : a > b ? 1 : 0);
