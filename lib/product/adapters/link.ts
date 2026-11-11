// link.capture — bring a web page into a Space as a real, checked resource. The first adapter
// because it needs no provider account, so it works for anyone, person or AI, today.
//
// What it really does: fetches the page over https, follows at most three redirects (each one
// re-checked), reads at most 512 KB, and records the final address, the HTTP status, the page's own
// title and description, and a SHA-256 of the bytes it received. Nothing is invented: a page with no
// title is saved with no title. It never fetches private, loopback, link-local or internal addresses,
// or anything with credentials in it. (DNS that resolves a public name to a private address is not
// re-checked here; the fetch runs on Vercel, outside any private network.)
import { createHash } from "node:crypto";
import type { Adapter } from "../run";

export type LinkInput = { url: string };
export type LinkCapture = { url: string; finalUrl: string; status: number; title: string; description: string; contentHash: `sha256:${string}`; mediaType: string; fetchedAt: string };

class Transient extends Error {}
const MAX_BYTES = 512 * 1024;

function safeUrl(raw: string): URL | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== "https:" || u.username || u.password) return null;
    const h = u.hostname.toLowerCase();
    if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal") || !h.includes(".")) return null;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
      const [a, b] = h.split(".").map(Number);
      if (a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127)) return null;
    }
    if (h.startsWith("[")) return null; // no IPv6 literals
    return u;
  } catch { return null; }
}

const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
function meta(html: string, name: string) {
  const m = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*content=["']([^"']*)["']`, "i").exec(html)
    ?? new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${name}["']`, "i").exec(html);
  return m ? decode(m[1]).slice(0, 300) : "";
}

export function linkAdapter(fetchImpl: typeof fetch = fetch): Adapter<LinkInput, LinkCapture> {
  return {
    id: "link.capture",
    provider: "web",
    costPerCallUsd: 0, // a plain https fetch from Solve's server
    title: input => `Bring in ${input.url}`,
    validate: raw => {
      const url = typeof (raw as { url?: unknown })?.url === "string" ? (raw as { url: string }).url : "";
      return safeUrl(url) && url.length <= 2048 ? { ok: true, input: { url: safeUrl(url)!.toString() } } : { ok: false, error: "Give a full https:// address of a public page." };
    },
    transient: e => e instanceof Transient,
    execute: async input => {
      let url = safeUrl(input.url)!;
      for (let hop = 0; hop <= 3; hop++) {
        let res: Response;
        try {
          res = await fetchImpl(url, { redirect: "manual", signal: AbortSignal.timeout(8000), headers: { "User-Agent": "Solve link capture", Accept: "text/html,*/*;q=0.5" } });
        } catch (e) { throw new Transient(`The page didn't answer (${e instanceof Error ? e.name : "network"}).`); }
        if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
          const next = safeUrl(new URL(res.headers.get("location")!, url).toString());
          if (!next) throw new Error("The page redirects somewhere Solve won't follow.");
          url = next; continue;
        }
        if (res.status >= 500 || res.status === 429) throw new Transient(`The site answered ${res.status}; try again later.`);
        if (res.status >= 400) throw new Error(`The site answered ${res.status}: there's nothing to bring in at that address.`);
        const reader = res.body?.getReader();
        const chunks: Uint8Array[] = []; let size = 0;
        while (reader) { const { done, value } = await reader.read(); if (done) break; chunks.push(value); size += value.length; if (size >= MAX_BYTES) { await reader.cancel(); break; } }
        const bytes = Buffer.concat(chunks.map(c => Buffer.from(c))).subarray(0, MAX_BYTES);
        const mediaType = (res.headers.get("content-type") ?? "").split(";")[0].trim() || "application/octet-stream";
        const html = mediaType.includes("html") ? bytes.toString("utf8") : "";
        const title = html ? (meta(html, "og:title") || decode(/<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1] ?? "").slice(0, 300)) : "";
        return { url: input.url, finalUrl: url.toString(), status: res.status, title, description: html ? (meta(html, "og:description") || meta(html, "description")) : "",
          contentHash: `sha256:${createHash("sha256").update(bytes).digest("hex")}` as `sha256:${string}`, mediaType, fetchedAt: new Date().toISOString() };
      }
      throw new Error("Too many redirects.");
    },
    fingerprint: out => ({ contentHash: out.contentHash, uri: out.finalUrl, mediaType: out.mediaType }),
    persist: async (kernel, world, out, key) => kernel.upsertEntity({
      kind: "document", scope: world.scope, title: (out.title || new URL(out.finalUrl).hostname).slice(0, 160), summary: out.description.slice(0, 240),
      attributes: { documentType: "link", worldId: world.worldId, url: out.finalUrl, title: out.title, description: out.description,
        captured: { status: out.status, at: out.fetchedAt, contentHash: out.contentHash, mediaType: out.mediaType }, checked: true },
      visibility: "members", idempotencyKey: `link-capture:${key}`,
    }),
  };
}
