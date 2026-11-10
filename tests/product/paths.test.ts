import assert from "node:assert/strict";
import { it } from "node:test";
import LZString from "lz-string";
import { TOOLS, briefFor, cleanLink, needsOf, pathsFor, replitLink } from "../../lib/product/paths";

it("reads what an intention needs from the person's own words", () => {
  assert.deepEqual(needsOf("Plan the garden for spring"), { website: false, software: false, share: false });
  assert.deepEqual(needsOf("A website for my tree company"), { website: true, software: false, share: true });
  assert.deepEqual(needsOf("An app where customers book a tree removal and pay"), { website: true, software: true, share: true });
  assert.equal(needsOf("Share photos from the trip").share, true);
});

it("an everyday intention stays here, with no tool pushed at it", () => {
  const paths = pathsFor("Plan the garden for spring");
  assert.deepEqual(paths.map(p => p.id), ["solve-page"]);
  assert.equal(paths[0].recommended, false, "nothing is recommended when nothing particular is needed");
});

it("a portfolio or simple site is recommended here first; a specialist is offered, not pushed", () => {
  const paths = pathsFor("My photography portfolio website");
  assert.deepEqual(paths.map(p => [p.id, p.support, p.recommended]), [["solve-page", "native", true], ["replit", "handoff", false]]);
});

it("something that needs code running is recommended to a builder that can make it, honestly labelled a handoff", () => {
  const paths = pathsFor("A booking app with customer logins and payments");
  assert.equal(paths[0].id, "replit");
  assert.equal(paths[0].support, "handoff");
  assert.equal(paths[0].recommended, true);
  const here = paths.find(p => p.id === "solve-page");
  assert.match(here!.why, /can't run logins/, "the native path says plainly what it cannot do");
});

it("the recommendation depends on needs alone — reordering the tools changes nothing", () => {
  for (const words of ["A booking app with logins", "My portfolio site", "Plan a party"]) {
    assert.deepEqual(pathsFor(words, [...TOOLS].reverse()), pathsFor(words, TOOLS), words);
  }
});

it("a tool marked unavailable is never offered", () => {
  const off = TOOLS.map(t => t.id === "replit" ? { ...t, support: "unavailable" as const } : t);
  assert.ok(!pathsFor("A booking app with logins", off).some(p => p.id === "replit"));
});

it("the brief carries only the thing's own words, and the Replit link round-trips exactly", () => {
  const needs = needsOf("A booking app with logins");
  const brief = briefFor("Tree booking", "Customers book a tree removal", needs);
  assert.match(brief, /^Tree booking\n\nCustomers book a tree removal\n\nBuild this as a working web app/);
  const url = new URL(replitLink(brief, needs));
  assert.equal(url.origin + url.pathname, "https://replit.com/");
  assert.equal(url.searchParams.get("stack"), "Build");
  assert.equal(LZString.decompressFromEncodedURIComponent(url.searchParams.get("prompt")!), brief);
  assert.equal(new URL(replitLink("A site", needsOf("my portfolio site"))).searchParams.get("stack"), "Design");
  assert.throws(() => replitLink("   ", needs));
});

it("a link brought back must be a plain https address", () => {
  assert.equal(cleanLink("https://tree-booking.replit.app"), "https://tree-booking.replit.app/");
  for (const bad of ["http://x.com", "javascript:alert(1)", "https://user:pw@x.com", "https://localhost", "data:text/html,hi", "", 5, "x".repeat(3000)]) {
    assert.equal(cleanLink(bad), null, String(bad).slice(0, 30));
  }
});

it("a description SOLVE wrote, in our own word, is never shown or handed on", async () => {
  const { ownDescription } = await import("../../lib/product/page");
  assert.equal(ownDescription("A private World. Start with a blank canvas and shape it as you go."), "");
  assert.equal(ownDescription("Trip plan", "Trip plan"), "", "a description that only repeats the title adds nothing");
  assert.equal(ownDescription(" Plan the garden ", "Garden"), "Plan the garden");
});

it("https addresses in a page's words become links; nothing else does", async () => {
  const { linkParts } = await import("../../lib/product/page");
  assert.deepEqual(linkParts("My shop: https://shop.example.com/a. Say hi!"), [
    { text: "My shop: " }, { href: "https://shop.example.com/a", text: "shop.example.com/a" }, { text: ". Say hi!" }]);
  for (const words of ["javascript:alert(1)", "http://insecure.example.com", "https://user:pw@x.com", "data:text/html,hi", "https://localhost/x"]) {
    assert.ok(linkParts(words).every(p => !("href" in p)), words);
  }
  assert.deepEqual(linkParts("plain words"), [{ text: "plain words" }]);
});
