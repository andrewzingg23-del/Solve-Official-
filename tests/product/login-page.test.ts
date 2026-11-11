import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
import { it } from "node:test";

it("existing-account routes render the sign-in action rather than the guest-upgrade dead end", async () => {
  const dir = await mkdtemp(join(tmpdir(), "solve-login-page-"));
  try {
    const stubs: Record<string,string> = {
      "next/link": `export default function Link(p){return p.children}`,
      "next/navigation": `export function redirect(){throw new Error('unexpected redirect')}`,
      "@/lib/supabase/config": `export const isSupabaseConfigured=true`,
      "@/lib/supabase/server": `export const getUser=async()=>({is_anonymous:true})`,
      "./actions": `export async function sendMagicLink(){};export async function signInLeavingGuestBehind(){}`,
    };
    const out = await build({ entryPoints:["app/login/page.tsx"],bundle:true,platform:"node",format:"cjs",write:false,
      plugins:[{name:"auth-fixture",setup(b){
        b.onResolve({filter:/.*/},a=>a.path in stubs?{path:a.path,namespace:"fixture"}:undefined);
        b.onLoad({filter:/.*/,namespace:"fixture"},a=>({contents:stubs[a.path],loader:"js"}));
      }}] });
    const file=join(dir,"page.cjs");await writeFile(file,out.outputFiles[0].text);
    const Page=createRequire(import.meta.url)(file).default;
    type UIElement = {type:unknown;props:Record<string,unknown>};
    const flatten=(e: unknown): UIElement[] => {
      if (!e||typeof e!=="object"||!("props" in e)) return [];
      const node=e as UIElement;
      return [node,...[node.props.children].flat(Infinity).flatMap(flatten)];
    };
    for (const params of [{intent:"signin"},{taken:"me@example.test"},{sent:"me@example.test",left:"1"}]) {
      const tree=flatten(await Page({searchParams:Promise.resolve(params)}));
      assert.equal(tree.find(e=>e.type==="h1")!.props.children,"Sign in to your account.");
      assert.ok(!tree.some(e=>e.props?.["data-keeps-work"]!==undefined));
      if ("sent" in params) assert.match(String(tree.find(e=>e.props.children==="Use a different email")!.props.href), /intent=signin/);
      if (!("sent" in params)) assert.equal((tree.find(e=>e.type==="form")!.props.action as {name:string}).name,"signInLeavingGuestBehind");
    }
    const fresh=flatten(await Page({searchParams:Promise.resolve({})}));
    assert.equal((fresh.find(e=>e.type==="form")!.props.action as {name:string}).name,"sendMagicLink");
  } finally { await rm(dir,{recursive:true,force:true}); }
});
