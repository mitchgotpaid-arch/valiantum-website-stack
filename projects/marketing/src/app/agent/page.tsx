import {requirePageUser} from '@/data/page-auth';
import Link from "next/link";
import { PageFrame } from "@/components/page-frame";
import { listBrands } from "@/data/brands";
import { getAiBudgetStatus } from "@/data/ai";
import { buildBrandAgentContext } from "@/lib/brands/agent-context";
import { hasAiEnvironment } from "@/lib/ai/config";
import { hasSupabaseEnv } from "@/lib/env";
import { AgentDraftForm } from "./agent-draft-form";
import { DailyBriefingForm } from "./daily-briefing-form";

export default async function AgentPage() {
  await requirePageUser();
  const [brands, budget] = hasSupabaseEnv() ? await Promise.all([listBrands(), getAiBudgetStatus()]) : [[], null];
  return <PageFrame title="Marketing Agent" description="Plan and carry out constrained marketing work with explicit permissions and a complete audit trail.">
    {budget ? <section className="card section-card settings-card"><div className="section-heading"><div><div className="eyebrow">API cost guard</div><h2>{formatMicros(budget.remainingCostMicros)} remaining this month</h2><p>Hard application cap: ${(budget.monthlyBudgetCents / 100).toFixed(2)} across all Brands. Briefings reserve up to $0.45 before any OpenAI request; routine Luna drafts reserve $0.01. Failed runs may count the full reservation against this app cap, so this is not an exact OpenAI bill.</p></div><span className="badge">{formatMicros(budget.usedCostMicros)} counted toward cap</span></div></section> : null}
    {brands.length ? <section className="card form-card"><div className="section-heading"><div><div className="eyebrow">Research director</div><h2>Build today&apos;s Brand briefing</h2><p>Live research is verified, ranked, and converted into a daily plan, distinct graphic directions, platform-native copy, and one complete article/SEO package.</p></div><span className="badge warning">Review required</span></div><DailyBriefingForm brands={brands} configured={hasAiEnvironment()} /></section> : null}
    {brands.length ? <section className="card form-card"><div className="section-heading"><div><h2>Generate a Brand-aware draft</h2><p>The Agent uses populated Brand Settings, produces a draft for review, and marks unsupported claims for verification. It cannot publish.</p></div><span className="badge warning">Review required</span></div><AgentDraftForm brands={brands} configured={hasAiEnvironment()} /></section> : null}
    <section className="card section-card settings-card"><div className="section-heading"><div><h2>Brand context</h2><p>The Agent receives only populated Brand settings. Empty optional fields are omitted, not guessed.</p></div></div>
      {brands.length ? <div className="brand-list">{brands.map((brand) => { const context = buildBrandAgentContext(brand); const optionalCount = Object.keys(context).length - 1; return <Link className="settings-link" href={`/brands/${brand.id}`} key={brand.id}><div><strong>{brand.name}</strong><span>{optionalCount} optional {optionalCount === 1 ? "setting" : "settings"} available to the Agent</span></div><span>Edit settings →</span></Link>; })}</div> : <div className="mini-empty">No Brand context is available yet.</div>}
    </section>
  </PageFrame>;
}

function formatMicros(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value / 1_000_000);
}
