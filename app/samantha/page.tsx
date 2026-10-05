import type { Metadata } from "next";
import { VenturePage } from "../venture-template";
import { getVenture } from "../ventures";

const venture = getVenture("samantha");

export const metadata: Metadata = {
  title: venture.metaTitle,
  description: venture.metaDescription,
};

export default function Page() {
  return <VenturePage slug="samantha" />;
}
