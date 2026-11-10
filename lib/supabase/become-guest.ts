import { registerGuest } from "@/app/guest-actions";
import { createClient } from "./client";

// Gives this browser a guest identity when the server couldn't.
//
// The proxy makes every visitor a guest on the server, but on a deployment all of those sign-ins
// come from the server's own address, so Supabase's per-address limit on new guests is shared by
// every visitor at once. When it trips, people were sent to a sign-in screen they never asked for.
// Making the guest from the browser counts against the visitor's own address instead, and nobody is
// ever asked to sign in just to start.
export async function becomeGuest(): Promise<boolean> {
  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) return false;
    }
    return (await registerGuest()).ok;
  } catch {
    return false;
  }
}
