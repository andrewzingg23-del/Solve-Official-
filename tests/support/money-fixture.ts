import { newId } from "./keys";
import { solve } from "../../lib/chain/solve";
import { service, sha, type KernelDb, type Session, user } from "../kernel/harness";

export const POLICY = "dev-proof-of-life";

// Kernel side of a settlement rail: root, DEV_SOLVE, service actors, Earn mirror accounts, the
// observed chain genesis, the rail and a reward policy.
export async function moneyKernel(
  k: KernelDb,
  {
    chain = "litesvm",
    mintAddress = "So11111111111111111111111111111111111111112",
    settlementAuthority = "Stake11111111111111111111111111111111111111",
    observedEarn = solve(450_000_000),
    policyAmount = solve(100),
    policyCap = solve(1_000_000),
  } = {},
) {
  const founder = user("auth-founder");
  const founderId = await k.value(founder, "register");
  await k.owner("select kernel.grant_root($1)", [founderId]);
  const chainScope = `system/chain:${chain}`;
  const vaultScope = `${chainScope}/vault:earn`;

  await k.rpc(founder, "define_asset", { p_code: "DEV_SOLVE", p_issuer_scope: chainScope, p_decimals: 9, p_label: "DEV-SOLVE" });
  const settlementService = await k.value(founder, "create_service_actor", { p_label: "settlement service" });
  const verifier = await k.value(founder, "create_service_actor", { p_label: "DEV verifier" });
  for (const capability of ["kernel.ledger.post", "kernel.settlement.record", "kernel.read"]) {
    await k.rpc(founder, "issue_grant", { p_grantee: settlementService, p_capability: capability, p_scope: chainScope });
  }

  const open = (normal: "debit" | "credit", label: string) =>
    k.value(founder, "open_account", { p_scope: vaultScope, p_asset: "DEV_SOLVE", p_normal_balance: normal, p_label: label });
  const onchain = await open("debit", "earn on-chain");
  const unallocated = await open("credit", "earn unallocated");
  const payable = await open("credit", "earn payable");

  // The chain observer records the Earn Vault genesis it saw on chain.
  await k.rpc(service, "post_transaction", {
    p_scope: chainScope,
    p_entries: [
      { account_id: onchain, amount: observedEarn.toString() },
      { account_id: unallocated, amount: (-observedEarn).toString() },
    ],
    p_memo: "earn vault genesis observed",
    p_evidence: [{ basis: "externally_verified", content_hash: sha(900), description: "genesis transactions" }],
    p_as_actor: settlementService,
  });

  await k.rpc(founder, "register_rail", {
    p_chain: chain,
    p_mint_address: mintAddress,
    p_settlement_authority: settlementAuthority,
    p_onchain_account: onchain,
    p_unallocated_account: unallocated,
    p_payable_account: payable,
  });
  const policyVersion = await k.value<number>(founder, "define_reward_policy", {
    p_policy_key: POLICY,
    p_chain: chain,
    p_outcome_type: "outcome.completed",
    p_amount: policyAmount.toString(),
    p_max_per_release: solve(1_000).toString(),
    p_total_cap: policyCap.toString(),
    p_required_bases: ["system_observed"],
    p_min_independent_parties: 1,
  });

  const balance = async (account: string) =>
    BigInt((await k.rpc(founder, "account_balance", { p_account_id: account }))[0].balance as string);

  return { chain, chainScope, founder, founderId, settlementService, verifier, onchain, unallocated, payable, policyVersion, balance };
}

export type Money = Awaited<ReturnType<typeof moneyKernel>>;

// A World owned by `owner`, the DEV verifier allowed to attest in it, a synthetic obligation and
// its completed outcome (self-reported only, not yet verified).
export async function worldWithOutcome(
  k: KernelDb,
  money: Money,
  owner: Session,
  ownerId: string,
  { beneficiaries = [{ actor_id: ownerId, attribution_bps: 10_000 }] } = {},
) {
  const world = `world:${await newId()}`;
  await k.rpc(owner, "claim_scope", { p_scope: world });
  await k.rpc(owner, "issue_grant", { p_grantee: money.verifier, p_capability: "kernel.evidence.attach", p_scope: world });
  await k.rpc(owner, "issue_grant", { p_grantee: money.verifier, p_capability: "kernel.read", p_scope: world });

  const obligation = await k.value(owner, "record_event", {
    p_type: "obligation.created",
    p_scope: world,
    p_payload: { title: "Complete the onboarding checklist", policy_key: POLICY, beneficiaries, synthetic: true },
  });
  const outcome = await k.value(owner, "record_event", {
    p_type: "outcome.completed",
    p_scope: world,
    p_payload: { obligation_event_id: obligation, summary: "checklist done" },
    p_evidence: [{ basis: "self_reported", content_hash: sha(1), description: "my checklist" }],
  });
  return { world, obligation, outcome };
}

export async function verifyOutcome(k: KernelDb, money: Money, outcome: string, n = 2) {
  return k.value(service, "attach_evidence", {
    p_event_id: outcome,
    p_basis: "system_observed",
    p_content_hash: sha(n),
    p_description: "DEV verifier: synthetic checklist satisfied",
    p_as_actor: money.verifier,
  });
}
