import type { Metadata } from "next";
import { auroraFromEnv } from "@/lib/solar/aurora";
import { VenturePage } from "../venture-template";
import { getVenture } from "../ventures";
import { requestDesignAction } from "./actions";
import { SolarTool } from "./tool";

const venture = getVenture("solar");

export const metadata: Metadata = { title: venture.metaTitle, description: venture.metaDescription };

const ERRORS: Record<string, string> = {
  offline: "Design requests aren't connected yet. Your numbers above are yours to keep.",
  consent: "Tick the box so Zest Solar may use your details for your design.",
  input: "Check your name, email, phone and full address.",
  address: "Aurora couldn't place that address. Check it, with the city, state and ZIP.",
  aurora: "Aurora didn't answer. Nothing was sent; try again in a moment.",
};

export default async function Page({ searchParams }: PageProps<"/solar">) {
  const { error, requested } = await searchParams;
  const message = typeof error === "string" ? ERRORS[error] ?? null : requested ? "Requested. Zest Solar has your address and will design your roof." : null;
  return (
    <VenturePage slug="solar">
      <SolarTool connected={auroraFromEnv() !== null} request={requestDesignAction} error={message} />
    </VenturePage>
  );
}
