SOV — VISUAL, FUNCTIONAL & TECHNICAL MASTER BLUEPRINT
The implementation contract for one cohesive operating environment
Version: Foundation Blueprint 1.0 Date: November 4, 2026 Audience: Codex, Claude Code, product designers, engineering agents and reviewers Status: Target specification, not verified implementation

1. Product Mission
SOV exists to connect a person's intentions with available intelligence, software, people, knowledge and resources in one personally governed environment.
Never compete. Integrate.
The product should make existing technology easier to discover, use together and build upon.
People should not need to know which APIs, AI models, workflow engines, storage providers or underlying protocols make their experience possible.
The individual controls the environment and what they authorize.
A single person should receive genuine utility before needing a social network or Community.
Permanent product structure
* Space: My digital environment, private activity and published identity.
* Projects: My durable work, creations and purpose-built Workbenches.
* Communities: My relationships, collective participation and shared resources.
* Control: My identity, integrations, permissions, Agent operations and economic resources.
* My Agent: Persistent personal intelligence available across all destinations.
Do not introduce permanent top-level destinations for Machines, People, Connections, Wallet, Worlds, Apps or Marketplace during the foundational release.
Those concepts remain accessible through the appropriate destination, search, shortcuts and contextual views.
Existing internal World/Room data structures may continue supporting contexts and Projects.

2. Design and Brand Contract
Preserve the approved SOV design language while reducing decorative interface density.
Default appearance: Premium contemporary interface with restrained architectural atmosphere, precise typography, subtle glass surfaces, dark graphite, warm highlights and limited violet accents.
Primary content: Real work, connected services, people, relevant activity, pending decisions and available capabilities.
Personal expression: Allow substantially different visual environments without changing operating logic.
Logo: Treat the current mark as provisional until the founder explicitly approves a final identity. Do not block functional engineering on logo exploration.
Design invariants
* Four primary destinations.
* Persistent Agent availability.
* Consistent semantic icons and labels.
* Predictable navigation and back behavior.
* Accessible controls and responsive layout.
* Clear private, shared and public context.
* Honest pending, failed, unavailable and completed states.
* Explicit approval interactions for consequential actions.
Customizable properties
* Personal environment.
* Theme and color treatment.
* Background imagery and atmosphere.
* Typography within supported constraints.
* Layout configurations.
* Approved widgets.
* Avatar appearance, voice and personality.
* Public Space branding.
* Creative artifact styling.
Do not confuse changing the Home environment with editing a Project artifact.
The visual foundation
Implement:
1. A canonical semantic design-token source.
2. A reusable component registry.
3. A versioned Environment Manifest.
4. A theme-aware Experience Renderer.
5. Component-state previews and visual regression tests.
Avoid hardcoded per-user CSS scattered across application routes.
AI-generated visual proposals must be validated before applying them.

