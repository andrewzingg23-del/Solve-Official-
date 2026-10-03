// Browser client for Client Components. Row Level Security applies as the signed-in user.
import { createBrowserClient } from "@supabase/ssr";
import { supabasePublishableKey, supabaseUrl } from "./config";

export function createClient() {
  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}
