// The signed-out start page follows brand v3: white floor, no decorative points or glows, nothing
// static pretending to be someone's state, lowercase solve, and the line "Everything here is real."
import assert from "node:assert/strict";
import { it } from "node:test";

it("draws the start page on the white floor, with nothing that pretends", async () => {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { StartView } = await import("../../app/start/view");
  const html = renderToStaticMarkup(StartView());
  assert.match(html, /bg-\[#f2f7fb\]/);
  assert.match(html, /Start with what you&#x27;re making real\./);
  assert.match(html, /solve gives an intention a place to go/);
  assert.match(html, /Everything here is real\./);
  assert.match(html, /href="\/login\?next=\/command"/);
  assert.doesNotMatch(html, /rounded-full/, "no points or rings: the point is for real saves");
  assert.doesNotMatch(html, /shadow-\[0_0/, "no glows");
  assert.doesNotMatch(html, /Not shaped|Next move/, "no static state shown as if it were someone's");
  assert.doesNotMatch(html, />Solve |kernel recorded/);
});
