import assert from "node:assert/strict";
import { it } from "node:test";
import {
  buildWebsiteDraftMessages,
  extractHtmlDocument,
  isSubstantiveDraft,
  looksLikeHtmlDocument,
  stripActiveContent,
} from "../../lib/product/website-draft";

const page = (body: string) => `<!DOCTYPE html><html><head><title>T</title></head><body>${body}</body></html>`;

it("builds a system+user prompt that carries the goal and forbids scripts/external resources", () => {
  const msgs = buildWebsiteDraftMessages({ title: "Reef Cafe", goal: "a cozy coffee shop by the beach" });
  assert.equal(msgs.length, 2);
  assert.equal(msgs[0].role, "system");
  assert.match(msgs[0].content, /NO JavaScript/);
  assert.match(msgs[0].content, /self-contained HTML5/i);
  assert.match(msgs[1].content, /cozy coffee shop by the beach/);
  assert.match(msgs[1].content, /Reef Cafe/);
});

it("extracts the HTML document from fenced, prose-wrapped, or bare output", () => {
  const doc = page("<h1>Hi</h1>");
  assert.equal(extractHtmlDocument("```html\n" + doc + "\n```"), doc);
  assert.equal(extractHtmlDocument("Sure! Here you go:\n" + doc + "\nHope that helps."), doc);
  assert.equal(extractHtmlDocument(doc), doc);
  assert.equal(extractHtmlDocument("no html here"), null);
  assert.equal(extractHtmlDocument(""), null);
  assert.equal(extractHtmlDocument(null), null);
});

it("accepts a real page and rejects an empty shell", () => {
  assert.equal(
    isSubstantiveDraft(page("<header><h1>Reef Cafe</h1></header><main><p>Fresh coffee and warm pastries steps from the sand, every morning from six. Order ahead, grab a window seat, and watch the tide roll in.</p></main>")),
    true,
  );
  assert.equal(isSubstantiveDraft(page("")), false);
  assert.equal(isSubstantiveDraft(page("<div></div>")), false);
  assert.equal(isSubstantiveDraft(null), false);
});

it("recognizes a stored HTML-document body and rejects plain notes", () => {
  assert.equal(looksLikeHtmlDocument(page("<h1>Hi</h1>")), true);
  assert.equal(looksLikeHtmlDocument("<html><body>x</body></html>"), true);
  assert.equal(looksLikeHtmlDocument("Just a plain note the user typed."), false);
  assert.equal(looksLikeHtmlDocument("<p>fragment only</p>"), false);
  assert.equal(looksLikeHtmlDocument(null), false);
});

it("strips scripts, inline handlers, javascript: URLs, and resource embeds; keeps styled content", () => {
  const dirty = page(
    `<style>h1{color:teal}</style><h1 onclick="steal()">Hi</h1>` +
      `<script>fetch('//evil')</script>` +
      `<a href="javascript:alert(1)">x</a>` +
      `<iframe src="//evil"></iframe>` +
      `<p>Real copy that should remain visible on the page.</p>`,
  );
  const clean = stripActiveContent(dirty);
  assert.doesNotMatch(clean, /<script/i, "script tag removed");
  assert.doesNotMatch(clean, /onclick/i, "inline handler removed");
  assert.doesNotMatch(clean, /javascript:alert/i, "javascript: URL neutralized");
  assert.doesNotMatch(clean, /<iframe/i, "iframe removed");
  assert.match(clean, /Real copy that should remain/, "visible copy preserved");
  assert.match(clean, /color:teal/, "inline CSS preserved");
});
