# MCPvault reconciled against the kernel and the SOLVE vision

`github.com/quarkvibe/MCPvault` — public, TypeScript, created 2025-07-16, last pushed 2025-07-29,
so dormant for over a year. Described as *"Personalized persistent AI interactions with information
ownership."* Built by the founder's brother, who is also SOLVE's first intended proof.

Read on 2026-11-09 from the GitHub API: 481 files — 279 code, 101 markdown documents, 51 committed
`.backup` files, 12 test files.

---

## 0. Urgent, and not an architecture question

**Two secrets files are committed to a public repository:** `.env` and `SECRETS_EXPORT.env`.

Between them the `.env` carries values for `DIGITALOCEAN_API_TOKEN`, `DATABASE_URL`,
`DATABASE_URL_PROD`, `JWT_SECRET`, `SESSION_SECRET`, `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `REDIS_PASSWORD` and `SMTP_PASS`. The token field is the exact length of
a live DigitalOcean personal access token. No values are reproduced here and none were read in
full; the classification step was deliberately abandoned when it tripped a credential guard.

**Whether those are live or placeholders, the correct action is identical:** treat all of them as
compromised. Rotate every one at its source, purge both files from git history (or delete the
repository and republish from a clean tree, which is faster and more certain), add them to
`.gitignore`, and review the DigitalOcean account's activity and billing for infrastructure nobody
created on purpose. A DigitalOcean token can create and destroy droplets and incur charges; a
Stripe secret key can move money.

This is the single most urgent item in either project and it is nobody's fault but a committed
`.env` is how most of these incidents start.

---

## 1. The thesis is the same, and that is the real finding

MCPvault's own words, next to SOLVE's:

| MCPvault | SOLVE |
|---|---|
| "Your data never mixes with others, and you control who has access." | Scoped records; `scope_covers` isolation; grants and revocation |
| "Users never have to re-upload or re-enter information." | Integrate first: things arrive from what already exists |
| "Your data becomes context that makes AI responses more relevant" | AI as an authorized actor reading only what it was granted |
| "Users control which applications can access their data" | OAuth consent, per-scope capability grants, revocable |
| Per-folder read / write / delete permissions with audit logging | `capability_covers` + the append-only hash-linked event chain |
| MCP and REST as the interface for any AI app | `/mcp` connector with OAuth already shipped |

Two people in the same family independently built toward the same conviction: **a person should own
their context, and AI should reach it only by permission.** That is not a coincidence to resolve by
picking a winner. It is the strongest evidence yet that the conviction is right — and the clearest
case of the waste SOLVE's own canon warns about, two implementations of one idea.

---

## 2. Where the architectures genuinely conflict

### Per-user droplet versus one kernel with scopes

This is the most consequential difference and it is not a matter of taste.

MCPvault isolates people by **giving each one their own server** — a dedicated DigitalOcean droplet
provisioned at signup, quoted at $4/month and 3–5 minutes. SOLVE isolates people by **scope and
capability inside one kernel**, enforced in the database and verified by tests that attempt the
breach.

The droplet model's consequences, stated plainly:

- **Marginal cost per person is real money and never falls.** One thousand people is one thousand
  droplets to pay for, patch, monitor and back up.
- **Collaboration is structurally impossible.** If a person's data lives on their own machine, two
  people cannot hold the same thing — one must copy it to the other. There is nowhere for a shared
  record to exist.
- **Counterparty confirmation cannot exist at all.** The mechanism SOLVE shipped today — a customer
  confirming a contractor's work, as evidence authored by them — requires both parties to act on
  one record. On separate droplets there is no record for the second party to stand on.
- **The operator is still trusted.** A droplet you do not administer is not sovereignty; it is
  single-tenant hosting. The thing that actually makes a record defensible is that its history is
  hash-linked and externally anchorable, not that it sits on its own box.

SOLVE's model costs approximately nothing per additional person, makes collaboration natural, and
proves isolation by test rather than by hardware. **Recommendation: do not adopt the droplet
model.** Its instinct — your data is not pooled with strangers' — is right, and the kernel already
delivers it more cheaply and more verifiably.

### A master encryption key at signup versus scoped recovery

MCPvault has the user create an encryption master key during registration. Lose it, lose
everything. That directly contradicts a decision the founder recorded earlier today: recovery is
**scoped**, requirements tighten with stakes, and *losing the instrument must not mean losing the
person*. SOLVE's envelope encryption and crypto-shredding give the same confidentiality without
making one lost string fatal.

### Audit log versus hash chain

MCPvault logs access. SOLVE's events are append-only and each carries the hash of the one before
it, so tampering is detectable and the whole chain verifies — it did, across 673 events, after
today's migrations. An audit log is a claim by whoever runs the server. A chain is checkable by
someone who does not trust them.

### Derived data presented as data

MCPvault stores "extracted entities, summaries, relationships" alongside uploaded documents. That
is exactly the conflation SOLVE forbids as of today: the document is an **artifact** and a fact;
an extraction is a **claim** with an author, which an AI made. SOLVE keeps the artifact, the
interpretation and the confirmation in three separate fields with no exception for anyone.

### Claims in the documentation that must not be published

The documents assert "SOC 2 Type II certified" and a "99.99% uptime SLA" while the same documents
say the platform still needs a token and launch steps to run. SOC 2 is an attestation produced by
an audit; asserting it without one is a misrepresentation with legal exposure, not an aspirational
headline. SOLVE's canon already forbids decorative verification and fabricated certification.
**Remove those claims from anything public before anything else ships.**

### The same integration failure, in a different shape

101 documents for 279 code files; three competing schemas (`schema.ts`,
`personal-data-schema.ts`, `unified-schema.ts`); 51 `.backup` files committed. This is the same
pattern as SOLVE's 39 open branches and six duplicate Space implementations — generated faster
than it could be integrated. Worth naming because the fix is the same rule, and because it means
the brothers already share a diagnosis: **integrate first.**

---

## 3. What SOLVE should actually take from it

Three things, and they are not code.

**The life-category model is real domain work, and it is now expressible natively.** Identity
(licence, passport, birth and marriage certificates), legal (wills, trusts, powers of attorney,
deeds, policies), financial (statements, tax returns, debts, benefits), family (tree, dependents,
emergency contacts, healthcare directives, educational records). That is a considered answer to
*what does a person actually want held*, and as of today SOLVE can express every one of them as a
**type definition** rather than a hardcoded category — which is exactly the "speak their language"
requirement, with the domain research already done.

**The three named advisors are the authority model, correctly intuited.** AIleen for legal, AIden
for accounting, AIsha for financial — three agents, each confined to one domain. That is SOLVE's
per-goal authority and service actors, arrived at independently. The kernel can already express
"this agent may read only this scope" with revocation; MCPvault described the shape without the
enforcement.

**The CLI is work SOLVE does not have.** Device authorization and out-of-band login, built and
documented. SOLVE's authentication friction consumed weeks of this project. Worth reading before
anyone builds a terminal path here.

---

## 4. The reconciliation

Not a merge. Two platforms with one thesis is the waste; one platform with two contributors is the
leverage.

1. **Security first, today:** rotate and purge, as in section 0. Nothing else matters until that is
   done.
2. **MCPvault becomes a type library and an MCP client of SOLVE, not a parallel platform.** Its
   categories become type definitions; its advisors become scoped agents; its vault becomes Space.
   No second identity system, no second permission model, no droplets.
3. **Drop the per-user droplet.** Keep the promise it was making — your things are not pooled with
   strangers' — and let `scope_covers` and the chain keep it instead, at no marginal cost and with
   collaboration possible.
4. **The brother is the first counterparty.** He already understands MCP, device auth, per-folder
   permissions and why ownership matters. The confirmation mechanism shipped today needs someone
   outside the founder's account to confirm their own side, and he is the best-informed person
   available to do it — which makes him a contributor rather than a parallel builder.

The honest summary: his conviction was correct, his domain research is usable, his authority
instincts match the kernel's, and his infrastructure choice would make the one thing SOLVE needs
most — two people standing on one record — impossible. That is a good trade to offer.
