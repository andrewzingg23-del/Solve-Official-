import {parseStudio,validateStudio,type StudioDocument} from "./document";
export type DraftVersion={document:StudioDocument;baseParents:string[]|null};
export type DraftState=DraftVersion&{past:DraftVersion[];future:DraftVersion[];saved:boolean;storageError:boolean;recoverySource:string|null;creations:{id:string;title:string}[]};
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function version(raw:unknown):DraftVersion{const r=raw as DraftVersion;if(!r||typeof r!=="object")throw new Error("Invalid draft");const p=r.baseParents;if(p!==null&&(!Array.isArray(p)||p.length>16||new Set(p).size!==p.length||p.some(id=>typeof id!=="string"||!UUID.test(id))))throw new Error("Invalid draft ancestry");return {document:validateStudio(r.document),baseParents:p};}
export function encodeDraft(draft:DraftState){return JSON.stringify({schema:"solve.studio.draft.v2",document:draft.document,baseParents:draft.baseParents,past:draft.past.slice(-8),future:draft.future.slice(0,8)});}
export function decodeDraft(raw:string):Pick<DraftState,"document"|"baseParents"|"past"|"future">|null{
 if(raw.length>1_000_000)return null;
 try{const r=JSON.parse(raw);if(r?.schema==="solve.studio.v1"){const document=parseStudio(raw);return document?{document,baseParents:null,past:[],future:[]}:null;}
 if(r?.schema!=="solve.studio.draft.v2"||!Array.isArray(r.past)||!Array.isArray(r.future)||r.past.length>8||r.future.length>8)return null;
 return {...version(r),past:r.past.map(version),future:r.future.map(version)};
 }catch{return null;}
}
export function replaceDraft(draft:DraftState,document:StudioDocument,baseParents=draft.baseParents):DraftState{return {...draft,document:validateStudio(document),baseParents,past:[...draft.past,{document:draft.document,baseParents:draft.baseParents}].slice(-40),future:[],saved:false};}
export function moveHistory(draft:DraftState,direction:"undo"|"redo"):DraftState{
 const next=direction==="undo"?draft.past.at(-1):draft.future[0];if(!next)return draft;
 const current={document:draft.document,baseParents:draft.baseParents};
 return direction==="undo"?{...draft,...next,past:draft.past.slice(0,-1),future:[current,...draft.future]}:{...draft,...next,past:[...draft.past,current].slice(-40),future:draft.future.slice(1)};
}
