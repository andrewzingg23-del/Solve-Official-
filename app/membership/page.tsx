import type { Metadata } from "next";
import { VenturePage } from "../venture-template";
import { getVenture } from "../ventures";
import { Oath } from "../venture-tools";
import { MembershipOffer } from "./offer";

const venture = getVenture("membership");

export const metadata: Metadata = { title: venture.metaTitle, description: venture.metaDescription };

export default function Page() {
  return (
    <VenturePage slug="membership">
      <Oath />
      <MembershipOffer />
    </VenturePage>
  );
}
