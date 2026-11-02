import "server-only";
import { cache } from "react";
import { getKernel } from "@/lib/kernel/server";
import { loadBot } from "@/lib/bot/store";

// Per-render reuse of the caller's own persona only. No directory or member reads.
export const getPersonalBot = cache(async () => loadBot(await getKernel()));
