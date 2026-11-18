import Link from "next/link";
import { PageFrame } from "@/components/page-frame";
import { listContentQueue } from "@/data/content";
import { hasSupabaseEnv } from "@/lib/env";

export default async function ContentPage() {
  if (!hasSupabaseEnv()) return <PageFrame title="Content" description="A central workspace for ideas, research, drafts, verification, approval, and publication history."><div className="card section-card"><div className="empty"><strong>Connect Supabase first</strong>The Approval Queue requires authenticated Brand-scoped data.</div></div></PageFrame>;
  const items = await listContentQueue();
  const captured = items.filter((item) => item.status === "VERIFYING" && item.contentType === "RESEARCH_CAPTURE");
  const pending = items.filter((item) => item.status === "NEEDS_REVIEW");
  const resolved = items.filter((item) => item.status === "APPROVED" || item.status === "REJECTED");
  return <PageFrame title="Approval queue" description="Review content against Brand truth, sources, verification, risk, and media policy before recording a human decision.">
    <div className="toolbar"><span>{pending.length} awaiting review</span><Link className="button" href="/content/new">Submit content</Link></div>
    {captured.length ? <section className="resolved-section"><div className="section-heading"><div><h2>Captured research — verification needed</h2><p>Paid AI responses that failed quality checks are retained here. They cannot be approved or published in this state.</p></div></div><div className="content-list">{captured.map((item) => <ContentCard item={item} key={item.id} />)}</div></section> : null}
    {pending.length ? <div className="content-list">{pending.map((item) => <ContentCard item={item} key={item.id} />)}</div> : <div className="card section-card"><div className="empty"><strong>Approval queue is clear</strong>{captured.length ? "Captured research above still needs verification and is not eligible for approval." : "Submit content when it is ready for a human review decision."}</div></div>}
    {resolved.length ? <section className="resolved-section"><div className="section-heading"><div><h2>Recent decisions</h2><p>Approval history remains available for review and audit reconstruction.</p></div></div><div className="content-list">{resolved.map((item) => <ContentCard item={item} key={item.id} />)}</div></section> : null}
  </PageFrame>;
}

function ContentCard({ item }: { item: Awaited<ReturnType<typeof listContentQueue>>[number] }) {
  return <Link className="card content-card" href={`/content/${item.id}`}><div><div className="content-card-meta"><span>{item.brandName}</span><span>·</span><span>{item.contentType.replaceAll("_", " ")}</span></div><h2>{item.title}</h2><p>{item.body || "No preview text."}</p></div><div className="content-card-status"><span className={`status status-${item.status.toLowerCase()}`}>{item.status.replaceAll("_", " ")}</span><span className="status">{item.risk} RISK</span></div></Link>;
}
