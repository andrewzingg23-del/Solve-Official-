import assert from "node:assert/strict";import {it} from "node:test";
import {kernelClient,KernelError} from "../../lib/kernel/client";import {localSupabase} from "../../lib/kernel/local";import {createKernelDb,user} from "../kernel/harness";
import {createCreativeWorld} from "../../lib/world/creative";import {assembleStudio,editStudio} from "../../lib/studio/document";import {readStudios,saveStudioRevision} from "../../lib/world/studio";
it("private studios replay safely, retain competing authors, and enforce read-only access and revocation",async()=>{
 const db=await createKernelDb(),alice=kernelClient(localSupabase(db,user("auth:studio-alice"))),bob=kernelClient(localSupabase(db,user("auth:studio-bob")));
 const aid=await alice.register("Alice"),bid=await bob.register("Bob");
 const world=await createCreativeWorld(alice,{worldId:"00000000-0000-4000-8000-000000008001",title:"Studio"}),document=assembleStudio("object","Desk","shared-desk");
 const input={worldId:world.worldId,document,parents:[] as string[],requestId:"initial"},first=await saveStudioRevision(alice,input);
 assert.equal(await saveStudioRevision(alice,input),first);assert.equal((await readStudios(alice,world.worldId))[0].revisions.length,1);
 await assert.rejects(saveStudioRevision(alice,{...input,document:editStudio(document,{type:"title",title:"Changed payload"})}),e=>e instanceof KernelError&&e.name==="conflict");
 await assert.rejects(readStudios(bob,world.worldId),e=>e instanceof KernelError&&e.name==="forbidden");
 await alice.issueGrant({grantee:bid,capability:"kernel.read",scope:world.scope});
 await assert.rejects(saveStudioRevision(bob,{...input,parents:[first],requestId:"no-write"}),e=>e instanceof KernelError&&e.name==="forbidden");
 const grant=await alice.issueGrant({grantee:bid,capability:"world.entity.write",scope:world.scope});
 const a=await saveStudioRevision(alice,{...input,document:editStudio(document,{type:"title",title:"Alice's desk"}),parents:[first],requestId:"alice-edit"});
 const b=await saveStudioRevision(bob,{...input,document:editStudio(document,{type:"title",title:"Bob's desk"}),parents:[first],requestId:"bob-edit"});
 const fork=(await readStudios(alice,world.worldId))[0];assert.deepEqual(new Set(fork.heads.map(r=>r.id)),new Set([a,b]));assert.equal(fork.revisions.find(r=>r.id===b)?.authorId,bid);assert.equal(fork.revisions.find(r=>r.id===a)?.authorId,aid);
 await assert.rejects(saveStudioRevision(alice,{...input,parents:["00000000-0000-4000-8000-000000000099"],requestId:"bad-parent"}),/parent/);
 // A generic entity update cannot forge the creation snapshot or its author.
 await bob.upsertEntity({entityId:a,kind:"document",scope:world.scope,title:"Forged",attributes:{documentType:"studio_revision",document:{...document,title:"Forged"},parents:[b]}});
 const immutable=(await readStudios(alice,world.worldId))[0];assert.equal(immutable.revisions.find(r=>r.id===a)?.document.title,"Alice's desk");assert.equal(immutable.revisions.find(r=>r.id===a)?.authorId,aid);
 await saveStudioRevision(alice,{...input,parents:[a,b],requestId:"resolve"});assert.equal((await readStudios(alice,world.worldId))[0].heads.length,1);
 await alice.revokeGrant(grant,"Access ended");await assert.rejects(saveStudioRevision(bob,{...input,parents:[b],requestId:"revoked"}),e=>e instanceof KernelError&&e.name==="forbidden");
});
