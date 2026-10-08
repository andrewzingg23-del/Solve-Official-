import type {CSSProperties,ReactNode} from "react";
export type IconName="home"|"map"|"world"|"people"|"id"|"spark"|"space"|"bike"|"object"|"plus"|"arrow"|"lock"|"undo"|"redo"|"move"|"rotate"|"download"|"layers"|"close"|"check"|"menu"|"focus"|"play"|"settings"|"agent"|"external"|"trash";
const paths:Record<IconName,ReactNode>={
home:<><path d="m3 10 9-7 9 7v10H3Z"/><path d="M9 20v-7h6v7"/></>,
map:<><path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2Z"/><path d="M9 3v16M15 5v16"/></>,
world:<><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/></>,
people:<><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 5"/></>,
id:<><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="M6 16a3 3 0 0 1 6 0m3-7h3m-3 4h3"/></>,
spark:<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5ZM20 3v4m-2-2h4"/>,
space:<path d="m3 7 9-4 9 4v10l-9 4-9-4Zm0 0 9 4 9-4M12 11v10"/>,
bike:<><circle cx="5" cy="16" r="4"/><circle cx="19" cy="16" r="4"/><path d="m5 16 5-9 5 9H5m14 0-4-11h-3m-4 2h4"/></>,
object:<path d="M3 8h18v3H3Zm2 3v9m14-9v9M5 17h14"/>,
plus:<path d="M12 5v14M5 12h14"/>,arrow:<path d="M4 12h15m-6-6 6 6-6 6"/>,
lock:<><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/></>,
undo:<path d="m8 4-5 5 5 5M3 9h10a7 7 0 0 1 0 14"/>,redo:<path d="m16 4 5 5-5 5m5-5H11a7 7 0 0 0 0 14"/>,
move:<path d="M12 2v20M2 12h20M8 6l4-4 4 4M8 18l4 4 4-4M6 8l-4 4 4 4m12-8 4 4-4 4"/>,
rotate:<path d="M20 10a8 8 0 1 0-1 8M20 3v7h-7"/>,download:<path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4"/>,
layers:<path d="m3 8 9-5 9 5-9 5Zm0 5 9 5 9-5M3 18l9 5 9-5"/>,close:<path d="m5 5 14 14M5 19 19 5"/>,check:<path d="m5 12 4 4 10-10"/>,
menu:<path d="M4 6h16M4 12h16M4 18h16"/>,focus:<><path d="M3 9V3h6m6 0h6v6m0 6v6h-6m-6 0H3v-6"/><circle cx="12" cy="12" r="3"/></>,
play:<path d="m7 3 14 9-14 9Z"/>,settings:<><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/></>,
agent:<><path d="M12 3v3"/><rect x="4" y="6" width="16" height="14" rx="4"/><path d="M8 11v2m8-2v2m-7 4h6M1 10v6m22-6v6"/></>,
external:<path d="M14 3h7v7m0-7-11 11M10 3H3v18h18v-7"/>,trash:<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>,
};
export function Icon({name,size=20,style}:{name:IconName;size?:number;style?:CSSProperties}){return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}>{paths[name]}</svg>;}
