import Link from "next/link";
import { AppDock } from "./app-dock";
import "./app-dock.css";

export const metadata = { title: "My App Surfaces — SOV" };

export default function AppSurfacesPage() {
  return <main className="solve-page sov-app-dock-page">
    <header className="solve-page-heading">
      <span className="solve-kicker">Space / Optional apps</span>
      <h1>Bring an app into your Space.</h1>
      <p>Use supported external experiences inside SOV. You decide what appears; nothing is connected or shared by default.</p>
      <div className="solve-profile-save"><Link href="/onboarding#apps" className="solve-text-link">Browse more integrations →</Link><Link href="/control" className="solve-text-link">Control & permissions →</Link></div>
    </header>
    <AppDock />
  </main>;
}
