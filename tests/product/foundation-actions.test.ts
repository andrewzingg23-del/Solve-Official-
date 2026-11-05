import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createKernelDb, user } from '../kernel/harness';
import { kernelClient, type Kernel } from '../../lib/kernel/client';
import { localSupabase } from '../../lib/kernel/local';
import { createCreativeWorld, loadCreativeWorld } from '../../lib/world/creative';

declare global { var __foundation: { user: {id:string;is_anonymous:boolean}|null; kernel:Kernel; emails:string[] }; }
type Modules={save:Pick<typeof import('../../app/projects/[worldId]/actions'),'saveProjectDocument'>;claim:Pick<typeof import('../../app/login/claim-actions'),'requestAccountClaim'>};
let compiled:Promise<Modules>|undefined;
async function actions(){return compiled??=(async()=>{
 const dir=await mkdtemp(join(tmpdir(),'sov-step1-'));
 const stubs:Record<string,string>={
 '@/lib/supabase/server':'export async function getUser(){return globalThis.__foundation.user;} export async function createClient(){return {auth:{updateUser:async(input)=>{globalThis.__foundation.emails.push(input.email);return {data:{user:globalThis.__foundation.user},error:null}}}};}',
 '@/lib/kernel/server':'export async function getKernel(){return globalThis.__foundation.kernel;}',
 'next/headers':'export async function headers(){return new Headers({origin:"http://localhost:3106"});}',
 'next/cache':'export function revalidatePath(){}', 'server-only':''
 };
 await build({entryPoints:{save:'app/projects/[worldId]/actions.ts',claim:'app/login/claim-actions.ts'},outdir:dir,bundle:true,format:'esm',platform:'node',packages:'external',plugins:[{name:'explicit-auth-fixture',setup(b){b.onResolve({filter:/.*/},a=>a.path.endsWith('/kernel/client')?{path:resolve('lib/kernel/client.ts'),external:true}:a.path in stubs?{path:a.path,namespace:'fixture'}:undefined);b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:stubs[a.path]}));}}]});
 const modules:Modules={save:await import(pathToFileURL(join(dir,'save.js')).href),claim:await import(pathToFileURL(join(dir,'claim.js')).href)};await rm(dir,{recursive:true});return modules;
 })();}
async function setup(){const db=await createKernelDb();const owner=kernelClient(localSupabase(db,user('step1-owner')));await owner.register();globalThis.__foundation={user:{id:'step1-owner',is_anonymous:false},kernel:owner,emails:[]};const world=await createCreativeWorld(owner,{worldId:'f75331de-f66c-40c4-bca9-eb682eea2cda',title:'Development'});return{owner,world};}

test('Project adapter saves, reopens, retries once, and rejects a stale revision',async()=>{
 const {owner,world}=await setup();const a=await actions();const input={requestId:'first-document',title:'Decision',body:'Use the canonical kernel.\n',position:{x:50,y:50}};
 const first=await a.save.saveProjectDocument(world.worldId,'step1-owner',input);assert.ok(first.ok);assert.equal(first.artifact.body,input.body);
 const retry=await a.save.saveProjectDocument(world.worldId,'step1-owner',input);assert.ok(retry.ok);assert.equal(retry.artifact.entityId,first.artifact.entityId);
 assert.equal((await loadCreativeWorld(owner,world.worldId)).artifacts.length,1);
 const patch={...input,requestId:'second-document',entityId:first.artifact.entityId,expectedVersion:1,body:'Revised decision.'};assert.equal((await a.save.saveProjectDocument(world.worldId,'step1-owner',patch)).ok,true);
 const stale=await a.save.saveProjectDocument(world.worldId,'step1-owner',{...patch,requestId:'stale-document',body:'Overwrite'});assert.ok(!stale.ok);assert.equal(stale.status,409);
 assert.equal((await loadCreativeWorld(owner,world.worldId)).artifacts[0].body,'Revised decision.');
 const lateReplay=await a.save.saveProjectDocument(world.worldId,'step1-owner',input);assert.ok(!lateReplay.ok);assert.equal(lateReplay.status,409,'a later version must not be reported as an exact readback of this save');
});
test('Project adapter rejects account switching before it can write',async()=>{
 const {owner,world}=await setup();const a=await actions();globalThis.__foundation.user={id:'different-account',is_anonymous:false};
 const response=await a.save.saveProjectDocument(world.worldId,'step1-owner',{requestId:'stale-owner',title:'Wrong',body:'No',position:{x:1,y:1}});assert.ok(!response.ok);assert.match(response.error,/sign-in changed/i);assert.equal((await loadCreativeWorld(owner,world.worldId)).artifacts.length,0);
});
test('claiming links only the current anonymous identity; it never signs into another account',async()=>{
 await setup();const a=await actions();
 assert.equal((await a.claim.requestAccountClaim('old-account','test@example.invalid')).ok,false);assert.deepEqual(globalThis.__foundation.emails,[]);
 assert.equal((await a.claim.requestAccountClaim('step1-owner','test@example.invalid')).ok,false);
 globalThis.__foundation.user={id:'step1-owner',is_anonymous:true};
 assert.equal((await a.claim.requestAccountClaim('step1-owner','not-an-email')).ok,false);
 const response=await a.claim.requestAccountClaim('step1-owner','test@example.invalid');assert.equal(response.ok,true);assert.deepEqual(globalThis.__foundation.emails,['test@example.invalid']);assert.equal(globalThis.__foundation.user.id,'step1-owner');
});
