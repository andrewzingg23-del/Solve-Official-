# SOLVE — Product Capability Atlas & Architectural Crosswalk

> **Status:** Proposed comprehensive product/engineering map transcribed from the 2026-11-08 founder conversation. A target capability is **not** a verified implementation. Check `BUILD_STATUS.md`, `ACTIVE-WORK.md`, open PRs, and staging before assigning or claiming built status. Complements, does not supersede, existing canon and security rules.
>
> **How to read:** `F` = underlying foundation; `L` = first coherent user launch; `E` = subsequent extension; `H` = horizon. Priorities are proposals, not delivery estimates.
>
> **Product law:** *Useful alone. More useful together. Simple for the person. Real underneath. Artistic by choice. Portable where technically possible.*

## A. Shared primitives and action lifecycle

Human categories map to shared interfaces: **Actors** (person/group/agent), **Resources** (typed things), **Relationships**, **Agreements**, **Grants/Authority**, **Capabilities and Actions**, **Evidence/History**, **Expression**, and **Context/Memory**. Different domains own their data and rules; the kernel enforces common security and provenance.

Every consequential command goes through: authenticate actor → resolve resource → validate typed input → evaluate policy → obtain necessary approval → execute through domain/provider → reconcile result → write evidence → update authorized views.

Required action states: proposed, awaiting approval, queued, running, succeeded, failed, unknown, cancelled. Never report success based only on generated prose. Owner IDs from a browser request never grant authority. Preserve idempotency and explicit reconciliation on ambiguous external outcomes.

## B. Feature registry

