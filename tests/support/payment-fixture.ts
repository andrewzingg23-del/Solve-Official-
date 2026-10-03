// Test markets for the payment router, on LiteSVM. DEV-USDC and ARC are test-only mints whose
// mint authority this fixture keeps; they exist only here and carry no value. DEV-SOLVE comes
// from the real genesis, and venue inventory of it comes out of the liquidity vault.
import {
  appendTransactionMessageInstructions,
  createTransactionMessage,
  generateKeyPairSigner,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type Address,
  type Instruction,
  type KeyPairSigner,
} from "@solana/kit";
import { getCreateAccountInstruction } from "@solana-program/system";
import {
  getCreateAssociatedTokenIdempotentInstruction,
  getInitializeMint2Instruction,
  getMintSize,
  getMintToInstruction,
  getTransferCheckedInstruction,
  TOKEN_PROGRAM_ADDRESS,
} from "@solana-program/token";
import { solve, tokenAccountAddress, walletBalance } from "../../lib/chain/solve";
import { kernelClient } from "../../lib/kernel/client";
import type { PaymentRail } from "../../lib/money/payment";
import { ratio, type FeeSchedule, type Level } from "../../lib/router/math";
import { PaymentRouter } from "../../lib/router/router";
import type { AssetInfo } from "../../lib/router/types";
import { ConstantProductVenue, LadderVenue } from "../../lib/router/venues";
import { service, user, type KernelDb } from "../kernel/harness";
import { devSolveChain } from "./chain-fixture";
import { moneyKernel } from "./money-fixture";
import { pgliteSupabase } from "./pglite-supabase";

export const USD = (dollars: number | bigint) => BigInt(dollars) * BigInt(1_000_000);
export const ARC = USD;

type Chain = Awaited<ReturnType<typeof devSolveChain>>;

async function send(chain: Chain, instructions: Instruction[]) {
  const lifetime = await chain.gateway.latestBlockhash();
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(chain.sponsor, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(lifetime, m),
    (m) => appendTransactionMessageInstructions(instructions, m),
  );
  const outcome = await chain.gateway.send(await signTransactionMessageWithSigners(message));
  if (outcome.status !== "confirmed") throw new Error(outcome.error);
  return outcome.signature;
}

export type AmmSpec = { kind: "amm" | "state_market"; pair: [string, string]; reserves: [bigint, bigint]; fees: FeeSchedule; operator: string };
export type BookSpec = {
  kind: "orderbook";
  operator: string;
  fees: FeeSchedule;
  ladders: { input: string; output: string; levels: Level[] }[];
  inventory: Record<string, bigint>;
};

// Spot: ARC = 0.5 DEV-USDC, DEV-SOLVE = 0.1 DEV-USDC, so ARC = 5 DEV-SOLVE on the State market.
export const DEFAULT_VENUES: Record<string, AmmSpec | BookSpec> = {
  "arc-usdc": { kind: "amm", operator: "DEV pool", pair: ["ARC", "DEV_USDC"], reserves: [ARC(200_000), USD(100_000)], fees: { tradingFeeBps: 30, providerFeeBps: 0 } },
  "solve-usdc": { kind: "amm", operator: "DEV pool", pair: ["DEV_SOLVE", "DEV_USDC"], reserves: [solve(500_000), USD(50_000)], fees: { tradingFeeBps: 30, providerFeeBps: 0 } },
  "arc-solve": { kind: "state_market", operator: "Arc State", pair: ["ARC", "DEV_SOLVE"], reserves: [ARC(100_000), solve(500_000)], fees: { tradingFeeBps: 10, providerFeeBps: 10 } },
  "solve-usdc-book": {
    kind: "orderbook",
    operator: "DEV maker",
    fees: { tradingFeeBps: 0, providerFeeBps: 5 },
    // Bids 0.0995 DEV-USDC per DEV-SOLVE; asks 0.1005.
    ladders: [
      { input: "DEV_SOLVE", output: "DEV_USDC", levels: [{ price: ratio(BigInt(995), BigInt(10_000_000)), size: USD(20_000) }] },
      { input: "DEV_USDC", output: "DEV_SOLVE", levels: [{ price: ratio(solve(10_000), USD(1_005)), size: solve(200_000) }] },
    ],
    inventory: { DEV_USDC: USD(20_000), DEV_SOLVE: solve(200_000) },
  },
};

