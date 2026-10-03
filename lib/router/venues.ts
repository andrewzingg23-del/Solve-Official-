// Venues that fill payment legs from inventory held in ordinary token accounts. A venue prices a
// leg, then co-signs the payment transaction only after decoding it and checking its own flows
// against its live on-chain inventory: it never signs blind. This is the RFQ settlement model;
// an on-chain AMM program would enforce the same curve inside the program instead.
import {
  getCompiledTransactionMessageDecoder,
  signBytes,
  type Address,
  type KeyPairSigner,
  type SignatureDictionary,
  type Transaction,
} from "@solana/kit";
import {
  getTransferCheckedInstructionDataDecoder,
  identifyTokenInstruction,
  TOKEN_PROGRAM_ADDRESS,
  TokenInstruction,
} from "@solana-program/token";
import type { ChainGateway } from "../chain/gateway";
import { readTokenAccount, tokenAccountAddress } from "../chain/solve";
import {
  capLadder,
  ceilDiv,
  constantProductExactIn,
  constantProductExactOut,
  ladderExactIn,
  ladderExactOut,
  QuoteError,
  ratio,
  type FeeSchedule,
  type Level,
  type Ratio,
  type SwapQuote,
} from "./math";
import type { AssetCode, AssetInfo, LegQuote, Venue, VenueKind } from "./types";

export type TokenTransfer = { source: Address; mint: Address; destination: Address; authority: Address; amount: bigint };

// Decodes a transaction into its token transfers and every other instruction's accounts.
export function decodeTokenFlows(transaction: Transaction) {
  const message = getCompiledTransactionMessageDecoder().decode(transaction.messageBytes);
  if ("addressTableLookups" in message && (message.addressTableLookups?.length ?? 0) > 0) {
    throw new Error("transactions with address lookup tables are not accepted");
  }
  if (!("instructions" in message)) throw new Error("unsupported transaction version");
  const keys = message.staticAccounts;
  const transfers: TokenTransfer[] = [];
  const other: { program: Address; accounts: Address[] }[] = [];
  for (const ix of message.instructions) {
    const program = keys[ix.programAddressIndex];
    const accounts = (ix.accountIndices ?? []).map((i) => keys[i]);
    if (program === TOKEN_PROGRAM_ADDRESS && ix.data && identifyTokenInstruction(ix.data) === TokenInstruction.TransferChecked) {
      const { amount } = getTransferCheckedInstructionDataDecoder().decode(ix.data);
      transfers.push({ source: accounts[0], mint: accounts[1], destination: accounts[2], authority: accounts[3], amount });
    } else {
      other.push({ program, accounts });
    }
  }
  return { feePayer: keys[0], transfers, other };
}

const SCALE = BigInt(10) ** BigInt(18);

type Observation = { at: number; spot: Ratio };

type VenueConfig = {
  id: string;
  kind: VenueKind;
  operator: string;
  gateway: ChainGateway;
  signer: KeyPairSigner;
  assets: AssetInfo[];
  fees: FeeSchedule;
  // Owner of the token accounts that receive the provider fee (required when providerFeeBps > 0).
  providerFeeOwner?: Address;
  twapWindowSeconds?: number;
};

abstract class InventoryVenue implements Venue {
  readonly id: string;
  readonly kind: VenueKind;
  readonly operator: string;
  readonly authority: Address;
  // Simulates a provider outage: quotes and co-signatures fail while true.
  offline = false;
  protected readonly gateway: ChainGateway;
  protected readonly signer: KeyPairSigner;
  protected readonly fees: FeeSchedule;
  protected readonly assets = new Map<AssetCode, AssetInfo>();
  private readonly providerFeeOwner: Address | undefined;
  private readonly twapWindowSeconds: number;
  private readonly observations = new Map<string, Observation[]>();

  constructor(config: VenueConfig) {
    this.id = config.id;
    this.kind = config.kind;
    this.operator = config.operator;
    this.gateway = config.gateway;
    this.signer = config.signer;
    this.authority = config.signer.address;
    this.fees = config.fees;
    this.providerFeeOwner = config.providerFeeOwner;
    this.twapWindowSeconds = config.twapWindowSeconds ?? 3600;
    for (const asset of config.assets) this.assets.set(asset.code, asset);
    if (config.fees.providerFeeBps > 0 && !config.providerFeeOwner) throw new Error(`${config.id}: provider fee needs a fee owner`);
    if (config.providerFeeOwner === config.signer.address) throw new Error(`${config.id}: fees must not land in inventory`);
  }

  abstract readonly pricing: string;
  abstract pairs(): [AssetCode, AssetCode][];
  protected abstract exactIn(input: AssetCode, output: AssetCode, amountIn: bigint): Promise<SwapQuote>;
  protected abstract exactOut(input: AssetCode, output: AssetCode, amountOut: bigint): Promise<SwapQuote>;
  protected abstract currentSpot(input: AssetCode, output: AssetCode): Promise<Ratio>;
  protected abstract depth(input: AssetCode, output: AssetCode): Promise<{ input: bigint; output: bigint }>;

