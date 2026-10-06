// The sign-in gate. Drew's order (2026-10-06): off for now — the app opens
// without login so he can see and tap everything on his phone.
//
// loginRequired() is the single switch. Set REQUIRE_LOGIN=1 in Vercel to put
// the wall back up. When the gate is off:
//   - pages render for signed-out visitors (no /login redirects);
//   - identity-gated actions (claim, swaps, kernel reads) stay honest — they
//     fail closed instead of faking identity;
//   - the Talk API allows guests, rate- and spend-limited by IP, so the
//     Anthropic key isn't an open wallet.
export function loginRequired(): boolean {
  return process.env.REQUIRE_LOGIN === "1" || process.env.REQUIRE_LOGIN === "true";
}
