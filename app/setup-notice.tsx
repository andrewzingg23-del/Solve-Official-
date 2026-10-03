import { label } from "./ui";

export function SetupNotice() {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-line bg-surface p-4 text-sm leading-6">
      <p className={label}>Store not connected</p>
      <p className="text-muted">
        Copy <code className="font-mono text-foreground">.env.example</code> to{" "}
        <code className="font-mono text-foreground">.env.local</code>, add the Supabase project URL
        and publishable key, then restart the dev server.
      </p>
    </div>
  );
}
