import {requirePageUser} from '@/data/page-auth';
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { listBrands } from "@/data/brands";
import { listContentQueue } from "@/data/content";
import { hasSupabaseEnv } from "@/lib/env";

export default async function DashboardPage() {
  await requirePageUser();
  const databaseConfigured = hasSupabaseEnv();
  const [content, brands] = databaseConfigured
    ? await Promise.all([listContentQueue(), listBrands()])
    : [[], []];
  const hasBrands = brands.length > 0;
  const awaitingApproval = content.filter((item) => item.status === "NEEDS_REVIEW").length;
  const metrics = [
    ["Awaiting approval", String(awaitingApproval), awaitingApproval ? "Human decisions required" : "Approval queue is clear"],
    ["Scheduled", "0", "No upcoming publications"],
    ["Failed jobs", "0", "No operational failures"],
    ["AI spend", "$0.00", "No production AI calls"],
  ] as const;

  return (
    <AppShell>
      <div className="content">
        <div className="title-row">
          <div><div className="eyebrow">Operations overview</div><h1>Marketing workspace</h1><p className="subtitle">{dashboardSubtitle(databaseConfigured, brands.map((brand) => brand.name))}</p></div>
          <span className="badge">{databaseConfigured ? "Private workspace" : "Connection required"}</span>
        </div>
        <section className="metrics" aria-label="Operational metrics">
          {metrics.map(([label, value, detail]) => <article className="card metric" key={label}><div className="metric-label">{label}</div><div className="metric-value">{value}</div><div className="metric-detail">{detail}</div></article>)}
        </section>
        <div className="section-grid">
          <section className="card section-card">
            <div className="section-heading"><h2>Today&apos;s content plan</h2><span className="badge warning">Not configured</span></div>
            {hasBrands
              ? <div className="empty"><strong>No content scheduled</strong>Content scheduling is not configured yet. You can submit a draft to the human Approval Queue now.<div style={{ marginTop: 18 }}><Link className="button" href="/content/new">Submit content</Link></div></div>
              : <div className="empty"><strong>No brands yet</strong>Add a brand before planning content. Brand facts and safety rules will be required before generation.</div>}
          </section>
          <section className="card section-card">
            <div className="section-heading"><h2>From idea to marketing</h2></div>
            <p className="subtitle">Capture ideas in Projects, then send a saved card as a brief. Review your content here and see its marketing status back on the original card.</p>
            <div className="brief-actions"><Link className="button" href="/projects">Project briefs</Link><Link className="button button-secondary" href="/agent">Marketing Agent</Link><a className="button button-secondary" href="/">Open Projects ↗</a></div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function dashboardSubtitle(databaseConfigured: boolean, brandNames: string[]) {
  if (!databaseConfigured) return "The system is in safe setup mode. Connect your existing Marketing OS database to restore your brands and drafts.";
  if (!brandNames.length) return "Your marketing database is connected. Add the first Brand and its truth sources to begin configuration.";
  if (brandNames.length === 1) return `${brandNames[0]} is connected. Add as much optional Brand context as you want; blank settings are ignored by the Agent.`;
  return `${brandNames.length} Brands are connected. Add only the optional context you want each Marketing Agent to use.`;
}