export async function paymentMarket({ venues = DEFAULT_VENUES } = {}) {
  const chain = await devSolveChain();
  const mintAuthority = await generateKeyPairSigner();
  // Real time plus an offset tests can move: the kernel checks quote expiry against its own clock.
  const clock = { offset: 0, now: () => new Date(Date.now() + clock.offset) };

  const createMint = async (decimals: number) => {
    const mint = await generateKeyPairSigner();
    const space = BigInt(getMintSize());
    await send(chain, [
      getCreateAccountInstruction({
        payer: chain.sponsor,
        newAccount: mint,
        lamports: await chain.gateway.minimumBalanceForRentExemption(space),
        space,
        programAddress: TOKEN_PROGRAM_ADDRESS,
      }),
      getInitializeMint2Instruction({ mint: mint.address, decimals, mintAuthority: mintAuthority.address, freezeAuthority: null }),
    ]);
    return mint.address;
  };

  const assets: Record<string, AssetInfo> = {
    DEV_SOLVE: { code: "DEV_SOLVE", symbol: chain.manifest.symbol, mint: chain.manifest.mint, decimals: 9 },
    DEV_USDC: { code: "DEV_USDC", symbol: "DEV-USDC", mint: await createMint(6), decimals: 6 },
    ARC: { code: "ARC", symbol: "ARC", mint: await createMint(6), decimals: 6 },
  };

  const openAccount = async (owner: Address, code: string) => {
    const asset = assets[code];
    const ata = await tokenAccountAddress(owner, asset.mint);
    await send(chain, [getCreateAssociatedTokenIdempotentInstruction({ payer: chain.sponsor, ata, owner, mint: asset.mint })]);
    return ata;
  };

  // Gives `owner` test tokens: minted for test assets, drawn from the liquidity vault for DEV-SOLVE.
  const fund = async (owner: Address, code: string, amount: bigint) => {
    const asset = assets[code];
    const ata = await openAccount(owner, code);
    if (code === "DEV_SOLVE") {
      await send(chain, [
        getTransferCheckedInstruction({
          source: chain.manifest.vaults.liquidity.tokenAccount,
          mint: asset.mint,
          destination: ata,
          authority: chain.owners.liquidity,
          amount,
          decimals: asset.decimals,
        }),
      ]);
    } else {
      await send(chain, [getMintToInstruction({ mint: asset.mint, token: ata, mintAuthority, amount })]);
    }
  };

  // Moves tokens out of an account owned by `owner` (a venue pulling inventory, a wallet paying).
  const withdraw = async (owner: KeyPairSigner, code: string, amount: bigint, { to, sameBlock = false }: { to?: Address; sameBlock?: boolean } = {}) => {
    const asset = assets[code];
    // sameBlock: land in the current block, leaving already-signed transactions valid.
    chain.gateway.expireAfterSend = !sameBlock;
    try {
      const destination = await openAccount(to ?? (await generateKeyPairSigner()).address, code);
      await send(chain, [
        getTransferCheckedInstruction({
          source: await tokenAccountAddress(owner.address, asset.mint),
          mint: asset.mint,
          destination,
          authority: owner,
          amount,
          decimals: asset.decimals,
        }),
      ]);
    } finally {
      chain.gateway.expireAfterSend = true;
    }
  };

  const venueSigners: Record<string, KeyPairSigner> = {};
  const feeOwners: Record<string, KeyPairSigner> = {};
  const list: (ConstantProductVenue | LadderVenue)[] = [];
  for (const [id, spec] of Object.entries(venues)) {
    const signer = await generateKeyPairSigner();
    venueSigners[id] = signer;
    const feeOwner = spec.fees.providerFeeBps > 0 ? await generateKeyPairSigner() : undefined;
    if (feeOwner) feeOwners[id] = feeOwner;
    const codes = spec.kind === "orderbook" ? Object.keys(spec.inventory) : spec.pair;
    const venueAssets = codes.map((c) => assets[c]);
    const base = { id, operator: spec.operator, gateway: chain.gateway, signer, assets: venueAssets, fees: spec.fees, providerFeeOwner: feeOwner?.address };
    if (spec.kind === "orderbook") {
      for (const [code, amount] of Object.entries(spec.inventory)) await fund(signer.address, code, amount);
      list.push(new LadderVenue({ ...base, ladders: spec.ladders }));
    } else {
      await fund(signer.address, spec.pair[0], spec.reserves[0]);
      await fund(signer.address, spec.pair[1], spec.reserves[1]);
      list.push(new ConstantProductVenue({ ...base, kind: spec.kind, pair: spec.pair }));
    }
    if (feeOwner) for (const code of codes) await openAccount(feeOwner.address, code);
  }

  const router = new PaymentRouter({ gateway: chain.gateway, assets: Object.values(assets), venues: list, clock: clock.now });
  const venue = (id: string) => list.find((v) => v.id === id)!;
  const balance = (owner: Address, code: string) => walletBalance(chain.gateway, owner, assets[code].mint);
  const advance = (seconds: number) => {
    clock.offset += seconds * 1000;
  };

  return { chain, assets, router, venue, venueSigners, feeOwners, fund, withdraw, balance, clock, advance };
}

