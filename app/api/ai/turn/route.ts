import { getUser } from "@/lib/supabase/server";
import { getKernel } from "@/lib/kernel/server";
import { createConsoleHandler } from "@/lib/ai/turn";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = createConsoleHandler({ getUser, getKernel, env: process.env });