3. Screen Atlas — Every Major Operation
Each screen below needs its own full-size visual reference, actual route or overlay behavior, and testable functional contract.
S01 — Space / Personal
Purpose: Display the most relevant elements of a person's digital life.
Visible: Agent entry, Continue, relevant shared activity, important approvals, selected integrations and contextual shortcuts.
Actions: Resume work, ask Agent, create, connect, respond, open relevant context, customize.
Required state: Actual user-owned or authorized information.
New user: Beautiful, simple empty state. No fabricated Projects, activity or automatically created Worlds.
Growth: More useful resources can become visible, but not automatically overwhelm the screen.
Security: Private by default.
S02 — Space / Shared Activity
Purpose: Surface real participation involving other people.
Visible: Authorized contributions, invitations, comments, shared creations and relevant Community updates.
Actions: Reply, inspect, contribute, accept invitation, request access, open associated Project.
Required state: Audience-scoped social-object records.
Security: Never combine unrelated private activity into a universally visible feed.
S03 — Space / Public Visitor
Purpose: Present the person's deliberately published identity and creations.
Visible: Selected public persona, interactive creations, publicly shared experiences and optional collaboration methods.
Actions: Explore, try, share, request permission, follow where supported.
Required state: Published visitor-safe resources only.
Security: Distinct server-authorized representation, not CSS-hidden private data.
S04 — Explore / Discover
Purpose: Find useful capabilities, creations, people and repeatable experiences.
Visible: Search, relevant categories, available Machines, templates, public creations and contributor information.
Actions: Preview, inspect capabilities, request installation or authorization, use a template.
Required state: Genuine registry and publication records.
Foundational implementation: Curated discoverable examples may be sufficient; do not require a global algorithmic feed.
S05 — Create on Demand
Purpose: Convert a new intention into a proposed usable experience.
Visible: Intention input, recommended capabilities, proposed workspace, workflow, dependencies, estimated usage and required approvals.
Actions: Modify plan, remove dependencies, connect needed tools, create workspace.
Required state: Validated draft manifest from actual supported components.
Security: Generated plans do not independently confer permissions.
S06 — Connect External Services
Purpose: Bring outside capabilities into SOV.
Visible: Supported providers, connection state, operations, required scopes, privacy and costs.
Actions: Authorize, inspect, grant to a context, disconnect, revoke.
Required state: Real provider responses and SOV authorization records.
Security: A connected account is not equivalent to general Agent access.
S07 — Projects
Purpose: Organize persistent work.
Visible: Owned, invited and shared Projects; actual artifacts; active tasks; last meaningful state.
Actions: Create intentionally, open, rename, archive, share, export.
Required state: Canonical Project and ownership records.
Security: Project-specific grants.
S08 — Workbench
Purpose: Perform actual work.
Visible: Editable artifact or specialized task surface, context tools, version history, preview and Agent access.
Actions: Edit directly, save, undo, preview, export, ask Agent, publish selected output.
Required state: Durable, versioned artifact model.
Foundational implementation: One strong interactive-page/artifact Workbench.
Future expansion: Design, coding, research, media, commerce and other specialized Workbenches.
S09 — Agent
Purpose: Coordinate intelligence and available capabilities.
Visible: Current context, Agent identity, proposed next action, tool status, evidence and usage when available.
Actions: Ask, plan, refine, assign, approve, cancel, inspect work.
Required state: Real provider responses and task records, not simulated operation progress.
Security: Model-independent identity and memory, context filtering and bounded authority.
S10 — Approvals and Execution
Purpose: Make consequential actions understandable and controllable.
Visible: Proposed operation, affected service, resources, principal, scope, estimated cost, risk and expected evidence.
Actions: Approve, decline, narrow scope, inspect details.
Required state: Authorization and task lifecycle records.
Security: Revalidate authorization at execution time; support unknown external outcomes and reconciliation.
S11 — Automations / Machines
Purpose: Turn successful processes into reusable bounded workflows.
Visible: Trigger, steps, capabilities, dependencies, grants, estimated cost, schedule and run history.
Actions: Create, preview, enable, pause, edit, clone, share where permitted.
Required state: Versioned Machine and execution records.
Security: No unrestricted recursive task delegation or background activity.
S12 — People
Purpose: Connect work, social identity and collaboration.
Visible: Approved connections, collaborator profiles, invitations, public contributions and participation opportunities.
Actions: Contact through supported channels, invite, share, request access, collaborate.
Required state: Identity, persona, audience and relationship records.
Security: Presence and discoverability are opt-in; do not expose private contacts or location.
People is a contextual social view, not a required global navigation destination.
S13 — Communities
Purpose: Support collective identity, resources and work.
Visible: Membership, roles, shared Projects, contributions, discussions and approvals.
Actions: Create, invite, join, contribute, manage access and leave.
Required state: Community membership, grants and social-object records.
Security: Community ownership is separate from members' personal resources.
S14 — Publish
Purpose: Make selected work available to an authorized audience.
Visible: Owner preview, visitor preview, visibility selection, attribution and available interactive actions.
Actions: Preview, publish, share, unpublish, revise.
Required state: Explicit publication and version records.
Security: Public view reads only the publication representation.
S15 — Control
Purpose: Let people understand and govern their operating environment.
Visible: SOV ID, Agent configuration, connections, permissions, tasks, usage, funding, security and activity receipts.
Actions: Configure, inspect, limit, revoke, reconnect, approve and reconcile.
Required state: Authoritative backend records and verified external data.
Security: Never derive financial or permission authority from visual state.
S16 — Customize
Purpose: Make SOV expressive and personal.
Visible: Theme, environment, layout, Agent appearance and accessible preview.
Actions: Preview, modify, apply, reset, undo.
Required state: Versioned validated Environment Manifest.
Security: Appearance does not alter grants, credentials or financial permissions.

4. Interaction Grammar
All screens must use a common action vocabulary:
Open — Navigate to an existing resource.
Create — Intentionally establish a durable resource.
Connect — Start a provider-supported authorization flow.
Use — Invoke an available capability within a permitted context.
Share — Establish access for defined participants.
Publish — Create an explicitly approved public representation.
Approve — Authorize a specified protected operation.
Run — Submit an authorized task to durable execution.
Verify — Resolve outcomes against actual evidence.
Customize — Change permitted presentation settings.
The same term should not mean different operations in different destinations.
Prefer short labels without unnecessary explanatory subtitles.
Use additional explanation for security, spending, publication, permissions and unfamiliar actions.

5. On-Demand Experience Factory
This is a defining long-term capability.
A user should be able to describe a useful outcome and have SOV assemble an appropriate experience from existing approved capabilities.
Fast path: Assemble without deploying new code
1. Capture the intention.
2. Identify an appropriate context.
3. Inspect existing templates and supported capabilities.
4. Determine required inputs, dependencies and providers.
5. Generate a proposed workspace and workflow manifest.
6. Validate components and resource requirements.
7. Identify missing connections and permissions.
8. Present an editable preview.
9. Obtain authorization for the intended creation.
10. Create the Project and persist its manifest.
11. Expose the new experience in Projects.
12. Update relevant Space, Agent and Control projections.
13. Execute tasks only under their own required grants.
14. Preserve artifacts, results, history and receipts.
15. Optionally save the workflow as a reusable Machine.
The user should not wait for a full software deployment to assemble a supported experience.
Slow path: A capability does not exist yet
If required functionality is unavailable in the registry:
* Explain what is missing.
* Search approved external providers or existing compatible software.
* Offer a reduced-scope alternative.
* Optionally prepare a development specification.
* Route custom development through isolated coding, testing and review.
* Register the resulting verified capability after deployment.
Do not run arbitrary generated application code with access to privileged SOV resources.
Generated workspace manifest
A generated workspace should declare:
* Schema version.
* Owner and Project context.
* Intent and objective.
* Selected Workbench type.
* Approved component references.
* Artifact schemas.
* Capability dependencies.
* Connection requirements.
* Task/workflow definitions.
* Permissions and funding requirements.
* Validation and verification rules.
* Version and migration information.
Expansion rule
A new use case expands the user's available experience through configuration and registered capabilities, not by mutating the global SOV navigation or inventing new database authorities.

