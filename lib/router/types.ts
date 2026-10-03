// Payment routing vocabulary. Every price here is a quote from a named venue at a stated time.
// There is no protocol price: spot, TWAP and executable amounts are kept apart and labelled.
import type { Address, SignatureDictionary, Transaction } from "@solana/kit";
import type { Ratio } from "./math";

// Kernel asset code, e.g. DEV_USDC.
export type AssetCode = string;

export type AssetInfo = { code: AssetCode; symbol: string; mint: Address; decimals: number };

export type VenueKind = "amm" | "orderbook" | "aggregator" | "state_market";

// One venue's executable quote for one leg, with the facts needed to audit it later.
export type LegQuote = {
  venue: string;
  kind: VenueKind;
  operator: string;
  // How the venue prices, in words, e.g. "constant product over on-chain reserves".
  pricing: string;
  input: AssetCode;
  output: AssetCode;
  // Executable amounts in base units. amountIn includes both fees.
  amountIn: bigint;
  amountOut: bigint;
  tradingFee: bigint;
  providerFee: bigint;
  // Marginal price before fees and impact: output base units per input base unit.
  spot: Ratio;
  // Venue-reported time-weighted average of spot, when the venue has observations.
  twap: { price: Ratio; windowSeconds: number; samples: number } | null;
  // Liquidity the venue can draw on for this leg, in base units.
  depth: { input: bigint; output: bigint };
  observedAt: string;
};

export interface Venue {
  readonly id: string;
  readonly kind: VenueKind;
  readonly operator: string;
  // The key that authorizes this venue's transfers; it co-signs every leg it fills.
  readonly authority: Address;
  // Directed pairs this venue fills: [input, output].
  pairs(): [AssetCode, AssetCode][];
  spot(input: AssetCode, output: AssetCode): Promise<Ratio>;
  quoteExactOut(input: AssetCode, output: AssetCode, amountOut: bigint, now: Date): Promise<LegQuote>;
  quoteExactIn(input: AssetCode, output: AssetCode, amountIn: bigint, now: Date): Promise<LegQuote>;
  // Token account holding the venue's inventory of an asset.
  inventoryAccount(asset: AssetCode): Promise<Address>;
  // Token account receiving the provider fee in an asset, or null when the venue charges none.
  providerFeeAccount(asset: AssetCode): Promise<Address | null>;
  // Verifies the venue's own flows in the transaction against its live state, then signs.
  cosign(transaction: Transaction, now: Date): Promise<SignatureDictionary>;
}

// NetOutput = Gross − NetworkCost − TradingFees − ProviderFees − Slippage, all in the
// denomination asset's base units. Gross is the spot value of the input; NetOutput is the
// executable value delivered. Slippage is what remains: price impact plus any path priced worse
// than the best spot mark, so the identity holds exactly.
export type CostBreakdown = {
  denomination: AssetCode;
  gross: bigint;
  networkCost: bigint;
  tradingFees: bigint;
  providerFees: bigint;
  slippage: bigint;
  netOutput: bigint;
  // gross − netOutput: what the payment costs beyond the amount delivered.
  total: bigint;
};

export type Route = {
  id: string;
  hops: number;
  input: AssetCode;
  inputAmount: bigint;
  // The most input the payer accepts at execution (quote + slippage tolerance).
  maxInput: bigint;
  deliver: AssetCode;
  deliverAmount: bigint;
  legs: LegQuote[];
  costs: CostBreakdown;
  // Network fees and rent the sponsor pays, in lamports. Users never pay them.
  network: { lamports: bigint; signatures: number; paidBy: "sponsor" };
};

export type PaymentRequest = {
  payer: Address;
  recipient: Address;
  denomination: AssetCode;
  // Amount in the denomination asset's base units.
  amount: bigint;
  // Assets the recipient accepts. Delivery in another asset is sized by its executable value.
  accepts: AssetCode[];
  maxSlippageBps: number;
  quoteTtlSeconds?: number;
  maxHops?: number;
  excludeVenues?: string[];
  // Reject legs whose spot differs from the venue TWAP by more than this (manipulation guard).
  maxSpotTwapDeviationBps?: number;
};

export type RejectedRoute = { path: string; reason: string };

export type Quote = {
  id: string;
  quotedAt: string;
  expiresAt: string;
  request: PaymentRequest;
  // Spot marks used to value inputs, per asset, in the denomination. Venue spot, not a price feed.
  marks: Record<AssetCode, { price: Ratio; path: string }>;
  routes: Route[];
  best: Route | null;
  rejected: RejectedRoute[];
};
