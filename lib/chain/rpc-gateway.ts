// Cluster gateway over JSON-RPC (devnet today, mainnet on the founder's word).
// Settlement-grade: a transaction counts as confirmed only at "finalized" commitment.
import {
  createSolanaRpc,
  getBase64EncodedWireTransaction,
  getSignatureFromTransaction,
  isSolanaError,
  SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE,
  type Address,
  type Transaction,
} from "@solana/kit";
import { UnknownOutcomeError, type ChainAccount, type ChainGateway, type Cluster, type SendOutcome } from "./gateway";

export class RpcGateway implements ChainGateway {
  private readonly rpc;

  constructor(
    readonly cluster: Exclude<Cluster, "litesvm">,
    url: string,
    private readonly options = { confirmTimeoutMs: 60_000, pollIntervalMs: 1_500 },
  ) {
    this.rpc = createSolanaRpc(url);
  }

  async latestBlockhash() {
    const { value } = await this.rpc.getLatestBlockhash({ commitment: "finalized" }).send();
    return value;
  }

  async getAccount(address: Address): Promise<ChainAccount | null> {
    const { value } = await this.rpc.getAccountInfo(address, { encoding: "base64", commitment: "finalized" }).send();
    if (!value) return null;
    return {
      address,
      lamports: value.lamports,
      programAddress: value.owner,
      data: Uint8Array.from(atob(value.data[0]), (c) => c.charCodeAt(0)),
    };
  }

  async minimumBalanceForRentExemption(space: bigint) {
    return this.rpc.getMinimumBalanceForRentExemption(space).send();
  }

  async send(transaction: Transaction): Promise<SendOutcome> {
    const signature = getSignatureFromTransaction(transaction);
    try {
      await this.rpc
        .sendTransaction(getBase64EncodedWireTransaction(transaction), { encoding: "base64", preflightCommitment: "confirmed" })
        .send();
    } catch (error) {
      // A failed preflight means the node never forwarded the transaction: definitely no effect.
      if (isSolanaError(error, SOLANA_ERROR__JSON_RPC__SERVER_ERROR_SEND_TRANSACTION_PREFLIGHT_FAILURE)) {
        return { status: "failed", signature, error: error.message };
      }
      throw new UnknownOutcomeError(signature, `send failed: ${String(error)}`);
    }

    const deadline = Date.now() + this.options.confirmTimeoutMs;
    while (Date.now() < deadline) {
      const { value } = await this.rpc.getSignatureStatuses([signature]).send();
      const status = value[0];
      if (status?.err) return { status: "failed", signature, error: JSON.stringify(status.err) };
      if (status?.confirmationStatus === "finalized") return { status: "confirmed", signature, slot: status.slot };
      await new Promise((resolve) => setTimeout(resolve, this.options.pollIntervalMs));
    }
    // Never infer success or failure from a timeout.
    throw new UnknownOutcomeError(signature, "not finalized before timeout");
  }
}
