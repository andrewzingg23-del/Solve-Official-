"use client";
import {useCallback,useMemo,useSyncExternalStore} from "react";
import {editStudio,parseStudio,type StudioDocument,type StudioOperation} from "./document";
type Draft={document:StudioDocument;past:StudioDocument[];future:StudioDocument[];saved:boolean;storageError:boolean};
const cache=new Map<string,Draft>(),listeners=new Set<()=>void>(),prefix="solve.studio.draft.v1:";
const notify=()=>listeners.forEach(fn=>fn());
function write(key:string,draft:Draft){try{localStorage.setItem(prefix+key,JSON.stringify(draft.document));draft.saved=true;draft.storageError=false;}catch{draft.saved=false;draft.storageError=true;}cache.set(key,draft);notify();}
function subscribe(callback:()=>void){listeners.add(callback);const changed=(e:StorageEvent)=>{if(!e.key?.startsWith(prefix))return;const key=e.key.slice(prefix.length),p=cache.get(key),d=e.newValue?parseStudio(e.newValue):null;if(d&&p&&d.id===p.document.id){cache.set(key,{document:d,past:[...p.past,p.document].slice(-40),future:[],saved:true,storageError:false});notify();}};window.addEventListener("storage",changed);return()=>{listeners.delete(callback);window.removeEventListener("storage",changed);};}
export function useStudioDraft(initial:StudioDocument,namespace="private"){
 const key=namespace+":"+initial.id,server=useMemo<Draft>(()=>({document:initial,past:[],future:[],saved:false,storageError:false}),[initial]);
 const snapshot=useCallback(()=>{if(!cache.has(key)){let d:StudioDocument|null=null;try{d=parseStudio(localStorage.getItem(prefix+key)??"");}catch{}cache.set(key,d?.id===initial.id?{...server,document:d,saved:true}:server);}return cache.get(key)!;},[key,initial.id,server]);
 const draft=useSyncExternalStore(subscribe,snapshot,()=>server);
 const replace=useCallback((document:StudioDocument)=>{const p=snapshot();write(key,{document,past:[...p.past,p.document].slice(-40),future:[],saved:false,storageError:false});},[key,snapshot]);
 const apply=useCallback((op:StudioOperation)=>replace(editStudio(snapshot().document,op)),[replace,snapshot]);
 const undo=useCallback(()=>{const p=snapshot(),d=p.past.at(-1);if(d)write(key,{...p,document:d,past:p.past.slice(0,-1),future:[p.document,...p.future]});},[key,snapshot]);
 const redo=useCallback(()=>{const p=snapshot(),d=p.future[0];if(d)write(key,{...p,document:d,past:[...p.past,p.document],future:p.future.slice(1)});},[key,snapshot]);
 const save=useCallback(()=>write(key,{...snapshot()}),[key,snapshot]);
 return {...draft,apply,replace,undo,redo,save,canUndo:draft.past.length>0,canRedo:draft.future.length>0};
}
