import type { Metadata } from "next";
import { VenturePage } from "../venture-template";
import { getVenture } from "../ventures";
import { MissedCallsTool } from "../venture-tools";

const venture = getVenture("samantha");

export const metadata: Metadata = { title: venture.metaTitle, description: venture.metaDescription };

export default function Page() {
  return <VenturePage slug="samantha"><MissedCallsTool /></VenturePage>;
}
