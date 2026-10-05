// The signed-out start page (Manus, pull request #8), on the brand's white floor (docs/brand/BRAND.md
// v3: brand surfaces open on the white floor; the point is reserved for a real save; nothing static
// pretends to be state). Signed-in people go to their Command Center instead (app/start/page.tsx).
import Link from "next/link";

const ink = "text-[#04070d]";
const muted = "text-[#4d5b6c]";
const line = "border-[#d3dde6]";
const accent = "text-[#0891b2]";
const label = `text-xs font-medium uppercase tracking-[0.24em] ${muted}`;
const primary = "inline-flex h-11 items-center justify-center rounded-md bg-[#04070d] px-5 text-xs font-semibold uppercase tracking-[0.2em] text-[#f2f7fb] transition-opacity duration-300 hover:opacity-85";
const secondary = `inline-flex h-11 items-center justify-center rounded-md border ${line} px-5 text-xs font-semibold uppercase tracking-[0.2em] ${ink} transition-colors duration-300 hover:border-[#0891b2] hover:text-[#0891b2]`;
const quiet = `text-xs uppercase tracking-[0.2em] ${muted} transition-colors duration-300 hover:text-[#0891b2]`;

const foundations = [
  { index: "01", title: "Your SOV ID", body: "One identity across Worlds, rooms, bots, and the history of what you changed.", href: "/account", action: "Open your account" },
  { index: "02", title: "Your avatar", body: "Shape a personal bot, connect it to the context you approve, and keep its authority bounded.", href: "/bot", action: "Shape your avatar" },
  { index: "03", title: "Your World", body: "Give a goal a private place to live. Add artifacts, routes, collaborators, and proof as the work moves.", href: "/worlds", action: "Open your Worlds" },
];

const loop = [
  ["Say", "Name the thing you want to make real."],
  ["Shape", "Create the World, avatar, and first room around it."],
  ["Work", "Bring in people, bots, and providers only when useful."],
  ["Prove", "Keep the result, the contributors, and the next step visible."],
];

export function StartView() {
  return (
    <div className={`min-h-svh w-full bg-[#f2f7fb] ${ink}`}>
      <main className="mx-auto flex min-h-svh w-full max-w-6xl flex-1 flex-col gap-16 px-4 py-6 md:gap-24 md:px-8 md:py-10">
        <header className={`flex flex-wrap items-center justify-between gap-5 border-b ${line} pb-5`}>
          <Link href="/" aria-label="solve" className="self-start">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/solve-wordmark-on-light.svg" alt="solve." className="h-7 w-auto" />
          </Link>
          <nav aria-label="Start navigation" className="flex items-center gap-5">
            <Link href="/login?next=/command" className={quiet}>Sign in</Link>
            <Link href="/" className={quiet}>The World</Link>
          </nav>
        </header>

        <section className="flex max-w-3xl flex-col gap-7">
          <p className={label}>The first move is yours</p>
          <h1 className="text-5xl font-semibold leading-[1.02] tracking-tight md:text-7xl">Start with what you&apos;re making real.</h1>
          <p className={`max-w-2xl text-base leading-7 md:text-lg ${muted}`}>
            solve gives an intention a place to go: your identity, your avatar, your World, and a record of the work as it becomes real.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/worlds" className={primary}>Open a private World</Link>
            <Link href="/bot" className={secondary}>Shape your avatar</Link>
          </div>
          <p className={`text-xs leading-5 ${muted}`}>Starting posts nothing publicly. A World opens under your authority.</p>
        </section>

        <section className={`flex flex-col gap-8 border-t ${line} pt-7`}>
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div className="flex flex-col gap-3">
              <p className={label}>The foundation</p>
              <h2 className="max-w-2xl text-3xl font-semibold tracking-tight md:text-5xl">The app grows around your work.</h2>
            </div>
            <p className={`max-w-md text-sm leading-6 ${muted}`}>Start with the parts that already exist. Add providers, collaborators, and public layers only when the work calls for them.</p>
          </div>
          <div className={`grid gap-px overflow-hidden border ${line} bg-[#d3dde6] md:grid-cols-3`}>
            {foundations.map((item) => (
              <article key={item.index} className="flex min-h-56 flex-col gap-5 bg-[#f2f7fb] p-5 md:p-7">
                <span className={`text-[10px] uppercase tracking-[0.18em] ${muted} tabular-nums`}>{item.index}</span>
                <div className="mt-auto flex flex-col gap-3">
                  <h3 className="text-xl font-semibold tracking-tight">{item.title}</h3>
                  <p className={`text-sm leading-6 ${muted}`}>{item.body}</p>
                  <Link href={item.href} className={`mt-2 text-xs font-semibold uppercase tracking-[0.18em] ${accent}`}>{item.action}</Link>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className={`grid gap-12 border-t ${line} pt-7 lg:grid-cols-[0.7fr_1.3fr] lg:gap-20`}>
          <div className="flex flex-col gap-5">
            <p className={label}>The loop</p>
            <h2 className="text-3xl font-semibold tracking-tight md:text-5xl">Say it. Shape it. Do it. Keep the proof.</h2>
            <p className={`max-w-md text-sm leading-6 ${muted}`}>AI can help across the whole path. Authority stays with the person, and the record stays with the work.</p>
          </div>
          <ol className={`grid border-y ${line} sm:grid-cols-2`}>
            {loop.map(([title, body], index) => (
              <li key={title} className={`flex gap-4 border-b ${line} py-5 last:border-0 sm:odd:border-r sm:odd:pr-6 sm:even:pl-6`}>
                <span className={`font-mono text-xs ${muted}`}>0{index + 1}</span>
                <div className="flex flex-col gap-2">
                  <h3 className="text-sm font-semibold">{title}</h3>
                  <p className={`text-sm leading-6 ${muted}`}>{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className={`flex flex-col gap-5 rounded-md border ${line} bg-white/60 p-6 md:p-10`}>
          <p className={label}>What happens next</p>
          <div className="flex flex-wrap items-end justify-between gap-7">
            <div>
              <h2 className="max-w-3xl text-3xl font-semibold tracking-tight md:text-5xl">A blank World is not empty. It is yours.</h2>
              <p className={`mt-4 max-w-2xl text-sm leading-6 ${muted}`}>Open one, make the first piece, then shape the avatar and collaborators that should join it. Every revision stays attributable.</p>
            </div>
            <Link href="/worlds" className={primary}>Open Worlds</Link>
          </div>
        </section>

        <footer className={`flex flex-wrap items-center justify-between gap-4 border-t ${line} pt-4`}>
          <span className={`text-sm font-medium`}>Everything here is real.</span>
          <span className={`text-[10px] uppercase tracking-[0.18em] ${muted}`}>Private by default</span>
        </footer>
      </main>
    </div>
  );
}
