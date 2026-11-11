// Server only: imported from server actions, route handlers and the connector, never a client component.

// github.repo.read — a real, authenticated read from the person's own GitHub, through the same run
// path as everything else (lib/product/run.ts). Read-only, so retries are safe (docs §10).
//
// Connection problems are handled here, not by the person: an expired token is renewed with the
// refresh token and the renewed token sealed back; only when GitHub itself refuses the refresh is the
// connection marked "reconnect" and the run fails saying exactly that.
import { createHash } from "node:crypto";
import { KernelError, type Kernel } from "@/lib/kernel/client";
import type { Adapter } from "../run";
import { readProvider, writeProvider } from "../credentials";
import { GithubAuthError, githubGet, refreshGithubToken, type GithubTokens } from "../providers/github";

export class NotConnected extends Error {}
export class NeedsReconnect extends Error {}
export class NotAllowed extends Error {}

/**
 * A usable GitHub token for this person, renewing it if it has lapsed. `kernel` is whoever is acting:
 * the person, or an app they allowed to use their GitHub (it holds read + write on that one record).
 */
export async function githubToken(kernel: Kernel, personId: string, fetchImpl: typeof fetch = fetch, now = () => Date.now()): Promise<string> {
  const conn = await readProvider(kernel, personId, "github").catch(e => {
    if (e instanceof KernelError && e.name === "forbidden") throw new NotAllowed("This app isn't allowed to use your GitHub. You can allow it in Apps.");
    throw e;
  });
  if (!conn || conn.status === "disconnected" || !conn.sealed) throw new NotConnected("GitHub isn't connected. Connect it in Apps.");
  if (conn.status === "reconnect") throw new NeedsReconnect("GitHub needs you to sign in again. Reconnect it in Apps.");
  const { unseal } = await import("../credentials");
  const tokens = unseal<GithubTokens>(conn.sealed);
  const lapsed = tokens.expiresAt && Date.parse(tokens.expiresAt) - now() < 60_000;
  if (!lapsed) return tokens.accessToken;
  if (!tokens.refreshToken) {
    await writeProvider(kernel, personId, "github", conn, { account: conn.account, status: "reconnect", secret: tokens }, `gh-lapsed:${conn.entityId}:${tokens.expiresAt}`).catch(() => {});
    throw new NeedsReconnect("GitHub's access has lapsed. Reconnect it in Apps.");
  }
  try {
    const renewed = await refreshGithubToken(tokens.refreshToken, fetchImpl);
    await writeProvider(kernel, personId, "github", conn, { account: conn.account, status: "connected", secret: renewed }, `gh-refresh:${createHash("sha256").update(tokens.refreshToken).digest("hex").slice(0, 32)}`);
    return renewed.accessToken;
  } catch (e) {
    if (e instanceof GithubAuthError) {
      await writeProvider(kernel, personId, "github", conn, { account: conn.account, status: "reconnect", secret: tokens }, `gh-refused:${conn.entityId}:${e.code}`).catch(() => {});
      throw new NeedsReconnect("GitHub refused to renew access. Reconnect it in Apps.");
    }
    throw e; // a network failure: transient, worth retrying
  }
}

export type RepoInput = { repo: string };
export type RepoRead = { fullName: string; description: string; htmlUrl: string; defaultBranch: string; visibility: string; pushedAt: string; stars: number; openIssues: number; readme: string; raw: string };

class Transient extends Error {}
const REPO = /^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/;

/** "owner/name", or a github.com URL to it, as a validated repo id. */
export function repoFrom(raw: string): string | null {
  const s = raw.trim().replace(/^https:\/\/github\.com\//i, "").replace(/\.git$/i, "").replace(/\/+$/, "").split(/[?#]/)[0];
  const two = s.split("/").slice(0, 2).join("/");
  return REPO.test(two) ? two : null;
}

export function githubRepoAdapter(token: () => Promise<string>, fetchImpl: typeof fetch = fetch): Adapter<RepoInput, RepoRead> {
  return {
    id: "github.repo.read",
    provider: "github",
    costPerCallUsd: 0, // GitHub's REST API, within the user's own rate limit
    title: input => `Read ${input.repo} on GitHub`,
    validate: raw => {
      const repo = repoFrom(typeof (raw as { repo?: unknown })?.repo === "string" ? (raw as { repo: string }).repo : "");
      return repo ? { ok: true, input: { repo } } : { ok: false, error: "Name a repository as owner/name." };
    },
    transient: e => e instanceof Transient || (e instanceof TypeError),
    execute: async input => {
      const t = await token();
      let repo;
      try { repo = await githubGet(t, `/repos/${input.repo}`, fetchImpl); }
      catch (e) { throw new Transient(`GitHub didn't answer (${e instanceof Error ? e.name : "network"}).`); }
      if (repo.status === 401) throw new NeedsReconnect("GitHub no longer accepts this connection. Reconnect it in Apps.");
      if (repo.status === 404 || repo.status === 403) throw new Error(`GitHub won't show ${input.repo} to this connection — it may not exist, or it isn't one of the repositories you let Solve see.`);
      if (repo.status >= 500 || repo.status === 429) throw new Transient(`GitHub answered ${repo.status}; try again shortly.`);
      if (repo.status !== 200) throw new Error(`GitHub answered ${repo.status}.`);
      const b = repo.body as Record<string, unknown>;
      // The README, if there is one; a repository without one is recorded without one.
      const readme = await githubGet(t, `/repos/${input.repo}/readme`, fetchImpl).catch(() => null);
      const content = readme?.status === 200 && typeof (readme.body as { content?: unknown })?.content === "string"
        ? Buffer.from((readme.body as { content: string }).content, "base64").toString("utf8").slice(0, 3000) : "";
      return {
        fullName: String(b.full_name ?? input.repo), description: String(b.description ?? ""), htmlUrl: String(b.html_url ?? `https://github.com/${input.repo}`),
        defaultBranch: String(b.default_branch ?? ""), visibility: String(b.visibility ?? (b.private ? "private" : "public")), pushedAt: String(b.pushed_at ?? ""),
        stars: Number(b.stargazers_count ?? 0), openIssues: Number(b.open_issues_count ?? 0), readme: content, raw: repo.raw,
      };
    },
    fingerprint: out => ({ contentHash: `sha256:${createHash("sha256").update(out.raw).digest("hex")}` as `sha256:${string}`, uri: `https://api.github.com/repos/${out.fullName}`, mediaType: "application/json" }),
    persist: async (kernel, world, out, key) => kernel.upsertEntity({
      kind: "document", scope: world.scope, title: out.fullName.slice(0, 160), summary: out.description.slice(0, 240),
      attributes: {
        documentType: "link", worldId: world.worldId, url: out.htmlUrl, title: out.fullName, description: out.description,
        captured: { status: 200, at: new Date().toISOString(), contentHash: `sha256:${createHash("sha256").update(out.raw).digest("hex")}`, mediaType: "application/json", provider: "github" },
        github: { defaultBranch: out.defaultBranch, visibility: out.visibility, pushedAt: out.pushedAt, stars: out.stars, openIssues: out.openIssues, readme: out.readme },
        checked: true,
      },
      visibility: "members", idempotencyKey: `github-repo:${key}`,
    }),
  };
}