6. Social Objects and Relationship Architecture
Social interaction should arise naturally from meaningful resources.
A social object may refer to:
* A creation.
* A published experience.
* A Project update.
* A request for contribution.
* A shared task.
* A Machine.
* An event.
* A Community discussion.
* A verified milestone.
Every social object must reference:
* Author/actor.
* Owning context.
* Underlying resource.
* Audience policy.
* Permitted interactions.
* Version or activity references.
* Moderation and reporting state where applicable.
Social actions
Users may comment, appreciate, invite, contribute, request access, collaborate or share according to the object's policy.
A social action may update shared activity projections, notify authorized members or produce a task.
It must not automatically publish unrelated private information.
Social growth loop
Create → Share → Discover → Experience → Participate → Contribute → Reuse.
This is more important than maximizing an infinite feed.
The product should be genuinely useful without any social activity.

7. Technical Architecture
Experience layer
Next.js/React application, approved design system, versioned manifests, Workbench renderer and responsive screens.
Application layer
Authenticated commands, read models, resource access checks, user preferences, publication APIs and integration orchestration.
Authority kernel
Canonical actors, contexts, resources, grants, tasks, evidence, events and financial records.
Reuse the existing SOV kernel wherever its implementation is verified.
Intelligence layer
Persistent Agent identity, Context Broker, model adapters, capability routing, task planning, memory management and measured inference.
Execution layer
Durable queues, workers, leases, task transitions, external API calls, idempotency, retries, human approvals and verification.
Integration layer
OAuth, MCP, APIs, webhooks, provider-specific adapters and typed capability manifests.
Projection layer
Screen-specific views, search indexes, relevant Agent context indexes and scoped realtime notifications.
Economic layer
Funding accounts, hard budgets, reservations, measured usage, reconciliation and provider-backed transaction records.
Infrastructure
Continue with the existing verified Next.js/Vercel and Supabase/PostgreSQL architecture unless a documented operational requirement warrants change.
Prefer a modular monolith with independent durable workers initially.
Avoid prematurely deploying a graph database, dedicated vector cluster, Kafka, Kubernetes or independent microservices solely for hypothetical future scale.

8. Critical Data Contracts
Codex must audit current database tables and functions before adding fields or systems.
The conceptual entities to reconcile are:
Actor: Person, organization or delegated Agent.
Context: Personal, Project or Community scope.
Resource: Artifact, file, connected account, credential reference, device, capability or other owned resource.
Grant: Permission from an authoritative principal over specified resources or operations.
Capability: Typed operation with provider, inputs, outputs, availability, risk, scopes and verification requirements.
Connection: Provider authentication and usable operation state.
Task: Objective, context, worker assignment, constraints, lease, status and evidence.
Artifact: Versioned durable creative or operational output.
Environment: Versioned presentation configuration.
Publication: Visitor-safe representation and visibility rules.
Social Object: Audience-scoped interaction around a referenced resource.
Membership: Community or Project participation and role.
Usage Record: Attributed AI or service consumption.
Funding Reservation: Concurrency-safe authorization of maximum expected spend.
Evidence Record: Source-backed information concerning execution and results.
Every entity has a canonical owner, schema version, lifecycle and authorization model.
Do not create parallel task, identity, grant or ledger systems.

9. Event Contracts and Cross-Screen Updates
Authoritative writes follow:
Command → Authentication → Authorization → Atomic write → Event → Projection → Authorized UI refresh.
Events must include stable ID, type, version, actor, resource/context references, causal reference and relevant evidence.
Use existing append-only event infrastructure where appropriate.
Employ durable event delivery and idempotent consumers.
Examples of domain events:
* project.created.v1
* artifact.version_saved.v1
* connection.authorized.v1
* connection.revoked.v1
* capability.registered.v1
* task.completed.v1
* task.failed.v1
* publication.created.v1
* publication.revoked.v1
* member.invited.v1
* member.removed.v1
* usage.recorded.v1
* environment.updated.v1
These are proposed vocabulary examples; reconcile them with existing kernel events.
Required automatic effects
Creating a Project makes it available in Projects, relevant Space continuity and authorized Agent context.
Connecting a provider updates Control and capability discovery, but does not grant every Project or Agent access.
Completing a task updates the corresponding Project, task receipts and eligible activity.
Publishing creates a separate visitor-safe representation.
Revoking membership or provider access prevents subsequent protected operations.
Changing a theme updates supported presentation surfaces without changing authority or data ownership.
A client reconnecting after missed events must recover current state from authoritative read models.

10. Multi-User Intelligence and Economics
Every paid or resource-intensive operation must have attributable usage and bounded authority.
Required controls
* Actual model and provider identification.
* Compatible model capability checks.
* Context selection and provenance.
* Approved routing and privacy policies.
* Funding source.
* Request limits.
* Cost estimates.
* Atomic reservations where spending is shared.
* Concurrency and delegated-task limits.
* Usage collection.
* Reconciliation and release of unused reservations.
* Real execution receipts.
User-owned API billing, SOV-managed allowances and future Community-funded operations are distinct funding methods.
Do not treat consumer subscriptions as transferable API credits.
Do not require cryptocurrency for the foundational launch.
Efficiency
The Agent remains durable without continuous inference.
Deterministic events update normal state.
Models are called when reasoning or generation adds value.
Optimize cost per verified successful outcome, not only tokens per response.

