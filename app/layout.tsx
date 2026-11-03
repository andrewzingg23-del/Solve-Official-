import type { Metadata, Viewport } from "next";
import { Archivo, Geist_Mono } from "next/font/google";
import "./globals.css";
import { getUser } from "@/lib/supabase/server";
import { DEFAULT_PERSONA } from "@/lib/bot/persona";
import { getPersonalBot } from "@/lib/product/identity-server";
import { identityCharacter } from "@/lib/product/identity";
import { ProductShell } from "./product/shell";
import "./product/product.css";
import "./world/[worldId]/room/room.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "solve",
  description: "A shared place for people, ideas and your AIs. Think, plan and build together.",
  applicationName: "solve",
  // Installable to the home screen (PWA). The manifest link is added by app/manifest.ts.
  appleWebApp: { capable: true, title: "solve", statusBarStyle: "black-translucent" },
  icons: {
    icon: [{ url: "/brand/solve-favicon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/brand/solve-app-icon.svg", type: "image/svg+xml" }],
  },
};

// themeColor lives on the viewport export in this Next version (not metadata).
export const viewport: Viewport = {
  themeColor: "#04070d",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getUser();
  const bot = user ? await getPersonalBot().catch(() => null) : null;
  const identity = user ? { userId: user.id, guest: user.is_anonymous === true, name: bot?.ownerLabel || (typeof user.user_metadata?.display_name === "string" ? user.user_metadata.display_name : "Your profile"), persona: identityCharacter(bot?.persona ?? DEFAULT_PERSONA) } : null;
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${geistMono.variable} h-full antialiased`}
      style={{ backgroundColor: "#04070d" }}
    >
      <body className="min-h-full flex flex-col font-sans">
        <ProductShell identity={identity}>{children}</ProductShell>
      </body>
    </html>
  );
}
