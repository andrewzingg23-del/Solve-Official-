"use client";
import {MATERIALS,materialFacts,type StudioDocument,type StudioNode,type StudioOperation,type MaterialId,type Vec3} from "@/lib/studio/document";
import {Icon} from "./icons";
export function NumberField({label,value,onCommit,min,max,step=0.01}:{label:string;value:number;onCommit:(v:number)=>void;min?:number;max?:number;step?:number}){
 return <label className="sv-number"><span>{label}</span><input key={value} aria-label={label} type="number" defaultValue={value} min={min} max={max} step={step} onBlur={e=>{const n=Number(e.currentTarget.value);if(Number.isFinite(n)&&n!==value)onCommit(n);}} onKeyDown={e=>{if(e.key==="Enter")e.currentTarget.blur();}}/></label>;
}
export function Inspector({document,node,apply,onClose,onDrop,busy}:{document:StudioDocument;node:StudioNode|null;apply:(o:StudioOperation)=>void;onClose:()=>void;onDrop:()=>void;busy:boolean}){
 const row=node?materialFacts(document).rows.find(r=>r.id===node.id):null;
 const vector=(key:"size"|"position"|"rotation",index:number,value:number)=>{if(!node)return;const v=[...node[key]] as Vec3;v[index]=value;apply({type:"node",id:node.id,patch:{[key]:v}});};
 if(!node)return <section className="sv-inspector">
 <div className="sv-panel-heading"><span className="sv-kicker">Your design, in detail</span><Icon name="settings" size={16}/></div>
 <div className="sv-inspector-intro"><div className="sv-object-symbol"><Icon name="space" size={38}/></div><h3>Ideas become tangible.</h3><p>Select any object in the canvas or the object list. Change its dimensions, position, rotation, or material.</p></div>
 <div className="sv-material-preview">{Object.entries(MATERIALS).slice(0,4).map(([id,m])=><div key={id}><span style={{background:m.color}}/><small>{m.label}</small></div>)}</div>
 <div className="sv-context-note"><Icon name="lock" size={17}/><div><strong>Private by default</strong><p>Your draft stays on this device. You decide when to export it or save to an authorized World.</p></div></div>
 </section>;
 return <section className="sv-inspector">
 <div className="sv-panel-heading"><span className="sv-kicker">Object inspector</span><button className="sv-icon-btn" aria-label="Close inspector" onClick={onClose}><Icon name="close" size={16}/></button></div>
 <h3>{node.label}</h3><p className="sv-subtle">{node.shape} geometry · metres</p>
 <label className="sv-field">Object name<input key={node.id+node.label} defaultValue={node.label} maxLength={100} onBlur={e=>{if(e.currentTarget.value!==node.label)apply({type:"node",id:node.id,patch:{label:e.currentTarget.value}});}}/></label>
 <div className="sv-fieldset"><span className="sv-kicker">Dimensions · m</span><div className="sv-vector">{["Width","Height","Depth"].map((l,i)=><NumberField key={l} label={l} value={node.size[i]} min={0.001} max={500} step={0.001} onCommit={v=>vector("size",i,v)}/>)}</div></div>
 <div className="sv-fieldset"><span className="sv-kicker">Position · m</span><div className="sv-vector">{["X","Y","Z"].map((l,i)=><NumberField key={l} label={"Position "+l} value={node.position[i]} min={-1000} max={1000} onCommit={v=>vector("position",i,v)}/>)}</div></div>
 <div className="sv-fieldset"><span className="sv-kicker">Rotation · degrees</span><div className="sv-vector">{["X","Y","Z"].map((l,i)=><NumberField key={l} label={"Rotation "+l} value={node.rotation[i]} min={-360} max={360} step={1} onCommit={v=>vector("rotation",i,v)}/>)}</div></div>
 <label className="sv-field">Material<select value={node.material} onChange={e=>apply({type:"node",id:node.id,patch:{material:e.target.value as MaterialId}})}>{Object.entries(MATERIALS).map(([id,m])=><option key={id} value={id}>{m.label}</option>)}</select></label>
 <div className="sv-object-facts"><span>Volume<strong>{row?.volumeM3.toFixed(4)} m³</strong></span><span>Est. mass<strong>{row?.massKg.toFixed(2)} kg</strong></span></div>
 <button className="sv-button sv-button-secondary sv-full" disabled={busy} onClick={onDrop}><Icon name="play" size={16}/>{busy?"Computing…":"Run drop experiment"}</button>
 <p className="sv-fineprint">Rigid-body motion of one isolated object. No deformation or structural approval.</p>
 <button className="sv-text-btn sv-danger" onClick={()=>{apply({type:"remove",id:node.id});onClose();}}><Icon name="trash" size={14}/>Remove object</button>
 </section>;
}
