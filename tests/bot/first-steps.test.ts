// The first-run path is ticked only by what is on the record, and disappears at the first save.
import assert from "node:assert/strict";
import { it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { firstSteps, nextStep } from "../../lib/bot/first-steps";
import { FirstSteps } from "../../app/bot/first-steps";

it("walks from no bot to the first save, one recorded step at a time", () => {
  const at = (s: Partial<Parameters<typeof firstSteps>[0]>) => nextStep(firstSteps({ botName: "Nova", hasBot: false, connections: 0, worlds: 0, saves: 0, ...s }))?.key ?? null;
  assert.equal(at({}), "bot");
  assert.equal(at({ hasBot: true }), "connect");
  assert.equal(at({ hasBot: true, connections: 1 }), "ask");
  assert.equal(at({ hasBot: true, connections: 1, worlds: 1 }), "save");
  assert.equal(at({ hasBot: true, connections: 1, worlds: 1, saves: 1 }), null);
  assert.match(firstSteps({ botName: "Nova", hasBot: true, connections: 0, worlds: 0, saves: 0 })[1].detail, /speaks as Nova/);
});

it("shows the path until the first save, then nothing", () => {
  const html = renderToStaticMarkup(createElement(FirstSteps, { steps: firstSteps({ botName: "Nova", hasBot: true, connections: 1, worlds: 0, saves: 0 }) }));
  assert.match(html, /From here to real/);
  assert.match(html, /aria-current="step"[^>]*>.*Ask for something real/);
  assert.equal(renderToStaticMarkup(createElement(FirstSteps, { steps: firstSteps({ botName: "Nova", hasBot: true, connections: 1, worlds: 2, saves: 1 }) })), "");
});
