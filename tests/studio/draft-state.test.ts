import assert from "node:assert/strict";
import {it} from "node:test";
import {assembleStudio,editStudio,parseStudio,validateStudio} from "../../lib/studio/document";
import {decodeDraft,encodeDraft,moveHistory,replaceDraft,type DraftState} from "../../lib/studio/draft-state";
import {applyStudioProposal,studioProposal} from "../../lib/studio/proposal";
const A="00000000-0000-4000-8000-000000000001",B="00000000-0000-4000-8000-000000000002";
const draft=(id="first",parents:string[]|null=[A]):DraftState=>({document:assembleStudio("object",id,id),baseParents:parents,past:[],future:[],saved:false,storageError:false,recoverySource:null,creations:[]});
it("a reopened shared draft retains its actual ancestry even when the server has a newer head",()=>{
 const local=replaceDraft(draft(),editStudio(draft().document,{type:"title",title:"My edit"}));
 const restored=decodeDraft(encodeDraft(local))!;
 assert.deepEqual(restored.baseParents,[A]);assert.notDeepEqual(restored.baseParents,[B]);
 assert.equal(restored.document.title,"My edit");
 assert.equal(decodeDraft(JSON.stringify(local.document))!.baseParents,null,"legacy data has unknown ancestry, never an inferred newest head");
});
it("creation identities and undo ancestry survive serialization and a reload",()=>{
 const first=draft(),second=replaceDraft(first,assembleStudio("blank","Second","second"),null);
 const reopened={...second,...decodeDraft(encodeDraft(second))!};
 const previous=moveHistory(reopened,"undo");assert.equal(previous.document.id,"first");assert.deepEqual(previous.baseParents,[A]);
 assert.equal(moveHistory(previous,"redo").document.id,"second");
 assert.equal(decodeDraft(encodeDraft(first))!.document.id,"first");
});
it("stale AI results cannot replace a new creation, edited dimensions, rates or checklist",()=>{
 const base=draft().document,p=studioProposal(base,JSON.stringify({title:"Proposal",brief:"Editable concept",nodes:base.nodes}))!;
 const changed=[editStudio(base,{type:"node",id:base.nodes[0].id,patch:{size:[2,.05,.75]}}),editStudio(base,{type:"rate",material:"wood",density:700,pricePerKg:3}),editStudio(base,{type:"step",id:"intent",status:"done"}),assembleStudio("blank","New creation","different")];
 for(const current of changed)assert.throws(()=>applyStudioProposal(current,base,p),/changed since this request/);
 const applied=applyStudioProposal(base,base,p);assert.equal(applied.revision,base.revision+1);assert.deepEqual(applied.rates,base.rates);assert.deepEqual(applied.steps,base.steps);
});
it("accepted UTF-8 documents round trip through compact saves and formatted exports; oversized edits fail",()=>{
 const base=draft().document,large={...base,steps:Array.from({length:24},(_,i)=>({id:"step-"+i,title:"Step",note:"字".repeat(600),status:"todo",dependsOnDesign:false}))};
 assert.throws(()=>validateStudio(large),/10 KB/);
 const accepted=validateStudio({...base,brief:"字".repeat(1200)});
 assert.deepEqual(parseStudio(JSON.stringify(accepted)),accepted);assert.deepEqual(parseStudio(JSON.stringify(accepted,null,2)),accepted);
 assert.deepEqual(decodeDraft(encodeDraft({...draft(),document:accepted}))!.document,accepted);
 assert.equal(decodeDraft("{broken"),null,"bad original data is surfaced for recovery rather than decoded as a blank template");
});
