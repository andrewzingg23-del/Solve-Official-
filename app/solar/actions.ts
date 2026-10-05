"use server";

import { redirect } from "next/navigation";
import { getKernel } from "@/lib/kernel/server";
import { getUser } from "@/lib/supabase/server";
import { readCommunity } from "@/lib/community/community";
import { deskCommunityId, DeskInputError, eraseDesign, requestDesign } from "@/lib/solar/desk";

const text = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");

function answersFrom(v: FormDataEntryValue | null): unknown {
  try {
    return JSON.parse(text(v) || "{}");
  } catch {
    return {};
  }
}

// The homeowner asks Zest Solar for their real design. Their details are sealed for Zest Solar alone
// (lib/solar/desk.ts); the design comes back to their own page.
export async function requestDesignAction(formData: FormData) {
  if (!(await getUser())) redirect("/login?next=%2Fsolar");
  const deskId = deskCommunityId();
  if (!deskId) redirect("/solar?error=offline#design");
  let code: string | null = null;
  try {
    const kernel = await getKernel();
    const desk = await readCommunity(kernel, deskId);
    if (!desk) code = "offline";
    else {
      await requestDesign(kernel, desk, {
        name: text(formData.get("name")),
        address: text(formData.get("address")),
        phone: text(formData.get("phone")),
        email: text(formData.get("email")),
        monthlyBill: text(formData.get("monthlyBill")),
        monthlyKwh: text(formData.get("monthlyKwh")),
        answers: answersFrom(formData.get("answers")),
        consent: formData.get("consent") === "on",
      }, text(formData.get("requestId")));
    }
  } catch (error) {
    code = error instanceof DeskInputError ? (error.message === "your consent" ? "consent" : "input") : "save";
  }
  if (code) redirect(`/solar?error=${code}#design`);
  redirect("/solar/mine?sent=1");
}

export async function eraseDesignAction(formData: FormData) {
  if (!(await getUser())) redirect("/login?next=%2Fsolar%2Fmine");
  const deskId = deskCommunityId();
  let ok = false;
  try {
    const kernel = await getKernel();
    const desk = deskId ? await readCommunity(kernel, deskId) : null;
    if (desk) {
      await eraseDesign(kernel, desk, text(formData.get("askId")));
      ok = true;
    }
  } catch {}
  redirect(`/solar/mine?${ok ? "erased=1" : "error=erase"}`);
}
