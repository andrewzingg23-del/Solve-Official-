# SOV Optional Onboarding & Integration Status

This change introduces a voluntary, non-blocking onboarding surface at \`/onboarding\`. It connects existing identity, Agent and Project entry points and provides a discoverable catalog of outside apps.

## What works in this branch

- Four stable destinations: **Space / Projects / Communities / Control**; the personal Agent remains separately available.
- \`/projects\` uses existing server-authorized Project reads rather than fake cards.
- \`/control\` displays honest identity, AI and connection entry points.
- \`/onboarding\` offers identity, Agent, optional apps and a clear route into Space.
- A visitor may select app interests without authentication; these **preferences are stored locally, not connected accounts**.
- The existing \`/bot?section=connections\` path remains the only guided live SOV MCP flow in the catalog.
- Optional Google/GitHub *identity sign-in* is available through Supabase Auth **when those providers are configured**. Sign-in does not grant Drive, GitHub repository or other provider data access.

## What this does not do

- OAuth or API authorization for Gmail, Google Drive, GitHub repositories, Instagram, Discord, Stripe, financial accounts or devices.
- Remote execution of external tasks or automatic posting on third-party networks.
- Importing private account data from a selected catalog tile.
- Enabling a front-end embed that the provider forbids.
- Claiming users' subscription credits can be transferred to the SOV API.

## To enable a real new provider

1. Register the SOV OAuth app with the external provider, using the proper callback and approved scopes; keep credentials in server-side secrets.
2. Implement a provider adapter with typed operations, state, scopes, costs, revocation, and verification.
3. Add a real connection record governed by SOV ID and per-context grants.
4. Surface provider-authorized data and supported actions in optional app panels; never display “Connected” without verified authorization.
5. Test multi-user isolation, reconnection, expiration, duplicate execution, and protected task approvals.
6. Only after validation update the catalog entry from \`adapter_required\` to an actual setup route.

## Initial UI and security expectations

- Start with zero optional services. Do not create Projects/Worlds for joining or selecting apps.
- Allow people to skip connection steps entirely, including on mobile.
- External login prompts originate from a deliberate action and follow provider OAuth flows.
- Keep account sign-in distinct from connected third-party application scopes.
- Do not copy tokens into a browser-readable preference file or Agent prompt.
- Confirm actual deployed preview and mobile screenshots before promotion.

## Staging deployment checklist

- Verify GitHub branch and expected Vercel preview project.
- Run \`npm test\`, \`npm run typecheck\`, \`npm run lint\`, and \`npm run build\` through normal CI.
- Test signed-out onboarding with no configuration; test signed-in browsing.
- Confirm that Google/GitHub login error paths are safe when providers are not configured.
- Test MCP assistant authorization, revocation and Project separation using real staging identity.
- Do **not** promote to production until preview and credentials are verified.
