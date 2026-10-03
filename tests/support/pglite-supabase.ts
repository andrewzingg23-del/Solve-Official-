// A SupabaseClient stand-in that sends kernel_api RPCs to the PGlite kernel the way PostgREST
// would: scalar functions return the value, set-returning functions return rows, and SQLSTATEs
// come back as { error: { code, message } }. Lets tests drive the real typed client.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { KernelDb, Session } from "../kernel/harness";

export function pgliteSupabase(k: KernelDb, session: Session): SupabaseClient {
  const client = {
    schema(name: string) {
      if (name !== "kernel_api") throw new Error(`unexpected schema ${name}`);
      return {
        async rpc(fn: string, args: Record<string, unknown>) {
          try {
            const rows = await k.rpc(session, fn, args);
            const data = (await k.returnsSet(fn)) ? rows : rows[0] ? Object.values(rows[0])[0] : null;
            return { data, error: null };
          } catch (error) {
            const { code, message } = error as { code?: string; message: string };
            return { data: null, error: { code, message } };
          }
        },
      };
    },
  };
  return client as unknown as SupabaseClient;
}