| ID / Stage | Feature — what a person can do | Technical mechanism | Connects to |
|---|---|---|---|
| ID-01 F | Have a stable SOLVE ID | Actor ID independent of handle, wallet and login | All resources |
| ID-02 L | Sign in and return | Session/authentication system; passkey roadmap | Home, private data |
| ID-03 L | Choose public handle and display identity | Handle uniqueness; public profile separate from account | Card, Page, search |
| ID-04 F | Recover account on another device | Independent recovery flow; revocable sessions | Security, continuity |
| ID-05 F | Keep public/private details separate | Field/resource access scopes and server/RLS controls | Home, Page |
| ID-06 E | Prove selected credentials | Issuer signatures, presentations, verification | Card, trust |
| ID-07 E | Act in personal, team and organization roles | Typed actor-resource relationships, policy profiles | Communities, Projects |
| ID-08 E | Create protected family identities/spaces | Guardian relationships, age-appropriate gates | Family, safety |
| ID-09 F | Delegate limited access | Scoped, expiring, revocable grants | AI, collaborators |
| ID-10 E | Export/restore supported identity bindings | Versioned export manifests, key/recovery mapping | Sovereignty |
| CARD-01 L | Share a beautiful digital Card | Card presentation referencing SOV ID | Public Page |
| CARD-02 L | Customize Card appearance | Theme/composition tokens; versioning | Art |
| CARD-03 L | Offer contact/follow/share actions | Verified public capability descriptors | Social |
| CARD-04 L | Share link and QR | Stable resolution route and QR payload | Discovery |
| CARD-05 E | Tap a physical Card | Revocable NFC/QR URL; not account authentication | Identity |
| CARD-06 E | Present different contexts | Multiple authorized presentations bound to one ID | Professional/community |
| CARD-07 E | Show selected verifiable claims | Credential presentation, verifier and policy | Credentials |
| CARD-08 E | Expose supported wallet/payment action | Request-based signing through independent wallet | Economy |
| CARD-09 L | Disable or replace a Card link | Rotate/revoke public Card identifier | Control |
| CARD-10 E | Exchange contact details | Consent-driven contact export/import | People |
| HOME-01 L | Enter a private Home | Authorized personal resource aggregation | Identity |
| HOME-02 L | Continue work from last session | Recent items and persistent state | Projects |
| HOME-03 L | Ask My Agent anywhere | Context-aware but permission-scoped assistant | AI |
| HOME-04 L | Personalize Home | Layout/theme state with editable composition | Art |
| HOME-05 E | View selected connected accounts | Permissioned provider reads | Connect |
| HOME-06 L | See meaningful updates | Activity/event notifications; preferences | People/Projects |
| HOME-07 E | Search your world | Permission-filtered resource search | All domains |
| HOME-08 L | Inspect and change access | Access review, grants, revocation UI | Control |
| HOME-09 E | Make priorities visible | Explicit priorities, optional AI organization | Memory |
| HOME-10 L | Resume on second device | Real server data, session recovery | Persistence |
| PAGE-01 L | Have a shareable public Page | Published presentation and public read policy | ID/Card |
| PAGE-02 L | Post images, writing, media | Post/media records, draft/publish lifecycle | Social/Art |
| PAGE-03 L | Follow someone | Typed directed relationship and privacy rule | People |
| PAGE-04 L | React and reply | Comment/reaction store, blocking/moderation | Social |
| PAGE-05 L | Find public people | Public handle/index lookup | ID |
| PAGE-06 E | Discover interesting worlds | Search and user-controllable discovery ranking | Spaces |
| PAGE-07 L | Share a page externally | Stable URL, Open Graph, preview image | Card |
| PAGE-08 E | Speak privately with someone | Scoped message records and delivery | People |
| PAGE-09 L | Add an interactive section | Validated components (form, poll, RSVP) | Capabilities |
| PAGE-10 E | See following activity | Permissioned feed from chosen relationships | Social |
| PAGE-11 E | Curate collections | Ordered pointers to owned/credited resources | Art |
| PAGE-12 E | Co-author a public section | Shared editor permissions, revisions and approvals | Collaboration |
| PAGE-13 L | Block/report unwanted activity | Abuse protections and moderation queues | Trust |
| PAGE-14 E | Move supported social content | Open export schema/protocol adapters | Portability |
| ART-01 F | Begin with a polished neutral interface | Design system, tokens, common components | All surfaces |
| ART-02 L | Switch light/dark | Tested themes and readable contrast | Home/Page/Card |
| ART-03 L | Choose fully personal visual language | Fonts, colors, textures, backgrounds | Presentation |
| ART-04 L | Arrange content however it suits you | Responsive versioned composition schema | Page, Spaces |
| ART-05 L | Ask AI to redesign real UI | Safe typed presentation edits | AI |
| ART-06 L | Edit manually too | Visual editor over same schema | Creation |
| ART-07 L | Reuse media and artworks | Storage, access policy, media metadata | Social |
| ART-08 E | Animate and enrich interactions | Declarative motion and behavior contracts | Spaces |
| ART-09 E | Include sound/music | Licensed, permissioned media | Page |
| ART-10 E | Build spatial experiences | Optional 3D renderer and content format | Worlds |
| ART-11 E | Save a personal aesthetic library | Versioned style presets, authorized references | AI |
| ART-12 E | Co-create in real time | Presence, merge/conflict model | People |
| ART-13 L | Undo creative changes | Revision history, rollback | Editor |
| ART-14 F | Preserve accessibility | Responsive/keyboard/screen reader/reduced motion | All UI |
| ART-15 E | Export creative originals | Assets + composition manifests and dependencies | Sovereignty |
| ART-16 H | Change devices without losing meaning | Alternate renderers of one resource contract | Future UIs |
| PROJECT-01 L | Create Project from text or UI | Typed create command; durable Project row | AI/Home |
| PROJECT-02 L | Save, refresh and reopen | Stable IDs, authorized read/query | Persistence |
| PROJECT-03 L | Show a Project Card | Purpose, state, actions, owner and members | Card |
| PROJECT-04 L | Invite a collaborator | Signed invite lifecycle and grants | People |
| PROJECT-05 L | Understand progress | Evidence-backed activity and task state | History |
| SPACE-01 L | Create an interactive Space | Typed Space and versioned composition | Projects/Art |
| SPACE-02 L | Add tested components | Component registry, validated manifests | Builder |
| SPACE-03 L | Collect form submissions | Public validation + private stored submissions | Page/Business |
| SPACE-04 E | Generate functioning experience | Intent → composition + data/capability contracts | AI/Runtime |
| SPACE-05 L | Preview before publishing | Draft/revision/publication controls | Trust |
| SPACE-06 E | Edit in focused Workbench | Contextual editor and real-time state | Art |
| SPACE-07 E | Co-edit with another person | Presence, concurrency, conflict decisions | Collaboration |
| SPACE-08 E | Ask AI to change a real resource | Typed patch/command under owner authority | AI |
| SPACE-09 E | Reuse a creation | Versioned template/component packs | Ecosystem |
| SPACE-10 E | Display selected Project data publicly | Permission-safe projections not raw DB copies | Page |
| SPACE-11 H | Host advanced generated functionality | Isolated/sandboxed runtime and lifecycle | Execution |
| SPACE-12 H | Build rich interactive Worlds | Scene/state/presence system | Spatial art |
| SPACE-13 E | Track authorship | Revision metadata and rights | Economy |
| PEOPLE-01 L | Find and recognize other people | Public profile lookup, privacy rules | ID/Page |
| PEOPLE-02 L | Invite simply | Scoped token, accept/decline, expiry | Projects |
| PEOPLE-03 L | Belong to Projects and groups | Membership entity and roles | Home |
| PEOPLE-04 L | Decide who can do what | Policy-enforced role grants | Control |
| PEOPLE-05 E | See who is currently present | Privacy-aware ephemeral presence | Spaces |
| PEOPLE-06 E | Discuss within a shared context | Conversation bound to resource | Projects |
| PEOPLE-07 E | Create a community | Community domain, members and shared Spaces | Social |
| PEOPLE-08 E | Host events | Event Card, RSVP, shared time/resources | Page |
| PEOPLE-09 E | Make and accept agreements | Versioned terms, recorded consent | Authority |
| PEOPLE-10 E | Pool chosen resources | Shared library/grants/attribution | Communities |
| PEOPLE-11 E | Decide together | Explicit eligible voting/approval governance | Agreements |
| PEOPLE-12 E | Understand each contribution | Event provenance and authorship | Evidence |
| PEOPLE-13 H | Move community between providers | Compatible export/federation | Sovereignty |
| AI-01 L | Have My Agent accessible throughout | Shared assistant surface, scoped resource context | Home |
| AI-02 L | Keep conversations | Chat records and streaming provider integration | Memory |
| AI-03 L | Ask AI to do something real | Typed capability gateway and outcome verification | Kernel |
| AI-04 L | Work on the right object | Context resource references and authorized retrieval | Spaces |
| AI-05 E | Remember chosen relevant context | Scoped, provenanced persistent memory | Identity |
| AI-06 E | Correct/export memory | User control, retention, provenance | Control |
| AI-07 E | Choose AI provider | Adapter registry, routing and user budget | Connect |
| AI-08 E | Let specialists collaborate | Named agents with task-scoped grants | Projects |
| AI-09 E | Separate shared and private context | Access filters, resource-scoped context stores | Safety |
| AI-10 E | Ask for compositional design | Validated creation/planning API | Art/Builder |
| AI-11 L | Know what was really accomplished | Command status and evidence receipts | History |
| AI-12 E | Delegate long work | Durable queue/workers/leases/cancellation | Automation |
| AI-13 E | Independently check outcomes | Tests, evidence, external verification | Projects |
| AI-14 E | Balance model choice and cost | Per-task model policy and budget enforcement | Control |
| AI-15 E | Import prior context by consent | Provider import, mapping, provenance | Onboarding |
| AI-16 H | Work with limited local AI | Local inference adapters and constraints | Resilience |
| AI-17 E | Preserve one's artistic taste | Permissioned style memory + reversible edits | Art |
| AI-18 L | Approve consequential actions | Human-in-loop policy and recorded approval | Authority |
| CONNECT-01 L | Link a supported outside service | Provider OAuth/token protocol | Identity |
| CONNECT-02 F | See connection state | Provider bindings and explicit scopes | Home/Control |
| CONNECT-03 F | Protect tokens | Restricted encrypted server-side credential store | Security |
| CONNECT-04 F | Discover allowed operations | Typed capability/argument schemas | AI/Card |
| CONNECT-05 F | Authorize per context | Scoped user/resource/operation grant | Kernel |
| CONNECT-06 L | Take a real provider action | Adapter and validated command pipeline | Projects |
| CONNECT-07 L | Know success or failure | Receipts, reconciliation, retries where safe | Evidence |
| CONNECT-08 L | Disconnect | Revoke provider/local grants, invalidate caches | Control |
| CONNECT-09 E | Reuse safely | Account connection plus independent Project scopes | AI |
| CONNECT-10 E | Find tools at the right moment | Relevance search and supported-provider discovery | Home |
| CONNECT-11 E | Monitor provider changes | Webhook/poll, de-dup, provider health | Activity |
| CONNECT-12 E | Add adapters predictably | Versioned SDK, contract tests and manifest | Ecosystem |
| CONNECT-13 H | Install community connectors | Signed/sandboxed packages and reviews | Marketplace |
| CRYPTO-01 E | Connect a wallet | Sign-in challenge and verified binding | ID |
| CRYPTO-02 F | Keep ID independent from wallet | Multiple revocable wallet-account associations | Identity |
| CRYPTO-03 E | Prove a key is controlled | Nonce signature, replay resistance | Trust |
| CRYPTO-04 E | Show chosen wallet information | Read-only selected asset/network queries | Card |
| CRYPTO-05 E | Receive a supported payment | Payment request/checkout adapter | Economy |
| CRYPTO-06 E | Send with approval | Transaction proposal, signing, receipt tracking | Authority |
| CRYPTO-07 E | Use supported stablecoins | Supported asset/network/payment provider | Payments |
| CRYPTO-08 E | Use programmable accounts | Smart-account and recovery adapters | Agents |
| CRYPTO-09 H | Give an agent bounded spending | Enforced budgets, allowlists, expiry, approvals | AI |
| CRYPTO-10 E | Display asset evidence | Chain/object metadata and ownership verification | Resources |
| CRYPTO-11 E | Present verifiable claims | Credential framework and disclosure | ID |
| CRYPTO-12 E | Understand final settlement | Network receipts, unknown handling | History |
| CRYPTO-13 H | Co-manage shared treasury | Multisig/policy vault and audit | Communities |
| CRYPTO-14 H | Use programmable agreement | Formal contract terms and external dispute handling | Agreements |
| CRYPTO-15 F | Keep keys outside model access | Wallet signer isolation | Security |
| PORT-01 L | Export supported information | Structured user-owned export bundle | All resources |
| PORT-02 E | Export designs and Creations | Schema/asset manifests | Art |
| PORT-03 E | Restore elsewhere | Compatible import, mapping, validation | Recovery |
| PORT-04 E | Keep safe backups | Encrypted archive, integrity and restore test | Trust |
| PORT-05 E | Read some things offline | Local cache/offline web client | Home |
| PORT-06 H | Edit offline then sync | Local-first event log and reconciliation | Spaces |
| PORT-07 H | Connect over local network | Peer discovery + authenticated sync | People |
| PORT-08 H | Run alternative infrastructure | Open specs and compatible services | Sovereignty |
| PORT-09 H | Connect to federated networks | Standardized protocol adapters and moderation | Social |
| PORT-10 H | Run limited local AI | Optional local model and dependency fallback | AI |
| PORT-11 F | Replace a provider | Adapter boundaries and migration strategies | Infrastructure |
| PORT-12 H | Share protocol stewardship | Public contracts and governance framework | Ecosystem |
| TRUST-01 F | Sign in securely | Credential/session protections | Identity |
| TRUST-02 F | Keep private things private | Server policy and DB row-level access | All resources |
| TRUST-03 F | Separate publication from ownership | Controlled published resource projection | Page |
| TRUST-04 F | See evidence | Event/command receipts and trace IDs | AI |
| TRUST-05 L | Withdraw future access | Grants/session/provider revocation | Control |
| TRUST-06 L | Approve high-risk operations | Risk policies, explicit approval | AI/Crypto |
| TRUST-07 L | Block and report | Abuse review and removal workflows | Social |
| TRUST-08 F | Resist spam | Rate limits, abuse detection, input controls | Public forms |
| TRUST-09 E | Keep children protected | Guardian and age policies | Family |
| TRUST-10 F | Secure provider credentials | Vault/rotation/least privilege | Connect |
| TRUST-11 E | Inspect automated decisions | Policy/provenance explanation | Control |
| TRUST-12 E | Control retention | Export/delete/retention lifecycles | Memory |
| TRUST-13 F | Keep generated components safe | Validated schema/sandbox boundaries | Builder |
| TRUST-14 E | Preserve authorship/rights | Attribution and license metadata | Art |
| TRUST-15 F | Recover mistakes | Versioning, idempotency, compensating commands | Kernel |
| ECON-01 E | Offer something useful | Offer/service resources and terms | Page |
| ECON-02 E | Receive requests | Private lead/inquiry/booking models | Forms |
| ECON-03 E | Accept supported payment | Checkout and verified receipt | Crypto/Fiat |
| ECON-04 E | License or sell creations | Rights/access/delivery contracts | Art |
| ECON-05 E | Accept voluntary support | Donation/tip payment adapter | Creator |
| ECON-06 H | Coordinate group funding | Treasury, accounting, approval | Community |
| ECON-07 E | Pay for optional SOLVE services | Usage billing, honest entitlements | Business |
| ECON-08 E | Order physical Cards | Design/order/fulfillment/activation | Card |
| ECON-09 H | Offer reusable creations | Listings, quality, versioning, licensing | Marketplace |
| ECON-10 F | Leave without losing data | Fundamental export and open contract | Sovereignty |
| SYS-01 F | Get one continuous app | Shared responsive shell and nav | All UX |
| SYS-02 F | Keep engineering organized | Domain-driven modular monolith | Repo |
| SYS-03 F | Save real records | Transactional persistence | All objects |
| SYS-04 F | Govern all commands | Kernel/API authorization boundary | Security |
| SYS-05 F | Execute safely | Typed command gateway, idempotency | AI |
| SYS-06 F | Query safely | Typed permission-filtered reads | Cards |
| SYS-07 F | Prove what happened | Event/action/evidence journal | Trust |
| SYS-08 F | Handle background work | Queue, workers, leases and cancellation | AI |
| SYS-09 F | Contain generated code | Isolation and resource limits | Builder |
| SYS-10 F | Handle media | Object storage and access policies | Art |
| SYS-11 F | Search without leaking | Authorized index queries | Explore |
| SYS-12 F | Test actual contracts | Unit/integration/E2E/security QA | All |
| SYS-13 F | Preview safely | Branch + CI + staging deployment | Development |
| SYS-14 F | Diagnose failures | Logs, traces, telemetry, error IDs | Control |
| SYS-15 F | Keep environments safe | Separate secrets and staging/production | Security |
| SYS-16 F | Evolve contracts | API/schema versioning and compatibility | Connectors |
| SYS-17 F | Work beautifully on phone | Responsive/accessibility/performance budgets | UX |
| SYS-18 E | Permit other clients | Documented API and compatible SDK | Portability |
| SYS-19 F | Know actual development state | Issue #67, GitHub/CI/Vercel evidence | Dev Room |
| SYS-20 F | Release deliberately | Approval, staged acceptance, rollback/flags | Production |

