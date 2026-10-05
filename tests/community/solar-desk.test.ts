// The solar desk without an Aurora API key, end to end on the embedded kernel: a homeowner's request
// is sealed in their own scope and readable only by the desk's owner; the owner answers with the
// proposal they made in Aurora; the homeowner sees it; and erasing the request makes the address and
// contact unreadable for good and takes the desk's access away.
import assert from "node:assert/strict";
import { it } from "node:test";
import { kernelClient } from "../../lib/kernel/client";
import { localSupabase } from "../../lib/kernel/local";
import { askToJoin, myCommunities, startCommunity } from "../../lib/community/community";
import { answerDesign, deskCommunityId, deskRequests, eraseDesign, myDesigns, requestDesign } from "../../lib/solar/desk";
import { createKernelDb, user } from "../kernel/harness";

const NONCE = "0b6f3c1e-8a2d-4f5b-9c7e-1d2e3f4a5b6c";
const HOME = { name: "Dana Reyes", address: "120 Palm Way, Tampa, FL 33602", phone: "813 555 0142", email: "dana@example.com", monthlyBill: 240, monthlyKwh: "", answers: { owner: "yes", roof: "under10", credit: "nonsense" }, consent: true };

async function setting() {
  const db = await createKernelDb();
  const person = async (auth: string, label: string) => {
    const k = kernelClient(localSupabase(db, user(auth)));
    return { k, id: await k.register(label) };
  };
  const zest = await person("auth:desk-zest", "Zest Solar");
  const dana = await person("auth:desk-dana", "Dana");
  const eve = await person("auth:desk-eve", "Eve");
  const desk = await startCommunity(zest.k, { name: "Zest Solar", packs: ["solar"], nonce: NONCE });
  return { zest, dana, eve, desk };
}

it("takes the desk from config, ignoring anything that isn't an id", () => {
  assert.equal(deskCommunityId(undefined), null);
  assert.equal(deskCommunityId("not-an-id"), null);
  assert.equal(deskCommunityId(" 6F1D2C3B-4A59-4687-9A0B-1C2D3E4F5A6B "), "6f1d2c3b-4a59-4687-9a0b-1c2d3e4f5a6b");
});

it("seals a homeowner's request for the desk's owner alone, and carries the answer back", async () => {
  const { zest, dana, eve, desk } = await setting();
  await assert.rejects(requestDesign(dana.k, desk, { ...HOME, consent: false }, "req-dana-0001"), /consent/);
  await assert.rejects(requestDesign(dana.k, desk, { ...HOME, address: "Tampa" }, "req-dana-0001"), /address/);
  const asked = await requestDesign(dana.k, desk, HOME, "req-dana-0001");
  assert.equal((await requestDesign(dana.k, desk, HOME, "req-dana-0001")).id, asked.id, "a retry is the same request");

  // The record holds only ciphertext.
  const raw = JSON.stringify(await dana.k.readEvents(asked.scope, { limit: 50 }));
  assert.ok(!raw.includes("Palm Way") && !raw.includes("813 555 0142") && !raw.includes("Dana Reyes"), "no name, address or phone in the clear");

  const [seen] = await deskRequests(zest.k, desk);
  assert.equal(seen.details?.name, "Dana Reyes");
  assert.equal(seen.details?.address, "120 Palm Way, Tampa, FL 33602");
  assert.equal(seen.details?.monthlyKwh, null);
  assert.deepEqual(seen.details?.answers, { owner: "yes", roof: "under10" }, "only real answers are kept");
  assert.equal(seen.answer, null);
  // Nobody else can open it.
  await assert.rejects(deskRequests(eve.k, desk));
  await assert.rejects(eve.k.readEvents(asked.scope, { limit: 5 }));

  await assert.rejects(answerDesign(zest.k, desk, { askId: seen.id, proposalUrl: "javascript:alert(1)" }, "ans-zest-0001"), /https/);
  await answerDesign(zest.k, desk, { askId: seen.id, proposalUrl: "https://v2.aurorasolar.com/e-proposal/abc", systemKw: "11.48", panels: 28, annualKwh: 16120, price: 33292, note: "South roof only." }, "ans-zest-0001");
  const [mine] = await myDesigns(dana.k, desk);
  assert.equal(mine.answer?.proposalUrl, "https://v2.aurorasolar.com/e-proposal/abc");
  assert.equal(mine.answer?.systemKw, 11.48);
  assert.equal(mine.answer?.panels, 28);
  assert.equal(mine.details?.address, "120 Palm Way, Tampa, FL 33602", "the homeowner reads their own request");
  assert.deepEqual(await myDesigns(eve.k, desk), []);
});

it("erases a request for good when the homeowner says so", async () => {
  const { zest, dana, desk } = await setting();
  const asked = await requestDesign(dana.k, desk, HOME, "req-dana-0001");
  const [mine] = await myDesigns(dana.k, desk);
  await assert.rejects(eraseDesign(zest.k, desk, mine.id), /not yours/);
  await eraseDesign(dana.k, desk, mine.id);
  await eraseDesign(dana.k, desk, mine.id);
  assert.equal((await myDesigns(dana.k, desk))[0].details, null);
  const [seen] = await deskRequests(zest.k, desk);
  assert.equal(seen.details, null, "the desk can no longer read it");
  await assert.rejects(answerDesign(zest.k, desk, { askId: seen.id, proposalUrl: "https://example.com/p" }, "ans-zest-0002"), /erased/);
  await assert.rejects(zest.k.readEvents(asked.scope, { limit: 5 }));
});

it("is only open where the community runs the solar pack", async () => {
  const { zest, dana } = await setting();
  const other = await startCommunity(zest.k, { name: "Builders", nonce: "1b6f3c1e-8a2d-4f5b-9c7e-1d2e3f4a5b6c" });
  await assert.rejects(requestDesign(dana.k, other, HOME, "req-dana-0001"), /solar desk/);
});

it("tells the owner what waits on them across their communities", async () => {
  const { zest, dana, eve, desk } = await setting();
  assert.deepEqual(await myCommunities(zest.k), [{ communityId: desk.communityId, name: "Zest Solar", standing: "owner", asking: 0, requests: 0 }]);
  await askToJoin(eve.k, desk, { requestId: "ask-eve-00001" });
  await requestDesign(dana.k, desk, HOME, "req-dana-0001");
  const [waiting] = await myCommunities(zest.k);
  assert.deepEqual([waiting.asking, waiting.requests], [1, 1]);
  const [r] = await myDesigns(dana.k, desk);
  await eraseDesign(dana.k, desk, r.id);
  assert.equal((await myCommunities(zest.k))[0].requests, 0, "an erased request no longer waits");
  assert.deepEqual(await myCommunities(dana.k), [], "asking isn't belonging");
});

