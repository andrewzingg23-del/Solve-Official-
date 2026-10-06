"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/packs", label: "Home" },
  { href: "/packs/trading", label: "Trade" },
  { href: "/bot", label: "Bot" },
  { href: "/card", label: "Card" },
];

export function TabBar() {
  const pathname = usePathname();
  if (pathname.startsWith("/login")) return null;
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur"
    >
      <div className="mx-auto grid max-w-4xl grid-cols-4" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        {TABS.map((t) => {
          const active = pathname === t.href || (t.href !== "/packs" && pathname.startsWith(t.href));
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium transition-colors ${
                active ? "text-accent" : "text-faint"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
