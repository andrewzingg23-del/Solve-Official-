// A shared save: the public receipt. It shows only what its owner chose to share, from a snapshot
// the server signed (lib/bot/receipt.ts). On the cinematic dark system: abyssal, ice type,
// hologram cyan as the single accent (founder law 2026-10-06).
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { receiptFromPath, type Receipt } from "@/lib/bot/receipt";
import { explorerUrl, leafHash, verifyProof } from "@/lib/chain/anchor";
import { partOutlinePath } from "@/lib/bot/part";
import { saveNumber, vouch } from "@/lib/bot/vouch";

export const dynamic = "force-dynamic";

const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export async function generateMetadata({ params }: PageProps<"/saved/[token]">): Promise<Metadata> {
  const r = receiptFromPath((await params).token);
  if (!r) return { title: "solve", robots: { index: false } };
  return {
    title: `Saved ${saveNumber(r.n)}: ${r.what}`,
    description: `${vouch(r.basis, r.owner)} · ${day(r.at)} · on solve`,
    robots: { index: false },
  };
}

export default async function SavedPage({ params }: PageProps<"/saved/[token]">) {
  const r = receiptFromPath((await params).token);
  if (!r) notFound();
  const outline = r.part ? partOutlinePath({ profile: r.part.outline, holes: r.part.holes }) : null;
  return (
    <div className="min-h-svh w-full text-foreground">
      <main className="relative mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-10 px-4 py-10 md:px-8 md:py-16">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[320px] overflow-hidden">
          <div className="absolute left-1/2 top-[-140px] h-[280px] w-[560px] -translate-x-1/2 rounded-[50%] bg-accent/[0.08] blur-3xl" />
        </div>

        <Link href="/" aria-label="solve" className="relative self-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/solve-wordmark-on-dark.svg" alt="solve." className="h-7 w-auto" />
        </Link>

        <section className="relative flex flex-col gap-5 border-t border-accent/40 pt-6">
          <p className="flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.24em] tabular-nums text-accent">
            <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-accent shadow-[0_0_12px_rgb(34_211_238/0.8)]" />
            Saved · {saveNumber(r.n)}
          </p>
          <h1 className="text-3xl font-semibold leading-tight tracking-tight [text-wrap:balance] md:text-5xl">{r.what}</h1>
          <p className="text-sm text-muted tabular-nums">
            {vouch(r.basis, r.owner)} · {day(r.at)} · {r.title}
          </p>
        </section>

        {outline && r.part ? (
          <figure className="glass relative flex flex-col gap-3 p-6">
            <svg viewBox={`-4 -4 ${outline.width + 8} ${outline.height + 8}`} role="img" aria-label={`${r.title}: side outline, ${r.part.size} mm`} className="mx-auto h-auto max-h-64 w-full max-w-md">
              <path d={outline.d} fillRule="evenodd" fill="#22d3ee" fillOpacity={0.08} stroke="#22d3ee" strokeWidth={1.2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
              <line x1={-4} y1={outline.height} x2={outline.width + 4} y2={outline.height} stroke="#f2f7fb" strokeOpacity={0.4} strokeWidth={1} vectorEffect="non-scaling-stroke" />
            </svg>
            <figcaption className="text-xs text-muted tabular-nums">{r.part.size} mm · {r.part.material} · designed and made in a World on solve</figcaption>
          </figure>
        ) : null}

        <footer className="relative mt-auto flex flex-col gap-3 border-t border-line pt-6 text-sm">
          <p className="font-medium">Everything here is real.</p>
          {r.anchor ? <AnchorLine anchor={r.anchor} /> : null}
          <p className="text-xs leading-5 text-muted">
            {r.owner} shared this from their record on {day(r.issued)}. {r.basis === "externally_verified" ? "It was verified." : `It rests on ${r.basis === "self_reported" ? `${r.owner}'s word` : "what was seen"}, not on an outside check.`}
          </p>
          <Link href="/" className="self-start text-[11px] font-semibold uppercase tracking-[0.2em] text-accent underline decoration-line underline-offset-4 transition-opacity duration-300 hover:opacity-80">
            Make your own
          </Link>
        </footer>
      </main>
    </div>
  );
}

// The anchor, checked here: the save's leaf and proof must lead to the root that was written on
// chain. It shows the record wasn't changed after the anchor, never that the event happened.
function AnchorLine({ anchor }: { anchor: NonNullable<Receipt["anchor"]> }) {
  const holds = verifyProof(leafHash({ seq: anchor.seq, hash: anchor.hash }), anchor.proof, anchor.root);
  const where = anchor.cluster === "solana-mainnet" ? "Solana" : anchor.cluster === "solana-devnet" ? "Solana devnet" : "a local test chain";
  const url = explorerUrl(anchor.cluster, anchor.signature);
  return (
    <p className="text-xs leading-5 text-muted">
      {holds ? `Anchored on ${where} on ${day(anchor.at)}: its proof checks out against the root written there, so this save was on the record by then and hasn't been changed since.` : "Its anchor proof does not check out, so treat this receipt with care."}
      {url && holds ? (
        <>
          {" "}
          <a href={url} target="_blank" rel="noopener noreferrer nofollow" className="text-accent underline decoration-line underline-offset-4">See the anchor</a>
        </>
      ) : null}
    </p>
  );
}
