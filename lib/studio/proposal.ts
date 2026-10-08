import {validateStudio,type StudioDocument} from "./document";
export function studioProposal(base:StudioDocument,reply:string):StudioDocument|null{
 if(reply.length>64000)return null;
 try{
 const clean=reply.trim().replace(/^```(?:json)?\s*/,"").replace(/\s*```$/,""),raw=JSON.parse(clean);
 if(!raw||typeof raw!=="object"||Array.isArray(raw)||Object.keys(raw).some(k=>!["title","brief","nodes"].includes(k)))return null;
 return validateStudio({...base,title:raw.title,brief:raw.brief,nodes:raw.nodes,revision:base.revision+1,steps:base.steps.map(s=>s.dependsOnDesign&&s.status==="done"?{...s,status:"needs_review"}:s)});
 }catch{return null;}
}
