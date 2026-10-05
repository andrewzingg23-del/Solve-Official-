import type { Metadata } from "next";
import Link from "next/link";
import { label, primaryAction, quietLink, secondaryAction } from "@/app/ui";

export const metadata: Metadata = {
  title: "Start with what you are making — solve",
  description: "Create a private World, shape your avatar, and make the next move visible.",
};

const foundations = [
  {
    index: "01",
    title: "Your SOV ID",
    body: "One identity across Worlds, rooms, bots, and the history of what you changed.",
    href: "/account",
    action: "Open your account",
    state: "Available now",
  },
  {
    index: "02",
    title: "Your avatar",
    body: "Shape a personal bot, connect it to the context you approve, and keep its authority bounded.",
    href: "/bot",
    action: "Shape your avatar",
    state: "Available now",
  },
  {
    index: "03",
    title: "Your World",
    body: "Give a goal a private place to live. Add artifacts, routes, collaborators, and proof as the work moves.",
    href: "/worlds",
    action: "Open your Worlds",
    state: "Available now",
  },
];

const loop = [
  ["Say", "Name the thing you want to make real."],
  ["Shape", "Create the World, avatar, and first room around it."],
  ["Work", "Bring in people, bots, and providers only when useful."],
  ["Prove", "Keep the result, the contributors, and the next step visible."],
];

