import assert from "node:assert/strict";
import { it } from "node:test";
import { portraitRequestId, portraitResult, providerErrorStatus, validatePortraitRequest, validatePortraitStatusRequest } from "../../lib/bot/higgsfield";

it("accepts a complete API key and a bounded portrait prompt", () => {
  const key = "a".repeat(40);
  assert.deepEqual(validatePortraitRequest({ apiKey: key, prompt: " A warm cyan robot portrait " }), { apiKey: key, prompt: "A warm cyan robot portrait" });
});

it("rejects malformed keys, blank prompts, and overlong prompts", () => {
  assert.equal(validatePortraitRequest({ apiKey: "short", prompt: "portrait" }), null);
  assert.equal(validatePortraitRequest({ apiKey: "a".repeat(20) + "\n" + "b".repeat(20), prompt: "portrait" }), null);
  assert.equal(validatePortraitRequest({ apiKey: "a".repeat(40), prompt: "  " }), null);
  assert.equal(validatePortraitRequest({ apiKey: "a".repeat(40), prompt: "x".repeat(1001) }), null);
});

it("accepts only safe status request identifiers", () => {
  assert.deepEqual(validatePortraitStatusRequest({ apiKey: "a".repeat(40), requestId: "request_1234" }), { apiKey: "a".repeat(40), requestId: "request_1234" });
  assert.equal(validatePortraitStatusRequest({ apiKey: "a".repeat(40), requestId: "../../secrets" }), null);
});

it("normalizes completed, pending and unsuccessful image results", () => {
  assert.deepEqual(portraitResult({ status: "completed", images: [{ url: "https://cdn.example/image.png" }] }), { status: "completed", imageUrl: "https://cdn.example/image.png" });
  assert.deepEqual(portraitResult({ data: { status: "processing" } }), { status: "processing" });
  assert.deepEqual(portraitResult({ status: "failed" }), { status: "failed" });
  assert.equal(portraitResult({ status: "completed", images: [{ url: "http://127.0.0.1/private" }] }).status, "failed");
});

it("extracts a bounded provider request ID and hides provider error details", () => {
  assert.equal(portraitRequestId({ request_id: "request_1234" }), "request_1234");
  assert.equal(portraitRequestId({ request_id: "../private" }), null);
  assert.deepEqual(providerErrorStatus(401), { status: 400, message: "Higgsfield rejected that API key. Check it and try again." });
  assert.equal(providerErrorStatus(503).status, 502);
});
