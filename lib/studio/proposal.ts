import {validateStudio,type StudioDocument} from "./document";
export function proposalMatches(current:StudioDocument,base:StudioDocument){return JSON.stringify(current)===JSON.stringify(base);}
export function applyStudioProposal(current:StudioDocument,base:StudioDocument,proposal:StudioDocument):StudioDocument{
 if(!proposalMatches(current,base))throw new Error("Your design changed since this request. Request a fresh proposal; your edits are preserved.");
 return validateStudio({...current,title:proposal.title,brief:proposal.brief,nodes:proposal.nodes,revision:current.revision+1,steps:current.steps.map(s=>s.dependsOnDesign&&s.status==="done"?{...s,status:"needs_review"}:s)});
}
export function studioProposal(base:StudioDocument,reply:string):StudioDocument|null{
 if(reply.length>64000)return null;
 try{
 const clean=reply.trim().replace(/^```(?:json)?\s*/,"").replace(/\s*```$/,""),raw=JSON.parse(clean);
 if(!raw||typeof raw!=="object"||Array.isArray(raw)||Object.keys(raw).some(k=>!["title","brief","nodes"].includes(k)))return null;
 return validateStudio({...base,title:raw.title,brief:raw.brief,nodes:raw.nodes,revision:base.revision+1,steps:base.steps.map(s=>s.dependsOnDesign&&s.status==="done"?{...s,status:"needs_review"}:s)});
 }catch{return null;}
}
