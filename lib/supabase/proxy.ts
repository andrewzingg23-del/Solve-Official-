import { loginRequired } from "@/lib/auth/gate";
import { kernelClient } from "@/lib/kernel/client";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "./config";
import { needsGuestContext } from "./guest-page";

// Refreshes the auth session cookie on every request and reports whether a
// session is present. This is an optimistic check for redirects only; pages
// must still call getUser() before showing private data.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!isSupabaseConfigured) return { response, signedIn: false };

  const supabase = createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  let signedIn = Boolean(data?.claims);
  // Establish the cookie before rendering; Server Components cannot persist it.
  // Keep callback/API traffic and asset requests free of implicit account creation.
  const path = request.nextUrl.pathname;
  const guestPage = needsGuestContext(path, request.method);
  if (!signedIn && !loginRequired() && guestPage) {
    const { data: guest, error } = await supabase.auth.signInAnonymously();
    signedIn = !error && Boolean(guest.session);
  }
  if (signedIn && guestPage) {
    try {
      await kernelClient(supabase).register();
    } catch {
      // Preserve the session and draft; identity-gated writes still fail closed.
      console.error("SOLVE identity registration unavailable");
    }
  }
  response.headers.set("Cache-Control", "private, no-store");
  return { response, signedIn };
}
