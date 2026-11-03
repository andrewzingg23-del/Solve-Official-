import test from 'node:test';
import assert from 'node:assert/strict';
import { projectProgress, meaningfulActivity, stepFromArtifact } from '../../lib/world/progress';
test('progress derives from saved steps and documents, never heartbeat events', () => {
 const artifacts = [{entityId:'s', title:'Next step',body:'- [ ] Interview one customer',updatedAt:'2026-01-02',version:1,position:{x:1,y:1},via:null,visibility:'members' as const}];
 assert.equal(projectProgress(artifacts).nextStep,'Interview one customer');
 assert.equal(projectProgress(artifacts).completed,0);
 assert.equal(stepFromArtifact({...artifacts[0],body:'- [x] Interview one customer'})?.done,true);
 assert.equal(meaningfulActivity('kernel.presence.heartbeat'),false);
 assert.equal(meaningfulActivity('kernel.entity.updated'),true);
});
test('empty work is described honestly', () => {
 assert.equal(projectProgress([]).status,'Ready for a first step');
 assert.equal(projectProgress([]).updatedAt,null);
});
test('private documents and malformed step records never become shared next actions', () => {
 const base = {entityId:'s',title:'Next step',body:'- [ ] Private next action',updatedAt:'2026-01-02',version:1,position:{x:1,y:1},via:null,visibility:'private' as const};
 assert.equal(projectProgress([base]).nextStep,null);
 assert.equal(projectProgress([base]).updatedAt,null);
 assert.equal(stepFromArtifact({...base,body:'- [ ] One\n- [ ] Two'}),null);
 assert.equal(stepFromArtifact({...base,title:'Meeting notes'}),null);
});

test('history finds durable work behind more than one page of heartbeats', async () => {
 const { readMeaningfulActivity } = await import('../../lib/world/progress');
 const events = Array.from({length:620},(_,i) => ({seq:i+1,type:i===0 ? 'kernel.entity.created' : 'kernel.presence.heartbeat'}));
 const kernel = {readEvents:async (_scope:string,{afterSeq=0,limit,newestFirst=false}:{afterSeq?:number;limit:number;newestFirst?:boolean}) => (newestFirst ? events.slice().reverse() : events).filter(e=>e.seq>afterSeq).slice(0,limit)};
 const found = await readMeaningfulActivity(kernel as never,'world:test');
 assert.equal(found.length,1); assert.equal(found[0].seq,1);
});
