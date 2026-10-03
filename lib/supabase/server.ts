import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { cache } from "react";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "./config";

// Server client for Server Components, Server Functions and Route Handlers.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Server Components can't set cookies. proxy.ts refreshes the session instead.
        }
      },
    },
  });
}

// The signed-in user, verified with Supabase Auth and memoized per render.
// Null when signed out or when Supabase isn't configured.
export const getUser = cache(async () => {
  // Render per request even before Supabase is configured, so pages never get
  // prerendered as signed out.
  await connection();
  if (!isSupabaseConfigured) return null;

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
});
