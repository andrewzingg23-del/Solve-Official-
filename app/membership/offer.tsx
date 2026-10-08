// What makes the club different, what it costs, and what members get. Prices are the founder's
// proposal (2026-10-05) and change only by the founder's word; they are on the page so an applicant
// knows before applying. No earnings promises: the room is about the men, not a return.
import Link from "next/link";
import { accent, label, line, muted, panel, primary, secondary } from "../venture-style";

const DIFFERENT = [
  ["Money doesn't get you in.", "The oath, a member's vouch and an interview. The price keeps the room small; it doesn't buy a seat."],
  ["Your word is on the record.", "Commitments and wins are saved in solve, where your table sees them. Not a group chat that forgets."],
  ["Small on purpose.", "Fifty founding seats. Tables of ten men who meet every week."],
  ["Built by operators.", "Run by a founder with real businesses in solar and insurance, who brings the room into the work."],
] as const;

const TIERS = [
  {
    name: "Founding seat",
    price: "$6,000",
    per: "a year, or $550 a month",
    note: "Locked for life for the first fifty.",
    gets: [
      "Your table: ten men, one call a week, the same seat every week.",
      "Two gatherings a year, in person.",
      "Your private World in solve: your goals, your routes, your word kept on the record.",
      "A monthly open line with the founder.",
      "First look at the ventures we build, and introductions to members building their own.",
    ],
  },
  {
    name: "Inner Circle",
    price: "$18,000",
    per: "a year",
    note: "Ten seats.",
    gets: [
      "Everything in the founding seat.",
      "A one-on-one with the founder every quarter.",
      "The annual private retreat.",
      "A seat on the council that votes on who joins.",
      "Introductions, made personally, to the operators in the room.",
    ],
  },
] as const;

export function MembershipOffer() {
  return (
    <div className="flex flex-col gap-12">
      <div className="flex flex-col gap-4">
        <p className={label}>What makes us different</p>
        <div className="grid gap-4 md:grid-cols-2">
          {DIFFERENT.map(([title, body], i) => (
            <div
              key={title}
              className={`${panel} group flex flex-col gap-2 p-6 transition-all duration-300 ease-calm hover:-translate-y-0.5 hover:border-accent/40`}
              style={{ animation: "page-enter 0.5s var(--ease-calm) both", animationDelay: `${i * 0.07}s` }}
            >
              <p className="text-xl font-semibold tracking-tight transition-colors duration-300 group-hover:text-accent">{title}</p>
              <p className={`text-sm leading-6 ${muted}`}>{body}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <p className={label}>What it costs, and what you get</p>
        <div className="grid items-stretch gap-6 md:grid-cols-2">
          {TIERS.map((t, i) => (
            <div
              key={t.name}
              className={`${panel} relative flex flex-col gap-5 overflow-hidden p-6 transition-all duration-300 ease-calm hover:-translate-y-1 md:p-8 ${
                i === 1 ? "border-accent/40 shadow-[0_0_48px_rgb(34_211_238/0.12)]" : "hover:border-accent/30"
              }`}
              style={{ animation: "page-enter 0.5s var(--ease-calm) both", animationDelay: `${0.1 + i * 0.1}s` }}
            >
              {i === 1 ? (
                <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent" />
              ) : null}
              <div className="flex flex-col gap-1">
                <p className={`text-xs font-semibold uppercase tracking-[0.24em] ${accent}`}>{t.name}</p>
                <p className="font-mono text-5xl font-semibold tabular-nums" style={{ textShadow: "0 0 32px rgb(34 211 238 / 0.18)" }}>{t.price}</p>
                <p className={`text-sm ${muted}`}>{t.per} · {t.note}</p>
              </div>
              <ul className="flex flex-col">
                {t.gets.map((g) => <li key={g} className={`border-t ${line} py-3 text-sm leading-6`}>{g}</li>)}
              </ul>
              <Link href="/start" className={`${i === 1 ? primary : secondary} mt-auto`}>Apply for {t.name === "Inner Circle" ? "the Inner Circle" : "a founding seat"}</Link>
            </div>
          ))}
        </div>
        <p className={`text-xs leading-5 ${muted}`}>Applying is free and commits you to nothing. Every applicant takes the oath, needs a member&apos;s vouch and sits an interview; you pay only once you&apos;re accepted.</p>
      </div>
    </div>
  );
}
