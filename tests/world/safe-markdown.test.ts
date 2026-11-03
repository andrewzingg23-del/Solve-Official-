import assert from "node:assert/strict";
import { it } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

it("formats AI emphasis, lists and code without interpreting HTML or executable links", async () => {
  const { SafeMarkdown } = await import("../../app/world/[worldId]/room/safe-markdown");
  const html = renderToStaticMarkup(React.createElement(SafeMarkdown, { text: "## Next step\n\n**Build** a `prototype`.\n\n- Test it\n- [Notes](https://example.com)\n\n<script>alert(1)</script>\n\n[bad](javascript:alert(1))\n\n```html\n<img src=x onerror=alert(1)>\n```" }));
  assert.match(html, /<h3[^>]*>Next step<\/h3>/);
  assert.match(html, /<strong>Build<\/strong>/);
  assert.match(html, /<code[^>]*>prototype<\/code>/);
  assert.match(html, /<ul[^>]*>/);
  assert.match(html, /href="https:\/\/example.com"/);
  assert.doesNotMatch(html, /<script|<img|href="javascript:/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&lt;img/);
});

it("keeps fenced content literal and blocks relative-protocol or encoded executable links", async () => {
  const { SafeMarkdown } = await import("../../app/world/[worldId]/room/safe-markdown");
  const html = renderToStaticMarkup(React.createElement(SafeMarkdown, { text: "1. First\n2. Second\n\n```\n**literal**\n<script>bad()</script>\n```\n\n[relative](//evil.example) [data](data:text/html,bad) [encoded](javascript&#58;bad) [local](/world/test)" }));
  assert.match(html, /<ol[^>]*><li>First<\/li><li>Second<\/li><\/ol>/);
  assert.match(html, /<code>\*\*literal\*\*\n&lt;script&gt;/);
  assert.doesNotMatch(html, /href="(?:\/\/|data:|javascript)/);
  assert.match(html, /href="\/world\/test"/);
});