11. Failure and Security Requirements
Test:
* Cross-user isolation.
* Provider timeout and token expiration.
* Revocation during a running task.
* Duplicate event delivery.
* Worker interruption.
* Concurrent spending attempts.
* Stale read projections.
* Guest-session loss.
* Failed artifact export.
* Unauthorized public access.
* Prompt injection through external content.
* Malicious third-party Machine output.
* Incompatible or upgraded manifest versions.
External applications and creator-generated interfaces must not receive privileged SOV credentials.
Use sandboxed or separately hosted rendering for untrusted third-party experiences.
Financial signing, identity changes and protected publication must remain under explicit human or organizational authority.

12. Launch Gates
Gate 0 — Verified inventory
Inspect current code, migrations, routes, deployments, tests and known design references.
Produce a traceability matrix for each Screen Atlas entry.
Gate 1 — Real identity and persistent Projects
Two recoverable identities, intentional Project creation, artifact saving, re-opening and private isolation.
Gate 2 — Real Agent and metering
One functioning model provider, persistent Agent identity, bounded inference and actual usage records.
Gate 3 — Durable execution and integration
A supported external operation runs through authorized task execution, evidence and recoverable event propagation.
Gate 4 — On-demand foundation
At least two different supported intentions assemble distinct valid Project/Workbench configurations using the same underlying contracts.
One should work without external connections; another should correctly identify missing integrations and request appropriate authorization.
Gate 5 — Social and publication
A creator shares a selected artifact, a second user participates under explicit permissions, and a visitor sees only deliberately published information.
Gate 6 — Operations and resilience
Actual Control records, budget enforcement, mobile/Desktop testing, monitoring, backup/restore checks, deployment verification and failure recovery.
No gate is passed merely because a mockup exists.

13. Visual Acceptance Contract
For each Screen Atlas entry, Codex must provide:
* Screen name and route.
* Full desktop screenshot.
* Mobile screenshot.
* Empty state.
* Actual populated state where evidence permits.
* Loading state.
* Unavailable/error state.
* Main click-through flows.
* Source data and owning module.
* Privacy and permission rules.
* Relevant test evidence.
* Differences from approved design.
Do not use invented financial, activity, connection or Agent state in production views.
The logo remains a distinct unresolved branding decision.

14. Required Implementation Discipline
For every feature, Codex must answer:
1. What user outcome does this deliver?
2. Which existing code already supports it?
3. Who owns authoritative state?
4. Which grants and scopes apply?
5. Which capabilities are actually available?
6. What happens on success, failure and uncertainty?
7. Which events and screens update?
8. Does the operation consume paid resources?
9. What can other people see or do?
10. How is it tested now, under growth and in the long-term portability scenario?
Implement small coherent vertical slices.
Preserve the approved visual identity and working code.
Use architecture decisions and versioned contracts to prevent drift.
Maintain an actual current-state handoff between coding agents.

15. First Functional Demonstration
The first complete technical demonstration should prove a simple but powerful scenario:
A person opens their Space and describes a new use case.
SOV identifies suitable available components and external capability requirements.
The person reviews the proposed workspace.
SOV creates a real Project and Workbench.
The person edits and saves a real artifact.
The Agent performs one bounded authorized operation.
The result, evidence and usage are recorded.
The person invites another user to contribute.
They publish a selected version.
Someone else can interact with that public creation.
Control accurately shows the underlying operations and permissions.
The work remains available after the session ends.
This demonstrates a coherent operating environment rather than disconnected feature demonstrations.

16. Long-Term Expansion
Future systems should plug into the foundation:
* More model providers.
* Independent Machines.
* Specialized Workbenches.
* Creator-made Experiences.
* Advanced social discovery.
* Personal and Community economies.
* External payment and wallet providers.
* More sophisticated collaborative tools.
* User-operated inference.
* Optional spatial and 3D experiences.
* Portable identity and resources.
* Independently operated compatible infrastructure.
Do not implement all of these in Foundation 1.
Preserve the contracts that allow them to arrive later.

