import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateKeyPairSigner } from "@solana/kit";
import { KernelError, kernelClient, type Kernel } from "../../lib/kernel/client";
import { moneyKernel } from "../support/money-fixture";
import { pgliteSupabase } from "../support/pglite-supabase";
import { anon, createKernelDb, service, sha, sqlstate, user } from "./harness";

const MINT = {
  DEV_SOLVE: "So11111111111111111111111111111111111111112",
  DEV_USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  ARC: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
};
const USD10 = "10000000";
const SIG_1 = "5".repeat(88);
const SIG_2 = "6".repeat(88);
const WIRE = "AQID";
const chainEvidence = [{ basis: "externally_verified" as const, content_hash: sha(42) as `sha256:${string}`, description: "finalized" }];

const named = (name: string, pattern?: RegExp) => (error: unknown) => {
  assert.ok(error instanceof KernelError, `expected KernelError, got ${error}`);
  assert.equal(error.name, name, error.message);
  if (pattern) assert.match(error.message, pattern);
  return true;
};

async function setup({ registerSolve = true } = {}) {
  const k = await createKernelDb();
  const money = await moneyKernel(k);
  const founder = kernelClient(pgliteSupabase(k, money.founder));
  await founder.defineAsset({ code: "DEV_USDC", issuerScope: "system/chain:litesvm", decimals: 6 });
  await founder.defineAsset({ code: "ARC", issuerScope: "system/chain:litesvm", decimals: 6 });
  await founder.defineAsset({ code: "DEV_EUR", issuerScope: "system/chain:litesvm", decimals: 6 });
  if (registerSolve) await founder.registerChainAsset("litesvm", "DEV_SOLVE", MINT.DEV_SOLVE);
  await founder.registerChainAsset("litesvm", "DEV_USDC", MINT.DEV_USDC);
  await founder.registerChainAsset("litesvm", "ARC", MINT.ARC);

  const paymentService = await founder.createServiceActor("payment service");
  await founder.issueGrant({ grantee: paymentService, capability: "kernel.payment.record", scope: "system/chain:litesvm" });
  const svc = kernelClient(pgliteSupabase(k, service), { actAs: paymentService });

  const client = (sub: string) => kernelClient(pgliteSupabase(k, user(sub)));
  const alice = client("auth-alice");
  const bob = client("auth-bob");
  const carol = client("auth-carol");
  const aliceId = await alice.register("Alice");
  const bobId = await bob.register("Bob");
  const carolId = await carol.register("Carol");
  const A = (await generateKeyPairSigner()).address;
  const B = (await generateKeyPairSigner()).address;
  await alice.linkWallet("litesvm", A);
  await bob.linkWallet("litesvm", B);
  await bob.setPaymentProfile({ chain: "litesvm", receiveAddress: B, acceptAssets: ["DEV_USDC", "ARC"] });

  const intent = (extra: Partial<Parameters<Kernel["createPaymentIntent"]>[0]> = {}) =>
    alice.createPaymentIntent({ recipientId: bobId, chain: "litesvm", asset: "DEV_USDC", amount: USD10, maxSlippageBps: 50, ...extra });
  const route = (paymentId: string, extra: Partial<Parameters<Kernel["selectPaymentRoute"]>[0]> = {}) => ({
    paymentId,
    route: { legs: [{ venue: "arc-usdc" }] },
    payerAddress: A,
    recipientAddress: B,
    inputAsset: "ARC",
    inputAmount: "20100000",
    maxInput: "20200500",
    deliverAsset: "DEV_USDC",
    deliverAmount: USD10,
    quotedAt: new Date(Date.now() - 1000).toISOString(),
    expiresAt: new Date(Date.now() + 30_000).toISOString(),
    ...extra,
  });
  const submit = (paymentId: string, attempt = 1, extra: Partial<Parameters<Kernel["recordPayment"]>[0]> = {}) =>
    svc.recordPayment({ paymentId, attempt, status: "submitted", txSignature: SIG_1, inputAmount: "20150000", wireTransaction: WIRE, ...extra });

  return { k, money, founder, svc, alice, bob, carol, aliceId, bobId, carolId, A, B, intent, route, submit };
}