  protected asset(code: AssetCode) {
    const asset = this.assets.get(code);
    if (!asset) throw new QuoteError("unsupported_pair", `${this.id} does not trade ${code}`);
    return asset;
  }

  protected assertPair(input: AssetCode, output: AssetCode) {
    if (!this.pairs().some(([i, o]) => i === input && o === output)) {
      throw new QuoteError("unsupported_pair", `${this.id} does not fill ${input} → ${output}`);
    }
  }

  protected assertOnline() {
    if (this.offline) throw new QuoteError("provider_unavailable", `${this.id} is unavailable`);
  }

  async inventoryAccount(asset: AssetCode) {
    return tokenAccountAddress(this.authority, this.asset(asset).mint);
  }

  async providerFeeAccount(asset: AssetCode) {
    if (this.fees.providerFeeBps === 0 || !this.providerFeeOwner) return null;
    return tokenAccountAddress(this.providerFeeOwner, this.asset(asset).mint);
  }

  protected async inventory(asset: AssetCode) {
    return (await readTokenAccount(this.gateway, await this.inventoryAccount(asset)))?.amount ?? BigInt(0);
  }

  async spot(input: AssetCode, output: AssetCode) {
    this.assertOnline();
    this.assertPair(input, output);
    return this.currentSpot(input, output);
  }

  // Records the current spot of every pair. Venues report a TWAP only over their own observations.
  async observe(now: Date) {
    for (const [input, output] of this.pairs()) {
      const key = `${input}>${output}`;
      const list = this.observations.get(key) ?? [];
      list.push({ at: now.getTime(), spot: await this.currentSpot(input, output) });
      this.observations.set(key, list);
    }
  }

  private twap(input: AssetCode, output: AssetCode, now: Date): LegQuote["twap"] {
    const list = this.observations.get(`${input}>${output}`) ?? [];
    const end = now.getTime();
    const start = end - this.twapWindowSeconds * 1000;
    let weighted = BigInt(0);
    let total = BigInt(0);
    let samples = 0;
    for (let i = 0; i < list.length; i++) {
      const from = Math.max(list[i].at, start);
      const to = Math.min(i + 1 < list.length ? list[i + 1].at : end, end);
      if (to <= from) continue;
      const ms = BigInt(to - from);
      weighted += ((list[i].spot.num * SCALE) / list[i].spot.den) * ms;
      total += ms;
      samples++;
    }
    if (total === BigInt(0)) return null;
    return { price: ratio(weighted / total, SCALE), windowSeconds: this.twapWindowSeconds, samples };
  }

  private async leg(input: AssetCode, output: AssetCode, swap: SwapQuote, now: Date): Promise<LegQuote> {
    return {
      venue: this.id,
      kind: this.kind,
      operator: this.operator,
      pricing: this.pricing,
      input,
      output,
      amountIn: swap.amountIn,
      amountOut: swap.amountOut,
      tradingFee: swap.tradingFee,
      providerFee: swap.providerFee,
      spot: await this.currentSpot(input, output),
      twap: this.twap(input, output, now),
      depth: await this.depth(input, output),
      observedAt: now.toISOString(),
    };
  }

  async quoteExactOut(input: AssetCode, output: AssetCode, amountOut: bigint, now: Date) {
    this.assertOnline();
    this.assertPair(input, output);
    return this.leg(input, output, await this.exactOut(input, output, amountOut), now);
  }

  async quoteExactIn(input: AssetCode, output: AssetCode, amountIn: bigint, now: Date) {
    this.assertOnline();
    this.assertPair(input, output);
    return this.leg(input, output, await this.exactIn(input, output, amountIn), now);
  }

  async cosign(transaction: Transaction, now: Date): Promise<SignatureDictionary> {
    this.assertOnline();
    void now;
    const { feePayer, transfers, other } = decodeTokenFlows(transaction);
    if (feePayer === this.authority) throw new Error(`${this.id} refuses to pay fees`);

    const byMint = new Map<Address, AssetInfo>([...this.assets.values()].map((a) => [a.mint, a]));
    const inventory = new Map<Address, AssetCode>();
    const feeAccounts = new Map<Address, AssetCode>();
    for (const asset of this.assets.values()) {
      inventory.set(await this.inventoryAccount(asset.code), asset.code);
      const fee = await this.providerFeeAccount(asset.code);
      if (fee) feeAccounts.set(fee, asset.code);
    }
    const mine = new Set<Address>([this.authority, ...inventory.keys()]);
    if (other.some((ix) => ix.accounts.some((a) => mine.has(a)))) {
      throw new Error(`${this.id} refuses: its accounts appear outside plain transfers`);
    }

    const outflow = new Map<AssetCode, bigint>();
    const inflow = new Map<AssetCode, bigint>();
    const feeInflow = new Map<AssetCode, bigint>();
    const add = (m: Map<AssetCode, bigint>, k: AssetCode, v: bigint) => m.set(k, (m.get(k) ?? BigInt(0)) + v);
    for (const t of transfers) {
      if (t.authority === this.authority) {
        const code = inventory.get(t.source);
        if (!code || byMint.get(t.mint)?.code !== code) throw new Error(`${this.id} refuses: transfer from a foreign account`);
        add(outflow, code, t.amount);
      }
      const into = inventory.get(t.destination);
      if (into) add(inflow, into, t.amount);
      const fee = feeAccounts.get(t.destination);
      if (fee) add(feeInflow, fee, t.amount);
    }
    if (outflow.size !== 1 || inflow.size !== 1) throw new Error(`${this.id} refuses: expected exactly one leg`);
    const [[output, out]] = [...outflow];
    const [[input, received]] = [...inflow];
    this.assertPair(input, output);
    const fees = feeInflow.get(input) ?? BigInt(0);
    if ([...feeInflow.keys()].some((k) => k !== input)) throw new Error(`${this.id} refuses: fee in the wrong asset`);

    // Price the leg against live inventory, before this transaction moves it.
    const live = await this.exactIn(input, output, received + fees);
    if (fees < live.providerFee) throw new Error(`${this.id} refuses: provider fee short`);
    if (out > live.amountOut) {
      throw new Error(`${this.id} refuses: ${out} ${output} exceeds the ${live.amountOut} its curve pays now`);
    }
    return { [this.authority]: await signBytes(this.signer.keyPair.privateKey, transaction.messageBytes) };
  }
}

