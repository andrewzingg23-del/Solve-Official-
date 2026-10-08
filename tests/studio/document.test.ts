import assert from "node:assert/strict";
import {it} from "node:test";
import {assembleStudio,editStudio,materialFacts,parseStudio,studioFingerprint,validateStudio} from "../../lib/studio/document";
import {studioProposal} from "../../lib/studio/proposal";
it("admits only bounded declarative scenes with unique ids and finite dimensions",()=>{
 const s=assembleStudio("architecture","Workspace","workspace");assert.deepEqual(parseStudio(JSON.stringify(s)),s);
 assert.throws(()=>validateStudio({...s,nodes:[...s.nodes,s.nodes[0]]}),/unique/);
 assert.throws(()=>validateStudio({...s,nodes:[{...s.nodes[0],size:[Infinity,1,1]}]}),/dimension/);
 assert.throws(()=>validateStudio({...s,nodes:[{...s.nodes[0],script:"alert(1)"}]}),/unsupported/);
 assert.equal(parseStudio('{"schema":"unknown"}'),null);
});
it("edits one semantic object without mutating its source and invalidates derived results",()=>{
 const s=assembleStudio("object","Desk","desk"),id=s.nodes[0].id,n=editStudio(s,{type:"node",id,patch:{size:[2,.05,.8],material:"aluminum"}});
 assert.equal(n.revision,s.revision+1);assert.notDeepEqual(n.nodes[0],s.nodes[0]);assert.notEqual(studioFingerprint(n),studioFingerprint(s));
 assert.throws(()=>editStudio(s,{type:"node",id:"absent",patch:{label:"x"}}),/not found/);
 const step=s.steps.find(s=>s.dependsOnDesign)!,done=editStudio(s,{type:"step",id:step.id,status:"done",note:"Checked"});
 assert.equal(done.steps.find(s=>s.id===step.id)?.status,"done");
 const changed=editStudio(done,{type:"node",id,patch:{material:"steel"}});
 assert.equal(changed.steps.find(s=>s.id===step.id)?.status,"needs_review");
});
it("calculates geometry quantities using editable density and cost assumptions",()=>{
 const s=assembleStudio("blank","Block","block"),n=validateStudio({...s,nodes:[{id:"block",label:"Block",shape:"box",size:[1,2,3],position:[0,1,0],rotation:[0,0,0],material:"wood"}],rates:{...s.rates,wood:{density:650,pricePerKg:2}},wastePercent:10}),facts=materialFacts(n);
 assert.equal(facts.volumeM3,6);assert.equal(facts.massKg,3900);assert.equal(facts.cost,8580);assert.equal(facts.fingerprint,studioFingerprint(n));assert.equal(facts.basis,"planning_assumptions");
});
it("AI proposals cannot execute code, change authority, or retain stale plan checks",()=>{
 const s=assembleStudio("object","Desk","desk"),done=editStudio(s,{type:"step",id:"design",status:"done"});
 const p=studioProposal(done,JSON.stringify({title:"New desk",brief:"Concept",nodes:s.nodes}));assert.ok(p);assert.equal(p.id,s.id);assert.equal(p.steps.find(s=>s.id==="design")?.status,"needs_review");
 assert.equal(studioProposal(s,JSON.stringify({title:"x",brief:"y",nodes:s.nodes,permission:"admin"})),null);
 assert.equal(studioProposal(s,JSON.stringify({title:"x",brief:"y",nodes:[{...s.nodes[0],code:"run()"}]})),null);
});
