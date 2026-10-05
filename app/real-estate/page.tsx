import type { Metadata } from "next";
import { VenturePage } from "../venture-template";
import { getVenture } from "../ventures";
import { DevelopmentModel } from "./model";

const venture = getVenture("real-estate");

export const metadata: Metadata = { title: venture.metaTitle, description: venture.metaDescription };

export default function Page() {
  return (
    <VenturePage slug="real-estate">
      <div id="model" className="scroll-mt-6">
        <DevelopmentModel />
      </div>
    </VenturePage>
  );
}
