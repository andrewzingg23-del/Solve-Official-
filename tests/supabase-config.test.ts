// Which Supabase project the app talks to: previews on solve-staging, production and local on their
// own settings, and the server key only ever for the same project as the URL.
import assert from "node:assert/strict";
import { it } from "node:test";
import { pickSupabase, STAGING } from "../lib/supabase/config";

const MAIN = "https://dupgybzkkbddsbaykrae.supabase.co";

it("runs previews on staging and everything else on the deployment's own settings", () => {
  const preview = pickSupabase({ deploy: "preview", url: MAIN, publishableKey: "sb_publishable_main" });
  assert.deepEqual([preview.onStaging, preview.url, preview.publishableKey], [true, STAGING.url, STAGING.publishableKey]);
  const production = pickSupabase({ deploy: "production", url: MAIN, publishableKey: "sb_publishable_main" });
  assert.deepEqual([production.onStaging, production.url, production.publishableKey], [false, MAIN, "sb_publishable_main"]);
  const local = pickSupabase({ url: "http://127.0.0.1:54321", publishableKey: "local" });
  assert.equal(local.url, "http://127.0.0.1:54321");
  assert.equal(pickSupabase({}).url, "", "unset stays unset, so the setup notice shows");
});

it("never pairs one project's URL with another project's server key", () => {
  assert.equal(pickSupabase({ deploy: "preview", url: MAIN, secretKey: "main-secret" }).serviceKey, null, "a preview pointed at staging must not use the main store's key");
  assert.equal(pickSupabase({ deploy: "preview", url: MAIN, secretKey: "main-secret", stagingSecretKey: "staging-secret" }).serviceKey, "staging-secret");
  assert.equal(pickSupabase({ deploy: "preview", url: STAGING.url, secretKey: "staging-secret" }).serviceKey, "staging-secret", "a preview already set up for staging keeps its key");
  assert.equal(pickSupabase({ deploy: "production", url: MAIN, secretKey: "main-secret", stagingSecretKey: "staging-secret" }).serviceKey, "main-secret");
});
