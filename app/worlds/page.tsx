import { randomUUID } from "node:crypto";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createWorldAction } from "@/app/worlds/actions";
import { field, glassCard, label, primaryAction, quietLink } from "@/app/ui";
import { KernelError } from "@/lib/kernel/client";
import { getKernel } from "@/lib/kernel/server";
import { getUser } from "@/lib/supabase/server";
import { listCreativeWorlds } from "@/lib/world/creative";
import { loginRequired } from "@/lib/auth/gate";

// A World's visual identity: a small orbital sigil derived deterministically
// from its id. Same World, same sigil — never invented, never shared.
function sigilSeed(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

function WorldSigil({ worldId, title }: { worldId: string; title: string }) {
  const h = sigilSeed(worldId);
  const rot = h % 360;
  const dotAngle = ((h >> 8) % 360) * (Math.PI / 180);
  const dotR = 20 + ((h >> 16) % 8);
  const cx = 32 + dotR * Math.cos(dotAngle);
  const cy = 32 + dotR * Math.sin(dotAngle);
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" role="img" aria-label={`${title} sigil`} className="shrink-0">
      <g transform={`rotate(${rot} 32 32)`}>
        <circle cx="32" cy="32" r="27" fill="none" stroke="#22d3ee" strokeOpacity="0.35" strokeWidth="1" />
        <circle cx="32" cy="32" r={20 + ((h >> 16) % 8)} fill="none" stroke="#22d3ee" strokeOpacity="0.5" strokeWidth="1" strokeDasharray="5 5" />
        <circle cx="32" cy="32" r="12" fill="none" stroke="#f2f7fb" strokeOpacity="0.25" strokeWidth="1" />
        <circle cx={cx} cy={cy} r="3" fill="#22d3ee" />
      </g>
      <circle cx="32" cy="32" r="2.5" fill="#f2f7fb" fillOpacity="0.85" />
    </svg>
  );
}

const ERROR_COPY: Record<string, string> = {
  "world-repo": "That isn\u2019t a GitHub repository link. Use https://github.com/owner/repo, optionally with /tree/<branch>.",
  "world-input": "Use a World name up to 160 characters and a goal up to 7,000 characters. Remove unsupported control characters.",
};

