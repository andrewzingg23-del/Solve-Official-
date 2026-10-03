import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import { generateKeyPairSigner } from "@solana/kit";
import { getMintToInstruction, getTransferCheckedInstruction } from "@solana-program/token";
import {
  ALLOCATION,
  assetSymbol,
  buildEarnRelease,
  buildSponsoredTransfer,
  GENESIS_SUPPLY,
  readMint,
  readTokenAccount,
  settlementExecuted,
  settlementSeed,
  solve,
  teamVested,
  VAULTS,
  walletBalance,
} from "../../lib/chain/solve";
import { devSolveChain } from "../support/chain-fixture";
import {
  appendTransactionMessageInstructions,
  createTransactionMessage,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
} from "@solana/kit";
import type { LiteSvmGateway } from "../support/litesvm-gateway";
import type { Instruction, TransactionSigner } from "@solana/kit";

const settlementId = (n: number) => createHash("sha256").update(`obligation-${n}`).digest("hex");

async function sendRaw(gateway: LiteSvmGateway, payer: TransactionSigner, instructions: Instruction[]) {
  const lifetime = await gateway.latestBlockhash();
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(payer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(lifetime, m),
    (m) => appendTransactionMessageInstructions(instructions, m),
  );
  return gateway.send(await signTransactionMessageWithSigners(message));
}

describe("DEV-SOLVE genesis", () => {
  it("creates exactly 1B across five separately owned vaults and seals the mint", async () => {
    const { gateway, manifest, settlementAuthority } = await devSolveChain();
    const mint = await readMint(gateway, manifest.mint);
    assert.equal(mint?.supply, GENESIS_SUPPLY);
    assert.equal(mint?.mintAuthority, null);
    assert.equal(mint?.freezeAuthority, null);
    assert.equal(manifest.symbol, "DEV-SOLVE");

    const owners = new Set<string>();
    for (const v of VAULTS) {
      const account = await readTokenAccount(gateway, manifest.vaults[v].tokenAccount);
      assert.equal(account?.amount, ALLOCATION[v], `${v} allocation`);
      owners.add(account!.owner);
    }
    assert.equal(owners.size, 5);

    const earn = await readTokenAccount(gateway, manifest.vaults.earn.tokenAccount);
    assert.equal(earn?.delegate, settlementAuthority.address);
    assert.equal(earn?.delegatedAmount, solve(1_000_000));
    for (const v of VAULTS.filter((v) => v !== "earn")) {
      assert.equal((await readTokenAccount(gateway, manifest.vaults[v].tokenAccount))?.delegate, null, `${v} has no delegate`);
    }
  });

  it("can never mint again, even with the original mint authority", async () => {
    const { gateway, manifest, sponsor, mintAuthority } = await devSolveChain();
    const outcome = await sendRaw(gateway, sponsor, [
      getMintToInstruction({ mint: manifest.mint, token: manifest.vaults.earn.tokenAccount, mintAuthority, amount: BigInt(1) }),
    ]);
    assert.equal(outcome.status, "failed");
    assert.equal((await readMint(gateway, manifest.mint))?.supply, GENESIS_SUPPLY);
  });

  it("labels non-mainnet assets DEV-SOLVE", () => {
    assert.equal(assetSymbol("litesvm"), "DEV-SOLVE");
    assert.equal(assetSymbol("solana-devnet"), "DEV-SOLVE");
    assert.equal(assetSymbol("solana-mainnet"), "SOLVE");
  });
});

