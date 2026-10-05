import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import { deskCommunityId } from "@/lib/solar/desk";
import { getUser } from "@/lib/supabase/server";
import { VenturePage } from "../venture-template";
import { getVenture } from "../ventures";
import { requestDesignAction } from "./actions";
import { SolarTool, type SolarStart } from "./tool";

const venture = getVenture("solar");

export const metadata: Metadata = { title: venture.metaTitle, description: venture.metaDescription };

const ERRORS: Record<string, string> = {
  offline: "Zest Solar's design desk isn't open yet. Your numbers above are yours to keep.",
  consent: "Tick the box so Zest Solar may use your details for your design.",
  input: "Check your name and full address (street, city, state and ZIP), and your email or phone if you gave one.",
  save: "That didn't go through. Nothing was sent; try again in a moment.",
};

const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

// A homeowner who signs in partway comes back with their numbers: the sign-in link carries them.
function startFrom(q: Record<string, string | string[] | undefined>): SolarStart | undefined {
  const bill = Number(one(q.bill));
  if (!Number.isFinite(bill) || bill <= 0) return undefined;
  let answers: SolarStart["answers"] = {};
  try {
    answers = JSON.parse(one(q.a) ?? "{}");
  } catch {}
  return { bill, kwh: (one(q.kwh) ?? "").replace(/[^0-9]/g, "").slice(0, 5), answers };
}

export default async function Page({ searchParams }: PageProps<"/solar">) {
  const q = await searchParams;
  const error = one(q.error);
  const user = await getUser();
  return (
    <VenturePage slug="solar">
      <SolarTool
        desk={deskCommunityId() !== null}
        signedIn={Boolean(user)}
        request={requestDesignAction}
        requestId={randomUUID()}
        start={startFrom(q)}
        error={error ? ERRORS[error] ?? ERRORS.save : null}
      />
    </VenturePage>
  );
}
