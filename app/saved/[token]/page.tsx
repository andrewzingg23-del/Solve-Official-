// A shared save: the public receipt. It shows only what its owner chose to share, from a snapshot
// the server signed (lib/bot/receipt.ts). Brand surfaces open on the white floor (BRAND.md §8).
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { openReceipt, receiptSecret, type Receipt } from "@/lib/bot/receipt";
import { partOutlinePath } from "@/lib/bot/part";
import { saveNumber, vouch } from "@/lib/bot/vouch";

export const dynamic = "force-dynamic";

const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

function load(token: string): Receipt | null {
  const secret = receiptSecret();
  return secret ? openReceipt(decodeURIComponent(token), secret) : null;
}

export async function generateMetadata({ params }: PageProps<"/saved/[token]">): Promise<Metadata> {
  const r = load((await params).token);
  if (!r) return { title: "solve", robots: { index: false } };
  return {
    title: `Saved ${saveNumber(r.n)}: ${r.what}`,
    description: `${vouch(r.basis, r.owner)} · ${day(r.at)} · on solve`,
    robots: { index: false },
  };
}

export default async function SavedPage({ params }: PageProps<"/saved/[token]">) {
  const r = load((await params).token);
  if (!r) notFound();
  const outline = r.part ? partOutlinePath({ profile: r.part.outline, holes: r.part.holes }) : null;
  return (
    <div className="min-h-svh w-full bg-[#f2f7fb] text-[#04070d]">
      <main className="mx-auto flex min-h-svh w-full max-w-2xl flex-col gap-10 px-4 py-10 md:px-8 md:py-16">
        <Link href="/" aria-label="solve" className="self-start">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brand/solve-wordmark-on-light.svg" alt="solve." className="h-7 w-auto" />
        </Link>

        <section className="flex flex-col gap-5 border-t border-[#04070d] pt-6">
          <p className="flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.24em] tabular-nums">
            <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-[#0891b2]" />
            Saved · {saveNumber(r.n)}
          </p>
          <h1 className="text-3xl font-semibold leading-tight tracking-tight [text-wrap:balance] md:text-5xl">{r.what}</h1>
          <p className="text-sm text-[#4d5b6c] tabular-nums">
            {vouch(r.basis, r.owner)} · {day(r.at)} · {r.title}
          </p>
        </section>

        {outline && r.part ? (
          <figure className="flex flex-col gap-3 rounded-xl border border-[#d3dde6] bg-white p-6">
            <svg viewBox={`-4 -4 ${outline.width + 8} ${outline.height + 8}`} role="img" aria-label={`${r.title}: side outline, ${r.part.size} mm`} className="mx-auto h-auto max-h-64 w-full max-w-md">
              <path d={outline.d} fillRule="evenodd" fill="#04070d" fillOpacity={0.06} stroke="#04070d" strokeWidth={1.2} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
              <line x1={-4} y1={outline.height} x2={outline.width + 4} y2={outline.height} stroke="#04070d" strokeOpacity={0.4} strokeWidth={1} vectorEffect="non-scaling-stroke" />
            </svg>
            <figcaption className="text-xs text-[#4d5b6c] tabular-nums">{r.part.size} mm · {r.part.material} · designed and made in a World on solve</figcaption>
          </figure>
        ) : null}

        <footer className="mt-auto flex flex-col gap-3 border-t border-[#d3dde6] pt-6 text-sm">
          <p className="font-medium">Everything here is real.</p>
          <p className="text-xs leading-5 text-[#4d5b6c]">
            {r.owner} shared this from their record on {day(r.issued)}. {r.basis === "externally_verified" ? "It was verified." : `It rests on ${r.basis === "self_reported" ? `${r.owner}'s word` : "what was seen"}, not on an outside check.`}
          </p>
          <Link href="/" className="self-start text-[11px] font-semibold uppercase tracking-[0.2em] text-[#0891b2] underline decoration-[#d3dde6] underline-offset-4">
            Make your own
          </Link>
        </footer>
      </main>
    </div>
  );
}
