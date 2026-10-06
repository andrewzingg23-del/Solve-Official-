import type { Metadata } from "next";
import { Archivo, Geist_Mono } from "next/font/google";
import "./globals.css";
import { CompanionMount } from "./companion/mount";
import { TabBar } from "./nav";

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
  description: "A living operating system for real life.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${geistMono.variable} h-full antialiased`}
      style={{ backgroundColor: "#04070d" }}
    >
      <body className="min-h-full flex flex-col font-sans">
        {children}
        <CompanionMount />
        <TabBar />
      </body>
    </html>
  );
}
