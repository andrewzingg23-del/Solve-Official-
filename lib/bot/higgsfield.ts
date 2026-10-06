// Higgsfield's paid image generation is an optional visual tool; it never changes the kernel persona.
export const HIGGSFIELD_MODEL_ENDPOINT = "https://api.higgsfield.ai/higgsfield-ai/soul/v2/standard";

export type PortraitInput = { apiKey: string; prompt: string };
export type PortraitStatus = { status: "processing" | "completed" | "failed"; imageUrl?: string };

type RecordValue = Record<string, unknown>;
const isRecord = (value: unknown): value is RecordValue => Boolean(value && typeof value === "object" && !Array.isArray(value));

// The provider key is user supplied and transient. Accept the whole copied key without assuming
// its internal format; never normalize, store, or return it.
export function validatePortraitPrompt(input: unknown): string | null {
  if (!isRecord(input)) return null;
  const prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
  if (!prompt || prompt.length > 1000) return null;
  return prompt;
}

export function validatePortraitRequest(input: unknown): PortraitInput | null {
  if (!isRecord(input)) return null;
  const apiKey = input.apiKey;
  const prompt = typeof input.prompt === "string" ? input.prompt.trim() : "";
  if (typeof apiKey !== "string" || apiKey.length < 20 || apiKey.length > 512 || /[\u0000-\u0020\u007f]/.test(apiKey)) return null;
  if (!prompt || prompt.length > 1000) return null;
  return { apiKey, prompt };
}

export function validatePortraitStatusRequest(input: unknown): { apiKey: string; requestId: string } | null {
  if (!isRecord(input)) return null;
  const apiKey = input.apiKey;
  const requestId = input.requestId;
  if (typeof apiKey !== "string" || apiKey.length < 20 || apiKey.length > 512 || /[\u0000-\u0020\u007f]/.test(apiKey)) return null;
  if (typeof requestId !== "string" || !/^[A-Za-z0-9_-]{8,128}$/.test(requestId)) return null;
  return { apiKey, requestId };
}

// Normalize only the fields the UI needs. Do not expose provider error bodies or arbitrary URLs.
export function portraitResult(body: unknown): PortraitStatus {
  const root = isRecord(body) && isRecord(body.data) ? body.data : body;
  if (!isRecord(root)) return { status: "processing" };
  const status = typeof root.status === "string" ? root.status.toLowerCase() : "";
  if (status === "completed") {
    const images = Array.isArray(root.images) ? root.images : [];
    const candidate = images.length && isRecord(images[0]) && typeof images[0].url === "string" ? images[0].url : "";
    try {
      const url = new URL(candidate);
      if (url.protocol === "https:" && !url.username && !url.password) return { status: "completed", imageUrl: url.toString() };
    } catch { /* An unusable provider URL is a failed result. */ }
    return { status: "failed" };
  }
  if (["failed", "nsfw", "canceled", "cancelled"].includes(status)) return { status: "failed" };
  return { status: "processing" };
}

export function portraitRequestId(body: unknown): string | null {
  const root = isRecord(body) && isRecord(body.data) ? body.data : body;
  if (!isRecord(root) || typeof root.request_id !== "string") return null;
  return /^[A-Za-z0-9_-]{8,128}$/.test(root.request_id) ? root.request_id : null;
}

export function providerErrorStatus(status: number): { status: number; message: string } {
  if (status === 401 || status === 403) return { status: 400, message: "Higgsfield rejected that API key. Check it and try again." };
  if (status === 429) return { status: 429, message: "Higgsfield rate limited this request. Try again later." };
  return { status: 502, message: "Higgsfield could not complete the request. Try again later." };
}
