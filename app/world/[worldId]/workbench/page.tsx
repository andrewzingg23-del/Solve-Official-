import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { KernelError } from "@/lib/kernel/client";
import { getKernel } from "@/lib/kernel/server";
import { getUser } from "@/lib/supabase/server";
import { loadCreativeWorld } from "@/lib/world/creative";
import { isRealityMode } from "@/app/reality/mode";
import { Workbench } from "./workbench";
import "@/app/reality/reality.css";

export const metadata: Metadata = { title: "Workbench · SOLVE" };

export default async function WorldWorkbenchPage({ params }: PageProps<"/world/[worldId]/workbench">) {
  const { worldId } = await params;
  const user = await getUser();
  if (!user || user.is_anonymous) redirect("/login?next=" + encodeURIComponent("/world/" + worldId + "/workbench"));
  let data: Awaited<ReturnType<typeof loadCreativeWorld>>;
  try {
    data = await loadCreativeWorld(await getKernel(), worldId);
  } catch (error) {
    if (error instanceof KernelError && (error.name === "forbidden" || error.name === "not_found" || error.name === "invalid")) notFound();
    return <main className="reality-workbench" style={{ padding: "clamp(25px,5vw,80px)" }}>
      <h1>Workbench is temporarily unavailable.</h1><p>Your World was not deleted. Please reopen it when the connection is restored.</p>
      <a href="/">Return to SOLVE</a>
    </main>;
  }
  const candidate: unknown = user.user_metadata?.solve_reality_mode_v1;
  return <Workbench
    worldId={data.world.worldId}
    title={data.world.title}
    summary={data.world.summary}
    mode={isRealityMode(candidate) ? candidate : "base"}
    pieces={data.artifacts.map(piece => ({
      id: piece.entityId, title: piece.title, body: piece.body,
      x: piece.position.x, y: piece.position.y, version: piece.version,
    }))}
  />;
}
