// Forgets solve's passport tokens for good (their key is destroyed). POST only.
import { NextResponse } from "next/server";
import { unlink } from "@/lib/passport/link";
import { getKernel } from "@/lib/kernel/server";
import { getUser } from "@/lib/supabase/server";
import { back } from "../shared";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  // Only this site's own form may unlink (a cross-site post is refused).
  const from = request.headers.get("origin");
  if (from && from !== origin) return new NextResponse(null, { status: 403 });
  if (!(await getUser().catch(() => null))) return NextResponse.redirect(`${origin}/login`, 303);
  try {
    const kernel = await getKernel();
    await unlink(kernel, (await kernel.whoami()).actor_id);
    return NextResponse.redirect(back(origin, "unlinked"), 303);
  } catch {
    return NextResponse.redirect(back(origin, "unavailable"), 303);
  }
}
