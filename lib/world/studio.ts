import { KernelError,type Kernel } from "../kernel/client";
import { loadCreativeWorld } from "./creative";
import { validateStudio,type StudioDocument } from "../studio/document";
// Creation events, never mutable entity attributes, are the snapshot authority.
export type StudioRevision={id:string;document:StudioDocument;parents:string[];authorId:string;onBehalfOf:string|null;clientName:string|null;at:string;requestId:string};
export type SharedStudio={id:string;revisions:StudioRevision[];heads:StudioRevision[]};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const bad=(message:string):never=>{throw new KernelError("invalid",message,"");};
export async function readStudios(kernel:Kernel,worldId:string):Promise<SharedStudio[]>{
 const{world}=await loadCreativeWorld(kernel,worldId),revisions:StudioRevision[]=[];let afterSeq=0;
 for(let page=0;page<200;page++){
 const events=await kernel.readEvents(world.scope,{afterSeq,limit:500});
 for(const e of events){if(e.scope!==world.scope||e.type!=="kernel.entity.created")continue;
 const request=e.payload.request as Record<string,unknown>|undefined,attrs=request?.attributes as Record<string,unknown>|undefined;
 if(request?.kind!=="document"||attrs?.documentType!=="studio_revision")continue;
 try{const document=validateStudio(attrs.document),parents=attrs.parents;
 if(!Array.isArray(parents)||parents.length>16||parents.some(p=>typeof p!=="string"||!UUID.test(p))||new Set(parents).size!==parents.length||parents.some(p=>!revisions.some(r=>r.id===p&&r.document.id===document.id)))continue;
 const id=e.payload.entity_id;if(typeof id!=="string"||!UUID.test(id))continue;
 const via=attrs.via as {client_name?:unknown}|undefined;
 revisions.push({id,document,parents,authorId:e.actor_id,onBehalfOf:e.on_behalf_of,clientName:typeof via?.client_name==="string"?via.client_name.slice(0,80):null,at:e.occurred_at,requestId:typeof attrs.requestId==="string"?attrs.requestId:""});
 }catch{/* Invalid generic documents are not studio records. */}}
 if(events.length<500)break;afterSeq=events.at(-1)!.seq;
 if(page===199)throw new KernelError("unavailable","This World needs a paged studio index before its complete history can be loaded","");
 }
 const groups=new Map<string,StudioRevision[]>();for(const r of revisions){const group=groups.get(r.document.id)??[];group.push(r);groups.set(r.document.id,group);}
 return [...groups].map(([id,revisions])=>{const parents=new Set(revisions.flatMap(r=>r.parents));return {id,revisions,heads:revisions.filter(r=>!parents.has(r.id))};});
}
export async function saveStudioRevision(kernel:Kernel,input:{worldId:string;document:StudioDocument;parents:string[];requestId:string;via?:{clientId:string|null;clientName:string|null}}):Promise<string>{
 const document=validateStudio(input.document);
 if(!Array.isArray(input.parents)||input.parents.length>16||input.parents.some(p=>typeof p!=="string"||!UUID.test(p))||new Set(input.parents).size!==input.parents.length)return bad("Invalid studio parents");
 if(typeof input.requestId!=="string"||!/^[a-zA-Z0-9_:-]{1,100}$/.test(input.requestId))return bad("Invalid studio request id");
 const{world}=await loadCreativeWorld(kernel,input.worldId),studio=(await readStudios(kernel,input.worldId)).find(s=>s.id===document.id),actor=await kernel.whoami();
 const retry=studio?.revisions.some(r=>r.requestId===input.requestId&&r.authorId===actor?.actor_id);
 if(!retry){if(studio&&input.parents.length===0)throw new KernelError("conflict","An existing studio needs an explicit parent revision","");for(const p of input.parents)if(!studio?.revisions.some(r=>r.id===p))return bad("Studio parent not found in this World and studio");}
 return kernel.upsertEntity({kind:"document",scope:world.scope,title:document.title,summary:"Editable studio concept; estimates and checklist are unverified planning data.",visibility:"members",attributes:{documentType:"studio_revision",document,parents:input.parents,requestId:input.requestId,...(input.via?{via:{client_id:input.via.clientId?.slice(0,200)??null,client_name:input.via.clientName?.slice(0,80)??null}}:{})},idempotencyKey:"studio:"+document.id+":"+input.requestId});
}
