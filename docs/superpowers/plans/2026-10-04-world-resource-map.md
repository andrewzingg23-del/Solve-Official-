# World Resource Map

Status: Founder-directed; implementation in progress.

Date: 2026-10-04
Branch: codex/need-to-route-network-state-spec
Parent product direction: `docs/superpowers/specs/2026-10-04-need-to-route-network-state-design.md`
Canonical vision: `VISION-CANON.md`

## Purpose

Help a person turn a project's goal into a legible map of the resources required to deliver it. A project has finite inputs: time, skill, ideas, capital, labor, and other resources such as tools, materials, and information. SOV should make available contributions, open needs, uncertainty, and eventual proof visible in one private World.

This is a reusable coordination primitive for personal, interpersonal, business, and community work. It is not a public marketplace or a generic task board.

## Product sequence

1. Capture the goal in a private World.
2. Record an offer or a need in one of six categories: time, skill, idea, capital, labor, or resource.
3. Include details and an availability/deadline window; optionally attach a source or evidence URL.
4. Group entries by category in the World. Display who asserted each entry, the source/URL if supplied, and the latest version.
5. Let the author revise or withdraw their own entry. Preserve prior revisions in kernel history.
6. In later slices, let a person invite a contributor for a specific role, let that contributor accept a clearly defined commitment, and record delivery evidence. A need or offer by itself is never a commitment.

## Truth and authority rules

- Every entry remains within its World scope and inherits the World’s permissions.
- An offer is the author’s self-description of a possible contribution, not a reservation, agreement, or promise.
- A need is an owner-described requirement, not proof that the requirement is satisfied.
- A link supplied by a person is an unverified source pointer until an appropriate verification workflow checks it.
- Creation and revisions are attributed to their actual actor. An author alone can revise or withdraw their entry in this slice.
- AI may later propose categories, routes, matches, and evidence requests; proposals must remain distinct from accepted commitments and verified outcomes.
- No automatic publishing, matching, messaging, purchasing, assignment of another person, or physical-world action is in scope.
- No real-money or clinical workflow is included.

## First implementation slice

- Use existing kernel entity kinds `resource` and `need`, and existing scoped `offers` and `needs` relations. No migration should be necessary.
- Persist category, open/withdrawn state, details, timeframe, optional source URL, World ID, and asserting actor as entity attributes.
- Add and revise resource entries through the same authenticated World/kernel boundary as text artifacts.
- Render a mobile-usable form and grouped resource register inside the existing World.
- Add tests for private scope, actor provenance, idempotent create retry, contributor write boundaries, revision, and withdrawal.

## Evidence and market choice

Live source review on 2026-10-04 identified family caregiving as a candidate for further discovery, not an approved market wedge. A 2025 C-TAC/National Alliance for Caregiving policy brief reports that 55% of family caregivers perform medical/nursing tasks while 22% received training for those responsibilities; the brief summarizes other studies rather than presenting its own survey method. The NAC/AARP technology-use summary reports 19% use electronic task lists and schedules, while its page does not provide sampling details. These signals support investigating coordination and training gaps, but do not establish willingness to adopt or pay. Any later care pilot should start with non-clinical logistics and avoid storing clinical details until privacy, safety, and legal questions are answered.

Repair shops are another candidate, but the reviewed September 2026 trade article describes existing software and AI products for calls, follow-up, and administration. Its source is practitioner commentary, not representative research; it does not establish an unserved niche. We should seek direct shop interviews before pursuing it.

Sources:
- C-TAC / National Alliance for Caregiving, *Not Just Visitors* (September 2025): https://www.caregiving.org/wp-content/uploads/2025/09/Not-Just-Visitors_CTACNAC_9.16.2025.pdf
- ACL-hosted NAC/AARP, *Technology Use Among Family Caregivers* (updated February 2026): https://acl.gov/sites/default/files/NCSC/technology-use-among-FC-nac.pdf
- Fleet Maintenance, *How independent repair shops can use AI to improve operations and customer service* (September 24, 2026): https://www.fleetmaintenance.com/shop-operations/ai-and-software/article/55407345/how-ai-can-help-repair-shops-capture-missed-business

## Acceptance criteria

- A signed-in person can add a need or an offer in each supported category to a private World.
- Empty categories remain visibly unmapped; SOV does not infer that resources exist.
- Each entry shows whether it is an offer or need, who asserted it, its current state, details, time window, source link, and version.
- A supplied URL is labeled as user-supplied and unverified.
- A contributor can revise or withdraw only their own resource entry.
- Replaying the same create request produces one canonical entity.
- Revoked or absent World grants prevent reading and writing entries.
- No entry is represented as an accepted commitment, completed work, verified resource, or payment.

## Follow-on work

1. Invite people to a World with task-scoped read or contribute access.
2. Add an explicit acceptance step so an offer becomes a commitment only when its author agrees.
3. Connect commitments to steps, dates, resources, and accountable people.
4. Record delivery evidence and preserve the difference between self-report, provider evidence, and independent verification.
5. Test one real-world workflow with recruited users and measure time-to-first-commitment, time-to-delivery, rework, and repeat use before extending to another market.
