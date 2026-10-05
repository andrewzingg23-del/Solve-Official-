import type { Metadata } from "next";
import { VenturePage } from "../venture-template";
import { getVenture } from "../ventures";
import { BreakEvenTool } from "../venture-tools";

const venture = getVenture("meta-ads");

export const metadata: Metadata = { title: venture.metaTitle, description: venture.metaDescription };

export default function Page() {
  return <VenturePage slug="meta-ads"><BreakEvenTool /></VenturePage>;
}
