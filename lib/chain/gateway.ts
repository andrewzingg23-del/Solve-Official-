// The chain boundary. Everything that touches a Solana cluster goes through a gateway, so the same
// transactions run against devnet, mainnet or an in-process runtime in tests.
import type { Address, Blockhash, Signature, Transaction } from "@solana/kit";

export type Cluster = "litesvm" | "solana-devnet" | "solana-mainnet";

export type ChainAccount = {
  address: Address;
  lamports: bigint;
  programAddress: Address;
  data: Uint8Array;
};

export type SendOutcome =
  // The transaction landed and succeeded.
  | { status: "confirmed"; signature: Signature; slot: bigint }
  // The transaction definitely did not take effect (rejected in preflight or failed on chain).
  | { status: "failed"; signature: Signature; error: string };

// Thrown when the gateway cannot tell whether a transaction took effect (timeout, outage).
// Callers must reconcile; they must never assume success or failure.
export class UnknownOutcomeError extends Error {
  constructor(
    readonly signature: Signature,
    message: string,
  ) {
    super(message);
    this.name = "UnknownOutcomeError";
  }
}

export interface ChainGateway {
  readonly cluster: Cluster;
  latestBlockhash(): Promise<{ blockhash: Blockhash; lastValidBlockHeight: bigint }>;
  getAccount(address: Address): Promise<ChainAccount | null>;
  minimumBalanceForRentExemption(space: bigint): Promise<bigint>;
  send(transaction: Transaction): Promise<SendOutcome>;
}
