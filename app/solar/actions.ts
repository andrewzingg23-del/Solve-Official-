"use server";

import { redirect } from "next/navigation";
import { auroraFromEnv, AuroraError, createProject, proposalToken } from "@/lib/solar/aurora";
import { SOLAR_LIMITS } from "@/lib/solar/estimate";

const text = (v: FormDataEntryValue | null, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max) : "");
const linkSecret = () => process.env.SOLAR_LINK_SECRET || process.env.SUPABASE_SECRET_KEY || null;

// The homeowner asks for their real design: a project in the installer's Aurora account, with their
// consent. They land on their own proposal page, which reads the design back as it's made.
export async function requestDesignAction(formData: FormData) {
  const aurora = auroraFromEnv();
  if (!aurora) redirect("/solar?error=offline#numbers");
  const r = {
    firstName: text(formData.get("firstName"), 60),
    lastName: text(formData.get("lastName"), 60),
    email: text(formData.get("email"), 120),
    phone: text(formData.get("phone"), 30),
    address: text(formData.get("address"), 200),
  };
  const bill = Number(formData.get("monthlyBill"));
  const kwhRaw = Number(formData.get("monthlyKwh"));
  if (!formData.get("consent")) redirect("/solar?error=consent#numbers");
  if (!r.firstName || !r.lastName || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.email) || r.phone.replace(/\D/g, "").length < 7 || r.address.length < 8) {
    redirect("/solar?error=input#numbers");
  }
  const monthlyBill = Number.isFinite(bill) ? Math.min(SOLAR_LIMITS.bill[1], Math.max(SOLAR_LIMITS.bill[0], Math.round(bill))) : 220;
  const monthlyKwh = Number.isFinite(kwhRaw) && kwhRaw >= SOLAR_LIMITS.kwh[0] ? Math.min(SOLAR_LIMITS.kwh[1], Math.round(kwhRaw)) : null;

  let projectId: string;
  try {
    projectId = await createProject(aurora, r);
  } catch (error) {
    redirect(`/solar?error=${error instanceof AuroraError && error.reason === "rejected" ? "address" : "aurora"}#numbers`);
  }
  const secret = linkSecret();
  if (!secret) redirect("/solar?requested=1#numbers");
  redirect(`/solar/proposal/${proposalToken(secret, { projectId, monthlyBill, monthlyKwh })}`);
}
