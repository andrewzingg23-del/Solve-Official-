"use client";
import {useCallback,useMemo,useSyncExternalStore} from "react";
import {editStudio,type StudioDocument,type StudioOperation} from "./document";
import {decodeDraft,encodeDraft,moveHistory,replaceDraft,type DraftState} from "./draft-state";
const cache=new Map<string,DraftState>(),listeners=new Set<()=>void>(),prefix="solve.studio.draft.v1:",libraryKey="solve.studio.library.v1";
const notify=()=>listeners.forEach(fn=>fn());
function library(){try{const r=JSON.parse(localStorage.getItem(libraryKey)||"[]");return Array.isArray(r)?r.filter((v:unknown):v is {id:string;title:string}=>!!v&&typeof v==="object"&&typeof (v as {id?:unknown}).id==="string"&&typeof (v as {title?:unknown}).title==="string").slice(0,200).map(v=>({id:v.id.slice(0,80),title:v.title.slice(0,160)})):[];}catch{return [];}}
function archive(version:DraftState){const creations=library(),i=creations.findIndex(c=>c.id===version.document.id);if(i<0){if(creations.length>=200)throw new Error("Creation archive is full");creations.push({id:version.document.id,title:version.document.title});}else creations[i].title=version.document.title;localStorage.setItem(prefix+"archive:"+version.document.id,encodeDraft(version));localStorage.setItem(libraryKey,JSON.stringify(creations));return creations;}
function write(key:string,draft:DraftState){try{if(draft.recoverySource)localStorage.setItem(prefix+key+":recovery",draft.recoverySource);if(key.startsWith("private:"))draft.creations=archive(draft);localStorage.setItem(prefix+key,encodeDraft(draft));draft.saved=true;draft.storageError=false;}catch{draft.saved=false;draft.storageError=true;}cache.set(key,draft);notify();}
function subscribe(callback:()=>void){listeners.add(callback);const changed=(e:StorageEvent)=>{if(!e.key?.startsWith(prefix))return;const key=e.key.slice(prefix.length),p=cache.get(key),d=e.newValue?decodeDraft(e.newValue):null;if(d&&p){cache.set(key,{...replaceDraft(p,d.document,d.baseParents),saved:true,storageError:false,creations:library()});notify();}};window.addEventListener("storage",changed);return()=>{listeners.delete(callback);window.removeEventListener("storage",changed);};}
export function useStudioDraft(initial:StudioDocument,namespace="private",initialParents:string[]|null=null){
 const key=namespace+":"+initial.id,server=useMemo<DraftState>(()=>({document:initial,baseParents:initialParents,past:[],future:[],saved:false,storageError:false,recoverySource:null,creations:[]}),[initial,initialParents]);
 const snapshot=useCallback(()=>{if(!cache.has(key)){let raw:string|null=null;try{raw=localStorage.getItem(prefix+key);}catch{}const d=raw?decodeDraft(raw):null;const accepted=d&&(namespace==="private"||d.document.id===initial.id);cache.set(key,{...server,...(accepted?d:{}),saved:!!accepted,storageError:!!raw&&!accepted,recoverySource:raw&&!accepted?raw:null,creations:namespace==="private"?library():[]});}return cache.get(key)!;},[key,initial.id,namespace,server]);
 const draft=useSyncExternalStore(subscribe,snapshot,()=>server);
 const replace=useCallback((document:StudioDocument,parents?:string[]|null)=>{const p=snapshot();if(namespace==="private"&&p.document.id!==document.id){try{p.creations=archive(p);}catch{p.storageError=true;}}write(key,replaceDraft(p,document,parents===undefined?p.baseParents:parents));},[key,namespace,snapshot]);
 const apply=useCallback((op:StudioOperation)=>replace(editStudio(snapshot().document,op)),[replace,snapshot]);
 const undo=useCallback(()=>write(key,moveHistory(snapshot(),"undo")),[key,snapshot]);
 const redo=useCallback(()=>write(key,moveHistory(snapshot(),"redo")),[key,snapshot]);
 const save=useCallback(()=>write(key,{...snapshot()}),[key,snapshot]);
 const setBaseParents=useCallback((baseParents:string[])=>write(key,{...snapshot(),baseParents}),[key,snapshot]);
 const openCreation=useCallback((id:string)=>{const p=snapshot();let d=null;try{d=decodeDraft(localStorage.getItem(prefix+"archive:"+id)||"");}catch{}if(d){try{p.creations=archive(p);}catch{}write(key,{...p,...d,saved:false});}},[key,snapshot]);
 return {...draft,apply,replace,undo,redo,save,setBaseParents,openCreation,canUndo:draft.past.length>0,canRedo:draft.future.length>0};
}
