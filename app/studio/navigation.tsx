"use client";
import Link from "next/link";
import {usePathname} from "next/navigation";
import {useGuestProfile} from "@/lib/guest/profile";
import {Icon,type IconName} from "./icons";
const links:{href:string;label:string;icon:IconName}[]=[{href:"/studio",label:"Studio",icon:"space"},{href:"/map",label:"Map",icon:"map"},{href:"/worlds",label:"Worlds",icon:"world"},{href:"/communities",label:"Communities",icon:"people"},{href:"/sov-id",label:"SOV ID",icon:"id"}];
export function StudioNavigation(){const pathname=usePathname(),{profile}=useGuestProfile();return <aside className="sv-rail">
 <Link href="/" className="sv-wordmark" aria-label="SOLVE home">solve<span className="sv-mark">✳</span></Link>
 <nav aria-label="Workspace" className="sv-rail-nav">{links.map(l=><Link key={l.href} href={l.href} aria-current={pathname===l.href||(l.href==="/studio"&&(pathname.startsWith("/studio")||pathname.endsWith("/studio")))?"page":undefined}><Icon name={l.icon}/><span>{l.label}</span></Link>)}</nav>
 <div className="sv-rail-bottom"><Link href="/packs"><Icon name="layers"/><span>Tools & packs</span></Link><Link href="/sov-id" className="sv-mini-profile"><span className="sv-initial">{profile?.yourName?.slice(0,1)||"S"}</span><span>{profile?.yourName||"Your identity"}<small>{profile?.sovName?"@"+profile.sovName:"Create your SOV ID"}</small></span><Icon name="arrow" size={16}/></Link></div></aside>;}