// Constant product (x·y = k) over the venue's two on-chain inventories. Kind "state_market" marks
// a State's own market for its coin; the curve is the same.
export class ConstantProductVenue extends InventoryVenue {
  readonly pricing = "constant product (x*y=k) over on-chain inventory; settles by co-signed transfer";
  private readonly pair: [AssetCode, AssetCode];

  constructor(config: Omit<VenueConfig, "kind"> & { kind?: "amm" | "state_market"; pair: [AssetCode, AssetCode] }) {
    super({ ...config, kind: config.kind ?? "amm" });
    this.pair = config.pair;
  }

  pairs(): [AssetCode, AssetCode][] {
    const [a, b] = this.pair;
    return [
      [a, b],
      [b, a],
    ];
  }

  private async reserves(input: AssetCode, output: AssetCode) {
    return { reserveIn: await this.inventory(input), reserveOut: await this.inventory(output) };
  }

  protected async exactIn(input: AssetCode, output: AssetCode, amountIn: bigint) {
    const { reserveIn, reserveOut } = await this.reserves(input, output);
    return constantProductExactIn(amountIn, reserveIn, reserveOut, this.fees);
  }

  protected async exactOut(input: AssetCode, output: AssetCode, amountOut: bigint) {
    const { reserveIn, reserveOut } = await this.reserves(input, output);
    return constantProductExactOut(amountOut, reserveIn, reserveOut, this.fees);
  }

  protected async currentSpot(input: AssetCode, output: AssetCode) {
    const { reserveIn, reserveOut } = await this.reserves(input, output);
    if (reserveIn === BigInt(0) || reserveOut === BigInt(0)) throw new QuoteError("insufficient_liquidity", `${this.id} is empty`);
    return ratio(reserveOut, reserveIn);
  }

  protected async depth(input: AssetCode, output: AssetCode) {
    const { reserveIn, reserveOut } = await this.reserves(input, output);
    return { input: reserveIn, output: reserveOut };
  }
}

// A maker quoting a static ladder per direction (an order book side), capped by inventory.
export class LadderVenue extends InventoryVenue {
  readonly pricing = "static price ladder capped by on-chain inventory; settles by co-signed transfer";
  private readonly ladders: Map<string, Level[]>;

  constructor(config: Omit<VenueConfig, "kind"> & { ladders: { input: AssetCode; output: AssetCode; levels: Level[] }[] }) {
    super({ ...config, kind: "orderbook" });
    this.ladders = new Map(config.ladders.map((l) => [`${l.input}>${l.output}`, l.levels]));
  }

  pairs(): [AssetCode, AssetCode][] {
    return [...this.ladders.keys()].map((k) => k.split(">") as [AssetCode, AssetCode]);
  }

  private async levels(input: AssetCode, output: AssetCode) {
    return capLadder(this.ladders.get(`${input}>${output}`) ?? [], await this.inventory(output));
  }

  protected async exactIn(input: AssetCode, output: AssetCode, amountIn: bigint) {
    return ladderExactIn(amountIn, await this.levels(input, output), this.fees);
  }

  protected async exactOut(input: AssetCode, output: AssetCode, amountOut: bigint) {
    return ladderExactOut(amountOut, await this.levels(input, output), this.fees);
  }

  protected async currentSpot(input: AssetCode, output: AssetCode) {
    const [best] = await this.levels(input, output);
    if (!best) throw new QuoteError("insufficient_liquidity", `${this.id} has no ${output} to sell`);
    return best.price;
  }

  protected async depth(input: AssetCode, output: AssetCode) {
    const levels = await this.levels(input, output);
    return {
      input: levels.reduce((sum, l) => sum + ceilDiv(l.size * l.price.den, l.price.num), BigInt(0)),
      output: levels.reduce((sum, l) => sum + l.size, BigInt(0)),
    };
  }
}
