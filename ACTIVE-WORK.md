# ACTIVE-WORK

One writer per architectural surface. Update this file when work starts, changes owner or finishes.

| Owner | Task | Branch | Owned paths | Protected paths (do not edit without the owner) | Done when |
|---|---|---|---|---|---|
| Codex (founder-directed takeover) | Build the open-ended shared creative World on isolated Supabase staging; verify Auth, then ship one real-time co-creation slice for two people and their separately owned agents. Keep improvement evidence-led and production untouched. | claude/keen-cerf-tpd7io | app/world/, app/api/, lib/world/, new kernel client/domain code, tests/, new migrations only when required, build/status docs | Applied migrations (never edit), DIRECTIVES.md (founder only), docs/MONETARY-CONSTITUTION.md Parts I–III, production Supabase project | Two people on separate devices can create/edit shared World work; an authorized external agent contributes with its own identity and scoped permission; changes sync, persist, show provenance, and survive reload. One actual collaboration task completes on staging. No simulated result is presented as live use. |

Shared contracts: DOMAIN-CONTRACTS.md, lib/kernel/client.ts (typed kernel_api), lib/kernel/local.ts (embedded kernel), lib/sandbox/pglite.ts (browser database boundary).

Production kernel changes and live service credentials are out of scope for this work until separately approved.
