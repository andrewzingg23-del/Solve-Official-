// Waiting on you, at the top of /bot: decisions to make and next steps to take, each linking to the
// World where it is done. Nothing shows when nothing is waiting.
import Link from "next/link";
import type { WaitingItem } from "@/lib/bot/waiting";

function host(link: string) {
  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function WaitingOnYou({ items }: { items: WaitingItem[] }) {
  if (!items.length) return null;
  return (
    <section aria-labelledby="waiting-title" className="flex flex-col gap-3 rounded-md border border-line bg-surface/60 p-5">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id="waiting-title" className="text-xs font-medium uppercase tracking-[0.24em] text-muted">Waiting on you</h2>
        <span className="text-[10px] uppercase tracking-[0.16em] text-muted tabular-nums">{items.length}</span>
      </div>
      <ol className="flex flex-col divide-y divide-line">
        {items.map((item) => (
          <li key={`${item.kind}:${item.pieceId}`} className="flex flex-col gap-1 py-3 text-sm">
            <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">{item.kind === "approve" ? "Approve messages" : item.kind === "choose" ? "Choose a route" : "Next step"}</span>
            {item.kind === "approve" ? (
              <>
                <Link href={`/world/${item.worldId}`} className="break-words hover:text-accent">{item.ask}</Link>
                <span className="text-xs leading-5 text-muted tabular-nums">{item.pending} of {item.total} messages to approve · in {item.worldTitle}</span>
              </>
            ) : item.kind === "choose" ? (
              <>
                <Link href={`/world/${item.worldId}`} className="break-words hover:text-accent">{item.ask}</Link>
                <span className="break-words text-xs leading-5 text-muted">
                  {item.options.length === 1 ? "One option" : `${item.options.length} options`}: {item.options.join(" · ")} · in {item.worldTitle}
                </span>
              </>
            ) : (
              <>
                <Link href={`/world/${item.worldId}`} className="break-words hover:text-accent">{item.step}</Link>
                <span className="break-words text-xs leading-5 text-muted tabular-nums">
                  {item.route} · {item.done} of {item.total} done · in {item.worldTitle}
                  {item.link && host(item.link) ? (
                    <>
                      {" · "}
                      <a href={item.link} target="_blank" rel="noopener noreferrer nofollow" className="underline decoration-line underline-offset-4 hover:text-accent">{host(item.link)}</a>
                    </>
                  ) : null}
                </span>
              </>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
