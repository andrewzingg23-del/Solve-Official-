"use client";
import {useEffect,useMemo,useRef,useState} from "react";
import {projectStudio} from "@/lib/studio/projection";
import type {StudioDocument,Vec3} from "@/lib/studio/document";
import type {DropResult} from "@/lib/studio/physics";
import type {StudioScene} from "./three-scene";
import {Icon} from "./icons";
export function StudioCanvas({document,selected,onSelect,onMove,experiment,frame=0}:{document:StudioDocument;selected:string|null;onSelect:(id:string|null)=>void;onMove:(id:string,p:Vec3,r:Vec3)=>void;experiment:DropResult|null;frame?:number}){
 const host=useRef<HTMLDivElement>(null),scene=useRef<StudioScene|null>(null),latest=useRef({document,selected,onSelect,onMove});latest.current={document,selected,onSelect,onMove};
 const[ready,setReady]=useState(false),[yaw,setYaw]=useState(-0.65),[pitch,setPitch]=useState(0.55),[zoom,setZoom]=useState(1),[mode,setMode]=useState<"translate"|"rotate">("translate"),[view,setView]=useState<"perspective"|"top"|"front">("perspective");
 const pointer=useRef<{x:number;y:number;dragged:boolean}|null>(null);
 useEffect(()=>{let cancelled=false,created:StudioScene|null=null;const target=host.current!,lose=()=>setReady(false);target.addEventListener("studio:renderer-lost",lose);
 const probe=window.document.createElement("canvas"),gl=probe.getContext("webgl2");
 if(gl){gl.getExtension("WEBGL_lose_context")?.loseContext();void import("./three-scene").then(({StudioScene})=>{if(cancelled)return;try{created=new StudioScene(target,id=>latest.current.onSelect(id),(id,p,r)=>latest.current.onMove(id,p,r));scene.current=created;created.render(latest.current.document);created.select(latest.current.selected);setReady(true);}catch{setReady(false);}}).catch(()=>setReady(false));}
 return()=>{cancelled=true;target.removeEventListener("studio:renderer-lost",lose);created?.destroy();scene.current=null;};},[]);
 useEffect(()=>{scene.current?.render(document);},[document]);useEffect(()=>{scene.current?.select(selected);},[selected]);useEffect(()=>{scene.current?.mode(mode);},[mode]);
 useEffect(()=>{if(experiment){const n=document.nodes.find(n=>n.id===experiment.nodeId);if(n)scene.current?.experiment(n,experiment.frames[frame]);}else scene.current?.render(document);},[experiment,frame,document]);
 const projection=useMemo(()=>projectStudio(experiment?{...document,nodes:document.nodes.filter(n=>n.id===experiment.nodeId).map(n=>({...n,position:experiment.frames[frame].position,rotation:[0,0,0] as Vec3}))}:document,yaw,pitch,zoom),[document,yaw,pitch,zoom,experiment,frame]);
 const orient=(v:typeof view)=>{setView(v);scene.current?.focus(v);setYaw(v==="perspective"?-0.65:0);setPitch(v==="top"?Math.PI/2:v==="front"?0:0.55);setZoom(1);};
 return <div className="sv-canvas" aria-label="Interactive design workspace">
 <svg className={"sv-projection "+(ready?"is-hidden":"")} viewBox="0 0 1000 700" aria-label="Editable three dimensional projection" aria-hidden={ready} tabIndex={ready?-1:0}
 onKeyDown={e=>{if(["ArrowLeft","ArrowRight","ArrowUp","ArrowDown"].includes(e.key))e.preventDefault();if(e.key==="ArrowLeft")setYaw(y=>y-0.1);if(e.key==="ArrowRight")setYaw(y=>y+0.1);if(e.key==="ArrowUp")setPitch(p=>Math.min(1.55,p+0.1));if(e.key==="ArrowDown")setPitch(p=>Math.max(0,p-0.1));}}
 onPointerDown={e=>{pointer.current={x:e.clientX,y:e.clientY,dragged:false};e.currentTarget.setPointerCapture(e.pointerId);}}
 onPointerMove={e=>{const p=pointer.current;if(!p)return;const dx=e.clientX-p.x,dy=e.clientY-p.y;if(Math.abs(dx)+Math.abs(dy)>2)p.dragged=true;setYaw(y=>y+dx*0.006);setPitch(p=>Math.max(0,Math.min(1.5,p-dy*0.004)));p.x=e.clientX;p.y=e.clientY;}}
 onPointerUp={e=>{if(pointer.current&&!pointer.current.dragged){const target=window.document.elementFromPoint(e.clientX,e.clientY)?.closest("[data-node-id]");if(target)onSelect(target.getAttribute("data-node-id"));}pointer.current=null;}} onPointerCancel={()=>{pointer.current=null;}}>
 <defs><radialGradient id="studio-light"><stop stopColor="#14323d" stopOpacity="0.65"/><stop offset="1" stopColor="#08131d" stopOpacity="0"/></radialGradient><filter id="studio-shadow"><feGaussianBlur stdDeviation="16"/></filter></defs>
 <ellipse cx="500" cy="420" rx="390" ry="190" fill="url(#studio-light)"/>
 {projection.grid.map((g,i)=><line key={i} x1={g.a.split(",")[0]} y1={g.a.split(",")[1]} x2={g.b.split(",")[0]} y2={g.b.split(",")[1]} stroke="#457b87" strokeOpacity="0.15"/>)}
 <ellipse cx="500" cy="490" rx="265" ry="56" fill="#000" opacity="0.35" filter="url(#studio-shadow)"/>
 {projection.polygons.map(p=><polygon key={p.key} data-node-id={p.id} points={p.points} fill={p.fill} opacity={p.opacity} stroke={selected===p.id?"#79f0ed":"#e0ecef"} strokeWidth={selected===p.id?1.8:0.3} strokeOpacity={selected===p.id?0.9:0.12}><title>{document.nodes.find(n=>n.id===p.id)?.label}</title></polygon>)}
 </svg><div className={"sv-three "+(ready?"":"is-hidden")} ref={host}/>
 <div className="sv-canvas-top"><span className="sv-chip"><span className="sv-dot"/>{experiment?"Rigid-body experiment":"Concept · editable geometry"}</span><span className="sv-coordinate">M / R{String(document.revision).padStart(2,"0")}</span></div>
 <div className="sv-canvas-tools"><button aria-label="Move selected object" aria-pressed={mode==="translate"} onClick={()=>setMode("translate")}><Icon name="move"/></button><button aria-label="Rotate selected object" aria-pressed={mode==="rotate"} onClick={()=>setMode("rotate")}><Icon name="rotate"/></button><span/><button aria-label="Frame design" onClick={()=>orient("perspective")}><Icon name="focus"/></button><button aria-label="Zoom in" onClick={()=>{scene.current?.zoom(0.8);setZoom(z=>Math.min(3,z*1.2));}}>+</button><button aria-label="Zoom out" onClick={()=>{scene.current?.zoom(1.2);setZoom(z=>Math.max(0.3,z/1.2));}}>−</button></div>
 <div className="sv-view-controls">{(["perspective","top","front"] as const).map(v=><button key={v} aria-pressed={view===v} onClick={()=>orient(v)}>{v==="perspective"?"3D":v==="top"?"Plan":"Front"}</button>)}</div>
 <div className="sv-canvas-caption"><span>{document.nodes.length?"Drag to orbit · select a part to edit":"Add your first object or assemble a concept"}</span><span>{ready?"Spatial view":"Interactive projection"}</span></div></div>;
}
