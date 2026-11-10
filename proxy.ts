import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { loginRequired } from "@/lib/auth/gate";

// Paths that send signed-out visitors to /login.
const protectedPaths = ["/account"];

export async function proxy(request: NextRequest) {
  const { response, signedIn } = await updateSession(request);
  const { pathname, search } = request.nextUrl;

  const isProtected = protectedPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
  if (isProtected && !signedIn && loginRequired()) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = new URLSearchParams({ next: pathname + search }).toString();
    return NextResponse.redirect(login);
  }

  return response;
}

export const config = {
  matcher: [
    // Everything except Next internals and static files.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
