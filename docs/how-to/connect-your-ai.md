# Connect your AI to Solve

Use the AI you already pay for — Claude, ChatGPT or Gemini — as **Your AI's brain**. It connects to two MCP servers so it shares one memory with you:

- **Your SOV Passport** (who you are, your projects, your preferences): `https://sovereign-passport.vercel.app/mcp`
- **Solve** (your Worlds, projects, approvals, morning-brief data): `https://solve-sage.vercel.app/mcp`

Both use OAuth — you approve access with your passkey/sign-in; you can revoke any time. **Reading is automatic; anything that acts (send, post, spend) waits for a "Do it / Change it" approval in Solve.** Your choice of brain never changes Solve's memory, projects or approvals.

> Copy buttons for both addresses are in the app: **Your AI → Brain → Connect**.

---

## Claude (Claude Pro / Team — claude.ai or desktop)
1. Open **Settings → Connectors** (desktop: Settings → Connectors; web: your profile → Settings → Connectors).
2. **Add custom connector** → paste `https://sovereign-passport.vercel.app/mcp` → **Add**.
3. **Add custom connector** again → paste `https://solve-sage.vercel.app/mcp` → **Add**.
4. For each, click **Connect** and approve with your passkey/sign-in.
5. In a chat, enable both connectors (the plug/tools icon). Ask: *"What's on my Solve morning brief?"* — it should read it.

## ChatGPT (Plus / Pro / Team — with connectors/MCP enabled)
1. **Settings → Connectors** (or, in a Project/GPT, **Configure → Add MCP server**).
2. Add server URL `https://sovereign-passport.vercel.app/mcp`, auth **OAuth**, and authorize.
3. Add server URL `https://solve-sage.vercel.app/mcp`, auth **OAuth**, and authorize.
4. Start a chat with the connectors on and ask it to *list my Solve projects*.

> If your ChatGPT plan/region doesn't expose custom MCP servers yet, use **Your own API key** or **Solve's free AI** in Your AI → Brain instead.

## Gemini (via an MCP-capable client)
Gemini apps don't accept arbitrary remote MCP servers directly yet. Two supported paths:
1. **Gemini API key** → Your AI → Brain → *Your own API key* → Google. (Sealed, capped.)
2. A desktop MCP client that supports Gemini + remote servers (e.g., an MCP host) → add the two URLs above.

---

## If you don't use any of these
Pick **Solve's free AI** in Your AI → Brain (free models, a daily limit, a plain message when you hit it), or **Your own API key** (OpenAI / Anthropic / Google / OpenRouter — sealed like your passport tokens, with a spend cap you set). You can mix: e.g. your Claude app for work, Solve's free AI inside Solve.

## What your AI can do through Solve's `/mcp`
- `get the morning brief` — one call returns what's waiting, next moves and recent changes.
- `list / read projects`, `add to a project`.
- `propose a memory` to your passport (lands in your review queue — never written directly).
- act on an approval card — **only after you approve it in Solve**.

Switch or disconnect any brain any time in **Your AI → Brain**. Room rules may limit brains (kid rooms: free or parent-approved; company rooms: an admin-approved list).
