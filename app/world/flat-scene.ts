import type {GeoPoint,SceneCallbacks,SceneController} from "@/lib/world/scene";
import type {SpatialView,ZoomBand} from "@/lib/world/spatial";
const NS="http://www.w3.org/2000/svg";
const project=(longitude:number,latitude:number)=>({x:(longitude+180)/360*1000,y:(90-latitude)/180*500});
function element<K extends keyof SVGElementTagNameMap>(tag:K,attrs:Record<string,string>={}){const n=document.createElementNS(NS,tag);Object.entries(attrs).forEach(([k,v])=>n.setAttribute(k,v));return n;}
export class FlatScene implements SceneController{
 private svg=element("svg",{viewBox:"0 0 1000 500",preserveAspectRatio:"none",role:"img","aria-label":"Flat map of authorized World places"});
 private marks=element("g");private lines=element("g");private land=element("g");private frame={x:0,y:0,w:1000,h:500};
 private view:SpatialView={markers:[],links:[],effects:[],offEarth:[]};private zoomBand:ZoomBand="PLANET";private dead=false;
 private drag:{x:number;y:number;moved:boolean}|null=null;private controls:HTMLDivElement;private observer:ResizeObserver;
 constructor(private host:HTMLElement,private callbacks:SceneCallbacks){
 host.style.background="radial-gradient(ellipse at 50% 45%,#153643,#07131e 80%)";
 this.svg.style.cssText="width:100%;height:100%;display:block;touch-action:none;cursor:grab;";
 const defs=element("defs"),gradient=element("linearGradient",{id:"flat-land-fill",x1:"0",y1:"0",x2:"1",y2:"1"});gradient.append(element("stop",{offset:"0","stop-color":"#184251"}),element("stop",{offset:"1","stop-color":"#0b2433"}));defs.append(gradient);this.svg.append(defs);
 const grid=element("g",{stroke:"#6aaab5","stroke-opacity":"0.07","stroke-width":"0.4"});
 for(let x=0;x<=1000;x+=1000/12)grid.append(element("line",{x1:String(x),x2:String(x),y1:"0",y2:"500"}));
 for(let y=0;y<=500;y+=500/6)grid.append(element("line",{x1:"0",x2:"1000",y1:String(y),y2:String(y)}));
 this.svg.append(grid,this.land,this.lines,this.marks);host.append(this.svg);
 this.controls=document.createElement("div");this.controls.className="solve-flat-map-controls";
 [["＋","Zoom map in",()=>this.zoom(0.7)],["−","Zoom map out",()=>this.zoom(1.4)],["⌂","Frame whole map",()=>this.returnHome()]].forEach(([label,aria,action])=>{const button=document.createElement("button");button.textContent=label as string;button.setAttribute("aria-label",aria as string);button.style.cssText="width:40px;height:40px;background:#0c2231cc;color:#8ce5e7;border:1px solid #8ce5e72a;border-radius:8px;font-size:20px;cursor:pointer";button.addEventListener("click",action as ()=>void);this.controls.append(button);});host.append(this.controls);
 this.svg.addEventListener("pointerdown",this.down);this.svg.addEventListener("pointermove",this.move);this.svg.addEventListener("pointerup",this.up);this.svg.addEventListener("pointercancel",this.cancel);this.svg.addEventListener("wheel",this.wheel,{passive:false});
 this.observer=new ResizeObserver(()=>this.notify());this.observer.observe(host);
 void fetch("/maps/world-land.json").then(r=>r.json()).then((data:{features:{geometry:{type:string;coordinates:number[][][]|number[][][][]}}[]})=>{if(this.dead)return;for(const f of data.features){const polys=f.geometry.type==="Polygon"?[f.geometry.coordinates as number[][][]]:f.geometry.coordinates as number[][][][];for(const poly of polys){const d=poly.map(ring=>ring.map(([lng,lat],i)=>{const p=project(lng,lat);return(i?"L":"M")+p.x.toFixed(2)+","+p.y.toFixed(2);}).join("")+"Z").join("");this.land.append(element("path",{d,fill:"url(#flat-land-fill)",stroke:"#46818a","stroke-opacity":"0.32","stroke-width":"0.45","fill-rule":"evenodd"}));}}}).catch(()=>{/* Place controls and authorized markers remain usable offline. */});
 const credit=document.createElement("a");credit.href="https://www.naturalearthdata.com/about/terms-of-use/";credit.target="_blank";credit.rel="noreferrer";credit.textContent="Natural Earth · public domain";credit.style.cssText="position:absolute;left:18px;bottom:98px;color:#70909a;font-size:8px;z-index:2";credit.dataset.mapCredit="true";host.append(credit);this.callbacks.onBand("PLANET");
 }
 static async create(host:HTMLElement,callbacks:SceneCallbacks){return new FlatScene(host,callbacks);}
 private down=(e:PointerEvent)=>{this.drag={x:e.clientX,y:e.clientY,moved:false};this.svg.setPointerCapture(e.pointerId);};
 private move=(e:PointerEvent)=>{if(!this.drag)return;const dx=e.clientX-this.drag.x,dy=e.clientY-this.drag.y;if(Math.abs(dx)+Math.abs(dy)>2)this.drag.moved=true;this.frame.x-=dx/Math.max(this.host.clientWidth,1)*this.frame.w;this.frame.y-=dy/Math.max(this.host.clientHeight,1)*this.frame.h;this.drag.x=e.clientX;this.drag.y=e.clientY;this.updateFrame();};
 private up=(e:PointerEvent)=>{if(this.drag&&!this.drag.moved){const target=document.elementFromPoint(e.clientX,e.clientY)?.closest("[data-world-ref]");this.callbacks.onSelect(target?.getAttribute("data-world-ref")??null,e.shiftKey||e.metaKey);}this.drag=null;this.notify();};
 private cancel=()=>{this.drag=null;this.notify();};
 private wheel=(e:WheelEvent)=>{e.preventDefault();this.zoom(e.deltaY>0?1.12:0.88);};
 private updateFrame(){this.svg.setAttribute("viewBox",[this.frame.x,this.frame.y,this.frame.w,this.frame.h].join(" "));}
 private zoom(factor:number){const w=Math.max(1,Math.min(1600,this.frame.w*factor)),h=w/2;this.frame.x+=(this.frame.w-w)/2;this.frame.y+=(this.frame.h-h)/2;this.frame.w=w;this.frame.h=h;this.updateFrame();this.zoomBand=w>650?"PLANET":w>90?"REGION":w>10?"METRO":"SITE";this.callbacks.onBand(this.zoomBand);this.notify();}
 private visible(){return this.view.markers.filter(m=>{const p=project(m.longitude,m.latitude);return p.x>=this.frame.x&&p.x<=this.frame.x+this.frame.w&&p.y>=this.frame.y&&p.y<=this.frame.y+this.frame.h;});}
 private notify(){this.callbacks.onVisible(this.visible().map(m=>m.ref));}
 render(view:SpatialView){this.view=view;this.marks.replaceChildren();this.lines.replaceChildren();const located=new Map(view.markers.map(m=>[m.ref,project(m.longitude,m.latitude)]));
 for(const line of view.links){const a=located.get(line.from),b=located.get(line.to);if(!a||!b)continue;this.lines.append(element("line",{x1:String(a.x),y1:String(a.y),x2:String(b.x),y2:String(b.y),stroke:line.style==="warning"?"#e8a08d":"#67b7bc","stroke-opacity":line.style==="quiet"?"0.16":"0.55","stroke-width":"0.65","vector-effect":"non-scaling-stroke"}));}
 for(const marker of view.markers){const p=project(marker.longitude,marker.latitude),g=element("g",{"data-world-ref":marker.ref,tabindex:"0",role:"button","aria-label":marker.title});g.style.cursor="pointer";
 const selected=marker.emphasis==="selected"||marker.emphasis==="lit";g.append(element("circle",{cx:String(p.x),cy:String(p.y),r:selected?"7":"5",fill:"#8ce5e7","fill-opacity":selected?"0.12":"0.04",stroke:"#8ce5e7","stroke-opacity":selected?"0.5":"0.17","stroke-width":"1","vector-effect":"non-scaling-stroke"}),element("circle",{cx:String(p.x),cy:String(p.y),r:"2",fill:marker.state==="blocked"?"#e8a08d":"#86e3e4"}));const label=element("text",{x:String(p.x+10),y:String(p.y+2),fill:selected?"#bcf1f0":"#89aeb8","font-size":selected?"6":"5","font-family":"sans-serif"});label.textContent=marker.title;g.append(label);g.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();this.callbacks.onSelect(marker.ref,e.shiftKey);}});this.marks.append(g);}
 this.notify();this.callbacks.onMetrics?.({initMs:0,markers:view.markers.length,links:view.links.length,lastRenderMs:0});
 }
 focusEntity(ref:string){const m=this.view.markers.find(m=>m.ref===ref);if(!m)return false;this.teleportTo({latitude:m.latitude,longitude:m.longitude});return true;}
 focusBounds(refs:string[]){const points=this.view.markers.filter(m=>refs.includes(m.ref)).map(m=>project(m.longitude,m.latitude));if(!points.length)return false;const xs=points.map(p=>p.x),ys=points.map(p=>p.y),w=Math.max(Math.max(...xs)-Math.min(...xs)+50,(Math.max(...ys)-Math.min(...ys)+30)*2,80);this.frame={x:(Math.min(...xs)+Math.max(...xs))/2-w/2,y:(Math.min(...ys)+Math.max(...ys))/2-w/4,w,h:w/2};this.updateFrame();this.zoomBand="REGION";this.callbacks.onBand(this.zoomBand);this.notify();return true;}
 frameRoute(refs:string[]){return this.focusBounds(refs);}
 teleportTo(p:GeoPoint){const pt=project(p.longitude,p.latitude);this.frame={x:pt.x-60,y:pt.y-30,w:120,h:60};this.updateFrame();this.zoomBand="REGION";this.callbacks.onBand(this.zoomBand);this.notify();}
 returnHome(){this.frame={x:0,y:0,w:1000,h:500};this.updateFrame();this.zoomBand="PLANET";this.callbacks.onBand(this.zoomBand);this.notify();}
 enterWorld(ref:string){this.focusEntity(ref);this.zoomBand="WORLD";this.callbacks.onBand("WORLD");}
 exitWorld(){this.returnHome();}
 screenPosition(ref:string){const m=this.visible().find(m=>m.ref===ref);if(!m)return null;const p=project(m.longitude,m.latitude);return{x:(p.x-this.frame.x)/this.frame.w*this.host.clientWidth,y:(p.y-this.frame.y)/this.frame.h*this.host.clientHeight};}
 renderedRefs(){return this.visible().map(m=>m.ref);}
 band(){return this.zoomBand;}
 destroy(){this.dead=true;this.observer.disconnect();this.svg.removeEventListener("pointerdown",this.down);this.svg.removeEventListener("pointermove",this.move);this.svg.removeEventListener("pointerup",this.up);this.svg.removeEventListener("pointercancel",this.cancel);this.svg.removeEventListener("wheel",this.wheel);this.svg.remove();this.controls.remove();this.host.querySelector("[data-map-credit]")?.remove();}
}
