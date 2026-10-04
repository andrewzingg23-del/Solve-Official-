import { randomUUID } from "node:crypto";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createWorldAction } from "@/app/worlds/actions";
import { label, primaryAction, quietLink, secondaryAction } from "@/app/ui";
import { KernelError } from "@/lib/kernel/client";
import { getKernel } from "@/lib/kernel/server";
import { getUser } from "@/lib/supabase/server";
import { listCreativeWorlds } from "@/lib/world/creative";

export default async function WorldsPage({ searchParams }: PageProps<"/worlds">) {
  const user = await getUser();
  if (!user) redirect("/login?next=%2Fworlds");
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
    <main className="mx-auto flex min-h-svh w-full max-w-6xl flex-1 flex-col gap-10 px-4 py-6 md:px-8 md:py-10">
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

      <section className="grid flex-1 gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.65fr)] lg:items-start">
        <div className="flex flex-col gap-7">
          <div className="flex flex-col gap-3">
            <p className={label}>Open work</p>
            <h1 className="max-w-3xl text-3xl font-medium leading-tight tracking-tight md:text-5xl">
              A World for what you&apos;re making.
            </h1>
            <p className="max-w-xl text-sm leading-6 text-muted md:text-base">
              Start with a blank canvas. Your work is saved to the kernel with its history and access recorded.
            </p>
          </div>

          {identityMissing ? (
            <div className="flex flex-col gap-3 rounded-md border border-line bg-surface p-5">
              <h2 className="text-sm font-medium">Finish setting up your SOV ID</h2>
              <p className="text-sm leading-6 text-muted">Your sign-in is active, but there is no kernel identity attached yet.</p>
              <Link href="/account" className={secondaryAction}>Open account</Link>
            </div>
          ) : unavailable ? (
            <div role="status" className="rounded-md border border-negative/30 bg-negative/10 p-4 text-sm">
              Worlds are temporarily unavailable. Your work has not been changed.
            </div>
          ) : worlds?.length ? (
            <ul aria-label="Your Worlds" className="flex flex-col divide-y divide-line border-y border-line">
              {worlds.map((world) => (
                <li key={world.worldId}>
                  <Link href={`/world/${world.worldId}`} className="group flex items-center justify-between gap-6 py-5 transition-colors hover:text-accent">
                    <div className="flex min-w-0 flex-col gap-1.5">
                      <span className="truncate text-lg font-medium tracking-tight">{world.title}</span>
                      <span className="text-xs text-muted">World · changed {new Date(world.updatedAt).toLocaleDateString("en-US", { dateStyle: "medium" })}</span>
                    </div>
                    <span aria-hidden="true" className="text-xl text-muted transition-transform group-hover:translate-x-1 group-hover:text-accent">→</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-md border border-line bg-surface/70 p-5 md:p-7">
              <p className={label}>Nothing here yet</p>
              <p className="mt-3 max-w-lg text-sm leading-6 text-muted">Give the work a name. The World opens private and empty; you choose what belongs in it.</p>
            </div>
          )}
        </div>

        {!identityMissing && !unavailable && (
          <aside className="flex flex-col gap-4 rounded-md border border-line bg-surface/75 p-5 md:p-7">
            <div className="flex flex-col gap-2">
              <p className={label}>Create</p>
              <h2 className="text-xl font-medium tracking-tight">Begin a new World</h2>
              <p className="text-sm leading-6 text-muted">A World starts with your authority. Access is controlled with explicit grants.</p>
            </div>
            {typeof error === "string" && (
              <p role="alert" className="rounded border border-negative/30 bg-negative/10 p-3 text-sm text-negative">
                {error === "world-title" ? "Add a title up to 160 characters." : "The World could not be created. Retry in a moment."}
              </p>
            )}
            <form action={createWorldAction} className="flex flex-col gap-3">
              <input type="hidden" name="worldId" value={nextWorldId} />
              <label htmlFor="world-title" className={label}>World name</label>
              <input
                id="world-title"
                name="title"
                required
                maxLength={160}
                autoComplete="off"
                placeholder="A thing I want to make"
                className="h-12 rounded-md border border-line bg-background px-3 text-sm outline-none transition-colors focus:border-accent"
              />
              <button type="submit" className={primaryAction}>Create blank World</button>
            </form>
            <p className="border-t border-line pt-4 text-xs leading-5 text-muted">
              Each edit is attributed to the person or agent that made it. Nothing is published by creating a World.
            </p>
          </aside>
        )}
      </section>

      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-4">
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted">Private by default · kernel recorded</span>
        <Link href="/" className={quietLink}>Return to the World</Link>
      </footer>
    </main>
  );
}