FINAL DIRECTIVE
Imagine broadly. Visualize every meaningful interaction. Build only verified increments.
Use SOV's four destinations and persistent Agent as the visual structure.
Use the existing kernel as the authority.
Use capability manifests and Workbench manifests for on-demand expansion.
Use events to connect application state.
Use grants to protect the person.
Use real evidence for outcomes.
Use transparent metering to sustain multi-user intelligence.
Use social objects to connect people's creations and contributions.
The result should feel like one personal digital environment that becomes more useful as the individual, their relationships and the available world of capabilities grow.
END — SOV MASTER BLUEPRINT
We now have an agreed SOV product vision, visual direction, operational launch contract, and master technical blueprint.
Your assignment is to reconcile these into a functioning application, preserving all verified existing work.
Start by inspecting the actual repository, Supabase schema and kernel APIs, Vercel configuration, available connectors, routes, components, tests and current deployment evidence.
Do not start with a redesign or an architecture reset.
Establish the blueprint reference
Create or reconcile a canonical docs/sov/blueprint/ reference containing:
* INDEX.md — source of truth and document precedence.
* CURRENT-STATE.md — evidence-backed implementation inventory.
* SCREEN-ATLAS.md — individual screen contracts and navigation flows.
* DESIGN-SYSTEM.md — approved design, components, tokens and customization.
* ARCHITECTURE.md — module ownership and infrastructure.
* CONTRACTS.md — actors, contexts, grants, resources, capabilities, tasks, evidence and events.
* ON-DEMAND.md — use-case assembly and live expansion.
* SOCIAL.md — public personas, social objects, memberships and sharing.
* INTEGRATIONS.md — provider adapters, scopes, MCP, OAuth and revocation.
* AGENT.md — memory, model routing, task delegation, verification and usage.
* ECONOMICS.md — budgets, funding attribution and resource metering.
* ACCEPTANCE.md — verified end-to-end tests and release gates.
Reuse any equivalent existing documents rather than creating duplicates.
Build against the visual specification
For each significant screen, produce an independent desktop and mobile reference, not another collage.
Preserve four destinations: Space, Projects, Communities, Control, plus the persistent Agent.
The approved warm architectural Home remains the default visual expression, but functionality must not depend on background artwork.
Provide truthful empty states, context-aware populated states, and meaningful loading, failure and permission states.
Use short, intuitive labels and progressive disclosure.
Keep the logo provisional.
Implement the foundational experience
Prioritize a single complete journey:
A person enters SOV, establishes recoverable identity, describes a use case, reviews a proposed workspace, creates a durable Project, edits and saves work, invokes an authorized capability, receives actual results, invites a collaborator and publishes a selected public artifact.
The relevant destinations must update through shared authoritative state, not separately simulated frontend logic.
Implement on-demand use-case assembly through versioned manifests, approved components and actual capability contracts. Unsupported functionality must be marked unavailable or routed to a separately reviewed engineering workflow.
Validate the architecture
For every operation, define:
1. Canonical owner and resource.
2. Required authentication and grants.
3. Inputs, outputs and capability requirements.
4. AI reasoning versus deterministic behavior.
5. Data persistence and versioning.
6. Events and affected projections.
7. Execution and verification.
8. Cost and budget constraints.
9. Failure and revocation behavior.
10. Automated and visual acceptance tests.
Reuse the existing kernel, task protocol, evidence records and ledger wherever valid.
Do not build duplicate systems.
Delivery standard
Use small, safe, testable increments.
At each milestone provide actual screenshots, implemented behavior, tests run, remaining blockers and the next smallest step.
The long-term blueprint guides architecture. The Foundation Release 1 contract governs initial scope.
Do not implement every visualized future capability at once. Prove the common foundation by making several different experiences work through the same operating contracts.
Begin with the source-backed audit, Screen Atlas mapping, and first verified vertical slice.
The objective is an operational, visually coherent SOV that can expand through real integrations, user-created capabilities and permissioned collaboration without repeatedly rebuilding its foundation.
SOV — Social, Community & Universal Intention Extension
Objective
Extend the existing SOV foundation so individuals can express their identity, discover other people and creations, build Communities, coordinate work, and turn digital or physical intentions into governed Projects.
Preserve the four destinations and persistent Agent. Do not turn every social or operational capability into another top-level navigation item.
1. Social foundation
Introduce or reconcile the following concepts against existing kernel records:
* Public Persona: a selected representation of an actor, independent of their internal identity.
* Social Object: a creation, request, update, contribution, event, Machine or shared outcome.
* Audience Policy: private, explicitly shared, member-scoped or public visibility.
* Relationship: follow, membership, invitation or approved collaboration.
* Contribution: a person's work associated with a resource or Project.
* Activity: a source-backed event visible only to its authorized audience.
* Opportunity: an opt-in request for a skill, service, resource or collaborator.
All references must use stable IDs. Display names, avatars and themes are mutable presentation attributes.
Use existing actors, contexts, resources, grants and events wherever possible.
2. Social Space
Implement three contextual views:
Personal — privately relevant work, resources, Agent actions and activity.
Shared — authorized contributions, collaborations, messages, invitations and Community activity.
Public — deliberately published identity and visitor-safe creations.
Maintain one consistent navigation structure across these views.
A public visitor must never receive private records, credentials, Agent memory or unpublished source data.
3. Personal and Community branding
Implement versioned visual manifests supporting approved themes, layouts, imagery, typography, profile components and public creations.
A Community may establish its own visual identity independently of its members.
A Project artifact may also have its own branding independent of the owner's Space.
Use stable, reusable SOV controls for permissions, financial approvals and safety-critical interactions.
Changing presentation must never change authority.
4. On-demand intention resolution
Accept a natural-language intention and translate it into a proposed objective, context, resources, capabilities, participants, dependencies, costs and required evidence.
Recognize at least four execution classes:
Digital — software, creation, data and online operations.
Physical — people, locations, equipment, logistics and real-world work.
Hybrid — a mixture of digital services and physical execution.
Regulated or high-stakes — activities requiring additional professional qualifications, legal authority, review or safeguards.
The system may assemble a workspace immediately from supported components.
It must not claim it can complete an external action without a compatible connector, authorized person or necessary service.
Unsupported capabilities should be explained and made into explicit dependencies or development requests.
5. Physical-world coordination
Introduce a reusable service-request and fulfillment pattern built on existing task primitives.
Represent the requested outcome, location where voluntarily supplied, participants, required qualifications, constraints, quotes, approvals, scheduled work, evidence and final confirmation.
Keep proposals, accepted assignments, dispatched operations, work in progress and verified completion distinct.
Do not invent service providers, issue unauthorized dispatches, book real-world resources or mark physical work complete based solely on an Agent's statement.
For regulated tasks, preserve the role of applicable licensed or qualified professionals.
6. Social-to-action loop
Prove this journey end-to-end:
A person publishes a creation or request.
Another person discovers it.
They request appropriate participation.
The owner approves access.
Both work in an authorized Project or Community.
An Agent helps coordinate suitable capabilities.
Tasks and contributions produce evidence.
The owner publishes a selected result.
Others may interact with or reuse the result where authorized.
7. AI and economic limits
The Agent can recommend people, Machines, providers and workflows using authorized data.
It cannot silently grant access, spend money, contact people, reveal private identity, or execute physical-world instructions outside approved authority.
Every billable operation must enforce a funding source and resource limit.
Every meaningful external result must preserve an evidence reference and uncertainty state.
8. First implementation gates
Gate A — Accurate private/public Persona and social-object representation.
Gate B — Real invitation, membership, collaboration and revocation.
Gate C — Working digital use-case assembly and durable Project persistence.
Gate D — Physical-world planning with human assignment and evidence requirements.
Gate E — One real external connector performing an authorized operation.
Gate F — Cross-screen state synchronization, two-user security testing and responsive visual validation.
9. Visual acceptance
Capture full-size screenshots for:
* A new private Space.
* A personalized, socially active Space.
* A public visitor Space.
* Public creation discovery.
* A Community entrance and member view.
* A collaboration invitation and permission approval.
* A digital intention being assembled.
* A physical intention requiring people and external resources.
* A Project showing execution, dependencies and evidence.
* Control showing real integration and authority state.
For each screen, verify the empty, populated, loading, unauthorized and failure states relevant to its operations.
Final requirement
Do not build a separate app for every use case.
Build a composable operating foundation where people can introduce a new intention, assemble available capabilities, involve other people, preserve work, and obtain real-world results through authorized providers and participants.
Visual ambition should reveal possibilities. The implementation must distinguish possibilities from operational capabilities.
END — SOCIAL AND UNIVERSAL INTENTION DIRECTIVE
SOV — COMMUNITY STUDIO & CREATIVE EXTENSIBILITY MANUAL
Codex visual, functional and technical design instructions
Status: Design and implementation target, not evidence of completed functionality.
1. Purpose
Build a Community experience that people can shape around their own identity, relationships, creative work and practical goals.
A Community should be able to support digital activity, physical-world coordination or both, without requiring SOV engineers to create a separate product for each use case.
Permanent principle: SOV owns the operating grammar. Communities own their expression. External providers retain their identity.
2. Preserve the SOV foundation
Keep the four main destinations:
* Space
* Projects
* Communities
* Control
Keep the personal Agent accessible throughout.
Inside Communities, use contextual views such as Explore, My Communities, Activity, Invitations and the active Community.
Do not add every integration, Machine, or community feature to the global navigation.
3. Create a Community Studio
Community owners should be able to build and change their environment through a visual editor.
The Studio should contain five areas:
Brand: Name, logo, visual identity, colors, typography, cover, public description and approved custom assets.
Layout: Select, arrange, resize and remove supported modules.
Content: Featured creations, posts, articles, portfolios, shared resources and interactive experiences.
Capabilities: Discover and configure external tools, Machines, AI capabilities and workflow components.
Governance: Public visibility, member roles, invitations, moderation, publishing rights, financial authority and approvals.
Offer desktop and mobile previews with visitor, member and administrator views.
Changes should support draft, preview, publish, revision history and rollback.
4. The modular creative canvas
Use a versioned Community Experience Manifest.
A Community can arrange registered modules, including:
Module	Use
Community Hero	Establish identity and purpose
Social Activity	Updates tied to people and resources
Creations Gallery	Interactive published work
Projects	Authorized shared work
Member Directory	Approved public/member profiles
Events	Digital or physical events
Discussion	Conversations around specific subjects
Resource Library	Files, links, knowledge and assets
Opportunities	Requests for contributors or services
Machines	Reusable workflows and capabilities
Integrations	Available external tools
Commerce	Approved storefront or payment capabilities
Real-World Coordination	Locations, people, resources, tasks and evidence
Custom Experience	Safely hosted or validated external interactive content
Do not load every module by default.
The creator selects the modules relevant to the Community. Provide excellent presets and blank-start options.
A new community should still feel intentional when its activity is empty.
5. Third-party integration architecture
Provide a searchable integration catalog, organized by capability rather than just provider logo.
Creative and media: Figma, Adobe, Canva where supported, YouTube, Vimeo, Spotify, SoundCloud.
Work and knowledge: Google Drive, Microsoft 365, Notion, Airtable, Dropbox.
Communication: Slack, Discord, Zoom, supported email and messaging services.
Software development: GitHub, GitLab, deployment providers, issue trackers.
Commerce and business: Stripe, Shopify, HubSpot and supported CRM/accounting services.
Physical coordination: Maps, event providers, booking systems, shipment services and qualified provider integrations.
Intelligence: OpenAI, Anthropic and other compatible AI providers through their supported interfaces.
Advanced connections: MCP servers, authorized custom APIs, webhooks and validated developer extensions.
These are potential integration targets. Do not present a provider as connected or operational without verifying its actual supported API and authorization state.
Every connector must declare
* Provider identity and adapter version.
* Available operations.
* Authentication method.
* Required external scopes.
* SOV-level resource grants.
* Input and output schemas.
* Usage cost and applicable limits.
* Execution and failure semantics.
* Evidence or confirmation method.
* Supported Community modules.
Every connector must distinguish
Discoverable: SOV knows the integration exists.
Connected: Authentication has succeeded.
Authorized: A particular Community, Agent or Project has a usable grant.
Available: The requested operation currently works.
Executed: An actual operation was attempted.
Verified: Appropriate evidence supports the reported outcome.
Do not use a green provider icon to collapse all six states into one.
6. Three types of integration presentation
Native module: A capability appears using SOV components and semantic design tokens.
Branded integration: An approved connector has its own logo, recognizable identity and appropriate provider-specific controls, inside SOV's stable shell.
External experience: A full independent application remains separately hosted or sandboxed and is accessible through a controlled embed, deep link or external navigation.
Third-party code must not receive privileged SOV credentials or unrestricted access to the application origin.
7. AI-assisted creative direction
The Community Agent can interpret requests such as:
"Make this a premium electronic music collective with public releases, private studio rooms, contributor applications and a shared project library."
Or:
"Create a neighborhood volunteer group with an event board, resource requests, partner organizations and a public record of completed improvements."
The Agent should produce an editable design proposal:
1. Identify the Community's purpose.
2. Suggest appropriate modules.
3. Propose a visual theme.
4. Identify relevant existing capabilities.
5. Show missing providers or dependencies.
6. Explain required permissions and resources.
7. Generate a preview.
8. Let the owner approve, modify or reject it.
9. Save a versioned manifest.
10. Update the relevant authorized views.
The AI does not gain permission to install services, spend money or publish information merely because it proposed the design.
8. Social and branding behavior
A Community's public appearance should communicate its identity through its actual creations and members—not rely on meaningless metrics.
Allow members to contribute through authorized social objects: posts, creations, discussions, requests, events, updates, Project milestones and reusable Machines.
Each object needs an owner, context, audience, allowed interactions and durable resource reference.
Support attribution, comments, collaboration requests, safe reporting and moderation.
Public social activity must be deliberately published or authorized; private personal activity must never leak into Community feeds.
9. Physical and digital use cases
Digital communities may coordinate source files, media, software, research and online collaboration.
Physical communities may coordinate venues, participants, equipment, suppliers, schedules, permits and real-world tasks.
Hybrid communities may do both.
Reuse the same Task, Resource, Grant and Evidence foundation.
Physical completion must be distinguished from plans, commitments and self-reported updates.
Where actual-world actions require qualified professionals, permissions or third-party service providers, SOV must identify and preserve those requirements.
10. Technical implementation
Reuse the existing kernel and its canonical actor, context, grant, task, evidence, event and resource systems.
Extend or reconcile:
Community Manifest: Branding, appearance, layout, registered modules and version.
Membership: Person, Community, role, grant and status.
Community Resource: Reference to a resource owned or shared within the Community.
Community Social Object: Typed interaction with a defined audience and owner.
Capability Binding: Connection between a Community module and an authorized provider operation.
Experience Renderer: Schema-driven presentation of approved modules.
Publication: Explicit public representation of approved Community resources.
Event Projections: Updates to relevant screens after authoritative changes.
Do not introduce duplicate identity or permissions systems.
11. Launch scope
For the first functional release, implement:
* Community creation and identity.
* Two meaningfully different visual themes.
* A small registered module library.
* Module arrangement and persistence.
* Visitor and member preview.
* Invitation and membership.
* One shared Project.
* One working external integration.
* One social creation or contribution.
* Actual permission enforcement.
* Responsive desktop/mobile behavior.
* Versioned changes and recoverable state.
Defer the open extension marketplace, unrestricted generated code, complex payments, and federation until the foundation is proven.
12. Visual review requirements
For each substantive Community UI change, provide:
* Desktop screenshot.
* Mobile screenshot.
* Owner view.
* Visitor view.
* Member view.
* Empty state.
* Actual populated state.
* Connector unavailable state.
* Permission request state.
* Different branding/theme example.
Use the approved SOV design language as the default, but allow Community-specific creative expression.
Visual comparisons must use actual application screenshots, not generated images presented as proof of implementation.
13. Acceptance test
A person creates a Community, chooses a visual identity, arranges modules, adds a shared Project, connects a supported tool, invites another user and publishes a visitor-safe Community page.
The invited person can participate only within their grants.
The owner can revoke access.
Community changes remain saved across sessions.
The public visitor cannot access private membership information, credentials or unpublished Project resources.
The system correctly distinguishes a proposed Agent action from real external execution.
The Community can later change its branding and modules without rewriting its membership, ownership or Project records.
Final instruction
Build a creative operating canvas, not a fixed Community page template.
SOV should make it easy to construct different kinds of collective experiences from the same trusted primitives.
The interface can be radically expressive.
The underlying authority, persistence, interoperability and execution rules remain consistent.
END — COMMUNITY STUDIO MANUAL
SOV — Optional Embedded Applications Directive for Codex
Build an App Surface System that allows authorized external applications and capabilities to appear inside a person's Space, Project or Community without requiring the user to leave SOV for every supported action.
Product rules
1. All application panels are optional and hidden by default.
2. Connecting a service does not automatically pin it to a user's Home.
3. Pinning a panel does not grant any additional API scopes or data permissions.
4. Users can move, resize, collapse, remove and organize panels into saved layouts.
5. Panels preserve provider branding where appropriate while using SOV's consistent controls for security and permissions.
6. Projects and Communities use independently scoped app configurations.
7. A Community cannot access a member's personal app account merely because the member joined.
8. On-demand use-case creation may suggest relevant app panels but must request user approval before connecting accounts or enabling actions.
Technical architecture
Introduce or reconcile a versioned AppSurface contract containing:
* Owner actor and context.
* Provider and capability reference.
* Render mode: native embed, API-backed component, sandboxed app or external link.
* Authorized connection reference, if required.
* Presentation manifest: placement, size, visibility and theme.
* Supported actions and their required grants.
* Loading, unavailable, expired, revoked and error states.
* Refresh and notification policy.
* Provider-specific compatibility limitations.
Implement an AppSurfaceHost in the existing Experience Engine.
Use official provider embed interfaces when available.
Use API-backed SOV components when the provider allows data access but not full embedded navigation.
Support MCP Apps through explicit extension negotiation, resource validation, sandboxing and a controlled host/tool bridge.
Use external navigation when embedding or equivalent API functionality is unavailable.
Do not bypass framing protections, authentication restrictions or provider policies.
Security
Keep OAuth tokens server-side.
Use least-privilege scopes and context-specific grants.
Restrict untrusted UI execution using appropriate sandbox isolation, CSP and a validated message bridge.
Never expose SOV credentials to embedded components.
Do not load private third-party data in public Space representations.
Support revocation, expiration, disconnect and per-panel removal.
Performance
Lazy-load panels.
Suspend inactive experiences where possible.
Cache permitted summaries without confusing cached information with live state.
Use responsive layouts and mobile-focused full-screen panel views.
Allow users to disable all external app surfaces while continuing to use SOV.
First acceptance test
A user pins a supported YouTube player to their private Space and uses its actual player controls.
They separately authorize Google Drive and select a file through the official picker.
They open a GitHub Project panel that reads real permitted repository data.
They remove the panels without deleting the underlying Project or automatically revoking their provider connections.
They revoke a connection and confirm that its protected operations become unavailable.
A visitor to their public Space receives none of the private connected data.
The same component-host architecture must support a Community-scoped experience under separate permissions.
The goal is a user-composed digital environment, not a forced collection of application logos.
SOV — Identity, Home & Social Profile Separation
Product requirement
Separate the private SOV Home from the public-facing social Profile.
Both belong to the same person but have different purposes, data boundaries and user experiences.
SOV ID
The persistent identity and authorization foundation.
Stores or references authentication, recovery, ownership, credentials, grants and linked identities.
It is managed through Control.
Never expose internal identity identifiers or private credentials in public Profile responses.
Home
The personally governed operating environment.
Shows the user's authorized Agent context, applications, resources, communications, tasks and relevant activity.
Private by default.
Opening Home must not automatically publish anything.
Social Profile
A dedicated shareable identity surface accessible through a user's avatar, public handle and social interactions.
Should support:
* Profile name, avatar, cover and biography.
* Unique public handle.
* Custom branding and layout.
* Optional external social links.
* Explicitly published creations.
* Selected Community participation.
* Public or permissioned activity.
* Follow and connection relationships.
* Messaging and collaboration requests where enabled.
* Audience and contact preferences.
* Visitor preview.
* Blocking, reporting and privacy controls.
Use server-authorized published views.
Allow a Profile to be discoverable independently of whether the person is actively using SOV Home.
Navigation
Keep Space, Projects, Communities and Control as the four primary destinations.
The avatar opens My Profile, Edit Profile, account switching where supported, and SOV ID / Security.
Public profile links open a dedicated profile route.
Do not add a fifth primary destination solely for the user's Profile.
Shared design system
Home and Profile use the same SOV application shell, design tokens and registered components.
Profile branding is independently configurable from Home appearance.
Projects and Communities also retain independent visual configurations.
Never couple a theme change to an ownership or authorization change.
Data architecture
Distinguish:
* Internal Actor / SOV ID.
* Public Persona / Profile.
* Public Handle.
* Profile Manifest.
* Follow / Connection Relationship.
* Published Social Object.
* Public Creation.
* Audience Policy.
* Collaboration Request.
* External Social Link.
Reuse current identity, resource, grant, publication and event primitives where possible.
Design for future multiple Personas under one internal identity, but do not require multi-persona management in Foundation Release 1.
First acceptance test
User A establishes SOV ID and creates private work.
User A customizes their Home independently of their Profile.
User A publishes a selected creation to their public Profile.
User B opens the public Profile without access to User A's Home.
User B requests to collaborate.
User A receives the request and explicitly authorizes a shared Project.
Revoking collaboration removes access to protected Project resources without erasing the public Profile.
Profile customization, private Home customization and Project content remain independent throughout.
The Profile is where others meet you. Home is where you operate. SOV ID is what preserves your ownership and control.
Codex, use this five-screen package as the unified visual foundation for SOV.
These are not five separate applications. They demonstrate one operating environment progressing from empty to connected, then expanding through Projects, Communities and external capabilities.
The original approved architectural screenshot remains the visual reference. Preserve its warmth, restrained glass surfaces, Agent identity and premium feel while prioritizing usability and clarity.
Build one reusable application shell, design system, component registry and manifest-driven experience engine. Different people, Projects and Communities should be able to look radically different without changing the fundamental navigation, permissions or operating architecture.
Treat the mockups as visual and functional targets, not proof of implemented capabilities. Reconcile them with the existing repository and kernel before changing code.
Prioritize real identity, persistence, Agent context, on-demand workspace assembly, authorized integrations, collaboration, publication and verifiable execution.
Keep third-party applications optional. An app being pinned, connected, authorized or able to execute are four distinct states.
Make the foundation capable of becoming many different experiences without creating a new application or rebuilding its underlying systems every time.
Implement incrementally, compare actual browser screenshots against the references, and preserve working code and user data.
The objective is one simple, beautiful, adaptable foundation that becomes more capable as the person uses it.