describe("Earn Vault releases", () => {
  it("releases once per settlement id; a replay moves nothing", async () => {
    const { gateway, manifest, sponsor, settlementAuthority } = await devSolveChain();
    const recipient = await generateKeyPairSigner();
    const release = () =>
      buildEarnRelease({
        gateway, manifest, sponsor, settlementAuthority,
        settlementId: settlementId(1), recipient: recipient.address, amount: solve(100),
      });

    assert.equal(await settlementExecuted(gateway, settlementAuthority.address, settlementId(1)), false);
    const first = await release();
    assert.equal((await gateway.send(first.transaction)).status, "confirmed");
    assert.equal(await walletBalance(gateway, recipient.address, manifest.mint), solve(100));
    assert.equal(await settlementExecuted(gateway, settlementAuthority.address, settlementId(1)), true);

    const replay = await release();
    assert.notEqual(replay.signature, first.signature);
    assert.equal((await gateway.send(replay.transaction)).status, "failed");
    assert.equal(await walletBalance(gateway, recipient.address, manifest.mint), solve(100));
  });

  it("cannot release beyond the approved capacity", async () => {
    const { gateway, manifest, sponsor, settlementAuthority } = await devSolveChain({ releaseCapacity: solve(150) });
    const recipient = await generateKeyPairSigner();
    const release = (n: number, amount: bigint) =>
      buildEarnRelease({ gateway, manifest, sponsor, settlementAuthority, settlementId: settlementId(n), recipient: recipient.address, amount });

    assert.equal((await gateway.send((await release(1, solve(100))).transaction)).status, "confirmed");
    const over = await gateway.send((await release(2, solve(100))).transaction);
    assert.equal(over.status, "failed");
    assert.equal(await settlementExecuted(gateway, settlementAuthority.address, settlementId(2)), false);
    assert.equal(await walletBalance(gateway, recipient.address, manifest.mint), solve(100));
  });

  it("cannot release more than the vault holds", async () => {
    const { gateway, manifest, sponsor, settlementAuthority } = await devSolveChain({ releaseCapacity: ALLOCATION.earn });
    const recipient = await generateKeyPairSigner();
    const built = await buildEarnRelease({
      gateway, manifest, sponsor, settlementAuthority,
      settlementId: settlementId(3), recipient: recipient.address, amount: ALLOCATION.earn + BigInt(1),
    });
    assert.equal((await gateway.send(built.transaction)).status, "failed");
  });

  it("gives the settlement key no power over the other vaults", async () => {
    const { gateway, manifest, sponsor, settlementAuthority } = await devSolveChain();
    const thief = await generateKeyPairSigner();
    for (const v of VAULTS.filter((v) => v !== "earn")) {
      const outcome = await sendRaw(gateway, sponsor, [
        getTransferCheckedInstruction({
          source: manifest.vaults[v].tokenAccount,
          mint: manifest.mint,
          destination: manifest.vaults.earn.tokenAccount,
          authority: settlementAuthority,
          amount: BigInt(1),
          decimals: 9,
        }),
      ]);
      assert.equal(outcome.status, "failed", `${v} must reject the settlement key`);
      assert.equal((await readTokenAccount(gateway, manifest.vaults[v].tokenAccount))?.amount, ALLOCATION[v]);
    }
    assert.equal(await walletBalance(gateway, thief.address, manifest.mint), BigInt(0));
  });
});

describe("settlement seeds", () => {
  it("commit 192 bits of the settlement id in 32 characters", () => {
    const seed = settlementSeed(settlementId(1));
    assert.equal(seed.length, 32);
    assert.match(seed, /^[A-Za-z0-9_-]{32}$/);
    assert.notEqual(settlementSeed(settlementId(2)), seed);
    assert.throws(() => settlementSeed("not-hex"));
  });
});

describe("sponsored transfers", () => {
  it("lets a wallet with no SOL send DEV-SOLVE; the sponsor pays fees", async () => {
    const { gateway, manifest, sponsor, settlementAuthority } = await devSolveChain();
    const alice = await generateKeyPairSigner();
    const bob = await generateKeyPairSigner();
    await gateway.send(
      (await buildEarnRelease({ gateway, manifest, sponsor, settlementAuthority, settlementId: settlementId(7), recipient: alice.address, amount: solve(100) })).transaction,
    );
    assert.equal(await gateway.getAccount(alice.address), null, "alice holds no SOL");

    const transfer = await buildSponsoredTransfer({ gateway, mint: manifest.mint, sponsor, owner: alice, recipient: bob.address, amount: solve(40) });
    assert.equal((await gateway.send(transfer.transaction)).status, "confirmed");
    assert.equal(await walletBalance(gateway, alice.address, manifest.mint), solve(60));
    assert.equal(await walletBalance(gateway, bob.address, manifest.mint), solve(40));
  });

  it("refuses to send more than the wallet holds", async () => {
    const { gateway, manifest, sponsor } = await devSolveChain();
    const alice = await generateKeyPairSigner();
    const bob = await generateKeyPairSigner();
    const transfer = await buildSponsoredTransfer({ gateway, mint: manifest.mint, sponsor, owner: alice, recipient: bob.address, amount: solve(1) });
    assert.equal((await gateway.send(transfer.transaction)).status, "failed");
  });
});

describe("team vesting schedule", () => {
  it("vests nothing before the 12-month cliff, then linearly to 72 months", () => {
    assert.equal(teamVested(0), BigInt(0));
    assert.equal(teamVested(11), BigInt(0));
    assert.equal(teamVested(12), ALLOCATION.team / BigInt(6));
    assert.equal(teamVested(36), ALLOCATION.team / BigInt(2));
    assert.equal(teamVested(72), ALLOCATION.team);
    assert.equal(teamVested(120), ALLOCATION.team);
  });
});
