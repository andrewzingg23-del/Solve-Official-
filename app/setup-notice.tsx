import { eyebrowAccent } from "./ui";

export function SetupNotice() {
  return (
    <div className="glass p-5 text-sm leading-6">
      <p className={eyebrowAccent}>Store not connected</p>
      <p className="mt-2 text-muted">
        Set <code className="font-mono text-foreground">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
        <code className="font-mono text-foreground">NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> in{" "}
        <code className="font-mono text-foreground">.env.local</code> or the Vercel project, then
        rebuild.
      </p>
    </div>
  );
}
