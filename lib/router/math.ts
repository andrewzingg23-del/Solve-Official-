// Exact integer arithmetic for quoting. Amounts are base units (bigint); prices are ratios of base
// units, so nothing is ever rounded through floating point.

export type Ratio = { num: bigint; den: bigint };

const ZERO = BigInt(0);
const ONE = BigInt(1);
const BPS = BigInt(10_000);

function gcd(a: bigint, b: bigint): bigint {
  a = a < ZERO ? -a : a;
  b = b < ZERO ? -b : b;
  while (b !== ZERO) [a, b] = [b, a % b];
  return a;
}

export function ratio(num: bigint, den: bigint): Ratio {
  if (den <= ZERO) throw new Error("ratio denominator must be positive");
  const g = gcd(num, den) || ONE;
  return { num: num / g, den: den / g };
}

export const UNIT_RATIO: Ratio = { num: ONE, den: ONE };

export const mulRatio = (a: Ratio, b: Ratio) => ratio(a.num * b.num, a.den * b.den);

export const compareRatio = (a: Ratio, b: Ratio) => {
  const l = a.num * b.den;
  const r = b.num * a.den;
  return l < r ? -1 : l > r ? 1 : 0;
};

// amount × ratio, rounded down.
export const applyRatio = (amount: bigint, r: Ratio) => (amount * r.num) / r.den;

export const ceilDiv = (a: bigint, b: bigint) => (a + b - ONE) / b;

// A ratio of base units as a human price, e.g. 0.5 (USDC per ARC), to `digits` decimal places.
export function formatRatio(r: Ratio, decimalsIn: number, decimalsOut: number, digits = 9) {
  // price = num/den × 10^(decimalsIn − decimalsOut)
  const shift = decimalsIn - decimalsOut;
  let num = r.num * BigInt(10) ** BigInt(digits);
  let den = r.den;
  if (shift >= 0) num *= BigInt(10) ** BigInt(shift);
  else den *= BigInt(10) ** BigInt(-shift);
  const scaled = num / den;
  const s = scaled.toString().padStart(digits + 1, "0");
  const whole = s.slice(0, s.length - digits);
  const fraction = s.slice(s.length - digits).replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole;
}

// Venue fees are charged on the input. One combined rounding keeps the net input monotone in the
// gross input, so exact-out quotes are minimal. The provider's share is split out of the total.
export type FeeSchedule = { tradingFeeBps: number; providerFeeBps: number };

export function splitFees(amountIn: bigint, fees: FeeSchedule) {
  const totalBps = BigInt(fees.tradingFeeBps + fees.providerFeeBps);
  if (totalBps < ZERO || totalBps >= BPS) throw new Error("fees must be between 0 and 10000 bps");
  const total = (amountIn * totalBps) / BPS;
  const providerFee = totalBps === ZERO ? ZERO : (total * BigInt(fees.providerFeeBps)) / totalBps;
  return { tradingFee: total - providerFee, providerFee, netIn: amountIn - total };
}

// The smallest gross input whose net input (after fees) is at least `netIn`.
export function grossForNet(netIn: bigint, fees: FeeSchedule) {
  if (netIn <= ZERO) return ZERO;
  const keep = BPS - BigInt(fees.tradingFeeBps + fees.providerFeeBps);
  return ((netIn - ONE) * BPS) / keep + ONE;
}

export class QuoteError extends Error {
  constructor(
    readonly reason: "insufficient_liquidity" | "provider_unavailable" | "unsupported_pair" | "invalid_amount",
    message: string,
  ) {
    super(message);
    this.name = "QuoteError";
  }
}

export type SwapQuote = { amountIn: bigint; amountOut: bigint; tradingFee: bigint; providerFee: bigint };

// Constant product (x·y = k) with the fee taken on the input. The trading fee stays in the pool;
// the provider fee is paid out separately and never enters the reserves.
export function constantProductExactIn(amountIn: bigint, reserveIn: bigint, reserveOut: bigint, fees: FeeSchedule): SwapQuote {
  if (amountIn <= ZERO) throw new QuoteError("invalid_amount", "amount must be positive");
  if (reserveIn <= ZERO || reserveOut <= ZERO) throw new QuoteError("insufficient_liquidity", "pool is empty");
  const { tradingFee, providerFee, netIn } = splitFees(amountIn, fees);
  const amountOut = (netIn * reserveOut) / (reserveIn + netIn);
  return { amountIn, amountOut, tradingFee, providerFee };
}

export function constantProductExactOut(amountOut: bigint, reserveIn: bigint, reserveOut: bigint, fees: FeeSchedule): SwapQuote {
  if (amountOut <= ZERO) throw new QuoteError("invalid_amount", "amount must be positive");
  if (reserveIn <= ZERO || amountOut >= reserveOut) {
    throw new QuoteError("insufficient_liquidity", `pool holds ${reserveOut}, ${amountOut} requested`);
  }
  const netNeeded = ceilDiv(reserveIn * amountOut, reserveOut - amountOut);
  const quote = constantProductExactIn(grossForNet(netNeeded, fees), reserveIn, reserveOut, fees);
  if (quote.amountOut < amountOut) throw new Error("constant product exact-out under-delivers");
  return { ...quote, amountOut };
}

// A static price ladder: levels of output available at a fixed price (output per input), best
// first. Fills never move the ladder; inventory caps it.
export type Level = { price: Ratio; size: bigint };

export function ladderExactIn(amountIn: bigint, levels: Level[], fees: FeeSchedule): SwapQuote {
  if (amountIn <= ZERO) throw new QuoteError("invalid_amount", "amount must be positive");
  const { tradingFee, providerFee, netIn } = splitFees(amountIn, fees);
  let remaining = netIn;
  let amountOut = ZERO;
  for (const level of levels) {
    const forLevel = ceilDiv(level.size * level.price.den, level.price.num);
    if (remaining >= forLevel) {
      amountOut += level.size;
      remaining -= forLevel;
    } else {
      amountOut += applyRatio(remaining, level.price);
      remaining = ZERO;
      break;
    }
  }
  return { amountIn, amountOut, tradingFee, providerFee };
}

export function ladderExactOut(amountOut: bigint, levels: Level[], fees: FeeSchedule): SwapQuote {
  if (amountOut <= ZERO) throw new QuoteError("invalid_amount", "amount must be positive");
  let remaining = amountOut;
  let netNeeded = ZERO;
  for (const level of levels) {
    if (remaining === ZERO) break;
    const take = remaining < level.size ? remaining : level.size;
    netNeeded += ceilDiv(take * level.price.den, level.price.num);
    remaining -= take;
  }
  if (remaining > ZERO) {
    throw new QuoteError("insufficient_liquidity", `book holds ${amountOut - remaining}, ${amountOut} requested`);
  }
  const quote = ladderExactIn(grossForNet(netNeeded, fees), levels, fees);
  if (quote.amountOut < amountOut) throw new Error("ladder exact-out under-delivers");
  return { ...quote, amountOut };
}

// Caps a ladder to what the maker actually holds.
export function capLadder(levels: Level[], inventory: bigint): Level[] {
  const capped: Level[] = [];
  let left = inventory;
  for (const level of levels) {
    if (left <= ZERO) break;
    const size = level.size < left ? level.size : left;
    capped.push({ price: level.price, size });
    left -= size;
  }
  return capped;
}
