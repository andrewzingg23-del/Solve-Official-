import type { MaterialId, StudioNode, TemplateId, Vec3 } from "./document";
const box=(id:string,label:string,size:Vec3,position:Vec3,material:MaterialId="wood",rotation:Vec3=[0,0,0]):StudioNode=>({id,label,shape:"box",size,position,material,rotation});
const round=(id:string,label:string,shape:StudioNode["shape"],size:Vec3,position:Vec3,material:MaterialId,rotation:Vec3=[0,0,0]):StudioNode=>({id,label,shape,size,position,rotation,material});
export function studioTemplate(t:TemplateId):StudioNode[]{
 if(t==="architecture")return [
 box("foundation","Foundation",[7,0.24,4.8],[0,0.12,0],"concrete"),box("floor","Oak floor",[6.8,0.08,4.6],[0,0.28,0]),
 box("back","Rear wall",[7,2.8,0.14],[0,1.64,-2.32],"concrete"),box("side","Side wall",[0.14,2.8,4.6],[-3.42,1.64,0],"concrete"),
 box("beam","Floating canopy",[7.2,0.18,1.4],[0,3.03,-1.64]),box("window","Glazed wall",[0.06,2.5,3.1],[3.42,1.7,-0.7],"glass"),
 box("table","Worktable",[2.2,0.08,0.9],[0.5,1.1,-0.75]),box("leg-l","Worktable support A",[0.1,0.76,0.7],[-0.42,0.7,-0.75],"steel"),
 box("leg-r","Worktable support B",[0.1,0.76,0.7],[1.42,0.7,-0.75],"steel"),box("bench","Window bench",[0.85,0.45,2.1],[2.5,0.57,-0.1]),
 box("shelf","Library shelf",[1.1,1.7,0.36],[-2.65,1.18,-1.85]),box("book-a","Archive block",[0.16,0.38,0.29],[-2.98,1.92,-1.83],"polymer"),
 box("book-b","Archive block II",[0.24,0.32,0.29],[-2.66,1.89,-1.83],"concrete"),round("pot","Planter","cylinder",[0.45,0.45,0.45],[2.6,0.545,1.7],"concrete"),
 round("plant","Plant placeholder","sphere",[0.65,1.3,0.65],[2.6,1.3,1.7],"polymer"),box("panel","Wall panel",[1.6,0.85,0.035],[0.1,2.05,-2.23],"polymer"),
 ];
 if(t==="object")return [
 box("surface","Desktop",[1.6,0.045,0.75],[0,0.76,0]),box("support-a","Left support",[0.075,0.735,0.65],[-0.67,0.3675,0],"steel"),
 box("support-b","Right support",[0.075,0.735,0.65],[0.67,0.3675,0],"steel"),box("brace","Rear brace",[1.28,0.075,0.045],[0,0.6,-0.28],"steel"),
 box("riser","Display riser",[0.6,0.06,0.23],[0,0.82,-0.15]),box("drawer","Accessory tray",[0.32,0.085,0.32],[0.46,0.67,0.08],"polymer"),
 ];
 if(t==="mobility")return [
 round("rear-wheel","Rear tire","torus",[0.7,0.7,0.035],[-0.55,0.35,0],"rubber"),round("front-wheel","Front tire","torus",[0.7,0.7,0.035],[0.55,0.35,0],"rubber"),
 round("rear-rim","Rear rim","torus",[0.64,0.64,0.012],[-0.55,0.35,0],"aluminum"),round("front-rim","Front rim","torus",[0.64,0.64,0.012],[0.55,0.35,0],"aluminum"),
 round("seat-tube","Seat tube","cylinder",[0.034,0.57,0.034],[-0.18,0.64,0],"aluminum",[0,0,12]),round("top-tube","Top tube","cylinder",[0.035,0.59,0.035],[0.08,0.88,0],"aluminum",[0,0,90]),
 round("down-tube","Down tube","cylinder",[0.04,0.65,0.04],[0.15,0.64,0],"aluminum",[0,0,-45]),round("stay","Rear stay","cylinder",[0.025,0.57,0.025],[-0.39,0.62,0],"aluminum",[0,0,-31]),
 round("chain-stay","Chain stay","cylinder",[0.025,0.39,0.025],[-0.38,0.35,0],"aluminum",[0,0,90]),round("fork","Fork","cylinder",[0.03,0.55,0.03],[0.49,0.6,0],"steel",[0,0,13]),
 box("saddle","Saddle placeholder",[0.25,0.045,0.15],[-0.25,1,0],"rubber"),round("bar","Handlebar","cylinder",[0.025,0.44,0.025],[0.42,1.04,0],"aluminum",[90,0,0]),
 round("crank","Crank hub","cylinder",[0.12,0.04,0.12],[-0.12,0.36,0],"steel",[90,0,0]),
 ];return [];
}
