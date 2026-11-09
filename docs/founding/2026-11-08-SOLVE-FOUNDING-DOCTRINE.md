# SOLVE — Founding Doctrine: A Human Operating Environment

> **Status:** Founder conversation captured as a proposed companion to the existing canon, 2026-11-08. This document is *not* a record of implemented functionality and does **not** replace `VISION-CANON.md`, `DIRECTIVES.md`, `DECISIONS.md`, `BUILD-CHARTER.md`, or the approved design contract. Founder review resolves wording or priority conflicts.
>
> **Core promise:** *Your digital life. In your hands.*
>
> **Founding ambition:** Let ordinary people imagine, express, create, connect, own, organize, and act through a personal digital environment. Protect their agency; let intelligence remove technical friction; let art make the environment theirs; let important work endure beyond one provider.

## 1. Start from people, not the present software market

People exist, perceive, create, choose, form relationships, make agreements, exchange value, remember, and act over time. Digital systems should reflect those realities instead of requiring people to conform to app-specific structures.

The current app categories (social network, chatbot, website builder, wallet, project manager) are *temporary packaging* of human capabilities. SOLVE should not make users install and configure a separate mental model for every human activity. Nor should it make all resources generic: people, money, agreements, Projects, Posts, and Spaces have different rules.

The test is ordinary: a person creates something they love; it really works; they share it; someone interacts or contributes; both can return; the work and the rights remain understandable.

## 2. Three founding forces

### SOVEREIGNTY — I choose, and my choices have boundaries

Meaningful control involves identity, access, authority, consent, recoverability, inspectability, and a credible right to exit. Someone's login, username, wallet, physical Card, and public profile are *expressions or bindings* of identity, not the entire person. The service should not become the only key to the person's digital life.

The sovereignty test:
1. Can I access and recover the important parts?
2. Can I understand who can see or change them?
3. Can I grant and withdraw future access?
4. Can I export, preserve, or migrate supported resources?
5. Can an independent compatible implementation preserve useful functions if SOLVE changes or disappears?

Claims must be bounded: exports do not guarantee perfect interoperability; already-shared information may not be retractable; disconnected devices cannot instantly receive revocations; blockchains and remote providers require their networks.

### EXPRESSION — I make this world mine

Art is not decoration after functionality. Personal expression is a primary reason to exist, visit, share, and return. An artist may present a gallery; a musician an interactive album; a writer a book-like environment; a child a protected creative world; a professional a quiet, elegant Page. No one should have to monetize or productivize themselves.

Every resource has **nature** (identity, type, authority, state, real actions) and **expression** (layout, imagery, motion, atmosphere, typography, interaction). Presentation is flexible; security and meaning remain stable. A beautiful default should work instantly. Novices can customize easily; experts can go deeply original. AI can suggest, edit, and assemble, but the human's artistic decisions govern and remain manually editable.

### SOLVE — I can make something happen

A problem is the gap between what is true and what someone wishes to make true. SOLVE should help people understand context, plan, coordinate, create, act under authority, verify what actually happened, and learn. It is not defined by a chatbot or by a catalog of workflows.

The loop: **Understand → Prepare → Coordinate → Create → Act → Verify → Learn.**

There is a broader life beyond tasks: leisure, friendship, beauty, play, discovery, and contemplation are valid ends. SOLVE is capability, not an obligation to be productive.

## 3. The core grammar of human digital reality

Use these common contracts *across* domain modules, without forcing all domains into one data model:

- **Actor** — person, organization, service, or distinctly identified AI agent.
- **Resource** — a real, typed, persistent thing that can be owned, referenced, and presented.
- **Relationship** — an explicitly typed connection among actors and resources.
- **Agreement** — a versioned proposal and acceptance, not an AI assumption of consent.
- **Authority** — the conditions under which an actor may perform a specific operation on a specific resource.
- **Action** — a typed command with inputs, executor, lifecycle, and consequences.
- **Evidence** — the inspectable record of what was proposed, attempted, actually completed, failed, or remains unknown.
- **Time and continuity** — revisions, provenance, retention, recovery, and history.
- **Expression** — the editable visual, auditory, spatial, and interaction presentation.
- **Intelligence** — a governed interpreter and composer of *real* resources and capabilities.

An untrusted model response is never a permission. A client-supplied owner ID is never authorization. A screenshot is not a functioning application. A green deployment status is not end-user acceptance.

## 4. Derive the whole product from the nature of the Card

A card is a small interface that answers: **what is this; who or what controls it; what can be done with it; what does it connect to; and what actually happened?**

The **SOLVE ID** establishes continuity of identity and the relationship to controlled resources. The **digital SOLVE Card** expresses selected, permissioned information and capabilities. The **physical Card** can resolve via QR or NFC to a revocable digital destination; possession of an NFC Card is not proof of account authority and the Card does not carry uncontrolled wallet keys.

