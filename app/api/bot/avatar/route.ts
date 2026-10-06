import { getUser } from "@/lib/supabase/server";
import {
  HIGGSFIELD_MODEL_ENDPOINT,
  portraitRequestId,
  portraitResult,
  providerErrorStatus,
  validatePortraitPrompt,
} from "@/lib/bot/higgsfield";

export const dynamic = "force-dynamic";
const STATUS_ENDPOINT = "https://api.higgsfield.ai/requests";
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET() {
  if (!(await getUser().catch(() => null))) return json({ error: "Sign in." }, 401);
  return json({ serverKey: Boolean(process.env.HIGGSFIELD_API_KEY?.trim()) });
}

export async function POST(request: Request) {
  if (!(await getUser().catch(() => null))) return json({ error: "Sign in to generate a portrait." }, 401);
  let body: unknown;
  try { body = await request.json(); } catch { return json({ error: "Send a valid JSON request." }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "Send a valid request." }, 400);
  const action = (body as Record<string, unknown>).action;
  // Server key first (one-tap), user key as fallback.
  const serverKey = process.env.HIGGSFIELD_API_KEY?.trim() || null;
  const withKey = (input: { apiKey?: string }) => input.apiKey?.trim() || serverKey;

  if (action === "generate") {
    const prompt = validatePortraitPrompt(body);
    if (!prompt) return json({ error: "Write a prompt of 1,000 characters or fewer." }, 400);
    const apiKey = withKey(body as { apiKey?: string });
    if (!apiKey) return json({ error: "Portrait generation isn't configured yet." }, 503);
    try {
      const response = await fetch(HIGGSFIELD_MODEL_ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Key ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, batch_size: 1, resolution: "720p", aspect_ratio: "1:1", enhance_prompt: true }),
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) {
        const failure = providerErrorStatus(response.status);
        return json({ error: failure.message }, failure.status);
      }
      const result: unknown = await response.json();
      const requestId = portraitRequestId(result);
      if (!requestId) {
        const immediate = portraitResult(result);
        return immediate.status === "completed" ? json(immediate) : json({ error: "Higgsfield returned an unexpected response." }, 502);
      }
      return json({ status: "processing", requestId });
    } catch {
      return json({ error: "Could not reach Higgsfield. No automatic retry was made." }, 502);
    }
  }

  if (action === "status") {
    const rec = body as Record<string, unknown>;
    const requestId = typeof rec.requestId === "string" ? rec.requestId : "";
    if (!requestId) return json({ error: "The generation request is invalid." }, 400);
    const apiKey = withKey(rec as { apiKey?: string });
    if (!apiKey) return json({ error: "Portrait generation isn't configured yet." }, 503);
    try {
      const response = await fetch(`${STATUS_ENDPOINT}/${encodeURIComponent(requestId)}/status`, {
        headers: { Authorization: `Key ${apiKey}` },
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        const failure = providerErrorStatus(response.status);
        return json({ error: failure.message }, failure.status);
      }
      return json(portraitResult(await response.json()));
    } catch {
      return json({ error: "Could not check the Higgsfield request. Try again." }, 502);
    }
  }

  return json({ error: "Choose a supported action." }, 400);
}
