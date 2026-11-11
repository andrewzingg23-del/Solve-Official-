import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from 'esbuild';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

test('guest bootstrap preserves existing sessions and respects login gate, API boundaries and failures', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'solve-guest-'));
  const fixture = { claims: false, required: false, fail: false, signups: 0, registrations: 0 };
  Object.assign(globalThis, { __guestFixture: fixture });
  try {
    const output = await build({ entryPoints: ['lib/supabase/proxy.ts'], bundle: true, platform: 'node', format: 'esm', write: false, plugins: [{ name: 'auth-fixture', setup(b) {
      const stubs: Record<string, string> = {
        '@supabase/ssr': `export function createServerClient(url,key,options){return {auth:{getClaims:async()=>({data:{claims:globalThis.__guestFixture.claims?{sub:'existing'}:null}}),signInAnonymously:async()=>{const f=globalThis.__guestFixture;f.signups++;if(f.fail)return {error:new Error('disabled'),data:{session:null}};options.cookies.setAll([{name:'guest-cookie',value:'private-token',options:{httpOnly:true}}]);return {error:null,data:{session:{}}};}}};}`,
        'next/server': `export const NextResponse={next:({request})=>({request,cookies:new Map(),headers:new Map()})};`,
        '@/lib/auth/gate': `export const loginRequired=()=>globalThis.__guestFixture.required;`,
        '@/lib/kernel/client': `export const kernelClient=()=>({register:async()=>{globalThis.__guestFixture.registrations++;}});`,
        './config': `export const isSupabaseConfigured=true,supabaseUrl='https://example.test',supabasePublishableKey='public';`,
      };
      b.onResolve({filter:/.*/}, args => args.path in stubs ? {path:args.path,namespace:'fixture'} : undefined);
      b.onLoad({filter:/.*/,namespace:'fixture'}, args => ({contents:stubs[args.path],loader:'js'}));
    }}] });
    const path = join(dir,'proxy.mjs'); await writeFile(path, output.outputFiles[0].text);
    const {updateSession} = await import(pathToFileURL(path).href);
    // A real browser opening a page. Anything without these headers is not a person arriving.
    const request = (path='/',headers:Record<string,string>={'sec-fetch-mode':'navigate','accept':'text/html'}) =>
      ({method:'GET',nextUrl:{pathname:path},cookies:new Map(),headers:new Map(Object.entries(headers))});
    const first = request(); const guest = await updateSession(first);
    assert.equal(guest.signedIn,true); assert.equal(fixture.signups,1); assert.equal(fixture.registrations,1);
    assert.equal(first.cookies.get('guest-cookie'),'private-token');
    assert.equal(guest.response.cookies.get('guest-cookie'),'private-token');
    assert.equal(guest.response.headers.get('Cache-Control'),'private, no-store');
    fixture.claims=true; await updateSession(request()); assert.equal(fixture.signups,1);
    fixture.claims=false; fixture.required=true; await updateSession(request()); assert.equal(fixture.signups,1);
    fixture.required=false; await updateSession(request('/api/bot/chat')); await updateSession(request('/auth/callback')); assert.equal(fixture.signups,1);
    fixture.fail=true; assert.equal((await updateSession(request())).signedIn,false); assert.equal(fixture.registrations,2);
    fixture.fail=false; fixture.signups=0;

    // Only a person opening a page becomes a guest. An identity owns work and can hold a GitHub
    // token, so nothing that merely looks may mint one — staging reached 725 guests against one
    // account that way.
    await updateSession(request('/',{'sec-fetch-mode':'cors','accept':'*/*'}));
    assert.equal(fixture.signups,0,'a fetch from script is not a person arriving');
    await updateSession(request('/',{'sec-fetch-mode':'no-cors','accept':'text/html'}));
    assert.equal(fixture.signups,0,'nor is a prefetch or an embed, whatever it accepts');
    await updateSession(request('/',{'accept':'*/*'}));
    assert.equal(fixture.signups,0,'a scripted client sending no Sec-Fetch headers is not either');
    await updateSession(request('/',{'user-agent':'curl/8.4.0'}));
    assert.equal(fixture.signups,0,'an uptime check or a crawler gets the page and no identity');
    // An older or unusual browser still asks for a page, and is still a person.
    await updateSession(request('/',{'accept':'text/html,application/xhtml+xml'}));
    assert.equal(fixture.signups,1,'a browser without Sec-Fetch headers is still someone arriving');
    await updateSession(request('/'));
    assert.equal(fixture.signups,2,'and a normal navigation always is');
  } finally { await rm(dir,{recursive:true,force:true}); }
});
