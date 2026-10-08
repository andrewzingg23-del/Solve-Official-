import { nodeVolume,studioFingerprint,validateStudio,type StudioDocument,type Vec3 } from "./document";
export type DropFrame={time:number;position:Vec3;rotation:[number,number,number,number]};
export type DropResult={fingerprint:string;revision:number;nodeId:string;solver:"rapier3d";solverVersion:string;massKg:number;maxSpeed:number;frames:DropFrame[];assumptions:string[];engineeringApproval:false};
let runtime:Promise<typeof import("@dimforge/rapier3d-compat")>|undefined;
async function rapier(){runtime??=import("@dimforge/rapier3d-compat").then(async r=>{await r.init();return r;});return runtime;}
export async function dropExperiment(input:StudioDocument,nodeId:string):Promise<DropResult>{
 const document=validateStudio(input),node=document.nodes.find(n=>n.id===nodeId);if(!node)throw new Error("Object not found");
 const R=await rapier(),world=new R.World({x:0,y:-9.81,z:0});
 try{
 world.timestep=1/120;world.createCollider(R.ColliderDesc.cuboid(1000,0.1,1000).setTranslation(0,-0.1,0).setFriction(0.6));
 const[x,y,z]=node.size,massKg=nodeVolume(node)*document.rates[node.material].density;
 const body=world.createRigidBody(R.RigidBodyDesc.dynamic().setTranslation(0,Math.max(x,y,z)/2+1,0).setCcdEnabled(true));
 let collider=R.ColliderDesc.cuboid(x/2,y/2,z/2),shapeAssumption="Box collision shape matches the dimensions.";
 if(node.shape==="sphere"&&Math.abs(x-y)<1e-6&&Math.abs(y-z)<1e-6){collider=R.ColliderDesc.ball(x/2);shapeAssumption="Spherical collision shape matches the dimensions.";}
 else if(node.shape==="cylinder"&&Math.abs(x-z)<1e-6){collider=R.ColliderDesc.cylinder(y/2,x/2);shapeAssumption="Cylindrical collision shape matches the dimensions.";}
 else if(node.shape!=="box")shapeAssumption="Collision uses a bounding box approximation; mass uses the declared geometry.";
 world.createCollider(collider.setMass(massKg).setFriction(0.6).setRestitution(0.15),body);
 const frames:DropFrame[]=[];let maxSpeed=0;
 for(let tick=0;tick<=600;tick++){if(tick%6===0){const p=body.translation(),q=body.rotation();frames.push({time:tick/120,position:[p.x,p.y,p.z],rotation:[q.x,q.y,q.z,q.w]});}const v=body.linvel();maxSpeed=Math.max(maxSpeed,Math.hypot(v.x,v.y,v.z));world.step();}
 return {fingerprint:studioFingerprint(document),revision:document.revision,nodeId,solver:"rapier3d",solverVersion:R.version(),massKg,maxSpeed,frames,engineeringApproval:false,assumptions:[shapeAssumption,"Isolated object released upright at least 1 m above a rigid floor; gravity 9.81 m/s².","No joints, deformation, breakage, load capacity or engineering certification. Friction 0.6; restitution 0.15.","Density is the studio's editable planning assumption. Other design objects are excluded."]};
 }finally{world.free();}
}
