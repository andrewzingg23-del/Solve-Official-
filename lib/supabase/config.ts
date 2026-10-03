// NEXT_PUBLIC_ vars are inlined at build time, so they must be read by their literal names.
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

// The app still renders without Supabase so a fresh clone runs before setup.
export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);
