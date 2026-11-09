# Integration stack — One Solve ($0 where possible, extend existing code)

Principle: **reuse what's built, pay nothing until a real outcome needs it.** Everything below plugs into existing systems (kernel, `lib/bot`, `lib/world`, `lib/passport`, `lib/github`, Supabase, Vercel) — no duplicate infrastructure. Each item: what · why · free limits · where it plugs in.

Status key: **live** (in repo/working) · **to add** (planned next) · **later** (only when needed + budgeted).

---

## 1. Background jobs — Inngest (free) + keep Vercel Cron
- **What:** Inngest free tier for durable, ret[r]yable jobs: morning-brief prep, session synth, connector/MCP calls, dev-agent tasks. Retries, timeouts, cancellation, step functions. Keep **Vercel Cron** only for the daily keep-alive ping + the brief *trigger* (Cron fires → Inngest does the work).
- **Why:** Vercel functions are short-lived and can't run reliable multi-step/retry workflows; Inngest adds durability without a server. Trigger.dev is the equivalent fallback.
- **Free limits:** Inngest free ≈ 50k runs/month, 25 concurrent, basic retries. Vercel Cron: generous on the current plan (1/day keep-alive is nothing).
- **Plugs in:** new `app/api/inngest/route.ts` (serve handler) + `lib/jobs/` functions; brief logic reuses `lib/bot/brief.ts`; synth → passport `propose_memory`; dev tasks → `lib/github`. **to add (first).**

## 2. Notifications — Web Push (VAPID) + Resend fallback
- **What:** `web-push` + VAPID keys for browser/PWA push ("your brief is ready"); **Resend** free tier as the email fallback.
- **Why:** free, works on the installed PWA (incl. iPhone 16.4+); no FCM/APNs account needed.
- **Free limits:** Web Push = free (self-hosted VAPID). Resend free ≈ 3k emails/month, 100/day.
- **Plugs in:** `lib/notify/push.ts` (VAPID send) + a `push_subscriptions` kernel/table; subscribe on the PWA (`app/` service worker + `app/manifest.ts` already exists); email via `lib/notify/email.ts`. **to add (first, with #1).**

## 3. Memory — pgvector (default) + OSS embeddings
- **What:** `pgvector` in Supabase as the bulk semantic layer; embeddings via **Transformers.js** (OSS, runs in the Node runtime, $0) or a free embeddings tier; optional **Mem0 OSS** / **Supermemory** adapters behind one interface.
- **Why:** the passport already holds curated memory; pgvector gives cheap semantic recall over bulk facts without a new vector DB. Keep the kernel the source of truth; vectors are an index.
- **Free limits:** pgvector = included in Supabase Postgres. Transformers.js = free (local compute). 
- **Plugs in:** a new migration adding a `vector` column + index on the memory/facts table (kernel-owned, additive); `lib/ai/embed.ts` (Transformers.js) feeding the Step-3 context packer (`lib/ai/context.ts`, live). Adapters: `lib/ai/memory/{mem0,supermemory}.ts`. **to add.**

## 4. Brains — OpenRouter :free default + MCP + BYOK + Ollama
- **What:** per-person brain (`lib/bot/brain.ts`, **live**): OpenRouter `:free` models as the default; Claude/ChatGPT/Gemini via MCP connectors; BYOK (sealed, capped); **Ollama** for local runs.
- **Why:** $0 default, user-owned compute, no lock-in.
- **Free limits:** OpenRouter `:free` models are **rate-limited upstream** (429s without credits) — NVIDIA Nemotron `:free` currently responds; Gemma `:free` is throttled. Set as default (`OPENROUTER_MODEL`/`_SMART` envs, **done**); reliability comes from BYOK/own-app.
- **Plugs in:** `lib/bot/brain.ts` + `lib/bot/chat.ts` tiering + `lib/bot/openrouter.ts`; Ollama = a base-URL swap in the OpenRouter client (OpenAI-compatible). `docs/how-to/connect-your-ai.md` (live). **partly live; route wiring to add.**

## 5. Realtime — Supabase Realtime (already used)
- **What:** Supabase Realtime broadcast + presence for rooms, approval cards, and move-based games.
- **Why:** already wired (`lib/world/presence.ts`, the `realtime.messages` policies in migrations 6/7); $0 on the current plan.
- **Free limits:** Supabase free: 200 concurrent realtime connections, 2M messages/month.
- **Plugs in:** existing `lib/world/` presence/collaboration; games broadcast validated moves. **live.**

## 6. Integrations — MCP first, then Nango, n8n/Zapier, browser agent
- **What:** remote **MCP servers** first (reuse the passport-link OAuth pattern, `lib/passport`); **Nango** (self-hosted, OSS) for OAuth APIs without MCP; **n8n** (self-hosted) or **Zapier MCP** as the long-tail bridge; a **Playwright** browser agent run locally, every submit behind an approval card.
- **Why:** MCP is the native, cheapest path; Nango/n8n are OSS/self-host ($0 infra on a small box); browser agent covers no-API portals.
- **Free limits:** Nango/n8n = free self-hosted (your compute). Zapier MCP = free tier. Playwright = free (`playwright-core` already a devDep).
- **Plugs in:** `lib/integrations/catalog.ts` (data-driven, to add) + the generic connect module reusing `lib/passport/client.ts`; browser agent in `lib/agent/browser.ts` (local). **to add (Milestone 2+).**

## 7. Ops — Upstash, Sentry, UptimeRobot, PostHog, Supabase Storage
- **What:** **Upstash Redis** (cross-instance rate limits + spend caps — replaces the in-memory limiter in `lib/bot/chat.ts`); **Sentry** (runtime errors); **UptimeRobot** (uptime on both live sites); **PostHog** (analytics — real outcomes only: activation, briefs read, moves approved); **Supabase Storage** (files/uploads).
- **Why:** all have real free tiers; close the gaps the plan flagged (in-memory limiter, no error alerting, no uptime, no analytics).
- **Free limits:** Upstash ≈ 500k commands/month; Sentry ≈ 5k errors/month; UptimeRobot 50 monitors/5-min; PostHog ≈ 1M events/month; Supabase Storage 1GB.
- **Plugs in:** `lib/ratelimit/` (Upstash) swapped into `lib/bot/chat.ts`; `sentry.*.config` + Vercel integration; UptimeRobot external; `lib/analytics/` (PostHog, consented); Storage via supabase-js. **to add.**

## 8. Later (only when needed + budgeted)
Persona / Stripe Identity (KYC), Stripe / Whop (real payments behind approval cards + money rules), WorkOS (SSO/SCIM for Company/Walled rooms), archive exports (Smarsh/Global Relay for Walled). **Not now.**

---

## Accounts / keys YOU create (one list)
I'll wire each once the key is in Vercel env. **Never paste secrets in chat — add them in the Vercel dashboard** (or tell me the exact var name and I'll remind you). Rotate anything already pasted.