## C. Why the parts connect instead of becoming separate apps

- **Card** presents a resource; **ID** identifies its actor; **Page** publishes a selected expression; **Home** operates private state.
- **Art** is a common composition and rendering system across Card, Page, Home and Spaces—not separately hardcoded themes.
- **Projects** store undertakings; **Spaces** provide environments; **Creations** are actual artifacts or interactive objects. They can reference one another but should not collapse into one generic type.
- **People and Communities** use actor/resource relationships, invitations and scoped membership. They don't require a second account system.
- **AI and human UI** use the *same authorized commands*. AI cannot bypass validation or forge success.
- **Connections** expose typed provider operations to Projects, Home, Cards and AI, gated by contextual grants.
- **Wallets** are optional identity bindings and transaction capabilities, not mandatory SOLVE identities.
- **Evidence** proves a real action; visible state updates from source-backed results.
- **Portability** requires useful exports and alternate implementations, not just a download button.

## D. Day-one vertical slice and evidence gates

**Launch objective:** A stranger makes a Page they love, creates something that really works, shares it, and another person contributes—while all private data stays private.

1. **Identity gate:** real sign-in, SOV ID, recoverable second-device access.
2. **Expression gate:** accepted visual shell, editable Card and Page, working publication, mobile layout.
3. **Persistence gate:** AI or direct UI creates a real Project; refresh and second device show the same record.
4. **Functionality gate:** a generated public inquiry form saves private submissions.
5. **Human gate:** a second account accepts a scoped invite and contributes; revocation blocks later access.
6. **Evidence gate:** state explicitly says proposed/running/succeeded/failed/unknown; receipts cite actual writes or provider outcomes.
7. **Exit gate:** an export of supported resources is documented and validated, without unsupported claims of full federation.

