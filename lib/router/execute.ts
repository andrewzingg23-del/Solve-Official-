// Turns a selected route into one atomic transaction: a payment marker, every leg's transfers and
// a memo. Either all of it executes or none of it does, so a failed leg never strands the payer
// halfway through a route. The marker makes a second execution of the same payment impossible.
import {
  address,
  appendTransactionMessageInstructions,
  createAddressWithSeed,
  createNoopSigner,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  getSignatureFromTransaction,
  partiallySignTransactionMessageWithSigners,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  type Address,
  type Instruction,
  type Transaction,
  type TransactionSigner,
} from "@solana/kit";
import { getAddMemoInstruction } from "@solana-program/memo";
import { getCreateAccountWithSeedInstruction, SYSTEM_PROGRAM_ADDRESS } from "@solana-program/system";
import { getCreateAssociatedTokenIdempotentInstruction, getTransferCheckedInstruction } from "@solana-program/token";
import type { ChainGateway } from "../chain/gateway";
import { settlementSeed, tokenAccountAddress, walletBalance } from "../chain/solve";
import { QuoteError } from "./math";
import type { PaymentRouter } from "./router";
import type { LegQuote, Quote, Route } from "./types";

const MEMO_PROGRAM = address("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

export type PaymentFailure =
  | "stale_quote"
  | "slippage"
  | "provider_unavailable"
  | "venue_refused"
  | "insufficient_liquidity"
  | "insufficient_balance"
  | "recipient_mismatch"
  | "route_invalid";

// A route that cannot be executed. Raised before anything is sent, so nothing moved.
export class PaymentError extends Error {
  constructor(
    readonly reason: PaymentFailure,
    message: string,
    readonly venue?: string,
  ) {
    super(message);
    this.name = "PaymentError";
  }
}

// The marker lives at an address derived from the payer and the kernel's payment id. It is created
// in the payment transaction itself, so it exists exactly when the payment executed.
export async function paymentMarkerAddress(payer: Address, paymentId: string) {
  return createAddressWithSeed({ baseAddress: payer, programAddress: SYSTEM_PROGRAM_ADDRESS, seed: settlementSeed(paymentId) });
}

export async function paymentExecuted(gateway: ChainGateway, payer: Address, paymentId: string) {
  return (await gateway.getAccount(await paymentMarkerAddress(payer, paymentId))) !== null;
}

export type BuiltPayment = {
  transaction: Transaction;
  signature: string;
  wire: string;
  marker: Address;
  // Executable legs at build time; amounts may differ from the quote within the slippage bound.
  legs: LegQuote[];
  inputAmount: bigint;
  deliverAmount: bigint;
};

export async function buildPaymentTransaction(input: {
  router: PaymentRouter;
  route: Route;
  quote: Pick<Quote, "expiresAt" | "request">;
  paymentId: string;
  // The recipient address the kernel pinned for this payment.
  recipient: Address;
  payer: TransactionSigner;
  sponsor: TransactionSigner;
}): Promise<BuiltPayment> {
  const { router, route, paymentId, recipient, payer, sponsor } = input;
  const gateway = router.gateway;
  const now = router.now();
  if (input.quote.request.recipient !== recipient) {
    throw new PaymentError("recipient_mismatch", `quote pays ${input.quote.request.recipient}, the payment names ${recipient}`);
  }
  if (input.quote.request.payer !== payer.address) throw new PaymentError("route_invalid", "quote was made for another payer");
  if (!route.legs.every((l, i) => i === 0 || route.legs[i - 1].output === l.input)) {
    throw new PaymentError("route_invalid", "legs do not chain");
  }
  if (now.getTime() >= new Date(input.quote.expiresAt).getTime()) {
    throw new PaymentError("stale_quote", `quote expired at ${input.quote.expiresAt}`);
  }
  if (route.legs.length > 0 && (route.legs[0].input !== route.input || route.legs.at(-1)!.output !== route.deliver)) {
    throw new PaymentError("route_invalid", "legs do not connect the input to the delivered asset");
  }

  // Re-price the same path at live state. The payer pays the current price, up to maxInput.
  const legs: LegQuote[] = [];
  let out = route.deliverAmount;
  for (let i = route.legs.length - 1; i >= 0; i--) {
    const { venue, input: from, output: to } = route.legs[i];
    try {
      const leg = await router.venue(venue).quoteExactOut(from, to, out, now);
      legs.unshift(leg);
      out = leg.amountIn;
    } catch (error) {
      if (!(error instanceof QuoteError)) throw error;
      const reason = error.reason === "provider_unavailable" ? "provider_unavailable" : "insufficient_liquidity";
      throw new PaymentError(reason, error.message, venue);
    }
  }
  const inputAmount = legs.length > 0 ? legs[0].amountIn : route.deliverAmount;
  if (inputAmount > route.maxInput) {
    throw new PaymentError("slippage", `price moved: route now needs ${inputAmount} ${route.input}, limit ${route.maxInput}`);
  }
  const inputAsset = router.asset(route.input);
  const balance = await walletBalance(gateway, payer.address, inputAsset.mint);
  if (balance < inputAmount) {
    throw new PaymentError("insufficient_balance", `needs ${inputAmount} ${route.input}, holds ${balance}`);
  }

  const deliverAsset = router.asset(route.deliver);
  const recipientAccount = await tokenAccountAddress(recipient, deliverAsset.mint);
  const marker = await paymentMarkerAddress(payer.address, paymentId);
  const instructions: Instruction[] = [
    getCreateAccountWithSeedInstruction({
      payer: sponsor,
      newAccount: marker,
      baseAccount: payer,
      base: payer.address,
      seed: settlementSeed(paymentId),
      amount: await gateway.minimumBalanceForRentExemption(BigInt(0)),
      space: 0,
      programAddress: SYSTEM_PROGRAM_ADDRESS,
    }),
    getCreateAssociatedTokenIdempotentInstruction({ payer: sponsor, ata: recipientAccount, owner: recipient, mint: deliverAsset.mint }),
  ];

  const transfer = async (from: Address, authority: TransactionSigner, to: Address, code: string, amount: bigint) => {
    const asset = router.asset(code);
    instructions.push(
      getTransferCheckedInstruction({ source: from, mint: asset.mint, destination: to, authority, amount, decimals: asset.decimals }),
    );
  };

  if (legs.length === 0) {
    await transfer(await tokenAccountAddress(payer.address, inputAsset.mint), payer, recipientAccount, route.deliver, route.deliverAmount);
  } else {
    let source = await tokenAccountAddress(payer.address, inputAsset.mint);
    let authority: TransactionSigner = payer;
    for (const leg of legs) {
      const venue = router.venue(leg.venue);
      const feeAccount = await venue.providerFeeAccount(leg.input);
      if (leg.providerFee > BigInt(0) && !feeAccount) throw new PaymentError("route_invalid", `${leg.venue} has no fee account`);
      await transfer(source, authority, await venue.inventoryAccount(leg.input), leg.input, leg.amountIn - leg.providerFee);
      if (leg.providerFee > BigInt(0)) await transfer(source, authority, feeAccount!, leg.input, leg.providerFee);
      source = await venue.inventoryAccount(leg.output);
      authority = createNoopSigner(venue.authority);
    }
    await transfer(source, authority, recipientAccount, route.deliver, legs.at(-1)!.amountOut);
  }
  instructions.push(getAddMemoInstruction({ memo: `solve:payment:${paymentId}` }, { programAddress: MEMO_PROGRAM }));

  const lifetime = await gateway.latestBlockhash();
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(sponsor, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(lifetime, m),
    (m) => appendTransactionMessageInstructions(instructions, m),
  );
  let transaction: Transaction = await partiallySignTransactionMessageWithSigners(message);

  // Each venue verifies its own flows against live inventory before it signs.
  for (const id of new Set(legs.map((l) => l.venue))) {
    try {
      const signatures = await router.venue(id).cosign(transaction, now);
      transaction = { ...transaction, signatures: { ...transaction.signatures, ...signatures } };
    } catch (error) {
      if (error instanceof QuoteError && error.reason === "provider_unavailable") {
        throw new PaymentError("provider_unavailable", error.message, id);
      }
      throw new PaymentError("venue_refused", error instanceof Error ? error.message : String(error), id);
    }
  }
  const missing = Object.entries(transaction.signatures).filter(([, s]) => !s).map(([a]) => a);
  if (missing.length > 0) throw new PaymentError("route_invalid", `missing signatures: ${missing.join(", ")}`);

  return {
    transaction,
    signature: getSignatureFromTransaction(transaction),
    wire: getBase64EncodedWireTransaction(transaction),
    marker,
    legs,
    inputAmount,
    deliverAmount: route.deliverAmount,
  };
}
