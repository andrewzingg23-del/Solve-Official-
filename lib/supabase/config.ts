// Which Supabase project the app talks to.
//
// Preview deployments run on solve-staging, as the founder-first plan has it ("sign in on the staging
// preview"): staging's kernel has every migration, and the main store's upgrade waits on the founder.
// Staging's URL and publishable key are public by design (they ship in browser code), so they can
// live here. Production and local runs use the deployment's own settings.
//
// NEXT_PUBLIC_ vars are inlined at build time, so they must be read by their literal names.
// NEXT_PUBLIC_SOLVE_DEPLOY is Vercel's VERCEL_ENV, inlined by next.config.ts.

export const STAGING = {
  url: "https://taeikshnbcsjlgbattyp.supabase.co",
  publishableKey: "sb_publishable_uiH3w7rzYgDe0Q7xF0N78Q_7H-5Hb_b",
} as const;

type Env = { deploy?: string; url?: string; publishableKey?: string; secretKey?: string; stagingSecretKey?: string };

export function pickSupabase(env: Env) {
  const onStaging = env.deploy === "preview";
  const url = onStaging ? STAGING.url : env.url ?? "";
  const publishableKey = onStaging ? STAGING.publishableKey : env.publishableKey ?? "";
  // The server key must belong to the same project as the URL. On a preview that is the staging key,
  // or the deployment's key when its own settings already point at staging; never another project's.
  const serviceKey = !onStaging
    ? env.secretKey || null
    : env.stagingSecretKey || (env.url === STAGING.url ? env.secretKey || null : null);
  return { onStaging, url, publishableKey, serviceKey };
}

const picked = pickSupabase({
  deploy: process.env.NEXT_PUBLIC_SOLVE_DEPLOY,
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
});

export const supabaseUrl = picked.url;
export const supabasePublishableKey = picked.publishableKey;
export const onStaging = picked.onStaging;

// The app still renders without Supabase so a fresh clone runs before setup.
export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

// Server only: the service key for the project above, or null.
export function serviceKey(): string | null {
  return pickSupabase({
    deploy: process.env.NEXT_PUBLIC_SOLVE_DEPLOY,
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    secretKey: process.env.SUPABASE_SECRET_KEY,
    stagingSecretKey: process.env.SUPABASE_STAGING_SECRET_KEY,
  }).serviceKey;
}
