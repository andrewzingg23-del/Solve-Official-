"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useGuestProfile } from "@/lib/guest/profile";
import { DEFAULT_PERSONA, validatePersona, type Persona } from "@/lib/bot/persona";
import { BotCharacter } from "@/app/bot/character";
import { workspaceIdentityLabel } from "@/lib/product/identity";
import { Icon, type IconName } from "./icons";

const homes: Array<{ href: string; label: string; icon: IconName }> = [
  { href: "/", label: "Projects", icon: "projects" },
  { href: "/communities", label: "Communities", icon: "community" },
  { href: "/connect", label: "Connections", icon: "ai" },
  { href: "/account", label: "Profile", icon: "profile" },
];
export type ShellIdentity = { userId: string; name: string; guest: boolean; persona: Persona } | null;
export function ProductShell({ children, identity }: { children: React.ReactNode; identity: ShellIdentity }) {
  const path = usePathname();
  const { profile } = useGuestProfile();
  const active = path.startsWith("/world") || path === "/" ? "/" : path.startsWith("/community") ? "/communities" : path;
  const minimal = path.startsWith("/oauth") || path.startsWith("/saved") || path.startsWith("/world-invite");
  const name = identity ? identity.name || "Your profile" : profile?.yourName || "Your profile";
  const localBotName = profile?.botPersona ? validatePersona(profile.botPersona, DEFAULT_PERSONA).name : profile?.botName;
  const persona = identity?.persona ?? validatePersona(profile?.botPersona, { ...DEFAULT_PERSONA, name: localBotName || DEFAULT_PERSONA.name });
  const botName = persona.name;
  const links = homes.map(home => <Link key={home.href} href={home.href} aria-current={active === home.href || active.startsWith(home.href + "/") ? "page" : undefined} className="solve-nav-link"><Icon name={home.icon} /><span>{home.label}</span></Link>);
  if (path === "/studio" || path === "/map" || path === "/sov-id" || /^\/world\/[^/]+\/studio$/.test(path)) return <>{children}</>;
  if (minimal) return <div className="solve-minimal"><Link href="/" className="solve-wordmark">solve<span>.</span></Link>{children}</div>;
  return <div className="solve-shell">
    <a href="#solve-main" className="solve-skip">Skip to content</a>
    <aside className="solve-sidebar" aria-label="Workspace sidebar">
      <Link href="/" className="solve-wordmark" aria-label="solve home">solve<span>.</span></Link>
      <div className="solve-sidebar-caption">A place to build together</div>
      <Link href="/worlds/new" className="solve-button solve-new-project"><Icon name="plus" />New project</Link>
      <nav aria-label="Primary">{links}</nav>
      <div className="solve-sidebar-bottom">
        <Link href="/bot" className="solve-ai-identity"><BotCharacter persona={persona} size={40} /><div><strong>{botName}</strong><span>{identity ? "Your personal AI" : "Make it yours"}</span></div><Icon name="arrow" width={15} /></Link>
        <Link href="/account" className="solve-person-identity"><span className="solve-initial">{name.slice(0, 1).toUpperCase()}</span><div><strong>{name}</strong><span>{workspaceIdentityLabel(identity ? { is_anonymous: identity.guest } : null)}</span></div></Link>
      </div>
    </aside>
    <div className="solve-body">
      <header className="solve-topbar"><Link href="/" className="solve-mobile-wordmark">solve<span>.</span></Link><span className="solve-topbar-title">{path.startsWith("/world/") ? "Shared workspace" : homes.find(home => home.href === active)?.label || (path === "/login" ? "Welcome to solve" : "Your workspace")}</span><div>{identity && !identity.guest ? <span className="solve-private-label"><Icon name="lock" width={14} />Your workspace</span> : <Link href="/login?next=%2Fconnect" className="solve-text-link">Sign in</Link>}</div></header>
      <div id="solve-main" tabIndex={-1} className="solve-main">{children}</div>
    </div>
    <nav aria-label="Primary mobile" className="solve-mobile-nav">{links}</nav>
  </div>;
}
