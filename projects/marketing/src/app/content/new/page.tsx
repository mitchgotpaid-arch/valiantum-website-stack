import {requirePageUser} from '@/data/page-auth';
import Link from "next/link";
import { redirect } from "next/navigation";
import { PageFrame } from "@/components/page-frame";
import { listBrands } from "@/data/brands";
import { hasSupabaseEnv } from "@/lib/env";
import { ContentForReviewForm } from "../content-forms";

export default async function NewContentPage() {
  await requirePageUser();
  if (!hasSupabaseEnv()) redirect("/content");
  const brands = await listBrands();
  return <PageFrame title="Create something worth sharing." description="Your words. Your brand. Start a new draft and give it a final review before the next step.">
    <div className="back-row"><Link href="/content">← Back to approval queue</Link><span className="badge warning">Human review required</span></div>
    {brands.length ? <section className="card form-card"><ContentForReviewForm brands={brands} /></section> : <div className="card section-card"><div className="empty"><strong>Create a Brand first</strong>Add a brand so every draft has the right voice, context, and creative direction.<div style={{ marginTop: 18 }}><Link className="button" href="/brands/new">Create first brand</Link></div></div></div>}
  </PageFrame>;
}