export type Market = Awaited<ReturnType<typeof paymentMarket>>;

// Kernel side: DEV-SOLVE rail, the two test assets on the litesvm chain, a payment service, and
// Alice (payer) and Bob (recipient, accepts DEV-USDC) with linked wallets.
export async function paymentsKernel(k: KernelDb, market: Market, { bobAccepts = ["DEV_USDC"] } = {}) {
  const money = await moneyKernel(k, {
    chain: "litesvm",
    mintAddress: market.chain.manifest.mint,
    settlementAuthority: market.chain.manifest.settlementAuthority,
  });
  const founder = kernelClient(pgliteSupabase(k, money.founder));
  await founder.defineAsset({ code: "DEV_USDC", issuerScope: "system/chain:litesvm", decimals: 6, label: "DEV-USDC (test, no value)" });
  await founder.defineAsset({ code: "ARC", issuerScope: "system/chain:litesvm", decimals: 6, label: "ARC (test State coin, no value)" });
  for (const asset of Object.values(market.assets)) await founder.registerChainAsset("litesvm", asset.code, asset.mint);

  const paymentService = await founder.createServiceActor("payment service");
  await founder.issueGrant({ grantee: paymentService, capability: "kernel.payment.record", scope: "system/chain:litesvm" });
  const rail: PaymentRail = { kernel: kernelClient(pgliteSupabase(k, service), { actAs: paymentService }), gateway: market.chain.gateway };

  const alice = kernelClient(pgliteSupabase(k, user("auth-alice")));
  const bob = kernelClient(pgliteSupabase(k, user("auth-bob")));
  const aliceId = await alice.register("Alice");
  const bobId = await bob.register("Bob");
  const aliceWallet = await generateKeyPairSigner();
  const bobWallet = await generateKeyPairSigner();
  await alice.linkWallet("litesvm", aliceWallet.address);
  await bob.linkWallet("litesvm", bobWallet.address);
  await bob.setPaymentProfile({ chain: "litesvm", receiveAddress: bobWallet.address, acceptAssets: bobAccepts });

  return { money, founder, paymentService, rail, alice, bob, aliceId, bobId, aliceWallet, bobWallet };
}
