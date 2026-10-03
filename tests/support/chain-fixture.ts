import { generateKeyPairSigner } from "@solana/kit";
import { runGenesis, solve, VAULTS, type Vault } from "../../lib/chain/solve";
import { LiteSvmGateway } from "./litesvm-gateway";

// A fresh in-process chain with DEV-SOLVE genesis run: fixed supply, five vaults, bounded earn delegate.
export async function devSolveChain({ releaseCapacity = solve(1_000_000) } = {}) {
  const gateway = new LiteSvmGateway();
  const sponsor = await generateKeyPairSigner();
  const mint = await generateKeyPairSigner();
  const mintAuthority = await generateKeyPairSigner();
  const settlementAuthority = await generateKeyPairSigner();
  const owners = {} as Record<Vault, Awaited<ReturnType<typeof generateKeyPairSigner>>>;
  for (const v of VAULTS) owners[v] = await generateKeyPairSigner();
  gateway.airdrop(sponsor.address, 100);

  const manifest = await runGenesis({
    gateway,
    payer: sponsor,
    mint,
    mintAuthority,
    vaultOwners: Object.fromEntries(VAULTS.map((v) => [v, owners[v].address])) as Record<Vault, typeof owners.earn.address>,
    earnOwner: owners.earn,
    settlementAuthority: settlementAuthority.address,
    releaseCapacity,
  });
  return { gateway, sponsor, mintAuthority, settlementAuthority, owners, manifest };
}
