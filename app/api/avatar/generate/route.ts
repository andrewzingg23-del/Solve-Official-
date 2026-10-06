import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { faceGenerationConfigured, submitFaceJob, faceJobStatus } from "@/lib/avatar/generate";

// In-memory job registry: jobId → statusUrl. Enough for one onboarding session;
// the client holds the jobId while polling.
const jobs = new Map<string, string>();

// Simple per-IP throttle: 5 generations per hour.
const starts = new Map<string, number[]>();
function throttled(ip: string): boolean {
  const now = Date.now();
  const window = (starts.get(ip) ?? []).filter((t) => now - t < 3_600_000);
  if (window.length >= 5) return false;
  window.push(now);
  starts.set(ip, window);
  return true;
}

function clientIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

// POST { prompt } → { jobId } — starts a face generation.
export async function POST(request: Request) {
  const user = await getUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Sign in to shape your bot." }, { status: 401 });
  if (!faceGenerationConfigured())
    return NextResponse.json({ error: "Face generation is not set up yet." }, { status: 503 });
  if (!throttled(clientIp(request)))
    return NextResponse.json({ error: "Slow down — 5 faces an hour." }, { status: 429 });
  const body = (await request.json().catch(() => null)) as { prompt?: unknown } | null;
  const prompt = typeof body?.prompt === "string" ? body.prompt : "";
  try {
    const { jobId, statusUrl } = await submitFaceJob(prompt);
    jobs.set(jobId, statusUrl);
    return NextResponse.json({ jobId });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't start." }, { status: 500 });
  }
}

// GET ?jobId= → { status, url? } — polls a running generation.
export async function GET(request: Request) {
  const user = await getUser().catch(() => null);
  if (!user) return NextResponse.json({ error: "Sign in to shape your bot." }, { status: 401 });
  const jobId = new URL(request.url).searchParams.get("jobId") ?? "";
  const statusUrl = jobs.get(jobId);
  if (!statusUrl) return NextResponse.json({ error: "Unknown generation." }, { status: 404 });
  try {
    const result = await faceJobStatus(statusUrl);
    if (result.status !== "pending") jobs.delete(jobId);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Couldn't check." }, { status: 500 });
  }
}
