// DEV-SOLVE on Solana: fixed-supply genesis, five vault domains, exactly-once Earn releases,
// sponsored transfers and chain reads. Built only on the SPL Token, Associated Token, System and
// Memo programs, so every rule below is enforced by audited on-chain programs.
import {
  address,
  appendTransactionMessageInstructions,
  createAddressWithSeed,
  createTransactionMessage,
  getSignatureFromTransaction,
  partiallySignTransactionMessageWithSigners,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type Address,
  type Instruction,
  type KeyPairSigner,
  type Signature,
  type Transaction,
  type TransactionSigner,
} from "@solana/kit";
import { getAddMemoInstruction } from "@solana-program/memo";
import { getCreateAccountInstruction, getCreateAccountWithSeedInstruction, SYSTEM_PROGRAM_ADDRESS } from "@solana-program/system";
import {
  AuthorityType,
  findAssociatedTokenPda,
  getApproveInstruction,
  getCreateAssociatedTokenIdempotentInstruction,
  getInitializeMint2Instruction,
  getMintDecoder,
  getMintSize,
  getMintToInstruction,
  getSetAuthorityInstruction,
  getTokenDecoder,
  getTransferCheckedInstruction,
  TOKEN_PROGRAM_ADDRESS,
} from "@solana-program/token";
import type { ChainGateway, Cluster } from "./gateway";

export const SOLVE_DECIMALS = 9;
const UNIT = BigInt(10) ** BigInt(SOLVE_DECIMALS);

// Whole tokens to base units.
export const solve = (tokens: bigint | number) => BigInt(tokens) * UNIT;

export const GENESIS_SUPPLY = solve(1_000_000_000);

