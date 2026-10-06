import { redirect } from "next/navigation";

// Claiming now lives in the guided flow at /start (step: sovid).
export default function ClaimPage() {
  redirect("/start?step=sovid");
}
