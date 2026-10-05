// A World's anchors: its history committed on chain as a fingerprint. Only the root goes on chain,
// never anything in the World. The owner can anchor now when this deployment has an anchor key.
import { label } from "@/app/ui";
import { day } from "@/app/save-point";
import type { Checkpoint } from "@/lib/bot/anchor";

type FormAction = (formData: FormData) => void | Promise<void>;

const where = (c: Checkpoint["cluster"]) => (c === "solana-mainnet" ? "Solana" : c === "solana-devnet" ? "Solana devnet" : "a local test chain");

export function AnchorPanel({ anchors, anchor }: { anchors: Checkpoint[]; anchor?: FormAction }) {
  const last = anchors.at(-1);
  return (
    <section aria-labelledby="anchor-title" className="flex flex-col gap-3 rounded-md border border-line bg-surface/45 p-5">
      <h2 id="anchor-title" className={label}>On chain</h2>
      {last ? (
        <p className="text-sm leading-6 tabular-nums">
          Anchored on {where(last.cluster)} · {day(last.at)} · {last.count} {last.count === 1 ? "event" : "events"}
          {last.url ? (
            <>
              {" · "}
              <a href={last.url} target="_blank" rel="noopener noreferrer nofollow" className="underline decoration-line underline-offset-4 hover:text-accent">See the anchor</a>
            </>
          ) : null}
        </p>
      ) : (
        <p className="text-sm leading-6 text-muted">Not anchored yet.</p>
      )}
      <p className="text-xs leading-5 text-muted">
        Anchoring writes a fingerprint of this World&apos;s history on Solana, never what&apos;s in it. Anyone can then check a shared save against it. It proves the record wasn&apos;t changed afterward, not that the thing itself happened.
      </p>
      {anchor ? (
        <form action={anchor}>
          <button type="submit" className="inline-flex h-8 items-center justify-center rounded-md border border-line px-3 text-[10px] font-semibold uppercase tracking-[0.18em] transition-colors duration-300 ease-calm hover:border-accent hover:text-accent">
            Anchor this World now
          </button>
        </form>
      ) : (
        <p className="text-xs text-muted">Anchoring isn&apos;t set up on this deployment yet.</p>
      )}
    </section>
  );
}
