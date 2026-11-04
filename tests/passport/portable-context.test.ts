import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPortableContext, type ContextEntry } from "../../lib/passport/portable-context";

const entry = (id: string, scope: ContextEntry["scope"], text: string): ContextEntry => ({
  id, scope, text, provenance: { source: "onboarding", sourceId: "import-1" },
  updatedAt: "2026-11-03T00:00:00Z", verified: false,
});

describe("Portable onboarding context", () => {
  it("never includes context without explicit approval", () => {
    assert.throws(() => buildPortableContext([entry("1","profile","private")], {
      recipient:"openai", scopes:["profile"], approved:false,
    }), /context_not_approved/);
  });
  it("only supplies approved scopes and keeps provenance", () => {
    const packet = buildPortableContext([
      entry("1","profile","I am a builder"),
      entry("2","memory","Do not send private memory"),
      entry("3","projects","Building SOLVE"),
    ], { recipient:"anthropic", scopes:["profile","projects"], approved:true }, "2026-11-03T12:00:00Z");
    assert.equal(packet.schema, "solve.context.v1");
    assert.equal(packet.entries.length, 2);
    assert.ok(packet.entries.every(e => e.scope !== "memory"));
    assert.equal(packet.entries[0].provenance.sourceId, "import-1");
    assert.equal(JSON.stringify(packet).includes("Do not send private memory"), false);
  });
  it("bounds untrusted text, refuses malformed recipients, and leaves originals untouched", () => {
    const source = entry("fact1","profile", "a".repeat(3000));
    assert.throws(() => buildPortableContext([source], {recipient:"https://evil",scopes:["profile"],approved:true}), /context_not_approved/);
    const packet = buildPortableContext([source],{recipient:"muse",scopes:["profile"],approved:true});
    assert.equal(packet.entries[0].text.length,1800);
    assert.equal(source.text.length,3000);
  });
  it("is identical across providers for the same grants and corpus, aside from recipient", () => {
    const corpus=[entry("1","goals","Create a collaborative World")];
    const a=buildPortableContext(corpus,{recipient:"openai",scopes:["goals"],approved:true},"2026-11-03T12:00:00Z");
    const b=buildPortableContext(corpus,{recipient:"claude",scopes:["goals"],approved:true},"2026-11-03T12:00:00Z");
    assert.deepEqual(a.entries,b.entries);
  });
});
