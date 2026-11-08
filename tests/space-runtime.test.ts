import test from "node:test";
import assert from "node:assert/strict";
import { applySpaceProposal, resolvePersonalView, SpaceValidationError } from "../lib/space-runtime/compiler";
import type { SpaceDocument } from "../lib/space-runtime/contract";

const base = (): SpaceDocument => ({
  schemaVersion: 1, spaceId: "agency", revision: 0, name: "Agency",
  components: [{id:"tasks",kind:"tasks",title:"Tasks",region:"main"}],
  expression: {mode:"light",accent:"#303030",surface:"solid",density:"comfortable"},
});
test("shared changes are immutable, revisioned and visible through different personal lenses", () => {
  const original = base();
  const next = applySpaceProposal(original, {spaceId:"agency",baseRevision:0,operations:[
    {type:"add-component",component:{id:"calendar",kind:"calendar",title:"Calendar",region:"side"}},
  ]});
  assert.equal(original.components.length,1);
  assert.equal(next.revision,1);
  const a = resolvePersonalView(next,{spaceId:"agency",actorId:"a",expression:{mode:"dark",accent:"#aabbcc"}});
  const b = resolvePersonalView(next,{spaceId:"agency",actorId:"b",expression:{mode:"light"}});
  assert.equal(a.components.length,2);
  assert.equal(b.components.length,2);
  assert.equal(a.expression.mode,"dark");
  assert.equal(b.expression.mode,"light");
  assert.equal(next.expression.mode,"light");
});
test("stale changes fail instead of silently overwriting collaborators", () => {
  assert.throws(() => applySpaceProposal(base(),{spaceId:"agency",baseRevision:5,operations:[]}),SpaceValidationError);
});
test("generated code and arbitrary style injection are rejected", () => {
  assert.throws(() => applySpaceProposal(base(),{spaceId:"agency",baseRevision:0,operations:[
    {type:"set-expression",patch:{accent:"red; background:url(https://evil.test)"}},
  ]}),SpaceValidationError);
  assert.throws(() => applySpaceProposal(base(),{spaceId:"agency",baseRevision:0,operations:[
    {type:"add-component",component:{id:"bad",kind:"script",title:"Script",region:"main"}},
  ]} as never),SpaceValidationError);
});
test("personal overrides cannot change shared components", () => {
  const document=base();
  const view=resolvePersonalView(document,{spaceId:"agency",actorId:"a",hiddenComponentIds:["tasks"]});
  assert.equal(view.components.length,0);
  assert.equal(document.components.length,1);
});
