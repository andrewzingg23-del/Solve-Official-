/**
 * A public, owner-published SOV identity is a stand-alone visitor surface.
 * The normal ProductShell is a private/personal workspace experience and must
 * not wrap a tapped or shared SOV card with its sidebar, app navigation or
 * account prompts. This checks display routing only; server RLS and the
 * public identity page still enforce publication and data visibility.
 */
export function isStandalonePublicIdentityRoute(pathname: string): boolean {
  return /^\/id\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/?$/i.test(pathname);
}
