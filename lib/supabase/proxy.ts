import { loginRequired } from "@/lib/auth/gate";
import { kernelClient } from "@/lib/kernel/client";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured, supabasePublishableKey, supabaseUrl } from "./config";

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
  const guestPage = ["GET", "POST"].includes(request.method)
    && !path.startsWith("/api/") && !path.startsWith("/auth/")
    && path !== "/login" && !path.startsWith("/_next/")
    // Looking at someone's public page never creates an identity for the person looking.
    && !path.startsWith("/p/") && !path.startsWith("/s/")
    && !/\.[a-z0-9]+$/i.test(path)
    // And only for a person actually opening a page. An identity is a real thing in the kernel —
    // it owns work and can hold a GitHub token — so a crawler, a link preview, an uptime check or
    // a scripted request must not mint one by looking (staging reached 725 guests against one
    // account this way). A browser opening a page says so in these headers; nothing else does.
    && isBrowserNavigation(request);
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

/**
 * A top-level page opening in a real browser.
 *
 * Every browser since 2020 sends `Sec-Fetch-Mode` on navigations, and it cannot be set by page
 * script, so it is a cheap and honest signal. This is not a security boundary — it is refused
 * capacity, not refused access: anything turned away here still gets the page, and a person whose
 * browser is unusual can still become a guest from the browser itself (lib/supabase/become-guest.ts)
 * or by doing something that needs an identity.
 */
function isBrowserNavigation(request: NextRequest): boolean {
  // Absent reads as null from Headers and undefined from a plain map, so test for presence.
  const mode = request.headers.get("sec-fetch-mode") || "";
  if (mode) return mode === "navigate";
  // No Sec-Fetch headers at all: only treat it as a person if it at least asks for a page.
  return (request.headers.get("accept") || "").includes("text/html");
}
