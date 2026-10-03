// In-process Solana runtime for tests and local runs. LiteSVM executes the real SPL Token,
// Associated Token, System and Memo programs, so behavior matches a cluster without a network.
import { getBase58Decoder, getSignatureFromTransaction, lamports, type Address, type Transaction } from "@solana/kit";
import { FailedTransactionMetadata, LiteSVM } from "litesvm";
import type { ChainAccount, ChainGateway, SendOutcome } from "../../lib/chain/gateway";

export class LiteSvmGateway implements ChainGateway {
  readonly cluster = "litesvm" as const;
  // Simulates an RPC outage: send() throws without submitting while true.
  offline = false;
  // Simulates a lost response: the next send() executes, then throws as if the reply never came.
  loseNextResponse = false;
  // Rotates the blockhash after every send. Turn off to land several transactions in one block.
  expireAfterSend = true;

  constructor(readonly svm: LiteSVM = new LiteSVM()) {}

  async latestBlockhash() {
    return { blockhash: this.svm.latestBlockhash(), lastValidBlockHeight: BigInt(Number.MAX_SAFE_INTEGER) };
  }

  async getAccount(address: Address): Promise<ChainAccount | null> {
    const account = this.svm.getAccount(address);
    if (!account.exists) return null;
    return {
      address,
      lamports: BigInt(account.lamports),
      programAddress: account.programAddress,
      data: new Uint8Array(account.data),
    };
  }

  async minimumBalanceForRentExemption(space: bigint) {
    return this.svm.minimumBalanceForRentExemption(space);
  }

  async send(transaction: Transaction): Promise<SendOutcome> {
    const signature = getSignatureFromTransaction(transaction);
    if (this.offline) throw new Error("RPC unavailable");
    const result = this.svm.sendTransaction(transaction);
    // A fresh blockhash per transaction keeps identical-looking retries distinct.
    if (this.expireAfterSend) this.svm.expireBlockhash();
    if (this.loseNextResponse) {
      this.loseNextResponse = false;
      throw new Error("connection reset before the response arrived");
    }
    if (result instanceof FailedTransactionMetadata) {
      return { status: "failed", signature, error: result.err().toString() + "\n" + result.meta().logs().join("\n") };
    }
    return { status: "confirmed", signature, slot: this.svm.getClock().slot };
  }

  airdrop(address: Address, sol = 10) {
    this.svm.airdrop(address, lamports(BigInt(sol) * BigInt(1_000_000_000)));
  }

  signatureString(bytes: Uint8Array) {
    return getBase58Decoder().decode(bytes);
  }
}
