"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useGuestProfile } from "@/lib/guest/profile";
import { DEFAULT_PERSONA, validatePersona } from "@/lib/bot/persona";
import { faceSrc } from "@/lib/bot/avatar";
import { Icon, type IconName } from "./icons";
import { SolveBrand } from "./solve-brand";

// The five destinations (DECISIONS.md, 2026-11-09). Projects, communities and the AI are not
// destinations of their own: things and people live in Space, the AI is an actor, and both are
// reached from where they belong rather than given permanent tabs.
const homes: Array<{ href: string; label: string; icon: IconName }> = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/account", label: "ID", icon: "profile" },
  { href: "/space", label: "Space", icon: "projects" },
  { href: "/workbench", label: "Bench", icon: "document" },
  { href: "/control", label: "Control", icon: "control" },
];

const within = (path: string, root: string) => path === root || path.startsWith(root + "/");

/** Which destination a route belongs to, so the right one is marked current. */
export function destinationOf(path: string): string {
  if (path === "/") return "/";
  if (/^\/world\/[^/]+\/workbench$/.test(path) || within(path, "/workbench")) return "/workbench";
  if (["/account", "/sov-id", "/bot", "/onboarding", "/claim"].some(root => within(path, root))) return "/account";
  if (["/control", "/apps"].some(root => within(path, root))) return "/control";
  if (["/space", "/projects", "/communities", "/community", "/world", "/worlds"].some(root => within(path, root))) return "/space";
  return path;
}
export type ShellIdentity = { userId: string; name: string; botName: string; face: string } | null;
export function ProductShell({ children, identity }: { children: React.ReactNode; identity: ShellIdentity }) {
  const path = usePathname();
  const { profile } = useGuestProfile();
  const active = destinationOf(path);
  // Pages a person reaches from a link someone else sent them: no one's navigation, only SOLVE's mark.
  const minimal = path.startsWith("/oauth") || path.startsWith("/saved") || path.startsWith("/world-invite") || path.startsWith("/confirm/");
  const name = identity ? identity.name || "Your profile" : profile?.yourName || "Your profile";
  const localBotName = profile?.botPersona ? validatePersona(profile.botPersona, DEFAULT_PERSONA).name : profile?.botName;
  const botName = identity?.botName || (!identity ? localBotName : "") || "Your AI";
  const face = identity?.face || (!identity ? profile?.face : "") || "blank";
  const links = homes.map(home => <Link key={home.href} href={home.href} aria-current={active === home.href ? "page" : undefined} className="solve-nav-link"><Icon name={home.icon} /><span>{home.label}</span></Link>);
  // One shell. Only a real working surface — an editor or studio — takes the full screen, which
  // is focus mode rather than a second application. Home is not one of those: it was drawing its
  // own separate chrome, which made SOLVE two shells. It now lives inside this one.
  if (path.startsWith("/personalize/instagram") || /^\/world\/[^/]+\/workbench$/.test(path)) return <>{children}</>;
  if (path === "/onboarding") return <>{children}</>;
  if (path === "/studio" || path === "/map" || path === "/sov-id" || /^\/world\/[^/]+\/studio$/.test(path)) return <>{children}</>;
  if (minimal) return <div className="solve-minimal"><SolveBrand href="/" />{children}</div>;
  return <div className="solve-shell">
    <a href="#solve-main" className="solve-skip">Skip to content</a>
    <aside className="solve-sidebar" aria-label="Workspace sidebar">
      <SolveBrand href="/" />
      <div className="solve-sidebar-caption">A Space that is yours.</div>
      <Link href="/worlds/new" className="solve-button solve-new-project"><Icon name="plus" />Create</Link>
      <nav aria-label="Primary">{links}</nav>
      <div className="solve-sidebar-bottom">
        <Link href="/bot" className="solve-ai-identity"><Image src={faceSrc(face)} width={40} height={40} alt="" loading="eager" /><div><strong>{botName}</strong><span>{identity ? "Your personal AI" : "Make it yours"}</span></div><Icon name="arrow" width={15} /></Link>
        <Link href="/account" className="solve-person-identity"><span className="solve-initial">{name.slice(0, 1).toUpperCase()}</span><div><strong>{name}</strong><span>{identity ? "Account saved" : profile ? "Saved on this device" : "Start with you"}</span></div></Link>
      </div>
    </aside>
    <div className="solve-body">
      <header className="solve-topbar"><SolveBrand href="/" compact /><span className="solve-topbar-title">{path.startsWith("/world/") ? "Shared workspace" : path === "/onboarding" ? "Make it yours" : homes.find(home => home.href === active)?.label || (path === "/login" ? "Welcome to SOLVE" : "SOLVE")}</span><div className="sov-topbar-actions"><Link href="/apps" className="solve-text-link">Apps</Link>{identity ? <Link href="/account" className="solve-private-label"><Icon name="lock" width={14} />SOV ID</Link> : <Link href="/login?next=%2Fonboarding" className="solve-text-link">Sign in</Link>}</div></header>
      <div id="solve-main" tabIndex={-1} className="solve-main">{children}</div>
    </div>
    <nav aria-label="Primary mobile" className="solve-mobile-nav">{links}</nav>
  </div>;
}
