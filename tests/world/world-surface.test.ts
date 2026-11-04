import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WorldSurface } from "../../app/world/[worldId]/room/world-surface";
import type { RoomPiece } from "../../app/world/[worldId]/room/pieces-map";

const worldId = "4a862a51-0e5f-4c5d-8150-efc314ef2b87";
const piece = (id: string, kind: RoomPiece["kind"], saved: boolean): RoomPiece =>
  ({ id, kind, title: `Item ${id}`, detail: "Real saved artifact",
    x: 0, y: 0, saved, via: null }) as RoomPiece;

describe("World saved-output surface", () => {
  it("does not fabricate previews when no actual World artifacts exist", () => {
    assert.equal(renderToStaticMarkup(createElement(WorldSurface,{worldId,pieces:[]})), "");
    assert.equal(renderToStaticMarkup(createElement(WorldSurface,{
      worldId, pieces:[piece("goal","goal",false)],
    })), "");
  });
  it("links actual saved artifacts without claiming evidence it lacks", () => {
    const html = renderToStaticMarkup(createElement(WorldSurface,{
      worldId,pieces:[piece("abc","text",false),piece("def","text",true)],
    }));
    assert.match(html,/What you&#x27;re creating/);
    assert.match(html,/world\/4a862a51-0e5f-4c5d-8150-efc314ef2b87#piece-abc/);
    assert.match(html,/Saved item · Not independently verified/);
    assert.match(html,/Evidence attached/);
  });
});
