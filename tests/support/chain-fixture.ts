import { runGenesis, solve, VAULTS, type Vault } from "../../lib/chain/solve";
import { newSigner } from "./keys";
import { LiteSvmGateway } from "./litesvm-gateway";

// A fresh in-process chain with DEV-SOLVE genesis run: fixed supply, five vaults, bounded earn delegate.
export async function devSolveChain({ releaseCapacity = solve(1_000_000) } = {}) {
  const gateway = new LiteSvmGateway();
  const sponsor = await newSigner();
  const mint = await newSigner();
  const mintAuthority = await newSigner();
  const settlementAuthority = await newSigner();
  const owners = {} as Record<Vault, Awaited<ReturnType<typeof newSigner>>>;
  for (const v of VAULTS) owners[v] = await newSigner();
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
