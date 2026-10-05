// On the Command Center when this deployment pairs a repository with the person and they have no room
// for it yet: one step to open it, a private World with the repository linked.
import type { RepoRef } from "@/lib/github/repo";

export function RepoRoomCard({ repo, title, open }: { repo: RepoRef; title: string; open: (form: FormData) => void | Promise<void> }) {
  return (
    <section aria-labelledby="repo-room" className="flex flex-col gap-3 rounded-md border border-accent/40 bg-accent/5 p-5">
      <h2 id="repo-room" className="text-xs font-medium uppercase tracking-[0.24em] text-muted">Your build has no room yet</h2>
      <p className="text-sm leading-6">
        <span className="font-mono">{repo.owner}/{repo.repo}</span>{repo.trunk ? <span className="text-muted"> on <span className="font-mono">{repo.trunk}</span></span> : null}. Open a room for it: the builders, the trunk&apos;s builds and every pull request, read from GitHub, with your routes and decisions around them.
      </p>
      <form action={open} className="flex flex-col gap-2">
        <input name="title" defaultValue={title} maxLength={160} aria-label="Room name" className="h-10 rounded-md border border-line bg-background px-3 text-sm outline-none focus:border-accent" />
        <input name="goal" maxLength={7000} placeholder="What it's for (optional): the first thing the room is after" aria-label="Goal" className="h-10 rounded-md border border-line bg-background px-3 text-sm outline-none placeholder:text-muted/60 focus:border-accent" />
        <button type="submit" className="h-10 rounded-md bg-accent px-5 text-xs font-semibold uppercase tracking-[0.2em] text-background hover:opacity-85">Open its room</button>
      </form>
      <p className="text-xs leading-5 text-muted">Private to you until you let someone in. solve only reads the repository.</p>
    </section>
  );
}
