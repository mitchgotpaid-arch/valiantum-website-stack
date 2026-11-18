import Link from "next/link";
import { hasSupabaseEnv } from "@/lib/env";

const navigation = [
  ["Dashboard", "/"],
  ["Brands", "/brands"],
  ["Content", "/content"],
  ["Calendar", "/calendar"],
  ["Campaigns", "/campaigns"],
  ["Project briefs", "/projects"],
  ["Agent", "/agent"],
  ["Analytics", "/analytics"],
  ["Settings", "/settings"],
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  const databaseConfigured = hasSupabaseEnv();

  return (
    <div className="app-grid">
      <aside className="sidebar">
        <div className="wordmark">Valiantum <small>Marketing OS</small></div>
        <a className="projects-return" href="/">← Back to Projects</a>
        <nav className="nav" aria-label="Primary navigation">
          {navigation.map(([label, href]) => <Link href={href} key={href}>{label}</Link>)}
        </nav>
        <div className="safety-note">
          <strong>Automatic publishing is off</strong>
          Drafting and review can continue. No content can be auto-published.
        </div>
      </aside>
      <main className="main">
        <header className="topbar">
          <span className="eyebrow">Operations workspace</span>
          <span className={`badge${databaseConfigured ? "" : " warning"}`}>
            {databaseConfigured ? "Database connected" : "Setup mode"}
          </span>
        </header>
        {children}
      </main>
    </div>
  );
}