// SPL Memo v2, deployed on every cluster. The memo client's newer default address is not.
const MEMO_PROGRAM = address("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

export const VAULTS = ["earn", "treasury", "team", "liquidity", "community"] as const;
export type Vault = (typeof VAULTS)[number];

export const ALLOCATION: Record<Vault, bigint> = {
  earn: solve(450_000_000),
  treasury: solve(200_000_000),
  team: solve(150_000_000),
  liquidity: solve(100_000_000),
  community: solve(100_000_000),
};

if (VAULTS.reduce((sum, v) => sum + ALLOCATION[v], BigInt(0)) !== GENESIS_SUPPLY) {
  throw new Error("vault allocations must sum to the genesis supply");
}

// The ticker shown for this deployment. Devnet and local assets are never called SOLVE.
export function assetSymbol(cluster: Cluster) {
  return cluster === "solana-mainnet" ? "SOLVE" : "DEV-SOLVE";
}

export type GenesisManifest = {
  cluster: Cluster;
  symbol: string;
  mint: Address;
  decimals: number;
  supply: string;
  vaults: Record<Vault, { owner: Address; tokenAccount: Address; allocation: string }>;
  settlementAuthority: Address;
  releaseCapacity: string;
  signatures: Signature[];
};

async function buildTransaction(
  gateway: ChainGateway,
  feePayer: TransactionSigner,
  instructions: Instruction[],
  { partial = false } = {},
): Promise<{ transaction: Transaction; signature: Signature }> {
  const lifetime = await gateway.latestBlockhash();
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(feePayer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(lifetime, m),
    (m) => appendTransactionMessageInstructions(instructions, m),
  );
  const transaction = partial
    ? await partiallySignTransactionMessageWithSigners(message)
    : await signTransactionMessageWithSigners(message);
  return { transaction, signature: getSignatureFromTransaction(transaction) };
}

async function sendOrThrow(gateway: ChainGateway, transaction: Transaction, step: string) {
  const outcome = await gateway.send(transaction);
  if (outcome.status !== "confirmed") throw new Error(`${step} failed: ${outcome.error}`);
  return outcome.signature;
}

export async function tokenAccountAddress(owner: Address, mint: Address) {
  const [ata] = await findAssociatedTokenPda({ owner, mint, tokenProgram: TOKEN_PROGRAM_ADDRESS });
  return ata;
}

// Creates the mint, the five vaults and the whole supply, then removes the mint authority in the
// same transaction that mints, so there is never a moment when more SOLVE could be created.
// The Earn owner then approves the settlement authority for a bounded release capacity.
export async function runGenesis(input: {
  gateway: ChainGateway;
  payer: TransactionSigner;
  mint: KeyPairSigner;
  mintAuthority: TransactionSigner;
  vaultOwners: Record<Vault, Address>;
  earnOwner: TransactionSigner;
  settlementAuthority: Address;
  releaseCapacity: bigint;
}): Promise<GenesisManifest> {
  const { gateway, payer, mint, mintAuthority, vaultOwners, earnOwner, settlementAuthority, releaseCapacity } = input;
  const owners = new Set(VAULTS.map((v) => vaultOwners[v]));
  if (owners.size !== VAULTS.length) throw new Error("each vault needs its own owner key");
  if (earnOwner.address !== vaultOwners.earn) throw new Error("earnOwner must sign for the earn vault owner");
  if (releaseCapacity <= BigInt(0) || releaseCapacity > ALLOCATION.earn) throw new Error("release capacity out of range");

  const signatures: Signature[] = [];
  const mintSpace = BigInt(getMintSize());
  const createMint = await buildTransaction(gateway, payer, [
    getCreateAccountInstruction({
      payer,
      newAccount: mint,
      lamports: await gateway.minimumBalanceForRentExemption(mintSpace),
      space: mintSpace,
      programAddress: TOKEN_PROGRAM_ADDRESS,
    }),
    getInitializeMint2Instruction({
      mint: mint.address,
      decimals: SOLVE_DECIMALS,
      mintAuthority: mintAuthority.address,
      freezeAuthority: null,
    }),
  ]);
  signatures.push(await sendOrThrow(gateway, createMint.transaction, "create mint"));

  const tokenAccounts = {} as Record<Vault, Address>;
  for (const v of VAULTS) tokenAccounts[v] = await tokenAccountAddress(vaultOwners[v], mint.address);

  const createVaults = await buildTransaction(
    gateway,
    payer,
    VAULTS.map((v) =>
      getCreateAssociatedTokenIdempotentInstruction({
        payer,
        ata: tokenAccounts[v],
        owner: vaultOwners[v],
        mint: mint.address,
      }),
    ),
  );
  signatures.push(await sendOrThrow(gateway, createVaults.transaction, "create vaults"));

  const mintAndSeal = await buildTransaction(gateway, payer, [
    ...VAULTS.map((v) =>
      getMintToInstruction({ mint: mint.address, token: tokenAccounts[v], mintAuthority, amount: ALLOCATION[v] }),
    ),
    getSetAuthorityInstruction({
      owned: mint.address,
      owner: mintAuthority,
      authorityType: AuthorityType.MintTokens,
      newAuthority: null,
    }),
  ]);
  signatures.push(await sendOrThrow(gateway, mintAndSeal.transaction, "mint and seal supply"));

  const bound = await buildTransaction(gateway, payer, [
    getApproveInstruction({
      source: tokenAccounts.earn,
      delegate: settlementAuthority,
      owner: earnOwner,
      amount: releaseCapacity,
    }),
  ]);
  signatures.push(await sendOrThrow(gateway, bound.transaction, "approve earn release capacity"));

  const vaults = {} as GenesisManifest["vaults"];
  for (const v of VAULTS) {
    vaults[v] = { owner: vaultOwners[v], tokenAccount: tokenAccounts[v], allocation: ALLOCATION[v].toString() };
  }
  return {
    cluster: gateway.cluster,
    symbol: assetSymbol(gateway.cluster),
    mint: mint.address,
    decimals: SOLVE_DECIMALS,
    supply: GENESIS_SUPPLY.toString(),
    vaults,
    settlementAuthority,
    releaseCapacity: releaseCapacity.toString(),
    signatures,
  };
}

// Settlement ids are SHA-256 hex digests from the kernel. Solana seeds are at most 32 UTF-8
// characters, so the seed is base64url of the first 24 bytes: 192 bits of the id in 32 characters.
const SETTLEMENT_ID = /^[0-9a-f]{64}$/;

export function settlementSeed(settlementId: string) {
  if (!SETTLEMENT_ID.test(settlementId)) throw new Error("settlement id must be 64 lowercase hex characters");
  const bytes = new Uint8Array(24);
  for (let i = 0; i < 24; i++) bytes[i] = parseInt(settlementId.slice(i * 2, i * 2 + 2), 16);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_");
}

export async function settlementMarkerAddress(settlementAuthority: Address, settlementId: string) {
  return createAddressWithSeed({
    baseAddress: settlementAuthority,
    programAddress: SYSTEM_PROGRAM_ADDRESS,
    seed: settlementSeed(settlementId),
  });
}

// A marker exists exactly when the release for this settlement executed: the marker is created in
// the same atomic transaction as the transfer.
export async function settlementExecuted(gateway: ChainGateway, settlementAuthority: Address, settlementId: string) {
  return (await gateway.getAccount(await settlementMarkerAddress(settlementAuthority, settlementId))) !== null;
}

// Builds and signs an Earn Vault release. The signature is known before sending, so callers can
// record "submitted" first and never lose track of a transaction.
export async function buildEarnRelease(input: {
  gateway: ChainGateway;
  manifest: GenesisManifest;
  sponsor: TransactionSigner;
  settlementAuthority: TransactionSigner;
  settlementId: string;
  recipient: Address;
  amount: bigint;
}) {
  const { gateway, manifest, sponsor, settlementAuthority, settlementId, recipient, amount } = input;
  if (settlementAuthority.address !== manifest.settlementAuthority) throw new Error("wrong settlement authority");
  if (amount <= BigInt(0)) throw new Error("amount must be positive");
  const marker = await settlementMarkerAddress(settlementAuthority.address, settlementId);
  const recipientAccount = await tokenAccountAddress(recipient, manifest.mint);

  return buildTransaction(gateway, sponsor, [
    getCreateAccountWithSeedInstruction({
      payer: sponsor,
      newAccount: marker,
      baseAccount: settlementAuthority,
      base: settlementAuthority.address,
      seed: settlementSeed(settlementId),
      amount: await gateway.minimumBalanceForRentExemption(BigInt(0)),
      space: 0,
      programAddress: SYSTEM_PROGRAM_ADDRESS,
    }),
    getCreateAssociatedTokenIdempotentInstruction({
      payer: sponsor,
      ata: recipientAccount,
      owner: recipient,
      mint: manifest.mint,
    }),
    getTransferCheckedInstruction({
      source: manifest.vaults.earn.tokenAccount,
      mint: manifest.mint,
      destination: recipientAccount,
      authority: settlementAuthority,
      amount,
      decimals: manifest.decimals,
    }),
    getAddMemoInstruction({ memo: `solve:settlement:${settlementId}` }, { programAddress: MEMO_PROGRAM }),
  ]).then((built) => ({ ...built, marker }));
}

// A wallet-to-wallet transfer whose network fees the sponsor pays. Pass partial: true when the
// sponsor will add its signature elsewhere (a server relay).
export async function buildSponsoredTransfer(input: {
  gateway: ChainGateway;
  mint: Address;
  sponsor: TransactionSigner;
  owner: TransactionSigner;
  recipient: Address;
  amount: bigint;
  partial?: boolean;
}) {
  const { gateway, mint, sponsor, owner, recipient, amount, partial } = input;
  if (amount <= BigInt(0)) throw new Error("amount must be positive");
  const source = await tokenAccountAddress(owner.address, mint);
  const destination = await tokenAccountAddress(recipient, mint);
  return buildTransaction(
    gateway,
    sponsor,
    [
      getCreateAssociatedTokenIdempotentInstruction({ payer: sponsor, ata: destination, owner: recipient, mint }),
      getTransferCheckedInstruction({ source, mint, destination, authority: owner, amount, decimals: SOLVE_DECIMALS }),
    ],
    { partial },
  );
}

export async function readMint(gateway: ChainGateway, mint: Address) {
  const account = await gateway.getAccount(mint);
  if (!account) return null;
  const decoded = getMintDecoder().decode(account.data);
  return {
    supply: decoded.supply,
    decimals: decoded.decimals,
    mintAuthority: decoded.mintAuthority.__option === "Some" ? decoded.mintAuthority.value : null,
    freezeAuthority: decoded.freezeAuthority.__option === "Some" ? decoded.freezeAuthority.value : null,
  };
}

export async function readTokenAccount(gateway: ChainGateway, tokenAccount: Address) {
  const account = await gateway.getAccount(tokenAccount);
  if (!account) return null;
  const decoded = getTokenDecoder().decode(account.data);
  return {
    owner: decoded.owner,
    mint: decoded.mint,
    amount: decoded.amount,
    delegate: decoded.delegate.__option === "Some" ? decoded.delegate.value : null,
    delegatedAmount: decoded.delegatedAmount,
  };
}

// The canonical balance: read from the chain, never from a database.
export async function walletBalance(gateway: ChainGateway, owner: Address, mint: Address) {
  const account = await readTokenAccount(gateway, await tokenAccountAddress(owner, mint));
  return account?.amount ?? BigInt(0);
}

// Team allocation schedule: nothing before a 12-month cliff, then linear by whole months to 72.
// Deterministic and price-independent. On-chain enforcement needs a vesting program (not yet built).
export function teamVested(monthsSinceGenesis: number, total = ALLOCATION.team) {
  if (!Number.isInteger(monthsSinceGenesis) || monthsSinceGenesis < 0) throw new Error("months must be a non-negative integer");
  if (monthsSinceGenesis < 12) return BigInt(0);
  return (total * BigInt(Math.min(monthsSinceGenesis, 72))) / BigInt(72);
}

export function formatSolve(amount: bigint) {
  const whole = amount / UNIT;
  const fraction = (amount % UNIT).toString().padStart(SOLVE_DECIMALS, "0").replace(/0+$/, "");
  return fraction ? `${whole.toLocaleString("en-US")}.${fraction}` : whole.toLocaleString("en-US");
}
