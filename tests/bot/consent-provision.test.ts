// Authorizing an assistant must not require building a bot by hand first. Approving consent
// provisions the person's default companion through the same authenticated kernel path /bot uses,
// so ownership and authority are identical to a save made on the bot page. Real kernel, no fakes.
import assert from "node:assert/strict";
import { it } from "node:test";
import { kernelClient } from "../../lib/kernel/client";
import { localSupabase } from "../../lib/kernel/local";
import { DEFAULT_PERSONA } from "../../lib/bot/persona";
import { companionOf, loadBot, saveBot } from "../../lib/bot/store";
import { createKernelDb, user } from "../kernel/harness";

// The id Supabase mints for an authorization request: 32 lowercase alphanumerics.
const authorizationId = "jo5jtaz44x5by5ngdvsqimvxsal6flov";
// What app/oauth/consent/actions.ts passes to saveBot when the person has no companion yet.
const consentRequestId = `consent-${authorizationId}`;

it("the consent request id is a valid save request id", () => {
  // saveBot throws on a malformed request id, which would have turned "approve" into a dead end.
  assert.match(consentRequestId, /^[A-Za-z0-9_-]{8,64}$/);
});

it("approving consent provisions the default companion, owned by the person, exactly once", async () => {
  const db = await createKernelDb();
  const ana = kernelClient(localSupabase(db, user("auth:consent-ana")));
  const anaId = await ana.register("Ana");

  const before = await loadBot(ana);
  assert.equal(before.avatar, null, "no companion before consent");

  // What approveConsentAction now does when bot.avatar is null.
  const provisioned = await saveBot(ana, before.persona, consentRequestId);

  assert.ok(provisioned.avatar, "approving consent creates the companion");
  assert.equal(provisioned.avatar.avatar_type, "ai_companion");
  assert.equal(provisioned.ownerId, anaId, "the companion belongs to the person who consented");
  assert.equal(provisioned.persona.name, DEFAULT_PERSONA.name, "it starts from the default persona");
  assert.equal(provisioned.history.length, 1);

  // A retried approval (double-click, or the browser replaying the action) must not fork a second
  // persona version or a second avatar.
  const retried = await saveBot(ana, before.persona, consentRequestId);
  assert.equal(retried.history.length, 1, "a retried approval writes nothing new");
  assert.equal(retried.avatar?.avatar_id, provisioned.avatar.avatar_id);
  assert.equal(companionOf(await ana.myAvatars())?.avatar_id, provisioned.avatar.avatar_id, "still one companion");

  // The person can still customize it afterwards; consent did not freeze the persona.
  const renamed = await saveBot(ana, { name: "Nova" }, "after-consent-0001");
  assert.equal(renamed.persona.name, "Nova");
  assert.equal(renamed.avatar?.avatar_id, provisioned.avatar.avatar_id, "renaming reuses the same companion");
  assert.equal(renamed.history.length, 2);
});

it("provisioning is scoped to the consenting person, never a shared or borrowed identity", async () => {
  const db = await createKernelDb();
  const ana = kernelClient(localSupabase(db, user("auth:consent-ana2")));
  const ben = kernelClient(localSupabase(db, user("auth:consent-ben2")));
  const anaId = await ana.register("Ana");
  const benId = await ben.register("Ben");

  await saveBot(ana, (await loadBot(ana)).persona, consentRequestId);
  // Ben approving his own authorization gets his own companion, not Ana's.
  const bensBot = await saveBot(ben, (await loadBot(ben)).persona, consentRequestId);

  assert.equal(bensBot.ownerId, benId);
  assert.notEqual(bensBot.avatar?.avatar_id, companionOf(await ana.myAvatars())?.avatar_id);
  assert.equal(companionOf(await ben.myAvatars())?.avatar_id, bensBot.avatar?.avatar_id, "Ben sees only his own companion");
  assert.notEqual(anaId, benId);
});
