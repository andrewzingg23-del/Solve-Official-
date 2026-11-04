import type { Metadata, Viewport } from "next";
import { SovExperience } from "./experience";
import "./experience.css";

export const metadata: Metadata = { title: "SOV — Your space", description: "One trusted SOV. Your space, your expression. Device-only experience preview.", robots: { index: false, follow: false } };
export const viewport: Viewport = { viewportFit: "cover" };
export default function SovPreview() { return <SovExperience />; }
