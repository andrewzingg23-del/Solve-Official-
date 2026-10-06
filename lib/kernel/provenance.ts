// Provenance stamps for AI-generated content (watermark-ready).
//
// Invisible watermark detectors (OpenAI textGrain, Anthropic's) are not
// generally available yet. When one ships, register it here and every
// stampContent call runs it — the pipeline shape is the point, so AI
// output already flows through exactly one stamping point.
//
// Until a detector is registered the registry is empty and content passes
// through unstamped. Nothing claims provenance it cannot verify.

import { createHash } from "node:crypto";
import type { kernelClient } from "@/lib/kernel/client";

type Kernel = ReturnType<typeof kernelClient>;

export type ProvenanceSignal = "ai-generated" | "human" | "unknown";

export type ProvenanceStamp = {
  /** Detector that produced this stamp, e.g. "textgrain-v1". */
  detector: string;
  signal: ProvenanceSignal;
  /** 0..1. Below 0.5 the stamp is informational, not a claim. */
  confidence: number;
  detail?: string;
};

export type WatermarkDetector = {
  name: string;
  detect: (text: string) => ProvenanceStamp | null;
};

const detectors: WatermarkDetector[] = [];

/** Plug in a watermark detector when one becomes available. */
export function registerDetector(detector: WatermarkDetector): void {
  if (!detectors.some((d) => d.name === detector.name)) detectors.push(detector);
}

export function clearDetectors(): void {
  detectors.length = 0;
}

export function detectorNames(): string[] {
  return detectors.map((d) => d.name);
}

/** Run every registered detector over the text. Empty registry → []. */
export function stampContent(text: string): ProvenanceStamp[] {
  if (!text) return [];
  const stamps: ProvenanceStamp[] = [];
  for (const d of detectors) {
    try {
      const stamp = d.detect(text);
      if (stamp) stamps.push(stamp);
    } catch {
      // A broken detector must never block the pipeline.
    }
  }
  return stamps;
}

/**
 * Stamp AI-generated text and attach the stamps as evidence on its kernel
 * event, so the provenance travels with the record. Returns the stamps;
 * with no detectors registered this is a no-op that returns [].
 */
export async function recordProvenance(
  client: Kernel,
  eventId: string,
  text: string,
  idempotencyKey?: string,
): Promise<ProvenanceStamp[]> {
  const stamps = stampContent(text);
  if (!stamps.length) return [];
  const contentHash: `sha256:${string}` =
    `sha256:${createHash("sha256").update(text, "utf8").digest("hex")}`;
  for (const stamp of stamps) {
    await client.attachEvidence(
      eventId,
      {
        basis: "system_observed",
        content_hash: contentHash,
        media_type: "application/json",
        description: `provenance:${stamp.detector}:${stamp.signal}:${stamp.confidence}`,
      },
      idempotencyKey ? `${idempotencyKey}:${stamp.detector}` : undefined,
    );
  }
  return stamps;
}
