"use client";

import { useMemo, useState } from "react";
import {
  ACCOUNTS,
  CAUTION,
  SHILL_CHECKLIST,
  TIERS,
  VIRAL_VERDICTS,
  type WatchAccount,
} from "./watchlist-data";

function matches(a: WatchAccount, q: string): boolean {
  const hay = `${a.name} ${a.handle} ${a.platform} ${a.role} ${a.knownFor} ${a.whyTrusted} ${a.caveat}`.toLowerCase();
  return hay.includes(q);
}

function AccountCard({ a }: { a: WatchAccount }) {
  return (
    <article className="glass p-5 md:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-lg font-medium tracking-tight text-foreground">{a.name}</h3>
        <p className="text-xs tabular-nums text-faint">{a.handle} · {a.platform}</p>
      </div>
      <p className="eyebrow mt-2">{a.role}</p>
      <dl className="mt-4 space-y-3 text-sm leading-6">
        <div>
          <dt className="text-[10px] uppercase tracking-[0.14em] text-faint">Known for</dt>
          <dd className="mt-1 text-muted">{a.knownFor}</dd>
        </div>
        <div>
          <dt className="text-[10px] uppercase tracking-[0.14em] text-faint">Why trusted</dt>
          <dd className="mt-1 text-muted">{a.whyTrusted}</dd>
        </div>
        <div className="rounded-xl border border-[rgb(255_77_94/0.25)] bg-[rgb(255_77_94/0.06)] p-3">
          <dt className="text-[10px] uppercase tracking-[0.14em] text-negative">Caveat</dt>
          <dd className="mt-1 text-foreground/90">{a.caveat}</dd>
        </div>
      </dl>
    </article>
  );
}

export function WatchlistClient() {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();

  const filtered = useMemo(
    () => (q ? ACCOUNTS.filter((a) => matches(a, q)) : ACCOUNTS),
    [q],
  );
  const cautionFiltered = useMemo(
    () =>
      q
        ? CAUTION.filter((c) => `${c.name} ${c.handle} ${c.flags}`.toLowerCase().includes(q))
        : CAUTION,
    [q],
  );

  return (
    <div>
      <div className="glass flex items-center gap-3 p-4">
        <label htmlFor="watchlist-search" className="sr-only">
          Search the watchlist
        </label>
        <input
          id="watchlist-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, handle, or keyword…"
          className="w-full bg-transparent text-sm text-foreground placeholder:text-faint focus:outline-none"
          autoComplete="off"
        />
        {q && (
          <p className="shrink-0 text-xs tabular-nums text-faint" role="status">
            {filtered.length + cautionFiltered.length} hit{filtered.length + cautionFiltered.length === 1 ? "" : "s"}
          </p>
        )}
      </div>

      {filtered.length === 0 && cautionFiltered.length === 0 ? (
        <p className="mt-8 text-sm text-faint" role="status">
          Nothing on the watchlist matches “{query.trim()}”.
        </p>
      ) : (
        <>
          {TIERS.map((tier) => {
            const inTier = filtered.filter((a) => a.tier === tier.id);
            if (inTier.length === 0) return null;
            return (
              <section key={tier.id} aria-label={tier.title} className="mt-10">
                <p className="eyebrow eyebrow-accent">{tier.title}</p>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-faint">{tier.blurb}</p>
                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  {inTier.map((a) => (
                    <AccountCard key={`${a.tier}-${a.handle}`} a={a} />
                  ))}
                </div>
              </section>
            );
          })}

          {!q && (
            <section aria-label="Viral bot accounts verdict" className="mt-12">
              <p className="eyebrow">Viral check</p>
              <h2 className="mt-2 text-xl font-medium tracking-tight text-foreground">
                The three accounts from the viral bot posts
              </h2>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-faint">
                Evaluated against the same bar. None belongs on a signal watchlist.
              </p>
              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                {VIRAL_VERDICTS.map((v) => (
                  <article key={v.handle} className="glass p-5">
                    <div className="flex items-baseline justify-between gap-2">
                      <h3 className="font-medium text-foreground">{v.handle}</h3>
                      <p className="text-xs tabular-nums text-faint">{v.followers}</p>
                    </div>
                    <p className="mt-1 text-xs italic text-faint">{v.bio}</p>
                    <p className="mt-3 text-sm leading-6 text-muted">{v.finding}</p>
                    <p className="mt-3 rounded-xl border border-[rgb(255_77_94/0.25)] bg-[rgb(255_77_94/0.06)] p-3 text-sm font-medium text-foreground/90">
                      {v.verdict}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          )}

          <section aria-label="Proceed with caution" className="mt-12">
            <p className="eyebrow">Caution list</p>
            <h2 className="mt-2 text-xl font-medium tracking-tight text-foreground">
              Popular, but questionable
            </h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-faint">
              Big audiences, specific red flags. Not a watchlist — a warning list.
            </p>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {cautionFiltered.map((c) => (
                <article key={c.name} className="glass p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <h3 className="font-medium text-foreground">{c.name}</h3>
                    <p className="text-xs text-faint">{c.handle}</p>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-muted">{c.flags}</p>
                </article>
              ))}
            </div>
          </section>

          {!q && (
            <section aria-label="Shill checklist" className="mt-12">
              <p className="eyebrow">Field guide</p>
              <h2 className="mt-2 text-xl font-medium tracking-tight text-foreground">
                Spot the shill
              </h2>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-faint">
                Eleven checks for judging any new memecoin account.
              </p>
              <ol className="mt-4 grid gap-3 lg:grid-cols-2">
                {SHILL_CHECKLIST.map((s, i) => (
                  <li key={s.title} className="glass flex gap-4 p-4">
                    <span className="stat-number text-2xl text-accent" aria-hidden="true">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-foreground">{s.title}</p>
                      <p className="mt-1 text-xs leading-5 text-muted">{s.detail}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </>
      )}
    </div>
  );
}
