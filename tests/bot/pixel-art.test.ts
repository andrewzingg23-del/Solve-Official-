import assert from "node:assert/strict";
import { it } from "node:test";
import { encodePixelArt, parsePixelArt } from "../../lib/bot/pixel-art";

it("round-trips a bounded pixel grid and rejects malformed or unsafe data", () => {
  const encoded = encodePixelArt({
    prompt: "A tiny blue robot",
    palette: ["#123abc", "#ffffff"],
    rows: [".00.", "0110", ".00."],
  });
  assert.ok(encoded.startsWith("SOV_PIXEL_ART_V1\n"));
  assert.deepEqual(parsePixelArt(encoded), {
    prompt: "A tiny blue robot",
    palette: ["#123abc", "#ffffff"],
    rows: [".00.", "0110", ".00."],
  });
  assert.throws(() => encodePixelArt({ prompt: "uneven", palette: ["#000000"], rows: ["00", "0"] }), /same width/);
  assert.throws(() => encodePixelArt({ prompt: "bad color", palette: ["red"], rows: ["0"] }), /hex colors/);
  assert.throws(() => encodePixelArt({ prompt: "missing color", palette: ["#000000"], rows: ["1"] }), /missing from the palette/);
  assert.equal(parsePixelArt("SOV_PIXEL_ART_V1\n{\"prompt\":\"x\",\"palette\":[\"url(javascript:alert(1))\"],\"rows\":[\"0\"]}"), null);
});
