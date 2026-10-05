import type { Metadata } from "next";
import { VenturePage } from "../venture-template";
import { getVenture } from "../ventures";
import { Dialer } from "./dialer";

const venture = getVenture("insurance");

export const metadata: Metadata = { title: venture.metaTitle, description: venture.metaDescription };

export default function Page() {
  return (
    <VenturePage slug="insurance">
      <Dialer />
    </VenturePage>
  );
}
