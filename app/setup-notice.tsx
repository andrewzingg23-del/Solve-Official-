import { label } from "./ui";

export function SetupNotice() {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-line bg-surface p-4 text-sm leading-6">
      <p className={label}>Store not connected</p>
      <p className="text-muted">
        Set <code className="font-mono text-foreground">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
        <code className="font-mono text-foreground">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> in{" "}
        <code className="font-mono text-foreground">.env.local</code> or the Vercel project, then
        rebuild.
      </p>
    </div>
  );
}
