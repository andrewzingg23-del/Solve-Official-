// The monetary proof-of-life: identity → World → obligation → outcome → evidence → entitlement →
// balanced ledger → deterministic settlement → DEV-SOLVE Earn Vault release → on-chain ownership →
// P2P transfer → reconciliation. Kernel: the real migrations in PGlite. Chain: LiteSVM running the
// real SPL programs. Every step goes through the production client and worker code.
import { createHash, randomUUID } from "node:crypto";
import { generateKeyPairSigner, type KeyPairSigner } from "@solana/kit";
import { getApproveInstruction } from "@solana-program/token";
import {
  appendTransactionMessageInstructions,
  createTransactionMessage,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
} from "@solana/kit";
import { buildSponsoredTransfer, formatSolve, readTokenAccount, settlementExecuted, solve, walletBalance } from "../../lib/chain/solve";
import { kernelClient, type Kernel } from "../../lib/kernel/client";
import { settle, type SettlementRail } from "../../lib/money/settlement";
import { createKernelDb, service, user, type KernelDb } from "../kernel/harness";
import { devSolveChain } from "./chain-fixture";
import { moneyKernel, POLICY, type Money } from "./money-fixture";
import { pgliteSupabase } from "./pglite-supabase";

export type ProofEnvironment = Awaited<ReturnType<typeof proofEnvironment>>;

export async function proofEnvironment({ releaseCapacity = solve(1_000_000) } = {}) {
  const chain = await devSolveChain({ releaseCapacity });
  const k = await createKernelDb();
  const money = await moneyKernel(k, {
    chain: "litesvm",
    mintAddress: chain.manifest.mint,
    settlementAuthority: chain.manifest.settlementAuthority,
    observedEarn: BigInt(chain.manifest.vaults.earn.allocation),
  });
  const rail: SettlementRail = {
    kernel: kernelClient(pgliteSupabase(k, service), { actAs: money.settlementService }),
    gateway: chain.gateway,
    manifest: chain.manifest,
    sponsor: chain.sponsor,
    settlementAuthority: chain.settlementAuthority,
  };
  const verifier = kernelClient(pgliteSupabase(k, service), { actAs: money.verifier });
  return { k, money, chain, rail, verifier };
}

export const clientFor = (k: KernelDb, sub: string) => kernelClient(pgliteSupabase(k, user(sub)));

const sha = (text: string) => `sha256:${createHash("sha256").update(text).digest("hex")}` as const;

// A World with one synthetic obligation, completed and independently verified, entitled and
// prepared for settlement to a fresh wallet.
export async function preparedSettlement(env: ProofEnvironment, client: Kernel, actorId: string) {
  const world = `world:${randomUUID()}`;
  await client.claimScope(world);
  await client.issueGrant({ grantee: env.money.verifier, capability: "kernel.evidence.attach", scope: world });
  await client.issueGrant({ grantee: env.money.verifier, capability: "kernel.read", scope: world });

  const obligation = await client.recordEvent({
    type: "obligation.created",
    scope: world,
    payload: {
      title: "DEV: complete the onboarding checklist",
      policy_key: POLICY,
      beneficiaries: [{ actor_id: actorId, attribution_bps: 10_000 }],
      synthetic: true,
    },
  });
  const outcome = await client.recordEvent({
    type: "outcome.completed",
    scope: world,
    payload: { obligation_event_id: obligation, summary: "checklist completed" },
    evidence: [{ basis: "self_reported", content_hash: sha(`checklist:${obligation}`), description: "completed checklist" }],
  });
  await env.verifier.attachEvidence(outcome, {
    basis: "system_observed",
    content_hash: sha(`verifier:${outcome}`),
    description: "DEV verifier: synthetic checklist satisfied",
  });
  const entitlementId = await client.createEntitlement({
    obligationEventId: obligation,
    outcomeEventId: outcome,
    beneficiaryId: actorId,
    policyKey: POLICY,
    policyVersion: env.money.policyVersion,
  });
  const wallet = await generateKeyPairSigner();
  await client.linkWallet("litesvm", wallet.address);
  const settlementId = await client.prepareSettlement(entitlementId, wallet.address);
  return { world, obligation, outcome, entitlementId, wallet, settlementId };
}

// Raises the Earn release capacity with the vault owner's (cold) key.
export async function approveEarnCapacity(env: ProofEnvironment, amount: bigint) {
  const lifetime = await env.chain.gateway.latestBlockhash();
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(env.chain.sponsor, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(lifetime, m),
    (m) =>
      appendTransactionMessageInstructions(
        [
          getApproveInstruction({
            source: env.chain.manifest.vaults.earn.tokenAccount,
            delegate: env.chain.manifest.settlementAuthority,
            owner: env.chain.owners.earn,
            amount,
          }),
        ],
        m,
      ),
  );
  return env.chain.gateway.send(await signTransactionMessageWithSigners(message));
}

