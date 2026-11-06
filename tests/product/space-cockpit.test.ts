import assert from "node:assert/strict";
import { test } from "node:test";
import { composeCockpit, recommendedAppIds } from "../../lib/product/space-cockpit";

test("one SOLVE foundation creates genuinely different first-run cockpits", () => {
  const founder = composeCockpit({ focus: "business,learning" });
  const gamer = composeCockpit({ focus: "gaming,music" });
  const family = composeCockpit({ focus: "family,business" });
  const engineer = composeCockpit({ focus: "engineering,learning" });
  assert.equal(founder.mode, "operator");
  assert.equal(gamer.mode, "creator");
  assert.equal(family.mode, "household");
  assert.equal(engineer.mode, "maker");
  assert.notDeepEqual(founder.actions.map(item => item.id), gamer.actions.map(item => item.id));
  assert.notEqual(gamer.priority, family.priority);
  assert.equal(composeCockpit({}).mode, "open");
});

test("first chosen focus determines arrangement, never permission", () => {
  assert.equal(composeCockpit({ focus: "family,business" }).mode, "household");
  assert.equal(composeCockpit({ focus: "business,family" }).mode, "operator");
  const layout = composeCockpit({ focus: "family", context: "private medication records", privacy: "secret" });
  assert.equal(JSON.stringify(layout).includes("medication"), false);
  assert.equal(JSON.stringify(layout).includes("secret"), false);
  assert.equal(JSON.stringify(layout).includes("grant"), false);
});

test("all visible quick actions resolve to an explicit SOLVE route", () => {
  for (const mode of ["family", "music", "business", "engineering", "other"]) {
    const layout = composeCockpit({ focus: mode });
    assert.equal(layout.actions.length, 4);
    for (const action of layout.actions) {
      assert.ok(action.href.startsWith("/") && !action.href.startsWith("//"));
      assert.ok(action.label.length > 0);
    }
  }
});

test("third-party recommendations never claim an account is connected", () => {
  const creator = composeCockpit({ focus: "gaming" });
  assert.deepEqual(recommendedAppIds(creator, ["discord", "youtube"]), ["spotify", "figma"]);
  assert.deepEqual(recommendedAppIds(composeCockpit({}), []), []);
});
