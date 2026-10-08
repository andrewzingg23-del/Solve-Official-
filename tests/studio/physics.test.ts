import assert from "node:assert/strict";import {it} from "node:test";
import {assembleStudio,studioFingerprint} from "../../lib/studio/document";import {dropExperiment} from "../../lib/studio/physics";
it("runs a real metre-scale rigid-body drop against the exact design",async()=>{
 const s=assembleStudio("object","Drop check","drop"),r=await dropExperiment(s,"surface");
 assert.equal(r.fingerprint,studioFingerprint(s));assert.equal(r.solver,"rapier3d");assert.ok(r.frames.length>30);
 assert.ok(r.frames[0].position[1]>r.frames.at(-1)!.position[1]+.5);assert.ok(r.maxSpeed>3&&r.maxSpeed<8);assert.ok(r.massKg>0);assert.equal(r.engineeringApproval,false);
 await assert.rejects(dropExperiment(s,"absent"),/not found/);
});
