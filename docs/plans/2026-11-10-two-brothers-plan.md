# The plan: two brothers, one record

Agreed 2026-11-09. The brother is in. This replaces "MCPvault versus SOLVE" with one build and
three people, each on work only they can do.

**The target:** one real tree-removal job recorded with photographs, confirmed by the customer's
side from a separate account, with every part of it inspectable and revocable. Not a demo — a job
that actually happened. That single path exercises identity, typed records, file storage,
evidence, authority, confirmation and provenance at once, which is why it is the target rather
than a feature list.

---

## Who does what, and why only they can

### The brother — file storage, because it is the one hard blocker

**One Supabase Storage bucket** (S3-compatible, already in our stack, so no new vendor and no new
credential). Cloudflare R2 is the alternative if egress cost ever matters; it is the same API.

The rules, which are not negotiable because the permission model depends on them:

- **Bytes in the bucket, record in the kernel.** The file goes to storage; its `sha256:` hash,
  owner, type and authority stay in `kernel.evidence`, which already says the content lives
  outside. The hash is authoritative — never the bucket.
- **No public bucket, ever. Signed URLs with short expiry, issued by the kernel only after an
  authority check.** A link that works without a grant check is the permission model bypassed.
  This is the single most common way file products leak.
- **Address content by its hash, not its filename.** Dedupes, makes tampering detectable, matches
  the kernel's existing `content_hash ~ '^sha256:[0-9a-f]{64}$'` constraint.
- **Encrypt per scope so deletion is real.** The kernel already has envelope encryption and
  `destroy_key`; destroying the key makes the object unreadable at once, which is the only way
  "withdraw published information" is true given eventual consistency and backups.
- **EXIF both ways.** Keep it on the private record — for a tree job the GPS and timestamp *are*
  the evidence. Strip it on publication — for a family photo it is a location leak. A decision,
  not a default.

**Also his:** rotate and purge the secrets committed to the public MCPvault repo, and port his
life-category work — identity, legal, financial, family, with the actual document types he
enumerated — across as **type definitions** rather than hardcoded categories. That domain research
is the best thing in his repo and it is now natively expressible.

**Not his, and dropped by agreement:** the per-user droplet. Its promise (your things are not
pooled with strangers') is kept by scopes and the chain at no marginal cost; its mechanism makes
two people standing on one record impossible, which is the one thing this plan is built around.
Premium is capacity and custody later — more storage, bring your own bucket, self-hosting — never
a VM per person, which would mean two code paths.

### Claude — the three surfaces that make the kernel reachable

Everything below is applied to staging already and has **zero call sites**, so this is reachability
rather than capability.

1. **Confirmation** — ask on a thing; answer by link in minimal chrome. The kernel is attack-tested:
   the owner cannot confirm their own record, an unissued token is indistinguishable from a
   malformed one, and a different answer cannot overwrite one already given.
2. **A person's own vocabulary** — `define_type` and `put_object` surfaced, so a tree job is called
   a tree job because the person said so. The most distinctive thing in the whole specification and
   one call site away.
3. **Export** — one control over `export_mine`. Satisfies "leave with your information" outright.

Then the evidence viewer, the moment the bucket exists.

### The founder — three things nobody else can do

- **Create the bucket** (or authorize me to), which unblocks the brother and the evidence viewer.
- **Reconcile the three staging-only migrations** — `public_space_projection`,
  `sov_public_identity`, `sov_card_permanent_account_publishing` exist on staging with no file in
  this repo, so the repo cannot rebuild staging and the card depends on one of them.
- **Say go on production**, when staging has carried a real job end to end and not before.

---

## The order, and what proves each step

| Step | Who | Done when |
|---|---|---|
| Rotate and purge MCPvault secrets | Brother | Keys rotated at source, files gone from history |
| Bucket exists | Founder | A bucket is reachable from the staging project |
| Upload path: bytes out, hash in | Brother | A photograph is stored and its hash is in `kernel.evidence` |
| Confirmation surfaces | Claude | Two accounts complete one ask-and-answer, green in CI |
| Own vocabulary | Claude | A type the founder names renders through the same generic view |
| Export | Claude | A file comes out containing the founder's work and nobody else's |
| Evidence viewer | Claude | The photograph appears on the record with its provenance |
| **One real job, end to end** | All three | The founder records a job with photographs; the brother confirms from his own account; the record shows who confirmed it, under whose authority, and the founder can revoke his access from the same screen |

That last row is the only one that counts. Everything above it is scaffolding for it.

---

## The rule that keeps this from sprawling

Every piece above strengthens another without becoming its dependency. Storage strengthens
evidence; evidence does not require storage to exist as a concept. Confirmation strengthens
evidence; evidence does not depend on confirmation. Types strengthen every surface; no surface
depends on a type being defined. If a proposed addition cannot be described that way, it waits.
