# SOLVE — App Technical Vision

**Status:** Product and technical north star  
**Last consolidated:** 2026-10-08  
**Purpose:** Describe the system SOLVE should become and the experience people should have while using it. This is a direction, not a claim that every capability exists today.

## The product in one sentence

SOLVE is a secure, private, adaptive platform where people and communities can prepare, create, and coordinate with AI—then connect digital work to real-world outcomes.

## What using SOLVE should feel like

SOLVE should feel futuristic and tangible at the same time. A person should feel that they have entered a living environment where their identity, map, communities, projects, tools, and AI agents fit together.

The experience should be calm enough to trust and rich enough to make complex work feel possible. Visual effects, motion, 3D, and personalization should explain presence, progress, relationships, or change. They should not hide uncertainty, imitate capability the product does not have, or make basic actions harder.

The adaptive home should open onto the surface most useful for the person’s current intent. It may be their map, a World, a project, a conversation, or an active workflow. There is no single mandatory home screen for every person and every moment.

## Identity comes early

After account access, the first meaningful product moment should be creating a SOV ID and an avatar—not an extended onboarding sequence. The experience should be relatively deep and realistic while remaining optional about sensitive disclosures.

The person can establish a recognizable identity and representative avatar, then enter SOLVE. More detail can be added over time as it becomes useful. The avatar should support expressive, realistic, and stylized choices without requiring a photograph or biometric information.

SOV ID should begin clean and basic, then be fully customizable. People can add sections, trackers, achievements, records, interests, projects, and other representations of what matters to them. They decide what is visible to whom. Connections to social media and external accounts should be offered as clear, prompted choices, never silently assumed.

Identity is a foundation for continuity and trust, not a demand to publish a complete profile.

## The living map

The map is a major shared surface: a flat world map that makes people, places, and communities feel near and discoverable, with the immediacy of a social map and more depth and control.

Members can appear through a SOV ID card with their chosen avatar, gamer-card details, and badges. Communities, projects, and Worlds can occupy their own places or regions. Selecting a member or node opens a useful path into the relevant profile, community, or World.

The map must respect privacy. Exact location is never exposed by default; people choose whether to appear, what location precision to share, with whom, and for how long. The map can represent presence without revealing a home address or live movements.

The map can be viewed flat and can connect to richer spatial or 3D environments when the task calls for them. It should be a useful model of relationships and activity, not decoration.

## SOV ID and avatar

SOV ID is the person's customizable identity surface across SOLVE. It connects their chosen name and avatar to their Worlds, contributions, badges, capabilities, and history—with privacy boundaries attached to each part.

Avatar creation should feel first-class: high quality, fast to understand, expressive, and revisable. The person should be able to see how their avatar represents them in maps, profile cards, and 3D Worlds. Do not make photorealism or likeness the only measure of quality.

The initial profile should not overwhelm. Start with a coherent identity card and let people add trackers, metrics, history, and other modules when they want them. Each module should have visible sharing controls.

## Communities and Worlds

Communities should be deep and flexible, not limited to a feed and member list. A community can define its purpose, membership, roles, spaces, rules, projects, shared resources, events, agents, workflows, and public or private surfaces. It can evolve without needing a new app for every use.

A World is a persistent place to think and work. It can contain maps, 3D scenes, plans, files, conversations, people, AI agents, resources, workflows, and evidence of real activity. People should be able to build inside a World together, digitally and physically.

Creating or joining should be seamless: invite the right people or agents, establish access, open a shared canvas, and begin. Presence should make clear who is there and what each person or agent is doing, while access and activity remain inspectable.

## Owned AI agents and workflows

People and communities should be able to create, configure, and own AI agents that work inside selected Worlds. They can describe an outcome in ordinary language; SOLVE helps assemble the agent's tools, knowledge, workflow, limits, and approval rules.

An agent can research, draft, design, simulate, coordinate, and complete actions within the authority it has been granted. Its owner can see what it can access, what it did, which sources it used, and what changed. Permissions should be scoped, time-bounded where appropriate, and revocable. High-impact or irreversible actions need a clear human approval step.

