import assert from "node:assert/strict";
import { it } from "node:test";
import { greetingName } from "../../lib/product/greeting";

it("greets by a first name, and never by something that isn't one", () => {
  assert.equal(greetingName("Andrew Zingg"), "Andrew");
  assert.equal(greetingName("Dr. Jane Smith"), "Jane", "titles are skipped, and no double full stop");
  assert.equal(greetingName("José María"), "José");
  assert.equal(greetingName("O'Neil"), "O'Neil");
  assert.equal(greetingName("Mary-Kate"), "Mary-Kate");
  assert.equal(greetingName("[automated acc-1] card-owner"), null, "a fixture marker is not a name");
  assert.equal(greetingName("1234"), null);
  assert.equal(greetingName(""), null);
  assert.equal(greetingName("   "), null);
});
