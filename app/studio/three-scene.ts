import * as THREE from "three";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";
import {TransformControls} from "three/addons/controls/TransformControls.js";
import {RoomEnvironment} from "three/addons/environments/RoomEnvironment.js";
import {MATERIALS,type StudioDocument,type StudioNode,type Vec3} from "@/lib/studio/document";
import type {DropFrame} from "@/lib/studio/physics";
export function nodeMesh(n:StudioNode):THREE.Mesh{
 const[x,y,z]=n.size;let geometry:THREE.BufferGeometry;
 if(n.shape==="box")geometry=new THREE.BoxGeometry(x,y,z);
 else if(n.shape==="cylinder"){geometry=new THREE.CylinderGeometry(0.5,0.5,1,48);geometry.scale(x,y,z);}
 else if(n.shape==="sphere"){geometry=new THREE.SphereGeometry(0.5,32,24);geometry.scale(x,y,z);}
 else{geometry=new THREE.TorusGeometry((x-z)/2,z/2,16,64);geometry.scale(1,y/x,1);}
 const glass=n.material==="glass",metal=n.material==="steel"||n.material==="aluminum";
 const material=new THREE.MeshPhysicalMaterial({color:MATERIALS[n.material].color,roughness:glass?0.12:metal?0.34:0.78,metalness:metal?0.7:0,transparent:glass,opacity:glass?0.24:1,depthWrite:!glass,side:glass?THREE.DoubleSide:THREE.FrontSide,clearcoat:metal?0.25:0});
 const mesh=new THREE.Mesh(geometry,material);mesh.position.fromArray(n.position);const[rx,ry,rz]=n.rotation.map(v=>THREE.MathUtils.degToRad(v));mesh.rotation.set(rx,ry,rz,"ZYX");mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.nodeId=n.id;return mesh;
}
function dispose(group:THREE.Object3D){group.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry.dispose();const mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach(m=>m.dispose());}else if(o instanceof THREE.LineSegments){o.geometry.dispose();const mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach(m=>m.dispose());}});}
export class StudioScene{
 private renderer:THREE.WebGLRenderer;
 private scene=new THREE.Scene();private camera=new THREE.PerspectiveCamera(35,1,0.01,5000);
 private orbit:OrbitControls;private transform:TransformControls;private model=new THREE.Group();
 private frame=0;private observer:ResizeObserver;private selected:string|null=null;
 private pointerStart={x:0,y:0};private outline:THREE.BoxHelper|null=null;private lastDoc:StudioDocument|null=null;
 private env:THREE.WebGLRenderTarget;private visible=true;private visibilityObserver:IntersectionObserver;
 constructor(private host:HTMLElement,private onSelect:(id:string|null)=>void,private onMove:(id:string,p:Vec3,r:Vec3)=>void){
 this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:"low-power"});
 this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.75));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.1;
 host.appendChild(this.renderer.domElement);this.renderer.domElement.setAttribute("aria-hidden","true");
 const pmrem=new THREE.PMREMGenerator(this.renderer),room=new RoomEnvironment();this.env=pmrem.fromScene(room,0.04);this.scene.environment=this.env.texture;room.dispose();pmrem.dispose();
 this.scene.add(new THREE.HemisphereLight(0xc8e7ef,0x302a24,2.5));
 const sun=new THREE.DirectionalLight(0xffe3c1,4);sun.position.set(-5,10,6);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-15,right:15,top:15,bottom:-15});sun.shadow.normalBias=0.025;this.scene.add(sun);
 const rim=new THREE.DirectionalLight(0x72e6ed,2);rim.position.set(6,4,-5);this.scene.add(rim);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(2000,2000),new THREE.ShadowMaterial({opacity:0.3}));floor.rotation.x=-Math.PI/2;floor.position.y=-0.02;floor.receiveShadow=true;this.scene.add(floor);
 const grid=new THREE.GridHelper(100,100,0x284755,0x192e3a);grid.position.y=-0.025;const gm=grid.material as THREE.Material;gm.transparent=true;gm.opacity=0.28;this.scene.add(grid);
 this.scene.add(this.model);this.camera.position.set(9,7,11);
 this.orbit=new OrbitControls(this.camera,this.renderer.domElement);this.orbit.enableDamping=true;this.orbit.dampingFactor=0.09;this.orbit.maxPolarAngle=Math.PI*0.49;this.orbit.minDistance=0.2;this.orbit.maxDistance=1000;
 this.transform=new TransformControls(this.camera,this.renderer.domElement);this.transform.setSize(0.8);this.scene.add(this.transform.getHelper());
 this.transform.addEventListener("dragging-changed",e=>{this.orbit.enabled=!e.value;});
 this.transform.addEventListener("mouseUp",()=>{const m=this.transform.object;if(m&&this.selected)this.onMove(this.selected,m.position.toArray() as Vec3,[m.rotation.x,m.rotation.y,m.rotation.z].map(v=>Math.round(THREE.MathUtils.radToDeg(v)*100)/100) as Vec3);});
 this.renderer.domElement.addEventListener("pointerdown",this.down);this.renderer.domElement.addEventListener("pointerup",this.up);this.renderer.domElement.addEventListener("webglcontextlost",this.lost);
 this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(host);this.visibilityObserver=new IntersectionObserver(([e])=>{this.visible=e.isIntersecting;});this.visibilityObserver.observe(host);this.resize();this.animate();
 }
 private lost=(e:Event)=>{e.preventDefault();this.host.dispatchEvent(new CustomEvent("studio:renderer-lost"));};
 private down=(e:PointerEvent)=>{this.pointerStart={x:e.clientX,y:e.clientY};};
 private up=(e:PointerEvent)=>{if(this.transform.dragging||this.transform.axis||Math.hypot(e.clientX-this.pointerStart.x,e.clientY-this.pointerStart.y)>5)return;const r=this.renderer.domElement.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),this.camera);const hit=ray.intersectObjects(this.model.children)[0];this.onSelect(hit?.object.userData.nodeId??null);};
 private resize(){const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h);}
 private animate=()=>{this.frame=requestAnimationFrame(this.animate);if(!this.visible||document.hidden)return;this.orbit.update();this.outline?.update();this.renderer.render(this.scene,this.camera);};
 private clearOutline(){if(this.outline){this.scene.remove(this.outline);this.outline.geometry.dispose();(this.outline.material as THREE.Material).dispose();this.outline=null;}}
 render(doc:StudioDocument){this.transform.detach();this.clearOutline();dispose(this.model);this.model.clear();doc.nodes.forEach(n=>this.model.add(nodeMesh(n)));if(!this.lastDoc||this.lastDoc.template!==doc.template)this.focus();this.lastDoc=doc;this.select(this.selected);}
 select(id:string|null){this.selected=id;this.transform.detach();this.clearOutline();const m=this.model.children.find(m=>m.userData.nodeId===id);if(m){this.transform.attach(m);this.outline=new THREE.BoxHelper(m,0x70eff2);this.scene.add(this.outline);}}
 mode(mode:"translate"|"rotate"){this.transform.setMode(mode);}
 focus(view:"perspective"|"top"|"front"="perspective"){const b=new THREE.Box3().setFromObject(this.model),c=new THREE.Vector3(),s=new THREE.Vector3();if(b.isEmpty()){c.set(0,0,0);s.set(2,2,2);}else{b.getCenter(c);b.getSize(s);}const scale=Math.max(s.x,s.y,s.z,1)*1.7;this.orbit.target.copy(c);const offset=view==="top"?new THREE.Vector3(0,scale*1.5,0.001):view==="front"?new THREE.Vector3(0,0.05,scale*1.7):new THREE.Vector3(scale*0.9,scale*0.7,scale*1.1);this.camera.position.copy(c).add(offset);this.orbit.update();}
 zoom(factor:number){this.camera.position.sub(this.orbit.target).multiplyScalar(factor).add(this.orbit.target);this.orbit.update();}
 experiment(n:StudioNode,frame:DropFrame){this.transform.detach();this.clearOutline();dispose(this.model);this.model.clear();const m=nodeMesh(n);m.position.fromArray(frame.position);m.quaternion.fromArray(frame.rotation);this.model.add(m);this.orbit.target.set(0,Math.max(...n.size)/2+0.5,0);const s=Math.max(...n.size,1)*3;this.camera.position.set(s*0.8,s*0.65,s);this.orbit.update();}
 destroy(){cancelAnimationFrame(this.frame);this.observer.disconnect();this.visibilityObserver.disconnect();this.orbit.dispose();this.transform.dispose();this.clearOutline();dispose(this.scene);this.env.dispose();this.renderer.domElement.removeEventListener("pointerdown",this.down);this.renderer.domElement.removeEventListener("pointerup",this.up);this.renderer.domElement.removeEventListener("webglcontextlost",this.lost);this.renderer.dispose();this.renderer.domElement.remove();}
}