Workflows should be editable and understandable. AI can propose the structure; people can change it themselves or tell the agent what to change. Every workflow should show its current state, dependencies, responsible people or agents, and evidence of completion.

## Create anything: digital and physical

A person should be able to say, for example:

> “AI assistant, create a 3D bicycle design studio. Build a first design from my requirements, test it against physics, and show me a path to making it.”

Or:

> “Create a 3D architecture concept for this real-world lot. Let me edit it, walk through it, and understand the likely materials, costs, permits, and financing.”

These are examples of one general capability: help people turn an idea—physical, digital, organizational, or social—into a manipulatable design and a credible route to completion.

For physical objects and projects, the long-term workflow is:

1. **Understand:** Clarify use, constraints, scale, location, budget, and intended outcome.
2. **Create:** Generate an editable 3D concept from scratch, tied to the user's requirements.
3. **Revise:** Let a person prompt edits or manipulate the model directly.
4. **Explore:** Tour the design virtually and inspect relevant views and components.
5. **Simulate:** Apply appropriate physics or domain models; expose assumptions and limits.
6. **Plan:** Identify real materials, quantities, suppliers, costs, skills, tools, and timelines.
7. **Validate:** Find current, location-specific permit and regulatory sources; show what needs a qualified professional's review.
8. **Coordinate:** Assemble financing information, people, tasks, approvals, and dependencies.
9. **Produce:** Generate useful plans, blueprints, exports, and handoffs for the next stage.
10. **Learn:** Record what was built, what changed, and how reality differed from the plan.

The same pattern should adapt beyond bicycles and buildings. A general platform can support many domains, but trustworthy physics, manufacturing details, regulations, and professional outputs require specialized models, verified data, tools, and review. SOLVE should show the difference between a concept, an estimate, a simulation, a sourced requirement, and a professionally approved plan.

## A common technical foundation

The app should build on a stable kernel that governs:

- Identity and account continuity
- Ownership, delegation, permissions, and consent
- Private, controlled data access
- Append-only events and provenance
- Evidence, sources, and correction history
- Double-entry accounting where value is recorded
- Idempotent execution and replay protection
- Human approval for consequential actions

Worlds, maps, communities, agents, workflows, 3D tools, and industry capabilities should use this foundation rather than bypass it. External services should connect through replaceable adapters. The platform should record what it asked an external service to do and what evidence confirms the result.

The interface should reflect real system state. A polished simulation is not a real-world action; an agent proposal is not approval; a material estimate is not a quote; and a generated blueprint is not automatically construction-ready.

## Real-time collaboration

People and agents should be able to work in the same World at the same time. SOLVE should make presence, authorship, ownership, and changes visible. Participants can make, discuss, and revise shared objects without losing the history of what changed.

A World should connect digital artifacts to physical execution: locations, materials, tasks, schedules, budgets, external providers, and completion evidence. The user can move naturally from an idea to a model, from a model to a workflow, and from the workflow to work carried out by people and tools.

## Privacy and security by design

SOLVE should make sharing explicit and understandable. A person or group can choose what to share, with whom, for what purpose, and for how long—and revoke access. Agents inherit only the authority they are granted. They do not gain broader access because they are intelligent or convenient.

Sensitive data, precise location, household relationships, and private World content should remain protected by default. A secure platform should make its access rules visible, give people ways to review and correct their information, and leave evidence of consequential actions.

## Technical direction

The design should support modular growth without locking the product to one provider, model, rendering engine, or industry. Shared kernel rules stay stable; specialized capabilities can evolve as reusable packs, tools, and adapters.

Prefer capabilities that can be composed: identity, maps, spatial scenes, 3D editing, simulation, research, sourcing, workflow orchestration, messaging, and evidence. The same user should be able to start small and add complexity only when it helps.

Scale implementation according to evidence. Build an end-to-end slice that a person can use, observe where it fails, then deepen the platform. Treat domain-specific simulation and real-world execution as progressively validated capabilities, not a promise that one model can design and safely produce every object today.
