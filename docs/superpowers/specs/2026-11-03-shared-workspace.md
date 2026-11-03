# Shared first-customer workspace

Founder asks for something he can sign into and build from within, usable with his brother from day one, adaptable without selecting a niche. This continues the approved creation path; universal capability is an ambition, not a claim.

Implement a shared workspace on the existing World/kernel: notes and imported text, next steps, safe HTML preview/source editing and bounded AI page creation/revision. Put invitation, conversation and saved work within reach. New projects and reopened cards land here. Make account sign-in visible and distinguish browser-bound guests from permanent accounts; do not silently transfer guest ownership. Existing version/conflict checks, scoped access and attribution apply to every mutation.

Reuse the existing storage, grants, invitation protocol, project history, AI provider configuration and script-free preview boundary. No new schema, paid provider activation, production promotion, automatic AI connections or repository self-modification. A saved HTML page is a visual draft, not a running application. Direct note/page editing must remain useful during AI outages.

Acceptance: two separate sessions share a project by explicit editor invitation; each can save and reopen work; stale writes preserve the newer saved version; an unrelated session is denied. Desktop/mobile usable. Account UI and callback tested separately from actual inbox delivery; report any live Auth configuration blocker honestly.

## Founder correction: bring your own intelligence
"it shouldnt work unless someone connect a outside llm"; connection choice "Support both". Activation requires either a verified external assistant call under a current OAuth authorization or the person's verified provider key. First API provider is OpenRouter, matching the existing transport and allowing a user-selected model. No deployment key fallback. Direct model calls use only the requesting person's key; MCP connections work from the external assistant and are not misrepresented as in-app model transport. Saved work remains readable/exportable after disconnect. Credentials are server-encrypted, sealed and owner-scoped, never shared with members or included in prompts. Stable accounts required for credential storage.
