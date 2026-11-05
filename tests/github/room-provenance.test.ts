import assert from 'node:assert/strict';
import { it } from 'node:test';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createKernelDb, user } from '../kernel/harness';
import { kernelClient, type Kernel } from '../../lib/kernel/client';
import { localSupabase } from '../../lib/kernel/local';
import { createCreativeWorld, createCreativeResourceEntry } from '../../lib/world/creative';
import type { RepoView } from '../../lib/github/repo';
import { grantWorldAccess } from '../../lib/world/collaboration';

declare global { var __roomProvenance: { kernel:Kernel; completions:number; reads:number; tokenUses:boolean[]; view?:RepoView }; }
let compiled:Promise<typeof import('../../app/api/worlds/[worldId]/conversation/route')>|undefined;
async function route(){return compiled??=(async()=>{
 const dir=await mkdtemp(join(tmpdir(),'sov-room-source-'));
 const stubs:Record<string,string>={
  '@/lib/supabase/server':'export async function getUser(){return {id:"room-provenance-test",email:"staging@example.invalid"}}',
  '@/lib/kernel/server':'export async function getKernel(){return globalThis.__roomProvenance.kernel}',
  '@/lib/github/repo':`export { repoForWorld } from ${JSON.stringify(resolve('lib/github/repo.ts'))};export async function readRepo(ref,opts){const f=globalThis.__roomProvenance;f.reads++;f.tokenUses.push(Boolean(opts.token));return f.view&&opts.token?{ok:true,view:f.view}:{ok:false,reason:"not_connected",ref}}`,
  '@/lib/bot/openrouter':'export function buildChatCompletionBody(x){return x}export async function completeChat(){globalThis.__roomProvenance.completions++;return {reply:"MODEL SPECULATION",inputTokens:1,outputTokens:1}}',
  'server-only':''
 };
 await build({entryPoints:['app/api/worlds/[worldId]/conversation/route.ts'],outfile:join(dir,'route.mjs'),bundle:true,format:'esm',platform:'node',packages:'external',plugins:[{name:'explicit-room-source-adapters',setup(b){b.onResolve({filter:/.*/},a=>a.path.endsWith('/kernel/client')?{path:resolve('lib/kernel/client.ts'),external:true}:a.path in stubs?{path:a.path,namespace:'fixture'}:a.path.startsWith('/')?{path:a.path,namespace:'file'}:undefined);b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:stubs[a.path]}));}}]});
 const loaded=await import(pathToFileURL(join(dir,'route.mjs')).href);await rm(dir,{recursive:true});return loaded;
 })();}

it('the actual saved Room route answers disconnected development questions without inference and preserves isolation',async()=>{
 const db=await createKernelDb();const owner=kernelClient(localSupabase(db,user('room-source-owner')));await owner.register('Staging tester');
 const world=await createCreativeWorld(owner,{worldId:'e513c7a7-2b23-41f5-8945-46bccd142cd1',title:'Development'});
 const member=kernelClient(localSupabase(db,user('room-source-member')));
 await grantWorldAccess(owner,{scope:world.scope,granteeActorId:await member.register('Member'),role:'viewer',requestId:'source-member'});
 await createCreativeResourceEntry(owner,{scope:world.scope,worldEntityId:world.entityId,requestId:'repo-link',entryType:'offer',category:'resource',title:'Repository',sourceUrl:'https://github.com/private-org/private-repo',description:'Saved URL, no authorization'});
 globalThis.__roomProvenance={kernel:owner,completions:0,reads:0,tokenUses:[]};const actual=await route();
 const names=['OPENROUTER_API_KEY','GITHUB_TOKEN','GITHUB_ROOMS'];const previous=names.map(n=>process.env[n]);process.env.OPENROUTER_API_KEY='test-adapter-only';delete process.env.GITHUB_ROOMS;
 const send=(id:string)=>actual.POST(new Request('http://localhost/conversation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requestId:id,intent:'ask_ai',text:'Is Codex still running?'})}),{params:Promise.resolve({worldId:world.worldId})});
 try{
  const response=await send('source-question');assert.equal(response.status,200);const body=await response.json();assert.equal(body.aiStatus,'complete');
  const messages=await owner.readRoomMessages(world.worldId);const reply=messages.find(m=>m.reply_to===body.messageId)!;
  assert.match(reply.text,/Development status unavailable/);assert.match(reply.text,/Runner status: unavailable/);assert.match(reply.text,/no model used/i);
  assert.deepEqual(reply.source_refs,[],'unrelated World documents are not GitHub evidence');
  assert.equal(globalThis.__roomProvenance.completions,0);assert.equal(globalThis.__roomProvenance.reads,1);
  await send('source-question');assert.equal((await owner.readRoomMessages(world.worldId)).length,2,'same saved question replays the same reply');
  delete process.env.OPENROUTER_API_KEY;await send('source-without-provider');assert.equal(globalThis.__roomProvenance.completions,0);
  process.env.GITHUB_TOKEN='test-read-adapter-only';
  globalThis.__roomProvenance.view={ref:{owner:'private-org',repo:'private-repo',trunk:'main'},url:'https://github.com/private-org/private-repo',trunk:'main',readAt:'2026-10-31T11:59:00Z',source:'github',trunkBuilds:[],commits:[],lanes:[],builders:[]};
  process.env.GITHUB_ROOMS='staging@example.invalid=private-org/private-repo@main';
  await send('personal-only-pairing');assert.equal(globalThis.__roomProvenance.tokenUses.at(-1),false,'personal pairing cannot disclose private evidence into shared conversation');
  const personalReply=(await member.readRoomMessages(world.worldId)).at(-1)!;assert.match(personalReply.text,/Development status unavailable/);assert.doesNotMatch(personalReply.text,/private-org\/private-repo/);
  process.env.GITHUB_ROOMS=`${world.worldId}=private-org/private-repo@main`;
  await send('world-scoped-pairing');assert.equal(globalThis.__roomProvenance.tokenUses.at(-1),true,'explicit World pairing can use its reader');
  const observed=(await member.readRoomMessages(world.worldId)).at(-1)!;assert.match(observed.text,/2026-10-31T11:59:00/);assert.match(observed.text,/private-org\/private-repo/);assert.match(observed.text,/Runner status: unavailable/);assert.deepEqual(observed.source_refs,[]);
  const outsider=kernelClient(localSupabase(db,user('room-source-outsider')));await outsider.register();globalThis.__roomProvenance.kernel=outsider;
  const before=globalThis.__roomProvenance.reads;assert.equal((await send('outsider-question')).status,403);assert.equal(globalThis.__roomProvenance.reads,before,'denied users cannot trigger source reads');
 }finally{names.forEach((n,i)=>previous[i]===undefined?delete process.env[n]:process.env[n]=previous[i]);}
});
