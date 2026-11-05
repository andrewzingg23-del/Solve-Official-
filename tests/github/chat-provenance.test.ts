// Exercises the real route with explicitly labelled identity/provider adapters.
// A missing GitHub observation must never reach a model, including error paths.
import assert from 'node:assert/strict';
import { it } from 'node:test';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

declare global { var __provenance: { reads:number; completions:number; fail:boolean }; }
let compiled:Promise<typeof import('../../app/api/bot/chat/route')>|undefined;
async function route(){return compiled??=(async()=>{
 const dir=await mkdtemp(join(tmpdir(),'sov-provenance-'));
 const stubs:Record<string,string>={
  '@/lib/supabase/server':'export async function getUser(){return {id:"provenance-test",email:"staging@example.invalid"}}',
  '@/lib/kernel/server':'export async function getKernel(){throw new Error("no kernel needed for unavailable development status")}',
  '@/lib/passport/context':'export async function passportContext(){return ""}',
  '@/lib/github/repo':`export { repoForViewer, roomRepos } from ${JSON.stringify(resolve('lib/github/repo.ts'))}; export async function readRepo(ref){globalThis.__provenance.reads++;if(globalThis.__provenance.fail)throw new Error("network unavailable");return {ok:false,reason:"not_connected",ref};}`,
  '@/lib/bot/openrouter':'export const OPENROUTER_MISSING_KEY_ERROR="provider not configured";export function buildChatCompletionBody(x){return x}export async function completeChat(){globalThis.__provenance.completions++;return {reply:"MODEL SPECULATION",inputTokens:1,outputTokens:1}}',
  'server-only':''
 };
 await build({entryPoints:['app/api/bot/chat/route.ts'],outfile:join(dir,'route.mjs'),bundle:true,format:'esm',platform:'node',packages:'external',plugins:[{name:'explicit-provenance-adapters',setup(b){b.onResolve({filter:/.*/},a=>a.path in stubs?{path:a.path,namespace:'fixture'}:a.path.startsWith('/')?{path:a.path,namespace:'file'}:undefined);b.onLoad({filter:/.*/,namespace:'fixture'},a=>({contents:stubs[a.path]}));}}]});
 const loaded=await import(pathToFileURL(join(dir,'route.mjs')).href);await rm(dir,{recursive:true});return loaded;
 })();}

it('missing or failing GitHub evidence never becomes model speculation or leaked deployment history',async()=>{
 const names=['GITHUB_ROOMS','OPENROUTER_API_KEY','SOLVE_DEPLOYED_REPO','SOLVE_DEPLOYED_REF','SOLVE_DEPLOYED_AT','SOLVE_DEPLOYED_LOG'];
 const previous=names.map(n=>process.env[n]);
 try{
  process.env.OPENROUTER_API_KEY='test-adapter-only';
  process.env.SOLVE_DEPLOYED_REPO='private-org/private-repository';
  process.env.SOLVE_DEPLOYED_REF='main';
  process.env.SOLVE_DEPLOYED_AT='2026-10-31T11:59:00Z';
  process.env.SOLVE_DEPLOYED_LOG=JSON.stringify([{sha:'a'.repeat(40),at:'2026-10-31T11:58:00Z',message:'PRIVATE COMMIT MUST NOT LEAK'}]);
  const actual=await route();
  for(const scenario of [{pair:'',fail:false,reads:0},{pair:'staging@example.invalid=private-org/private-repository@main',fail:false,reads:1},{pair:'staging@example.invalid=private-org/private-repository@main',fail:true,reads:1}]){
   for(const message of ['What is Codex working on?','Is Codex still running?','Is ChatGPT running?','What are the agents doing?','What is the runner doing?','Did the build pass?']){
   globalThis.__provenance={reads:0,completions:0,fail:scenario.fail};process.env.GITHUB_ROOMS=scenario.pair;
   const response=await actual.POST(new Request('http://localhost/api/bot/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({botName:'Nova',message})}));
   assert.equal(response.status,200);const body=await response.json();
   assert.match(body.reply,/Development status unavailable/);assert.match(body.reply,/Runner status: unavailable/);
   assert.equal(body.source,'development-room');assert.equal(body.observation,null);assert.deepEqual(body.runner,{status:'unavailable'});
   assert.doesNotMatch(body.reply,/PRIVATE COMMIT|MODEL SPECULATION/);
   assert.equal(globalThis.__provenance.completions,0);assert.equal(globalThis.__provenance.reads,scenario.reads);
   }
  }
 }finally{names.forEach((n,i)=>previous[i]===undefined?delete process.env[n]:process.env[n]=previous[i]);}
});