export default function StartPage() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-7xl flex-1 flex-col gap-16 px-4 py-6 md:gap-24 md:px-8 md:py-10">
      <header className="flex flex-wrap items-center justify-between gap-5 border-b border-line pb-5">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm font-semibold uppercase tracking-[0.3em] text-accent">solve</Link>
          <span className="text-muted">/</span>
          <span className="text-xs font-semibold uppercase tracking-[0.2em]">Start</span>
        </div>
        <nav aria-label="Start navigation" className="flex items-center gap-5">
          <Link href="/bot" className={quietLink}>Your bot</Link>
          <Link href="/worlds" className={quietLink}>Your Worlds</Link>
          <Link href="/" className={quietLink}>The World</Link>
        </nav>
      </header>

      <section className="grid items-center gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(24rem,0.8fr)] lg:gap-20">
        <div className="flex max-w-3xl flex-col gap-7">
          <p className={label}>The first move is yours</p>
          <h1 className="max-w-3xl text-5xl font-medium leading-[0.98] tracking-[-0.06em] md:text-8xl">
            Start with what you are <span className="text-accent">making real.</span>
          </h1>
          <p className="max-w-2xl text-base leading-7 text-muted md:text-lg">
            Solve gives an intention a place to go: your identity, your avatar, your World, and a record of the work as it becomes real.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/worlds" className={primaryAction}>Open a private World <span aria-hidden="true">→</span></Link>
            <Link href="/bot" className={secondaryAction}>Shape your avatar</Link>
          </div>
          <p className="text-xs leading-5 text-muted">No public post is made by starting. A World opens under your authority.</p>
        </div>

        <div className="relative min-h-[23rem] overflow-hidden rounded-md border border-line bg-surface/70 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.26)] md:min-h-[28rem] md:p-7">
          <div className="absolute inset-0 opacity-70 [background-image:linear-gradient(rgb(242_247_251_/_0.06)_1px,transparent_1px),linear-gradient(90deg,rgb(242_247_251_/_0.06)_1px,transparent_1px)] [background-size:32px_32px]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgb(34_211_238_/_0.16),transparent_38%)]" />
          <div className="relative flex h-full min-h-[20rem] flex-col justify-between">
            <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-muted">
              <span>Personal World / draft</span>
              <span className="inline-flex items-center gap-2 text-positive"><span className="h-1.5 w-1.5 rounded-full bg-positive shadow-[0_0_12px_var(--positive)]" /> Private</span>
            </div>
            <div className="relative mx-auto flex h-48 w-48 items-center justify-center rounded-full border border-accent/50 shadow-[0_0_60px_rgb(34_211_238_/_0.12)] md:h-56 md:w-56">
              <div className="absolute inset-[18%] rounded-full border border-accent/25 [transform:rotate(35deg)_scaleX(.52)]" />
              <div className="absolute inset-[18%] rounded-full border border-accent/25 [transform:rotate(-38deg)_scaleX(.52)]" />
              <div className="absolute inset-[26%] rounded-full border border-accent/20" />
              <span className="h-3 w-3 rounded-full bg-accent shadow-[0_0_22px_var(--accent)]" />
              <span className="absolute left-[19%] top-[28%] h-2 w-2 rounded-full bg-positive shadow-[0_0_14px_var(--positive)]" />
              <span className="absolute right-[20%] top-[58%] h-2 w-2 rounded-full bg-accent shadow-[0_0_14px_var(--accent)]" />
              <span className="absolute bottom-[18%] left-[48%] h-2 w-2 rounded-full bg-foreground shadow-[0_0_14px_var(--foreground)]" />
            </div>
            <div className="grid grid-cols-3 gap-2 border-t border-line pt-4 text-[10px] uppercase tracking-[0.12em] text-muted">
              <span>Identity<br /><b className="font-medium text-foreground">You</b></span>
              <span>Avatar<br /><b className="font-medium text-foreground">Not shaped</b></span>
              <span>Next move<br /><b className="font-medium text-accent">Open</b></span>
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-8 border-t border-line pt-7">
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="flex flex-col gap-3">
            <p className={label}>The foundation</p>
            <h2 className="max-w-2xl text-3xl font-medium tracking-tight md:text-5xl">The app grows around your work.</h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-muted">Start with the parts that already exist. Add providers, collaborators, and public layers only when the work calls for them.</p>
        </div>
        <div className="grid gap-px overflow-hidden border border-line bg-line md:grid-cols-3">
          {foundations.map((item) => (
            <article key={item.index} className="flex min-h-64 flex-col gap-5 bg-background p-5 md:p-7">
              <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.18em] text-muted"><span className="text-accent">{item.index}</span><span>{item.state}</span></div>
              <div className="mt-auto flex flex-col gap-3"><h3 className="text-xl font-medium tracking-tight">{item.title}</h3><p className="text-sm leading-6 text-muted">{item.body}</p><Link href={item.href} className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent">{item.action} <span aria-hidden="true">→</span></Link></div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-12 border-t border-line pt-7 lg:grid-cols-[0.7fr_1.3fr] lg:gap-20">
        <div className="flex flex-col gap-5"><p className={label}>The loop</p><h2 className="text-3xl font-medium tracking-tight md:text-5xl">Say it. Shape it. Do it. Keep the proof.</h2><p className="max-w-md text-sm leading-6 text-muted">AI can help across the whole path. Authority stays with the person, and the record stays with the work.</p></div>
        <div className="grid gap-0 border-y border-line sm:grid-cols-2">{loop.map(([title, body], index) => <div key={title} className="flex gap-4 border-b border-line py-5 last:border-0 sm:nth-[2]:border-b-0 sm:odd:border-r sm:odd:pr-6 sm:even:pl-6"><span className="font-mono text-xs text-accent">0{index + 1}</span><div className="flex flex-col gap-2"><h3 className="text-sm font-medium">{title}</h3><p className="text-sm leading-6 text-muted">{body}</p></div></div>)}</div>
      </section>

      <section className="flex flex-col gap-5 rounded-md border border-accent/25 bg-accent/5 p-6 md:p-10">
        <p className={label}>What happens next</p>
        <div className="flex flex-wrap items-end justify-between gap-7"><div><h2 className="max-w-3xl text-3xl font-medium tracking-tight md:text-5xl">A blank World is not empty. It is yours.</h2><p className="mt-4 max-w-2xl text-sm leading-6 text-muted">Open one, make the first piece, then shape the avatar and collaborators that should join it. Every revision stays attributable.</p></div><Link href="/worlds" className={primaryAction}>Open Worlds <span aria-hidden="true">→</span></Link></div>
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-4"><span className="text-[10px] uppercase tracking-[0.18em] text-muted">Private by default · kernel recorded</span><Link href="/" className={quietLink}>Return to the World</Link></footer>
    </main>
  );
}
