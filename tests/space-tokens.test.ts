import test from "node:test";
import assert from "node:assert/strict";
import { expressionTokens } from "../lib/space-runtime/tokens";
import { DEFAULT_EXPRESSION } from "../lib/space-runtime/contract";

test("shared tokens preserve layout metrics while personal mode changes palette", () => {
 const light = expressionTokens(DEFAULT_EXPRESSION);
 const dark = expressionTokens({...DEFAULT_EXPRESSION,mode:"dark"});
 assert.equal(light["--solve-gap"],dark["--solve-gap"]);
 assert.notEqual(light["--solve-background"],dark["--solve-background"]);
 assert.equal(light["--solve-radius"],dark["--solve-radius"]);
});
test("token compiler rejects untrusted CSS and limits output to stable names", () => {
 assert.throws(()=>expressionTokens({...DEFAULT_EXPRESSION,accent:"url(https://bad.test)"}));
 assert.equal(Object.keys(expressionTokens(DEFAULT_EXPRESSION)).length,8);
});
