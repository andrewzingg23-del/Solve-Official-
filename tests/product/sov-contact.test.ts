import test from "node:test";
import assert from "node:assert/strict";
import { createSovVCard, safeContactEmail, safeSovLink } from "../../lib/product/sov-contact";

test("SOV contact export produces an interoperable vCard from approved data", () => {
  const result = createSovVCard({ name: "Ada, Lovelace", email: "ada@example.com", website: "https://example.com/portfolio" });
  assert.ok(result?.startsWith("BEGIN:VCARD\r\nVERSION:3.0\r\n"));
  assert.ok(result?.includes("FN:Ada\\, Lovelace"));
  assert.ok(result?.includes("EMAIL;TYPE=INTERNET:ada@example.com"));
  assert.ok(result?.includes("URL:https://example.com/portfolio"));
  assert.ok(result?.endsWith("END:VCARD\r\n"));
});

test("SOV export refuses empty identities and unsafe public destinations", () => {
  assert.equal(createSovVCard({ name: "  " }), null);
  assert.equal(safeContactEmail("hi@example.com\r\nFN:Other"), "");
  assert.equal(safeSovLink("javascript:alert(1)"), "");
  assert.equal(safeSovLink("https://a:b@example.com"), "");
  assert.equal(safeSovLink("http://example.com"), "");
  const card = createSovVCard({ name: "Avery", email: "forged@example.com\r\nN:Bad", website: "javascript:alert(1)" });
  assert.ok(card?.includes("FN:Avery"));
  assert.equal(card?.includes("EMAIL"), false);
  assert.equal(card?.includes("URL:"), false);
});
