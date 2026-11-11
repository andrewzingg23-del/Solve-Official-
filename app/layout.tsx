import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { getUser } from "@/lib/supabase/server";
import { getKernel } from "@/lib/kernel/server";
import { BASE_LOOK, type CardLook } from "@/lib/product/card";
import { environmentFor, environmentStyle } from "@/lib/product/environment";
import { readLook } from "@/lib/product/look-store";
import { readSpaceShared } from "@/lib/product/page";
import { Shell } from "./ui/shell";
import "./ui/system.css";

// Rebuilt from zero (2026-11-10). Nothing visual here descends from the earlier product: one design
// system (app/ui/system.css), one shell (app/ui/shell.tsx), and an environment whose colours come
// from the person's own card, computed before the first paint.

const sans = Geist({ variable: "--font-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Solve",
  description: "Your digital life, in your hands.",
  applicationName: "Solve",
  appleWebApp: { capable: true, title: "Solve", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#f5f4fa" };

/** Who is here, and how their SOLVE looks. Any failure falls back to SOLVE's Base, never to an error. */
async function presence(): Promise<{ name: string; look: CardLook; signedIn: boolean; publicSpace: boolean; identityKey: string }> {
  const user = await getUser().catch(() => null);
  if (!user) return { name: "", look: BASE_LOOK, signedIn: false, publicSpace: false, identityKey: "signed-out" };
  try {
    const kernel = await getKernel();
    const me = await kernel.whoami();
    const [profile] = await kernel.readActors([me.actor_id]).catch(() => []);
    const [stored, space] = await Promise.all([
      readLook(kernel, me.actor_id).catch(() => null),
      readSpaceShared(kernel, me.actor_id).catch(() => ({ shared: false })),
    ]);
    return { name: profile?.label?.trim() ?? "", look: stored?.look ?? BASE_LOOK, signedIn: !user.is_anonymous, publicSpace: space.shared, identityKey: user.id };
  } catch {
    return { name: "", look: BASE_LOOK, signedIn: !user.is_anonymous, publicSpace: false, identityKey: user.id };
  }
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { name, look, signedIn, publicSpace, identityKey } = await presence();
  const env = environmentFor(look);
  return (
    <html lang="en" data-tone={env.tone} className={`${sans.variable} ${mono.variable}`} style={environmentStyle(env) as React.CSSProperties}>
      <body>
        <Shell identityKey={identityKey} name={name} signedIn={signedIn} publicSpace={publicSpace}>{children}</Shell>
      </body>
    </html>
  );
}
