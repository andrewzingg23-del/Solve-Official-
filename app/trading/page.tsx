import type { Metadata } from "next";
import { VenturePage } from "../venture-template";
import { getVenture } from "../ventures";
import { PositionSizer } from "../venture-tools";

const venture = getVenture("trading");

export const metadata: Metadata = { title: venture.metaTitle, description: venture.metaDescription };

export default function Page() {
  return <VenturePage slug="trading"><PositionSizer /></VenturePage>;
}