**Needed for the first slice (Inngest + Web Push morning brief):**
1. **Inngest** account → `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY` (Vercel env, prod+preview).
2. **VAPID keys** for Web Push → `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (mailto:you@…). (I can generate the keypair for you to paste, or you generate it — you said you'll add them.)
3. **Resend** account (email fallback) → `RESEND_API_KEY`.

**Soon after:**
4. **Upstash Redis** → `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.
5. **Sentry** → `SENTRY_DSN` (+ auth token for source maps).
6. **PostHog** → `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`.
7. **UptimeRobot** → external only (add monitors for solve-sage.vercel.app + sovereign-passport.vercel.app), no repo key.

**Already set this session:** `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`/`_SMART` (free Nemotron). **Still needed (prior asks):** `SUPABASE_SECRET_KEY` (/mcp bot), `GITHUB_TOKEN`(+`GITHUB_ROOMS`) (Dev Room), Supabase Auth redirect `https://solve-sage.vercel.app/**`, `OPENAI_API_KEY` on the passport project (embeddings) — or use Transformers.js (#3) to avoid it.

**Self-hosted later (your own small box/VPS, $0 infra):** Nango, n8n, Ollama.

---

## Implementation order
1. **Inngest + Web Push → the morning brief** (free): Cron trigger → Inngest brief job (reuses `lib/bot/brief.ts`, writes via `propose_memory`) → Web Push "brief ready". *Blocked on keys #1–#2.*
2. Upstash rate limits (replace in-memory limiter), Sentry, UptimeRobot, PostHog.
3. pgvector + Transformers.js embeddings → bigger context recall.
4. `lib/integrations/catalog.ts` + Nango/MCP connect; brain route wiring (free default + per-person).
5. Realtime games/cards polish; browser agent behind approvals.
6. Later: identity/payments/SSO when a real outcome needs them.
