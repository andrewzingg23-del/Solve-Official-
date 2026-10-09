# Solve collaboration rebuild

Founder instruction: “build it and eclutter any thing that isn't market ready also its lame becuse it was built on top of trading app completely re build”. This follows the readiness inventory and the agreed first journey: identity, project, invitation, selected AI knowledge, shared work and returning to saved progress.

## Outcome and scope

Rebuild the public product experience around people and their AIs making progress together. The first concrete case is the founder and his brother working on Zuber Pen. Existing projects, events, actors, permissions, bots and documents remain canonical. This is a replacement of the app's entry, navigation and everyday workflows, not a database reset.

Use four homes: Projects, Communities, Your AI and Profile. The product calls a World a project in everyday copy while preserving existing URLs and kernel ontology. Guests can explore and prepare a local draft; sharing and cross-device saving require actual sign-in. No invented users, conversations, counts, completed work or assistant connections.

## Product design

- Root becomes a calm collaboration landing for guests and a real project dashboard for members. An idea composer carries its draft through sign-in and creates a private project through the existing World service.
- A consistent desktop sidebar and accessible mobile navigation replace floating dashboards and the multiple companion overlays. Persistent identity shows the person's actual account or explicitly local profile.
- Project rooms center conversation and AI, with documents and people/access reachable as focused sections. Optional cost and repository tools are tucked away. The main experience has no trading data, financial actions, simulated outreach, map, experimental studio or disabled “Soon” packs.
- Communities display real memberships and joining controls. Their launch form does not offer unfinished sector packs.
- Your AI presents persona, authorized connections and reviewed knowledge in separate sections. Manual imports and MCP connection steps accurately describe their limits. No automatic history-sync or provider compatibility claims without verification.
- Profile offers an explicit review/save of the local identity into the current signed-in account. It never silently applies a local draft to a different account, overwrites an existing saved persona or shares personal context into a project.

## Boundaries

No new product dependencies. Use Next 16, React 19, Tailwind, Supabase Auth and kernel_api. Preserve applied migrations. If profile display-name changes require a kernel function, add a narrowly scoped authenticated-human RPC and an append-only event; actor IDs come from the verified caller. Permission checks remain in services and actions, not only navigation.

Gate unfinished routes and financial surfaces centrally, including direct URLs and their HTTP APIs. Keep source and data for later releases. Enabled experiments require explicit deployment configuration and remain outside default navigation. Old project and invitation links continue to work. API denials return JSON; page requests redirect to a useful core home. Authentication callbacks, OAuth/MCP and core project APIs remain available.

Use the existing dark blue-black, ice text and cyan accent with quiet typography, real-content hierarchy, visible focus, 44px minimum controls, responsive layout and reduced-motion support. No market charts, particle backgrounds or fabricated social proof in the rebuilt core.

## Verification and release

Run focused route and identity authority/idempotency/privacy tests first, then actual desktop/mobile navigation and draft-continuity browser checks. Exercise the shared room against real SQL with distinctly labelled Auth/model fixtures. Run the full suite, typecheck, lint and production build before integration. Obtain one independent whole-branch review and address material findings. Report live deployment, real Auth/provider and remote migrations separately from local results. Existing authorization to integrate and ship persists; unavailable credentials do not justify fake live success.