export async function earnMirror(env: ProofEnvironment) {
  const kernel = await env.money.balance(env.money.onchain);
  const chain = (await readTokenAccount(env.chain.gateway, env.chain.manifest.vaults.earn.tokenAccount))!.amount;
  return { kernel, chain, match: kernel === chain };
}

export type Step = { n: number; title: string; detail: string };

export async function runProofOfLife(onStep: (step: Step) => void = () => {}) {
  const steps: Step[] = [];
  const step = (title: string, detail: string) => {
    const s = { n: steps.length + 1, title, detail };
    steps.push(s);
    onStep(s);
  };

  const env = await proofEnvironment();
  const symbol = env.chain.manifest.symbol;
  onStep({
    n: 0,
    title: "Genesis",
    detail: `${formatSolve(BigInt(env.chain.manifest.supply))} ${symbol} minted once into five vaults; mint authority removed`,
  });

  const alice = clientFor(env.k, "auth-alice");
  const aliceId = await alice.register("Alice");
  step("Sign in", "verified session for JWT subject auth-alice (no client-supplied actor id)");
  const who = await alice.whoami();
  step("Actor", `server resolved the session to canonical actor ${who.actor_id} (${who.kind})`);

  const prepared = await preparedSettlement(env, alice, aliceId);
  step("World", `${prepared.world} claimed by Alice`);
  step("Obligation", `synthetic DEV obligation ${prepared.obligation}`);
  step("Evidence", `outcome ${prepared.outcome}: self-report + independent system_observed attestation`);

  const [entitlement] = await alice.myEntitlements();
  step("Entitlement", `${formatSolve(BigInt(entitlement.amount))} ${symbol}, evidence root ${entitlement.evidence_root}`);
  step("Ledger", `Earn unallocated → payable: ${formatSolve(await env.money.balance(env.money.payable))} owed`);

  const expectedSettlement = createHash("sha256")
    .update(`solve:settlement:v1|${prepared.obligation}|${aliceId}|${POLICY}`)
    .digest("hex");
  step("Settlement identity", `${prepared.settlementId} (derived from the obligation: ${expectedSettlement === prepared.settlementId})`);

  const earnBefore = await readTokenAccount(env.chain.gateway, env.chain.manifest.vaults.earn.tokenAccount);
  step(
    "Vault authorization",
    `settlement key may release ${formatSolve(earnBefore!.delegatedAmount)} more; marker for this settlement absent`,
  );
  const result = await settle(env.rail, prepared.settlementId);
  step("Release", `${result.status}; transaction ${result.signature}`);
  const marker = await settlementExecuted(env.chain.gateway, env.chain.manifest.settlementAuthority, prepared.settlementId);
  step("On-chain receipt", `settlement marker present: ${marker}`);

  const [settled] = await alice.myEntitlements();
  step("Reconciliation", `kernel status ${settled.status}, signature ${settled.tx_signature}`);

  const aliceBalance = await walletBalance(env.chain.gateway, prepared.wallet.address, env.chain.manifest.mint);
  step("Chain balance", `Alice's wallet holds ${formatSolve(aliceBalance)} ${symbol} (read from chain)`);

  const bob: KeyPairSigner = await generateKeyPairSigner();
  const transfer = await buildSponsoredTransfer({
    gateway: env.chain.gateway,
    mint: env.chain.manifest.mint,
    sponsor: env.chain.sponsor,
    owner: prepared.wallet,
    recipient: bob.address,
    amount: solve(40),
  });
  const sent = await env.chain.gateway.send(transfer.transaction);
  step("P2P transfer", `Alice → Bob 40 ${symbol}: ${sent.status} (fees sponsored; neither wallet holds SOL)`);
  const bobBalance = await walletBalance(env.chain.gateway, bob.address, env.chain.manifest.mint);
  const aliceAfter = await walletBalance(env.chain.gateway, prepared.wallet.address, env.chain.manifest.mint);
  step("Second wallet", `Bob holds ${formatSolve(bobBalance)} ${symbol}; Alice ${formatSolve(aliceAfter)}`);

  const relogin = clientFor(env.k, "auth-alice");
  const [reloaded] = await relogin.myEntitlements();
  const mirror = await earnMirror(env);
  const integrity = await kernelClient(pgliteSupabase(env.k, service)).verifyChain();
  step("Reload", `fresh session sees ${reloaded.status}; Earn mirror ${mirror.match ? "matches" : "DIFFERS FROM"} chain; history ${integrity.ok ? "intact" : "BROKEN"} (${integrity.events_checked} events)`);

  return {
    steps,
    env,
    aliceId,
    prepared,
    entitlement,
    expectedSettlement,
    result,
    marker,
    settled,
    aliceBalance,
    aliceAfter,
    bobBalance,
    transfer: sent,
    reloaded,
    mirror,
    integrity,
  };
}

export type { Money };