The Card pattern can *present* a person, Project, Community, Event, Agent, Creation, or Asset. Underneath, each retains a properly typed domain model. The universal Card is a presentation/action contract, **not** a universal table.

From one human identity grow:
- **My Home:** private context, AI, work, connections, permissions, and continuity.
- **My Page:** public self-expression and relationships, valuable even without AI or commerce.
- **Projects:** persistent undertakings with goals, participants, resources, progress, and evidence.
- **Spaces:** designed environments for experiencing, creating, or operating resources.
- **Creations:** art, media, content, forms, functional components, applications.
- **People and Communities:** chosen relationships, membership, shared authority and cooperation.
- **Control:** inspect, grant, revoke, export, recover, select providers.
- **Wallet / Value:** optional cryptographic verification, ownership representations, exchange and approved financial actions.

Creating privately and publishing selectively should ordinarily expose a controlled presentation of the *same underlying resource*, rather than copying work into a separate disconnected system. Public and private records still require separate authority checks.

## 5. AI throughout, but bounded by reality

AI is optional and replaceable. It can understand intention, retrieve authorized context, research, suggest, design, assemble, help coordinate people and tools, and execute explicit typed actions. The system owns durable resources, not the chat transcript.

A consequential operation travels:
`actor → intent → resource → typed capability → server authorization → approval if required → executor → receipt/evidence → visible state`.

Differentiate `proposed`, `awaiting_approval`, `queued`, `running`, `succeeded`, `failed`, `unknown`, and `cancelled`. Never turn an uncertain provider result into a success claim or blindly retry an irreversible action. A task, Project, or publication must exist outside model conversation and survive a refresh and another device.

Agents act through limited, revocable grants. Private personal memory, shared Project context, public content, and third-party evidence have distinct provenance and access scopes. An AI's ability to think broadly must not silently expand its authority.

Multiple agents and people can collaborate around a single persistent Project; AI providers are replaceable. Shared context is not the union of everyone's private memory.

## 6. Expression must be functional

A user's Page should stand on its own: art, photos, writing, collections, music where authorized, individuality, follow relationships, replies, discovery, and meaningful interactions. Browsing should feel like discovering *people and their worlds*, not uniformly formatted content boxes. A person must be free to enjoy art without a Project.

Creation should produce working resources. For example: 'create a beautiful inquiry page' produces an editable composition, validated public form endpoint, private submissions, publish controls, and a reproducible acceptance test. 'Create a Project' produces a saved resource visible through the same Home and Space. 'Invite my brother' produces a real, scoped invitation and a verifiable second-account experience.

The implementation should use a validated composition/component system first. Arbitrary generated code only within independently secured sandbox boundaries. Manual editing and AI editing operate on the same representation; users can undo and restore.

## 7. Crypto-native without crypto dependence

Support passkeys and ordinary account recovery, optional linked wallets, signed challenges, verifiable credentials where appropriate, programmable wallet permissions, and supported value transfer. The actor identity is independent from any one blockchain address. A signature proves control of a key, not automatically a legal name, entitlement, authenticity of art, or ownership of physical property.

Keep private posts, memories, and household data off public blockchains. Require meaningful transaction confirmation, avoid agent access to unrestricted private keys, show network/asset/fee/finality information, reconcile unknown settlement states, and provide loss/recovery guidance.

No mandatory token, presale, or speculative currency is needed to establish the product. Any later monetary mechanism must emerge from actual utility, explicit governance, safety review, and compliant real-world operations.

## 8. Human cooperation and voluntary organization

A person may invite one other person into a resource; two people can form a group; groups can build communities, businesses, events, projects, or creative worlds. Agreements have explicit acceptance and clear responsibilities. Access is scoped to the shared resource; participation must never expose unrelated Home data, memory, or wallet access.

Examples:
- Two brothers create and operate SOLVE through a shared Project and connected development tools.
- A child makes a safe blue-and-purple creative experience for approved friends.
- A musician curates an album-like world with authorized fan participation.
- A neighborhood group organizes a real park-restoration effort and tracks contributions.
- An artist creates a gallery that others can explore, remix under license, or support voluntarily.
- A family preserves an evolving shared record with agreed privacy and exit rules.
- A business produces a public inquiry experience that saves responses privately.

None of these scenarios should require hardcoded, unrelated app products. They reuse durable identity, resource, relationship, permissions, expression, capability, and evidence contracts.

## 9. SOLVE must be allowed to disappear

A platform that promises sovereignty but makes itself indispensable has contradicted its own mission. People should be able to inspect and export important records, retain permitted assets and relationships, move to compatible implementations, and recover as much as technology allows.

