import { studioTemplate } from "./templates";
// Shared bounded data for controls, imports and owned agents. Metres are canonical.
export const MATERIALS = {
 wood:{label:"Warm oak",color:"#b48d64",density:650,pricePerKg:2},
 aluminum:{label:"Aluminum",color:"#bac7d0",density:2700,pricePerKg:4},
 steel:{label:"Steel",color:"#687785",density:7850,pricePerKg:1.2},
 glass:{label:"Glass",color:"#8bc5cb",density:2500,pricePerKg:1.5},
 concrete:{label:"Concrete",color:"#c6c8bc",density:2400,pricePerKg:0.12},
 polymer:{label:"PETG",color:"#45b9ba",density:1270,pricePerKg:22},
 rubber:{label:"Rubber",color:"#26353e",density:1100,pricePerKg:3},
} as const;
export type MaterialId=keyof typeof MATERIALS;
export type Vec3=[number,number,number];
export type StudioNode={id:string;label:string;shape:"box"|"cylinder"|"sphere"|"torus";size:Vec3;position:Vec3;rotation:Vec3;material:MaterialId};
export const STUDIO_TEMPLATES=[
 {id:"architecture",label:"Living spaces",detail:"Architecture · rooms · places",icon:"space"},
 {id:"mobility",label:"Things that move",detail:"Bicycles · vehicles · mechanisms",icon:"bike"},
 {id:"object",label:"Everyday objects",detail:"Furniture · products · prototypes",icon:"object"},
 {id:"blank",label:"Something new",detail:"An open studio for your idea",icon:"spark"},
] as const;
export type TemplateId=typeof STUDIO_TEMPLATES[number]["id"];
export type StudioStep={id:string;title:string;status:"todo"|"doing"|"done"|"needs_review";note:string;dependsOnDesign:boolean};
export type StudioDocument={schema:"solve.studio.v1";id:string;title:string;brief:string;template:TemplateId;revision:number;units:"m";nodes:StudioNode[];steps:StudioStep[];rates:Record<MaterialId,{density:number;pricePerKg:number}>;wastePercent:number};
export class StudioInputError extends Error {}
const invalid=(message:string):never=>{throw new StudioInputError(message);};
function object(value:unknown):Record<string,unknown>{if(!value||typeof value!=="object"||Array.isArray(value))return invalid("Expected a studio object");return value as Record<string,unknown>;}
function keys(raw:Record<string,unknown>,allowed:string[]){if(Object.keys(raw).some(k=>!allowed.includes(k)))invalid("Studio contains an unsupported field");}
function text(value:unknown,max:number,empty=false):string{if(typeof value!=="string"||value.length>max||(!empty&&!value.trim())||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value))return invalid("Invalid studio text");return value.trim();}
function id(value:unknown){const r=text(value,80);if(!/^[a-zA-Z0-9_-]+$/.test(r))return invalid("Invalid studio id");return r;}
function num(value:unknown,low:number,high:number,label:string):number{if(typeof value!=="number"||!Number.isFinite(value)||value<low||value>high)return invalid("Invalid "+label);return value;}
function vector(value:unknown,low:number,high:number,label:string):Vec3{if(!Array.isArray(value)||value.length!==3)return invalid("Invalid "+label);return value.map(v=>num(v,low,high,label)) as Vec3;}
export function validateNode(value:unknown):StudioNode{
 const r=object(value);keys(r,["id","label","shape","size","position","rotation","material"]);
 if(!["box","cylinder","sphere","torus"].includes(String(r.shape)))return invalid("Unsupported geometry");
 if(!Object.hasOwn(MATERIALS,String(r.material)))return invalid("Unsupported material");
 const size=vector(r.size,0.001,500,"dimension");
 if(r.shape==="torus"&&(size[2]>=size[0]/2||size[2]>=size[1]/2))return invalid("A ring's tube must be smaller than its diameter");
 return {id:id(r.id),label:text(r.label,100),shape:r.shape as StudioNode["shape"],size,position:vector(r.position,-1000,1000,"position"),rotation:vector(r.rotation,-360,360,"rotation"),material:r.material as MaterialId};
}
export function validateStudio(value:unknown):StudioDocument{
 const r=object(value);keys(r,["schema","id","title","brief","template","revision","units","nodes","steps","rates","wastePercent"]);
 if(r.schema!=="solve.studio.v1"||r.units!=="m")return invalid("Unsupported studio schema or units");
 if(!STUDIO_TEMPLATES.some(t=>t.id===r.template))return invalid("Unsupported studio template");
 if(!Array.isArray(r.nodes)||r.nodes.length>64)return invalid("A studio supports up to 64 objects");
 const nodes=r.nodes.map(validateNode);if(new Set(nodes.map(n=>n.id)).size!==nodes.length)return invalid("Object ids must be unique");
 if(!Array.isArray(r.steps)||r.steps.length>24)return invalid("Invalid studio plan");
 const steps=r.steps.map(v=>{const s=object(v);keys(s,["id","title","status","note","dependsOnDesign"]);if(!["todo","doing","done","needs_review"].includes(String(s.status))||typeof s.dependsOnDesign!=="boolean")return invalid("Invalid plan status");return {id:id(s.id),title:text(s.title,160),status:s.status as StudioStep["status"],note:text(s.note,600,true),dependsOnDesign:s.dependsOnDesign};});
 if(new Set(steps.map(s=>s.id)).size!==steps.length)return invalid("Plan ids must be unique");
 const ratesRaw=object(r.rates);keys(ratesRaw,Object.keys(MATERIALS));
 const rates=Object.fromEntries(Object.keys(MATERIALS).map(k=>{const rate=object(ratesRaw[k]);keys(rate,["density","pricePerKg"]);return [k,{density:num(rate.density,1,30000,"density"),pricePerKg:num(rate.pricePerKg,0,100000,"price assumption")}];})) as StudioDocument["rates"];
 const revision=num(r.revision,1,1000000,"revision");if(!Number.isInteger(revision))return invalid("Revision must be an integer");
 return {schema:"solve.studio.v1",id:id(r.id),title:text(r.title,160),brief:text(r.brief,2000,true),template:r.template as TemplateId,revision,units:"m",nodes,steps,rates,wastePercent:num(r.wastePercent,0,100,"waste allowance")};
}
export function parseStudio(raw:string):StudioDocument|null{if(raw.length>64000)return null;try{return validateStudio(JSON.parse(raw));}catch{return null;}}
export function assembleStudio(template:TemplateId,title:string,studioId:string):StudioDocument{
 return validateStudio({schema:"solve.studio.v1",id:studioId,title,brief:"",template,revision:1,units:"m",nodes:studioTemplate(template),rates:Object.fromEntries(Object.entries(MATERIALS).map(([k,v])=>[k,{density:v.density,pricePerKg:v.pricePerKg}])),wastePercent:10,steps:[
 {id:"intent",title:"Define the purpose and constraints",note:"",status:"todo",dependsOnDesign:false},
 {id:"design",title:"Refine dimensions and materials",note:"",status:"todo",dependsOnDesign:true},
 {id:"validate",title:"Check feasibility with the right expertise",note:"",status:"todo",dependsOnDesign:true},
 {id:"source",title:"Find suppliers and obtain real quotes",note:"",status:"todo",dependsOnDesign:true},
 {id:"build",title:"Coordinate people, tools and the build",note:"",status:"todo",dependsOnDesign:true},
 {id:"evidence",title:"Record the outcome and what changed",note:"",status:"todo",dependsOnDesign:false},
 ]});
}
export type StudioOperation=
 |{type:"node";id:string;patch:Partial<Omit<StudioNode,"id">>}
 |{type:"add";node:StudioNode}|{type:"remove";id:string}|{type:"title";title:string}|{type:"brief";brief:string}
 |{type:"rate";material:MaterialId;density:number;pricePerKg:number}
 |{type:"step";id:string;status:StudioStep["status"];note?:string;title?:string};
