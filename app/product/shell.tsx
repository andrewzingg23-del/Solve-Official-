"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { House, Stack, UsersThree, ShieldCheck, Plus, ArrowUpRight, LockSimple, UserCircle, SlidersHorizontal } from "@phosphor-icons/react";
import { PRIMARY_DESTINATIONS, destinationFor } from "@/lib/product/routes";

export type ShellIdentity = { userId: string; name: string; botName: string; face: string; isGuest?: boolean } | null;
const icons = [House, Stack, UsersThree, ShieldCheck];
export function ProductShell({ children, identity }: { children: React.ReactNode; identity: ShellIdentity }) {
  const path = usePathname();
  if (path === '/sov-preview' || path.startsWith('/sov-preview/') || path === '/studio' || path === '/map' || path === '/sov-id' || /^\/world\/[^/]+\/studio$/.test(path)) return <>{children}</>;
  const publicView = path.startsWith('/saved') || path.startsWith('/oauth') || path.startsWith('/world-invite');
  if (publicView) return <div className="solve-minimal"><Link href="/" className="sov-mark">◯ SOV</Link>{children}</div>;
  const active = destinationFor(path);
  const links = PRIMARY_DESTINATIONS.map((home,index)=>{const Icon=icons[index];return <Link key={home.href} href={home.href} aria-current={active===home.href?'page':undefined} className="solve-nav-link"><Icon size={22}/><span>{home.label}</span></Link>;});
  return <div className="solve-shell sov-foundation">
    <a href="#solve-main" className="solve-skip">Skip to content</a>
    <aside className="solve-sidebar" aria-label="Workspace sidebar">
      <Link href="/" className="sov-mark" aria-label="SOV Space"><span aria-hidden="true">◯</span>SOV</Link>
      <div className="sov-sidebar-label">MY SOV</div>
      <nav aria-label="Primary">{links}</nav>
      <Link href="/projects/new" className="solve-button sov-sidebar-create"><Plus size={18}/>Create<ArrowUpRight size={15}/></Link>
      <Link href="/bot" className="sov-agent-shortcut"><Image src="/sov/companion-orb.png" width={37} height={37} alt=""/><span>My Agent</span><ArrowUpRight size={16}/></Link>
      <div className="sov-sidebar-bottom"><span><LockSimple size={14}/>Private by default</span><Link href="/control"><UserCircle size={31}/><div><strong>{identity?.name || (identity?'Your Space':'Welcome to SOV')}</strong><small>{identity ? identity.isGuest?'Guest session':'Account signed in':'Explore first'}</small></div></Link></div>
    </aside>
    <div className="solve-body">
      <header className="solve-topbar"><Link href="/" className="sov-mobile-mark">◯ SOV</Link><div className="sov-topbar-context"><span>SOV</span><i>/</i>{PRIMARY_DESTINATIONS.find(d=>d.href===active)?.label}</div><div className="sov-topbar-actions"><Link href="/projects" className="sov-find-work">Find your work <span>↗</span></Link><Link href="/control" aria-label="SOV ID and security"><ShieldCheck size={21}/></Link><Link href="/account" aria-label="Account preferences"><SlidersHorizontal size={21}/></Link></div></header>
      <div id="solve-main" tabIndex={-1} className="solve-main">{children}</div>
    </div>
    <Link href="/bot" className="sov-mobile-agent" aria-label="My Agent"><Image src="/sov/companion-orb.png" width={42} height={42} alt=""/></Link>
    <nav aria-label="Primary mobile" className="solve-mobile-nav">{links}</nav>
  </div>;
}
