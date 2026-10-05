// Serves a part designed in a World as an STL for the person's slicer. Read with their own
// sign-in, so the kernel decides whether they may see that World.
import { KernelError } from "@/lib/kernel/client";
import { getKernel } from "@/lib/kernel/server";
import { getUser } from "@/lib/supabase/server";
import { partFile } from "@/lib/bot/part";

export const dynamic = "force-dynamic";
const text = (body: string, status: number) => new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });

export async function GET(_request: Request, { params }: { params: Promise<{ worldId: string; file: string }> }) {
  const { worldId, file } = await params;
  if (!(await getUser().catch(() => null))) return text("Sign in to download this part.", 401);
  try {
    const found = await partFile(await getKernel(), worldId, file);
    if (!found) return text("No part here.", 404);
    return new Response(Buffer.from(found.bytes), {
      headers: {
        "Content-Type": "model/stl",
        "Content-Disposition": `attachment; filename="${found.filename}"`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof KernelError && (error.name === "forbidden" || error.name === "not_found" || error.name === "invalid")) return text("No part here.", 404);
    throw error;
  }
}
