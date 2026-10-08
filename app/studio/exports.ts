import type {StudioDocument} from "@/lib/studio/document";
import {blueprintSvg} from "@/lib/studio/projection";
export function downloadFile(name:string,body:BlobPart,mime:string){const url=URL.createObjectURL(new Blob([body],{type:mime})),a=document.createElement("a");a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export async function exportStudio(studio:StudioDocument,format:"json"|"svg"|"glb"|"stl"){
 const name=studio.title.replace(/[^a-zA-Z0-9_-]/g,"-").slice(0,60)||"studio";
 if(format==="json")return downloadFile(name+".solve.json",JSON.stringify(studio,null,2),"application/json");
 if(format==="svg")return downloadFile(name+"-concept-plan.svg",blueprintSvg(studio),"image/svg+xml");
 const[{Group,Mesh},{nodeMesh}]=await Promise.all([import("three"),import("./three-scene")]),group=new Group();studio.nodes.forEach(n=>group.add(nodeMesh(n)));group.updateMatrixWorld(true);
 try{if(format==="stl"){const{STLExporter}=await import("three/addons/exporters/STLExporter.js");downloadFile(name+"-metres.stl",new STLExporter().parse(group,{binary:false}),"model/stl");}
 else{const{GLTFExporter}=await import("three/addons/exporters/GLTFExporter.js");const r=await new GLTFExporter().parseAsync(group,{binary:true});if(r instanceof ArrayBuffer)downloadFile(name+".glb",r,"model/gltf-binary");}}
 finally{group.traverse(o=>{if(o instanceof Mesh){o.geometry.dispose();const m=Array.isArray(o.material)?o.material:[o.material];m.forEach(m=>m.dispose());}});}
}
