// One shell, five destinations. Every route belongs to exactly one of them, so the person always
// knows where they are — and things, communities and the AI are reached from where they belong
// rather than given permanent tabs of their own.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { it } from "node:test";
import { destinationOf } from "../../app/product/shell";

it("places every route under one of the five destinations", () => {
  const cases: Array<[string, string]> = [
    ["/", "/"],
    ["/account", "/account"], ["/sov-id", "/account"], ["/bot", "/account"], ["/onboarding", "/account"],
    ["/space", "/space"], ["/projects", "/space"], ["/communities", "/space"], ["/community/abc", "/space"],
    ["/world/abc", "/space"], ["/world/abc/record", "/space"], ["/worlds/new", "/space"],
    ["/workbench", "/workbench"], ["/world/abc/workbench", "/workbench"],
    ["/control", "/control"], ["/apps", "/control"],
  ];
  for (const [path, destination] of cases) assert.equal(destinationOf(path), destination, path);
});

it("does not mistake a route that merely starts with the same letters", () => {
  assert.equal(destinationOf("/spacecraft"), "/spacecraft", "prefix matching is by path segment, not by string");
  assert.equal(destinationOf("/controller"), "/controller");
});

it("keeps the full screen only for real working surfaces, never for Home", () => {
  const shell = readFileSync("app/product/shell.tsx", "utf8");
  const bypass = shell.split("\n").find(line => line.includes("return <>{children}</>") && line.includes("instagram"));
  assert.ok(bypass, "the focus-mode rule exists");
  assert.ok(!/path === "\/"/.test(bypass), "Home is inside the shell, not a second application");
  assert.ok(/workbench/.test(bypass), "an editor may take the full screen");
});

it("Home no longer draws chrome of its own", () => {
  const home = readFileSync("app/reality/entry.tsx", "utf8");
  assert.ok(!home.includes('className="reality-head"'), "no second header");
  assert.ok(!home.includes('aria-label="Mobile navigation"'), "no second bottom navigation");
  assert.ok(!home.includes('href="#reality-main"'), "no second skip link");
});
