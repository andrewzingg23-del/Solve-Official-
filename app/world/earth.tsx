"use client";
import {forwardRef,useEffect,useImperativeHandle,useRef} from "react";
import type {SceneCallbacks,SceneController} from "@/lib/world/scene";
import type {SpatialView} from "@/lib/world/spatial";
import {FlatScene} from "./flat-scene";
type Props=SceneCallbacks&{view:SpatialView;dimmed:boolean;reducedMotion:boolean};
const idle:SceneController={render:()=>{},focusEntity:()=>false,focusBounds:()=>false,frameRoute:()=>false,teleportTo:()=>{},returnHome:()=>{},enterWorld:()=>{},exitWorld:()=>{},screenPosition:()=>null,renderedRefs:()=>[],band:()=>"PLANET",destroy:()=>{}};
export const Earth=forwardRef<SceneController,Props>(function Earth(props,ref){
 const host=useRef<HTMLDivElement>(null),scene=useRef<SceneController>(idle),latest=useRef(props);latest.current=props;
 useImperativeHandle(ref,()=>({render:v=>scene.current.render(v),focusEntity:r=>scene.current.focusEntity(r),focusBounds:r=>scene.current.focusBounds(r),frameRoute:r=>scene.current.frameRoute(r),teleportTo:p=>scene.current.teleportTo(p),returnHome:()=>scene.current.returnHome(),enterWorld:r=>scene.current.enterWorld(r),exitWorld:()=>scene.current.exitWorld(),screenPosition:r=>scene.current.screenPosition(r),renderedRefs:()=>scene.current.renderedRefs(),band:()=>scene.current.band(),destroy:()=>scene.current.destroy()}));
 useEffect(()=>{let cancelled=false,created:FlatScene|null=null;const callbacks:SceneCallbacks={onSelect:(r,a)=>latest.current.onSelect(r,a),onVisible:r=>latest.current.onVisible(r),onBand:b=>latest.current.onBand(b),onStatus:(s,d)=>latest.current.onStatus(s,d),onMetrics:m=>latest.current.onMetrics?.(m)};
 callbacks.onStatus("loading");FlatScene.create(host.current!,callbacks).then(s=>{if(cancelled)return s.destroy();created=s;scene.current=s;s.render(latest.current.view);callbacks.onStatus("ready");}).catch(()=>callbacks.onStatus("failed","The map could not initialize."));return()=>{cancelled=true;created?.destroy();scene.current=idle;};},[]);
 useEffect(()=>{scene.current.render(props.view);},[props.view]);
 return <div ref={host} className="absolute inset-0 transition-opacity duration-700 ease-calm" style={{opacity:props.dimmed?0.22:1}}/>;
});