describe("chain assets", () => {
  it("binds each asset to one mint per chain, consistent with the settlement rail", async () => {
    const t = await setup({ registerSolve: false });
    await assert.rejects(t.alice.registerChainAsset("litesvm", "DEV_EUR", MINT.DEV_SOLVE), named("forbidden"));
    assert.equal(await t.founder.registerChainAsset("litesvm", "DEV_USDC", MINT.DEV_USDC), "DEV_USDC");
    await assert.rejects(t.founder.registerChainAsset("litesvm", "DEV_USDC", MINT.ARC), named("conflict"));
    await assert.rejects(t.founder.registerChainAsset("litesvm", "DEV_EUR", MINT.DEV_USDC), named("conflict"));
    await assert.rejects(t.founder.registerChainAsset("litesvm", "DEV_SOLVE", MINT.ARC), named("conflict"));
    await assert.rejects(
      t.founder.registerChainAsset("litesvm", "DEV_SOLVE", "Stake11111111111111111111111111111111111111"),
      named("invalid", /settlement rail names a different mint/),
    );
    assert.equal(await t.founder.registerChainAsset("litesvm", "DEV_SOLVE", MINT.DEV_SOLVE), "DEV_SOLVE");
    const listed = await t.alice.readChainAssets("litesvm");
    assert.deepEqual(listed.map((a) => [a.asset, a.decimals]), [["ARC", 6], ["DEV_SOLVE", 9], ["DEV_USDC", 6]]);
  });
});

describe("payment profiles", () => {
  it("publishes only the actor's own wallets and registered assets, versioned", async () => {
    const t = await setup();
    await assert.rejects(t.carol.setPaymentProfile({ chain: "litesvm", receiveAddress: t.B, acceptAssets: ["DEV_USDC"] }), named("invalid", /linked wallets/));
    await assert.rejects(t.bob.setPaymentProfile({ chain: "litesvm", receiveAddress: t.B, acceptAssets: ["DEV_EUR"] }), named("invalid", /registered/));
    await assert.rejects(t.bob.setPaymentProfile({ chain: "litesvm", receiveAddress: t.B, acceptAssets: ["ARC", "ARC"] }), named("invalid"));
    assert.equal(await t.bob.setPaymentProfile({ chain: "litesvm", receiveAddress: t.B, acceptAssets: ["DEV_USDC", "ARC"] }), 1);
    assert.equal(await t.bob.setPaymentProfile({ chain: "litesvm", receiveAddress: t.B, acceptAssets: ["DEV_USDC"] }), 2);

    const profile = await t.alice.readPaymentProfile(t.bobId, "litesvm");
    assert.equal(profile.version, 2);
    assert.equal(profile.receive_address, t.B);
    assert.deepEqual(profile.accept_assets, ["DEV_USDC"]);
    await assert.rejects(t.alice.readPaymentProfile(t.carolId, "litesvm"), named("not_found"));
  });
});

describe("payment intents", () => {
  it("pins the recipient's published address and accepted assets", async () => {
    const t = await setup();
    const paymentId = await t.intent();
    assert.match(paymentId, /^[0-9a-f]{64}$/);
    const before = await t.alice.readPayment(paymentId);
    assert.equal(before.status, "created");
    assert.equal(before.attempt, 0);
    assert.equal(before.recipient_address, t.B);
    assert.deepEqual(before.accept_assets, ["DEV_USDC", "ARC"]);

    // Bob moves to a new wallet later; this payment still pays what he published when it began.
    const B2 = (await generateKeyPairSigner()).address;
    await t.bob.linkWallet("litesvm", B2);
    await t.bob.setPaymentProfile({ chain: "litesvm", receiveAddress: B2, acceptAssets: ["DEV_USDC"] });
    assert.equal((await t.alice.readPayment(paymentId)).recipient_address, t.B);
    assert.equal((await t.alice.readPayment(await t.intent())).recipient_address, B2);
  });

  it("replays the same request under the same key and rejects a changed one", async () => {
    const t = await setup();
    const first = await t.intent({ idempotencyKey: "rent-oct" });
    assert.equal(await t.intent({ idempotencyKey: "rent-oct" }), first);
    await assert.rejects(t.intent({ idempotencyKey: "rent-oct", amount: "11000000" }), named("conflict"));
    assert.notEqual(await t.intent(), first);
  });

  it("rejects payments that cannot be made", async () => {
    const t = await setup();
    await assert.rejects(t.bob.createPaymentIntent({ recipientId: t.bobId, chain: "litesvm", asset: "DEV_USDC", amount: USD10 }), named("invalid", /different recipient/));
    await assert.rejects(t.intent({ recipientId: t.carolId }), named("invalid", /receives no payments/));
    await assert.rejects(t.intent({ asset: "DEV_EUR" }), named("invalid", /not registered/));
    await assert.rejects(t.intent({ amount: "0" }), named("invalid"));
    await assert.rejects(t.intent({ maxSlippageBps: 5000 }), named("invalid"));
    await assert.rejects(t.intent({ recipientId: "00000000-0000-4000-8000-0000000000ff" }), named("not_found"));
  });
});

