"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/packs", label: "Home" },
  { href: "/packs/trading", label: "Trade" },
  { href: "/bot", label: "Bot" },
  { href: "/card", label: "Card" },
  { href: "/avatar", label: "Avatar" },
];

export function TabBar() {
  const pathname = usePathname();
  if (pathname.startsWith("/login")) return null;
  return (
    <nav
      aria-label="Primary"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center"
      style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}
    >
      <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-line bg-[linear-gradient(165deg,rgb(14_23_40/0.85),rgb(6_11_20/0.7))] p-1.5 shadow-[0_16px_48px_rgb(0_0_0/0.45),inset_0_1px_0_rgb(242_247_251/0.07)] backdrop-blur-xl">
        {TABS.map((t) => {
          const active = pathname === t.href || (t.href !== "/packs" && pathname.startsWith(t.href));
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-[56px] min-w-[68px] flex-col items-center justify-center gap-1.5 rounded-full px-4 text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors ${
                active ? "text-accent" : "text-faint"
              }`}
            >
              {t.label}
              <span
                aria-hidden
                className={`h-1 w-1 rounded-full transition-opacity ${
                  active
                    ? "bg-accent opacity-100 shadow-[0_0_10px_rgb(34_211_238/0.9)]"
                    : "opacity-0"
                }`}
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
