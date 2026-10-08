import {MATERIALS,type StudioDocument,type StudioNode,type Vec3} from "./document";
type Face={nodeId:string;key:string;vertices:Vec3[];shade:number;material:StudioNode["material"]};
export function rotate(point:Vec3,angles:Vec3):Vec3{const[rx,ry,rz]=angles.map(n=>n*Math.PI/180);let[x,y,z]=point;[y,z]=[y*Math.cos(rx)-z*Math.sin(rx),y*Math.sin(rx)+z*Math.cos(rx)];[x,z]=[x*Math.cos(ry)+z*Math.sin(ry),-x*Math.sin(ry)+z*Math.cos(ry)];[x,y]=[x*Math.cos(rz)-y*Math.sin(rz),x*Math.sin(rz)+y*Math.cos(rz)];return[x,y,z];}
function faces(n:StudioNode):Face[]{
 const[w,h,d]=n.size,result:Vec3[][]=[];
 if(n.shape==="box"){const v:Vec3[]=[[-w/2,-h/2,-d/2],[w/2,-h/2,-d/2],[w/2,h/2,-d/2],[-w/2,h/2,-d/2],[-w/2,-h/2,d/2],[w/2,-h/2,d/2],[w/2,h/2,d/2],[-w/2,h/2,d/2]];for(const indices of [[0,1,2,3],[4,7,6,5],[0,4,5,1],[3,2,6,7],[1,5,6,2],[0,3,7,4]])result.push(indices.map(i=>v[i]));}
 else if(n.shape==="cylinder"){const a:Vec3[]=[],b:Vec3[]=[];for(let i=0;i<24;i++){const r=i/24*Math.PI*2;a.push([Math.cos(r)*w/2,h/2,Math.sin(r)*d/2]);b.push([Math.cos(r)*w/2,-h/2,Math.sin(r)*d/2]);}result.push(a,b);for(let i=0;i<24;i++)result.push([a[i],b[i],b[(i+1)%24],a[(i+1)%24]]);}
 else{const cols=28,rows=n.shape==="sphere"?12:8;const vertex=(i:number,j:number):Vec3=>{const a=i/cols*Math.PI*2,b=j/rows*Math.PI*(n.shape==="sphere"?1:2);if(n.shape==="sphere")return[Math.cos(a)*Math.sin(b)*w/2,Math.cos(b)*h/2,Math.sin(a)*Math.sin(b)*d/2];const r=(w-d)/2,t=d/2;return[(r+t*Math.cos(b))*Math.cos(a),(r+t*Math.cos(b))*Math.sin(a)*h/w,t*Math.sin(b)];};for(let i=0;i<cols;i++)for(let j=0;j<rows;j++)result.push([vertex(i,j),vertex(i+1,j),vertex(i+1,j+1),vertex(i,j+1)]);}
 return result.map((v,i)=>({nodeId:n.id,key:n.id+"-"+i,vertices:v.map(p=>{const r=rotate(p,n.rotation);return r.map((x,i)=>x+n.position[i]) as Vec3;}),material:n.material,shade:n.shape==="box"?[0.62,0.8,0.55,1.12,0.9,0.7][i]:0.78+0.3*Math.sin(i*0.6)}));
}
const tint=(hex:string,s:number)=>"rgb("+[1,3,5].map(i=>Math.min(255,Math.round(parseInt(hex.slice(i,i+2),16)*s))).join(" ")+")";
export function projectStudio(doc:StudioDocument,yaw=-0.65,pitch=0.55,zoom=1){
 const project=([x,y,z]:Vec3):Vec3=>{const px=x*Math.cos(yaw)+z*Math.sin(yaw),pz=-x*Math.sin(yaw)+z*Math.cos(yaw);return[px,-y*Math.cos(pitch)+pz*Math.sin(pitch),y*Math.sin(pitch)+pz*Math.cos(pitch)];};
 const projected=doc.nodes.flatMap(faces).map(f=>({...f,vertices:f.vertices.map(project)})),all=projected.flatMap(f=>f.vertices),xs=all.map(p=>p[0]),ys=all.map(p=>p[1]);
 const minX=Math.min(...xs,0),maxX=Math.max(...xs,1),minY=Math.min(...ys,0),maxY=Math.max(...ys,1),cx=(minX+maxX)/2,cy=(minY+maxY)/2,scale=Math.min(740/Math.max(maxX-minX,0.1),460/Math.max(maxY-minY,0.1))*zoom;
 const screen=(p:Vec3)=>(500+(p[0]-cx)*scale).toFixed(2)+","+(340+(p[1]-cy)*scale).toFixed(2);
 const polygons=projected.map(f=>({id:f.nodeId,key:f.key,points:f.vertices.map(screen).join(" "),fill:tint(MATERIALS[f.material].color,f.shade),opacity:f.material==="glass"?0.3:1,depth:f.vertices.reduce((s,v)=>s+v[2],0)/f.vertices.length})).sort((a,b)=>a.depth-b.depth);
 const grid=[];const span=Math.max(maxX-minX,maxY-minY,2)*1.1;for(let i=-8;i<=8;i++){const p=i*span/8;grid.push({a:screen(project([p,-0.015,-span])),b:screen(project([p,-0.015,span]))},{a:screen(project([-span,-0.015,p])),b:screen(project([span,-0.015,p]))});}
 return{polygons,grid};
}
export function blueprintSvg(doc:StudioDocument){
 const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]!));
 const p=projectStudio(doc,0,Math.PI/2);
 return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 740"><rect width="1000" height="740" fill="#07131e"/>'+p.polygons.map(p=>'<polygon points="'+p.points+'" fill="'+p.fill+'" stroke="#a3dfe4" stroke-width="1"/>').join("")+'<text x="40" y="42" fill="#dce8ee" font-family="sans-serif" font-size="20">'+escape(doc.title)+' · concept plan · revision '+doc.revision+'</text><text x="40" y="698" fill="#b9c8d0" font-family="sans-serif" font-size="13">Metres · editable source in SOLVE JSON · no engineering or permit approval</text></svg>';
}