Design for graceful degradation:
1. Hosted services and full AI work when available.
2. Important information can be backed up and restored elsewhere.
3. Selected locally retained data remains usable while offline.
4. Future local network / independently hosted cooperation is possible where security can be maintained.
5. Software cannot function without working power and hardware; some external providers and transactions cannot survive their networks failing.

Portable data formats, published protocol contracts, tested exports/restores, independent implementations, and future shared protocol stewardship are stronger guarantees than branding about freedom.

## 10. Why a large incumbent may resist the deepest promise

Major platforms can copy features. What is harder to reconcile with some platform economics is the unconditional ability to move identity, context, creations, relationships, and providers away from the original company. That is an *incentive tension*, not proof that incumbents are incapable or invariably hostile to openness.

SOLVE's advantage must emerge from artistic quality, practical usefulness, trust, relationships, interoperable creations, and demonstrated retention—not assertions that no one can compete.

A sustainable business sells convenience and genuinely valuable services (hosting, compute, advanced creation, managed capabilities, optional hardware), not dependence or ransom for export. 'For the people, by the people' requires enforceable protocols, rights, meaningful participation, and governance beyond founder goodwill.

## 11. Reality checks and anti-patterns

Do not:
- Present simulated work or beautiful mockups as a real user outcome.
- Make AI, social participation, a payment instrument, or wallet setup mandatory to use basic identity and creation.
- Conflate public profile, private Home, underlying SOV ID, and physical Card.
- Give a single generic resource model the responsibility for all domain rules.
- Build three disconnected applications that happen to share a brand.
- Treat more context as always better; preserve scope, provenance, privacy, and human correction.
- Assume every person wants to work, monetize, or operate an organization.
- Assume generated interfaces are useful just because they are impressive.
- Claim 10x usefulness without observing real people and comparing alternatives.
- Hardcode design to the founder's personal taste; preserve a coherent neutral foundation and maximum human expression.
- Equate blockchain records with truth of all physical-world claims.
- Turn every new founding insight into a simultaneous urgent code rewrite.
- Let AI claim tests, deployments, or external outcomes without verifiable evidence.

## 12. The day-one proof, not the whole horizon

A coherent initial experience:
1. Establish a recoverable SOLVE ID and usable digital Card.
2. Arrive at an elegant, coherent private Home.
3. Customize a public Page through manual controls or optional AI; publish selectively.
4. Create one real Project through AI or direct interaction; save, refresh, reopen.
5. Generate one functional public form whose submissions become private, permissioned records.
6. Invite a second person; prove contribution and revocation.
7. Inspect actions, failures, permissions, and ownership.
8. Provide an honest, usable export of supported resources.

Measure time to first useful result, creator satisfaction, meaningful shares, second-person participation, persistence, trust, and return behavior. The founder's personal use is not independent customer validation.

A finished vertical slice is a stronger milestone than dozens of unfinished modules.

## 13. Core engineering direction

Prefer a domain-driven modular monolith until real scaling constraints warrant separation. One cohesive application shell, strongly typed domain resource models, a governed command/query boundary, centralized authorization/evidence contracts, validated presentation schemas, and replaceable infrastructure adapters.

The endorsed software pattern: `identity + resource + relationship + authority + capability + evidence + presentation` with domain-specific implementations. The kernel is a trust boundary, not a universal business-rules engine.

Keep source code separate from durable user data. Use staging, tests, and exact revisions as evidence. Respect the established `main` decision and existing PR ownership, and reconcile historical trunk instructions explicitly instead of silently overwriting them. No production deployment, merge, migration, or financial operation follows from a doctrine update.

## 14. Founding statement

**SOLVE exists to give people the practical freedom to imagine, express, create, connect, own, and shape their digital lives. Sovereignty protects their choice. Art makes their existence personal. Intelligence expands what they can accomplish. Cooperation multiplies that capability. And important parts of what they create should endure beyond any one company.**

**SOLVE should not become the one application everyone must depend on. Its ultimate achievement would be enabling people to depend entirely on no single application again.**

---

### Related existing authorities

- [VISION-CANON.md](../../VISION-CANON.md) — standing vision and founder clarifications.
- [DIRECTIVES.md](../../DIRECTIVES.md) — active founder orders; not modified here.
- [DECISIONS.md](../../DECISIONS.md) — dated recorded decisions.
- [BUILD-CHARTER.md](../../BUILD-CHARTER.md) — durable engineering decision rules.
- [APP-TECHNICAL-VISION.md](../../APP-TECHNICAL-VISION.md) — prior experience/technical vision.
- [docs/design/EXPERIENCE-IMPLEMENTATION-CONTRACT.md](../design/EXPERIENCE-IMPLEMENTATION-CONTRACT.md) — approved visual and operational contract.
- [Issue #67](https://github.com/andrewzingg23-del/Solve-Official-/issues/67) — coordination and evidence, not doctrine.