export default async function WorldsPage({ searchParams }: PageProps<"/worlds">) {
  const user = await getUser();
  if (!user && loginRequired()) redirect("/login?next=%2Fworlds");
  const { error } = await searchParams;
  const nextWorldId = randomUUID();

  let worlds = null as Awaited<ReturnType<typeof listCreativeWorlds>> | null;
  let identityMissing = false;
  let unavailable = false;
  try {
    worlds = await listCreativeWorlds(await getKernel());
  } catch (caught) {
    if (caught instanceof KernelError && caught.name === "unauthenticated") identityMissing = true;
    else unavailable = true;
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-6xl flex-1 flex-col px-4 pb-10 pt-6 md:px-8 md:pt-10">
      <header className="flex flex-wrap items-center justify-between gap-5 border-b border-line pb-5">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-sm font-semibold uppercase tracking-[0.3em] text-accent">solve</Link>
          <span className="text-muted">/</span>
          <span className="text-xs font-semibold uppercase tracking-[0.2em]">Your Worlds</span>
        </div>
        <div className="flex items-center gap-5">
          <Link href="/arcadia" className={quietLink}>Explore Arcadia</Link>
          <Link href="/account" className={quietLink}>You</Link>
        </div>
      </header>

      {/* One message. */}
      <section className="flex flex-col gap-3 pb-8 pt-8 text-center md:pt-12">
        <p className="eyebrow eyebrow-accent">Open work</p>
        <h1 className="text-5xl font-bold tracking-tight md:text-7xl">
          Your <span className="serif-accent">worlds</span>.
        </h1>
        <p className="mx-auto max-w-xl text-sm leading-6 text-muted md:text-base">
          Start with what you want to make happen. A goal becomes the first piece in a private World you can shape as you work.
        </p>
      </section>

      {identityMissing ? (
        <div className={`${glassCard} flex flex-col gap-3 p-6`}>
          <h2 className="text-sm font-medium">Finish setting up your SOV ID</h2>
          <p className="text-sm leading-6 text-muted">Your sign-in is active, but there is no kernel identity attached yet.</p>
          <Link href="/account" className={primaryAction}>Open account</Link>
        </div>
      ) : unavailable ? (
        <div role="status" className="alert-pin rounded-2xl p-4 text-sm">
          Worlds are temporarily unavailable. Your work has not been changed.
        </div>
      ) : worlds?.length ? (
        /* The gallery: glance → detail. Each World carries its own visual identity. */
        <ul aria-label="Your Worlds" className="grid gap-4 md:grid-cols-2">
          {worlds.map((world) => (
            <li key={world.worldId}>
              <Link
                href={`/world/${world.worldId}/room`}
                className={`${glassCard} group flex items-center gap-5 p-5 transition-all duration-300 ease-calm hover:-translate-y-0.5 hover:border-accent/40 md:p-6`}
              >
                <WorldSigil worldId={world.worldId} title={world.title} />
                <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="eyebrow">World</span>
                  <span className="truncate text-xl font-semibold tracking-tight">{world.title}</span>
                  <span className="text-xs tabular-nums text-muted">
                    Changed {new Date(world.updatedAt).toLocaleDateString("en-US", { dateStyle: "medium" })}
                  </span>
                </span>
                <span aria-hidden="true" className="text-2xl text-muted transition-all group-hover:translate-x-1 group-hover:text-accent">→</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className={`${glassCard} p-6 md:p-8`}>
          <p className={label}>Nothing here yet</p>
          <p className="mt-3 max-w-lg text-sm leading-6 text-muted">
            Give your project a name and start with a goal or a blank canvas. Only you can see this World unless you grant access.
          </p>
        </div>
      )}

      {/* The create flow stays honest: name, goal, optional repo — nothing published, nothing shared. */}
      {!identityMissing && !unavailable && (
        <section className={`${glassCard} mt-10 flex flex-col gap-5 p-6 md:p-8`}>
          <div className="flex flex-col gap-2">
            <p className={label}>Create</p>
            <h2 className="text-2xl font-semibold tracking-tight">
              Begin a new <span className="serif-accent">world</span>.
            </h2>
            <p className="text-sm leading-6 text-muted">Start with the need; SOV keeps it with the work. Your World stays private until you choose who can enter.</p>
          </div>
          {typeof error === "string" && (
            <p role="alert" className="alert-pin rounded-xl p-3 text-sm">
              {ERROR_COPY[error] ?? "The World could not be created. Retry in a moment."}
            </p>
          )}
          <form action={createWorldAction} className="flex flex-col gap-4">
            <input type="hidden" name="worldId" value={nextWorldId} />
            <div className="flex flex-col gap-2">
              <label htmlFor="world-title" className={label}>World name</label>
              <input
                id="world-title"
                name="title"
                required
                maxLength={160}
                autoComplete="off"
                placeholder="A thing I want to make"
                className={field}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="world-goal" className={label}>What are you trying to get done? <span className="font-normal normal-case tracking-normal text-muted">(optional)</span></label>
              <textarea
                id="world-goal"
                name="goal"
                maxLength={7000}
                rows={4}
                autoComplete="off"
                placeholder="I want to plan Mom’s 60th, launch my business, fix a workflow…"
                className="w-full resize-y rounded-xl border border-line bg-surface-sunken p-4 text-foreground outline-none transition-colors duration-300 ease-calm placeholder:text-faint focus:border-accent"
              />
            </div>
            <p className="text-xs leading-5 text-muted">Your goal is saved as the first piece. Leave it blank for an empty canvas. Nothing is published or shared by creating a World.</p>
            <div className="flex flex-col gap-2">
              <label htmlFor="world-repo" className={label}>Building code? <span className="font-normal normal-case tracking-normal text-muted">(optional)</span></label>
              <input
                id="world-repo"
                name="repo"
                type="url"
                autoComplete="off"
                placeholder="https://github.com/owner/repo/tree/main"
                className={`${field} font-mono text-xs`}
              />
            </div>
            <p className="text-xs leading-5 text-muted">Its room shows the build as it happens: branches, pull requests and whether the build passed. solve only reads it.</p>
            <button type="submit" className={`${primaryAction} self-start`}>Create private World</button>
          </form>
          <p className="border-t border-line-soft pt-4 text-xs leading-5 text-muted">
            Every piece is attributed to its author. Connected agents enter only after you grant them access.
          </p>
        </section>
      )}

      <footer className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t border-line pt-4">
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted">Private by default · kernel recorded</span>
        <Link href="/" className={quietLink}>Return to the World</Link>
      </footer>
    </main>
  );
}