describe("payment routes", () => {
  it("lets only the payer choose a live route to the pinned address within the slippage bound", async () => {
    const t = await setup();
    const id = await t.intent();
    const past = { quotedAt: new Date(Date.now() - 60_000).toISOString(), expiresAt: new Date(Date.now() - 1000).toISOString() };
    const long = { expiresAt: new Date(Date.now() + 200_000).toISOString() };

    await assert.rejects(t.bob.selectPaymentRoute(t.route(id)), named("forbidden"));
    await assert.rejects(t.alice.selectPaymentRoute(t.route(id, past)), named("invalid", /stale quote/));
    await assert.rejects(t.alice.selectPaymentRoute(t.route(id, long)), named("invalid", /120 seconds/));
    await assert.rejects(t.alice.selectPaymentRoute(t.route(id, { recipientAddress: t.A })), named("invalid", /recipient mismatch/));
    await assert.rejects(t.alice.selectPaymentRoute(t.route(id, { payerAddress: t.B })), named("invalid", /linked wallets/));
    await assert.rejects(t.alice.selectPaymentRoute(t.route(id, { deliverAsset: "DEV_SOLVE" })), named("invalid", /does not accept/));
    await assert.rejects(t.alice.selectPaymentRoute(t.route(id, { deliverAmount: "9999999" })), named("invalid", /less than the amount/));
    await assert.rejects(t.alice.selectPaymentRoute(t.route(id, { maxInput: "20200501" })), named("invalid", /slippage tolerance/));
    await assert.rejects(t.alice.selectPaymentRoute(t.route(id, { maxInput: "20099999" })), named("invalid"));

    const chosen = t.route(id);
    assert.equal(await t.alice.selectPaymentRoute(chosen), 1);
    assert.equal(await t.alice.selectPaymentRoute(chosen), 1, "an exact retry returns the same attempt");
    await assert.rejects(t.alice.selectPaymentRoute(t.route(id, { inputAmount: "20100001" })), named("invalid", /routed/));
  });
});