For all gates: measure real user outcome, not a test count or a screenshot.

## E. Implementation policy for existing repo

The current repository already contains kernel contracts, vision canon, design contracts, PRs and ACTIVE-WORK tracking. **Do not reconstruct them from a speculative atlas.** Before any implementation, inspect the exact current branch, issue #67, owner claims, PR #80 (shell), PR #86 (Space composition/runtime contract), and the Project persistence PR stack. Prefer one small non-overlapping change with tests and staged acceptance.

One GitHub branch/PR per bounded implementation. No production deploy, migration, merge, finance operation, or broad rewrite from this document alone. The founder's latest approved visual target remains authoritative in its designated design documentation.

## F. Product-level refusal tests

A feature is not complete if:
- It cannot be used by a person unfamiliar with the repository.
- It looks like it works but has no persistent authorized effect.
- It compromises expression to maintain a generic visual template.
- It requires a wallet or external service for unrelated basic work.
- It bypasses a real person's consent because AI inferred intent.
- It creates private/public leakage.
- It fails silently when a provider is unavailable.
- It depends on SOLVE being the only possible future host without a documented portability path.

**The person is the center. Capability without needless complexity. Freedom without needless dependence. Expression without a standardized cage.**

## Related documents

- [Founding Doctrine](./2026-11-08-SOLVE-FOUNDING-DOCTRINE.md)
- [VISION-CANON.md](../../VISION-CANON.md)
- [EXPERIENCE-IMPLEMENTATION-CONTRACT.md](../design/EXPERIENCE-IMPLEMENTATION-CONTRACT.md)
- [Issue #67 — Development Control Room](https://github.com/andrewzingg23-del/Solve-Official-/issues/67)
