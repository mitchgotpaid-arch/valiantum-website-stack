import Link from "next/link";
import { redirect } from "next/navigation";
import { PageFrame } from "@/components/page-frame";
import { listBrands } from "@/data/brands";
import { hasSupabaseEnv } from "@/lib/env";
import { ContentForReviewForm } from "../content-forms";

export default async function NewContentPage() {
  if (!hasSupabaseEnv()) redirect("/content");
  const brands = await listBrands();
  return <PageFrame title="Submit content for review" description="Create a human-authored or imported draft with fail-closed verification, risk, approval, and media defaults.">
    <div className="back-row"><Link href="/content">← Back to approval queue</Link><span className="badge warning">Human review required</span></div>
    {brands.length ? <section className="card form-card"><ContentForReviewForm brands={brands} /></section> : <div className="card section-card"><div className="empty"><strong>Create a Brand first</strong>Content must belong to a Brand so RLS, truth, sources, and media policy can be enforced.<div style={{ marginTop: 18 }}><Link className="button" href="/brands/new">Create first brand</Link></div></div></div>}
  </PageFrame>;
}
