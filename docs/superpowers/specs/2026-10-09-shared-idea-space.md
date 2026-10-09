# Shared idea space

User authorization: “Build”, following the adaptive collaboration roadmap and the Zuber Pen example.

## Outcome

Two signed-in people can join an existing World using a shareable invitation, keep conversation and decisions there, ask AI about that shared work, and resume later. These primitives also serve an event, study group, or other project. Existing personal chat and guest browsing continue to work.

## Contract

- Use canonical actors, World entities, scoped grants, append-only kernel events, and existing document artifacts. Add migrations; do not change applied migrations or founder canon.
- Invitations require the current human World owner. Store only a SHA-256 token hash. Links expire after 48 hours, are single-use, can be cancelled, and confer viewer or editor grants under the owner's existing authority. Repeated acceptance by the same person is safe while access remains valid. Accepting requires authenticated canonical human identity. No private project details appear before acceptance.
- Conversation persists as typed kernel records. Read requires `kernel.read`; posting requires `world.entity.write`. Attribution comes from the authenticated actor. A recorded decision names its human author; it is not represented as unanimous agreement. AI drafts remain distinguishable from human messages and decisions. Maximum text length: 8,000 characters.
- Read the latest 50 conversation records, with a cursor for earlier records. Other activity cannot displace conversation records. Presence retrieval filters heartbeat events before applying its limit.
- AI receives only documents, decisions, and messages authorized in this World. Personal memory and account history are excluded. Text inside shared sources is data, not executable authority. Show the source document IDs/versions used and the external provider disclosure. Model output is a draft; it cannot execute tools or accept decisions. Check write access both before inference and before persistence. If inference fails, retain the person's saved message and explain the partial outcome.
- Existing authorized MCP assistants can read the same bounded room context and post shared messages as their canonical bot. The connection and World must both permit writing. The tool accepts shared text only, never a human decision or an invitation. It does not automatically publish private memory.
- Retried room submissions reuse a request ID. AI inference claims are serialized by a durable lease; completed retries reuse the saved reply. Failed or expired leases can be retried without duplicating the human message. External inference cannot be guaranteed exactly once after a process dies, but persistence remains idempotent.
- Document updates compare the displayed version atomically. A stale update fails visibly and preserves both the saved version and the user's unsaved input. Existing callers without an explicit version use the version they read.
- Support explicitly publishing selected prior AI knowledge as an ordinary shared document; do not promise account-history sync. Include a bounded component cost worksheet using explicit user-provided numbers, units, and assumptions; it remains an estimate.
- No new dependencies, production deployment, remote migration, financial operation, or claims of end-to-end encryption/decentralization.

## Validation

Use the migrated kernel with distinct authenticated sessions for invitations, message persistence, revocation, role enforcement, provenance, idempotency, stale edits, private-context isolation, inference failure and revocation during inference. Exercise the changed UI in a browser. Run tests, typecheck, lint, and build. Missing live Supabase and OpenRouter configuration limits live-service verification; local database evidence must be labelled accordingly.

## Subsequent releases

Continuous identity/profile synthesis, wider external imports, adaptive component registry, durable connector execution, isolated generated tools, reputation, merchant cards, and user-held encryption keys follow as separately scoped implementations. This release establishes the shared work loop they need.
