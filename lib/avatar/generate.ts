import "server-only";

// AI face generation via Higgsfield (text-to-image).
// Async lifecycle: submit → poll status_url → completed/failed/nsfw.
// Costs Higgsfield credits on Drew's account; one face per request.

const FACE_MODEL = "higgsfield-ai/soul/v2/standard";

function splitCredentials(): { apiKey: string; apiSecret: string } | null {
  const raw = process.env.HF_CREDENTIALS || process.env.HF_KEY || process.env.HIGGSFIELD_API_KEY;
  if (!raw?.trim()) return null;
  const parts = raw.trim().split(":");
  if (parts.length === 2 && parts[0] && parts[1]) return { apiKey: parts[0], apiSecret: parts[1] };
  return null;
}

export function faceGenerationConfigured(): boolean {
  return splitCredentials() !== null;
}

function authHeaders(): Record<string, string> {
  const c = splitCredentials();
  if (!c) throw new Error("Face generation is not set up yet.");
  return { "hf-api-key": c.apiKey, "hf-api-secret": c.apiSecret };
}

export async function submitFaceJob(userPrompt: string): Promise<{ jobId: string; statusUrl: string }> {
  const clean = userPrompt.trim().slice(0, 300);
  if (!clean) throw new Error("Describe the face first.");
  if (!faceGenerationConfigured()) throw new Error("Face generation is not set up yet.");
  const { higgsfield, config } = await import("@higgsfield/client/v2");
  const raw = (process.env.HF_CREDENTIALS || process.env.HF_KEY || process.env.HIGGSFIELD_API_KEY || "").trim();
  config({ credentials: raw });
  const prompt =
    `Photorealistic portrait, head and shoulders, centered, facing the camera. ` +
    `${clean}. Dramatic half-shadow cinematic lighting, deep black background, ` +
    `subtle cyan rim light on one side of the face.`;
  const res = await higgsfield.subscribe(FACE_MODEL, {
    input: { prompt, aspect_ratio: "1:1", safety_tolerance: 2 },
    withPolling: false,
  });
  if (!res.request_id) throw new Error("Couldn't start the generation. Try again.");
  return { jobId: res.request_id, statusUrl: res.status_url };
}

export type FaceJobStatus =
  | { status: "pending" }
  | { status: "completed"; url: string }
  | { status: "failed"; error: string };

export async function faceJobStatus(statusUrl: string): Promise<FaceJobStatus> {
  const res = await fetch(statusUrl, { headers: authHeaders(), cache: "no-store" });
  if (!res.ok) throw new Error("Couldn't check the generation. Try again.");
  const body = (await res.json()) as { status?: string; images?: { url: string }[] };
  const status = body.status ?? "pending";
  if (status === "completed") {
    const url = body.images?.[0]?.url;
    if (!url || !url.startsWith("https://")) return { status: "failed", error: "The generation finished with no image." };
    return { status: "completed", url };
  }
  if (status === "failed" || status === "nsfw") {
    return {
      status: "failed",
      error: status === "nsfw" ? "That prompt was rejected. Try another." : "The generation failed. Try again.",
    };
  }
  return { status: "pending" };
}