describe("payment transitions", () => {
  it("lets only the payment service record outcomes, inside the route's bounds", async () => {
    const t = await setup();
    const id = await t.intent();
    await assert.rejects(t.svc.recordPayment({ paymentId: id, attempt: 0, status: "failed" }), named("invalid", /no route yet/));
    await t.alice.selectPaymentRoute(t.route(id));

    const alicePosing = kernelClient(pgliteSupabase(t.k, user("auth-alice")));
    await assert.rejects(alicePosing.recordPayment({ paymentId: id, attempt: 1, status: "failed" }), named("forbidden"));
    await assert.rejects(t.submit(id, 1, { wireTransaction: undefined }), named("invalid", /signed transaction/));
    await assert.rejects(t.submit(id, 1, { inputAmount: "20200501" }), named("invalid", /slippage bound/));
    await assert.rejects(t.submit(id, 2), named("invalid", /current attempt/));
    await t.submit(id);
    assert.equal((await t.alice.readPayment(id)).executed_input, "20150000");

    await t.svc.recordPayment({ paymentId: id, attempt: 1, status: "needs_reconciliation", detail: "timeout" });
    await assert.rejects(t.submit(id, 1, { txSignature: SIG_2 }), named("invalid", /one transaction per attempt/));
    await assert.rejects(t.svc.recordPayment({ paymentId: id, attempt: 1, status: "confirmed", txSignature: SIG_1 }), named("invalid", /evidence/));
    await assert.rejects(
      t.svc.recordPayment({ paymentId: id, attempt: 1, status: "confirmed", txSignature: SIG_2, evidence: chainEvidence }),
      named("invalid"),
    );
    const confirmed = await t.svc.recordPayment({ paymentId: id, attempt: 1, status: "confirmed", txSignature: SIG_1, evidence: chainEvidence });
    assert.equal(await t.svc.recordPayment({ paymentId: id, attempt: 1, status: "confirmed", txSignature: SIG_1, evidence: chainEvidence }), confirmed);
    await assert.rejects(t.svc.recordPayment({ paymentId: id, attempt: 1, status: "failed" }), named("invalid", /confirmed to failed/));
    const payment = await t.bob.readPayment(id);
    assert.equal(payment.status, "confirmed");
    assert.equal(payment.tx_signature, SIG_1);
  });

  it("allows a new route only after the previous attempt definitely failed", async () => {
    const t = await setup();
    const id = await t.intent();
    await t.alice.selectPaymentRoute(t.route(id));
    await t.submit(id);
    await assert.rejects(t.alice.selectPaymentRoute(t.route(id, { inputAmount: "20100002" })), named("invalid", /submitted/));
    await t.svc.recordPayment({ paymentId: id, attempt: 1, status: "needs_reconciliation" });
    await assert.rejects(t.alice.selectPaymentRoute(t.route(id, { inputAmount: "20100002" })), named("invalid", /needs_reconciliation/));
    await t.svc.recordPayment({ paymentId: id, attempt: 1, status: "failed", detail: "blockhash expired; marker absent" });

    assert.equal(await t.alice.selectPaymentRoute(t.route(id, { inputAmount: "20100002", maxInput: "20200000" })), 2);
    await assert.rejects(t.svc.recordPayment({ paymentId: id, attempt: 1, status: "failed" }), named("invalid", /current attempt/));
    await t.submit(id, 2, { txSignature: SIG_2, inputAmount: "20100002" });
    await t.svc.recordPayment({ paymentId: id, attempt: 2, status: "confirmed", txSignature: SIG_2, evidence: chainEvidence });
    const rows = await t.k.owner("select attempt, status from kernel.payment_transitions where payment_id = $1 order by id", [id]);
    assert.deepEqual(
      rows.map((r) => `${r.attempt}:${r.status}`),
      ["1:routed", "1:submitted", "1:needs_reconciliation", "1:failed", "2:routed", "2:submitted", "2:confirmed"],
    );
  });
});

describe("payment reads and history", () => {
  it("shows a payment to its payer, its recipient and the service, and no one else", async () => {
    const t = await setup();
    const id = await t.intent();
    assert.equal((await t.svc.readPayment(id)).payment_id, id);
    assert.equal((await t.bob.readPayment(id)).payer_id, t.aliceId);
    await assert.rejects(t.carol.readPayment(id), named("forbidden"));
    await assert.rejects(kernelClient(pgliteSupabase(t.k, anon)).readPayment(id), (e: unknown) => e instanceof KernelError && e.code === "42501");

    const [sent] = await t.alice.myPayments();
    const [received] = await t.bob.myPayments();
    assert.deepEqual([sent.direction, sent.counterparty_id, sent.status], ["sent", t.bobId, "created"]);
    assert.deepEqual([received.direction, received.counterparty_id], ["received", t.aliceId]);
    assert.deepEqual(await t.carol.myPayments(), []);
  });

  it("keeps payment records append-only and out of direct reach of API roles", async () => {
    const t = await setup();
    const id = await t.intent();
    await t.alice.selectPaymentRoute(t.route(id));
    await assert.rejects(t.k.owner("update kernel.payment_intents set amount = 1 where payment_id = $1", [id]), sqlstate("KA006"));
    await assert.rejects(t.k.owner("delete from kernel.payment_transitions where payment_id = $1", [id]), sqlstate("KA006"));
    await assert.rejects(t.k.owner("update kernel.payment_routes set max_input = max_input * 2"), sqlstate("KA006"));
    for (const table of ["payment_intents", "payment_routes", "payment_transitions", "payment_profiles", "chain_assets"]) {
      await assert.rejects(t.k.as(user("auth-alice"), `select * from kernel.${table}`), sqlstate("42501"));
      await assert.rejects(t.k.as(service, `select * from kernel.${table}`), sqlstate("42501"));
    }
    assert.equal((await t.svc.verifyChain()).ok, true);
  });
});
