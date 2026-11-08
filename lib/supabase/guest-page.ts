/** Whether a page GET/POST requires a private SOLVE guest context.
 * A public ID share is read-only and works under PostgREST's true anon role:
 * opening a stranger's card must not create a Supabase user or kernel actor.
 */
export function needsGuestContext(path: string, method: string): boolean {
  const publicIdentityShare = /^\/id\/[^/]+\/?$/.test(path);
  return (method === "GET" || method === "POST")
    && !publicIdentityShare
    && !path.startsWith("/api/")
    && !path.startsWith("/auth/")
    && path !== "/login"
    && !path.startsWith("/_next/")
    && !/\.[a-z0-9]+$/i.test(path);
}