export function editStudio(document:StudioDocument,op:StudioOperation):StudioDocument{
 const next=structuredClone(document);
 if(op.type==="node"||op.type==="remove"){const i=next.nodes.findIndex(n=>n.id===op.id);if(i<0)return invalid("Object not found");if(op.type==="node")next.nodes[i]={...next.nodes[i],...op.patch,id:op.id};else next.nodes.splice(i,1);}
 else if(op.type==="add")next.nodes.push(op.node);else if(op.type==="title")next.title=op.title;else if(op.type==="brief")next.brief=op.brief;
 else if(op.type==="rate")next.rates[op.material]={density:op.density,pricePerKg:op.pricePerKg};
 else if(op.type==="step"){const s=next.steps.find(s=>s.id===op.id);if(!s)return invalid("Plan step not found");s.status=op.status;if(op.note!==undefined)s.note=op.note;if(op.title!==undefined)s.title=op.title;}
 if(["node","remove","add","rate"].includes(op.type))next.steps.forEach(s=>{if(s.dependsOnDesign&&s.status==="done")s.status="needs_review";});
 next.revision++;return validateStudio(next);
}
// Change detector only, never advertised as cryptographic evidence.
export function studioFingerprint(document:StudioDocument):string{
 const bytes=JSON.stringify({nodes:document.nodes,rates:document.rates,waste:document.wastePercent});let hash=2166136261;
 for(let i=0;i<bytes.length;i++)hash=Math.imul(hash^bytes.charCodeAt(i),16777619);return "design-"+(hash>>>0).toString(16).padStart(8,"0");
}
export function nodeVolume(n:StudioNode):number{const[x,y,z]=n.size;if(n.shape==="cylinder")return Math.PI*x*z*y/4;if(n.shape==="sphere")return Math.PI*x*y*z/6;if(n.shape==="torus")return 2*Math.PI**2*((x-z)/2)*(z/2)**2*y/x;return x*y*z;}
export function materialFacts(document:StudioDocument){
 const rows=document.nodes.map(n=>{const volumeM3=nodeVolume(n),massKg=volumeM3*document.rates[n.material].density;return {id:n.id,label:n.label,material:n.material,volumeM3,massKg,cost:massKg*document.rates[n.material].pricePerKg*(1+document.wastePercent/100)};});
 return {rows,volumeM3:rows.reduce((s,r)=>s+r.volumeM3,0),massKg:rows.reduce((s,r)=>s+r.massKg,0),cost:rows.reduce((s,r)=>s+r.cost,0),currency:"USD",fingerprint:studioFingerprint(document),basis:"planning_assumptions" as const};
}
export const STUDIO_CAPABILITIES=[
 {id:"scene.edit",status:"available"},{id:"rigid-body.drop",status:"available"},{id:"material.quantities",status:"available"},
 {id:"cad.constraints",status:"adapter_required"},{id:"engineering.validate",status:"adapter_required"},{id:"local.requirements",status:"adapter_required"},
] as const;
