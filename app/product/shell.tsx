"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useGuestProfile } from "@/lib/guest/profile";
import { DEFAULT_PERSONA, validatePersona } from "@/lib/bot/persona";
import { faceSrc } from "@/lib/bot/avatar";
import { Icon, type IconName } from "./icons";

const homes: Array<{ href: string; label: string; icon: IconName }> = [
  { href: "/space", label: "Space", icon: "home" },
  { href: "/projects", label: "Projects", icon: "projects" },
  { href: "/communities", label: "Communities", icon: "community" },
  { href: "/control", label: "Control", icon: "control" },
];
export type ShellIdentity = { userId: string; name: string; botName: string; face: string } | null;
export function ProductShell({ children, identity }: { children: React.ReactNode; identity: ShellIdentity }) {
  const path = usePathname();
  const { profile } = useGuestProfile();
  const active = path === "/" || path === "/space" ? "/space" : path.startsWith("/world") || path.startsWith("/projects") ? "/projects" : path.startsWith("/community") ? "/communities" : ["/control", "/account", "/bot", "/onboarding"].some(root => path === root || path.startsWith(root + "/")) ? "/control" : path;
  const minimal = path.startsWith("/oauth") || path.startsWith("/saved") || path.startsWith("/world-invite");
  const name = identity ? identity.name || "Your profile" : profile?.yourName || "Your profile";
  const localBotName = profile?.botPersona ? validatePersona(profile.botPersona, DEFAULT_PERSONA).name : profile?.botName;
  const botName = identity?.botName || (!identity ? localBotName : "") || "Your AI";
  const face = identity?.face || (!identity ? profile?.face : "") || "blank";
  const links = homes.map(home => <Link key={home.href} href={home.href} aria-current={active === home.href || active.startsWith(home.href + "/") ? "page" : undefined} className="solve-nav-link"><Icon name={home.icon} /><span>{home.label}</span></Link>);
  if (path === "/studio" || path === "/map" || path === "/sov-id" || /^\/world\/[^/]+\/studio$/.test(path)) return <>{children}</>;
  if (minimal) return <div className="solve-minimal"><Link href="/" className="solve-wordmark">solve<span>.</span></Link>{children}</div>;
  return <div className="solve-shell">
    <a href="#solve-main" className="solve-skip">Skip to content</a>
    <aside className="solve-sidebar" aria-label="Workspace sidebar">
      <Link href="/" className="solve-wordmark sov-wordmark" aria-label="SOV Space"><span className="sov-wordmark-ring" aria-hidden="true" />SOV</Link>
      <div className="solve-sidebar-caption">Your digital life, connected</div>
      <Link href="/worlds/new" className="solve-button solve-new-project"><Icon name="plus" />Create</Link>
      <nav aria-label="Primary">{links}</nav>
      <div className="solve-sidebar-bottom">
        <Link href="/bot" className="solve-ai-identity"><Image src={faceSrc(face)} width={40} height={40} alt="" loading="eager" /><div><strong>{botName}</strong><span>{identity ? "Your personal AI" : "Make it yours"}</span></div><Icon name="arrow" width={15} /></Link>
        <Link href="/account" className="solve-person-identity"><span className="solve-initial">{name.slice(0, 1).toUpperCase()}</span><div><strong>{name}</strong><span>{identity ? "Account saved" : profile ? "Saved on this device" : "Start with you"}</span></div></Link>
      </div>
    </aside>
    <div className="solve-body">
      <header className="solve-topbar"><Link href="/" className="solve-mobile-wordmark sov-wordmark">SOV</Link><span className="solve-topbar-title">{path.startsWith("/world/") ? "Shared workspace" : path === "/onboarding" ? "Make it yours" : homes.find(home => home.href === active)?.label || (path === "/login" ? "Welcome to SOV" : "Your Space")}</span><div className="sov-topbar-actions"><Link href="/onboarding#apps" className="solve-text-link">Apps</Link>{identity ? <Link href="/account" className="solve-private-label"><Icon name="lock" width={14} />SOV ID</Link> : <Link href="/login?next=%2Fonboarding" className="solve-text-link">Sign in</Link>}</div></header>
      <div id="solve-main" tabIndex={-1} className="solve-main">{children}</div>
    </div>
    <nav aria-label="Primary mobile" className="solve-mobile-nav">{links}</nav>
  </div>;
}
