import {AgentRefresh} from './agent-refresh';
import {getDraftAgentState,AgentStorageError} from '@/data/draft-agent';
import {AutomaticAgent} from '@/components/marketing/automatic-agent';
import {workerHash} from '@/lib/agent/worker-auth.cjs';
import {requirePageUser} from '@/data/page-auth';
import Link from "next/link";
import { PageFrame } from "@/components/page-frame";
import { listBrands } from "@/data/brands";
import { getAiBudgetStatus } from "@/data/ai";
import {buildBrandKnowledge} from "@/lib/brands/knowledge";
import {getBrandGovernance} from "@/data/brand-governance";
import { hasAiEnvironment } from "@/lib/ai/config";
import { hasSupabaseEnv } from "@/lib/env";
import { AgentDraftForm } from "./agent-draft-form";
import { DailyBriefingForm } from "./daily-briefing-form";

export default async function AgentPage({searchParams}:{searchParams:Promise<{brand?:string;brief?:string}>}) {
  await requirePageUser();
  const [brands, budget] = hasSupabaseEnv() ? await Promise.all([listBrands(), getAiBudgetStatus()]) : [[], null];
  const requested=await searchParams;
  const trained=await Promise.all(brands.map(async brand=>({brand,training:buildBrandKnowledge(brand,await getBrandGovernance(brand.id))})));
  let automatic:Awaited<ReturnType<typeof getDraftAgentState>>={settings:[],runs:[]},storageReady=true;
  if(hasSupabaseEnv())try{automatic=await getDraftAgentState();}catch(error){if(error instanceof AgentStorageError&&error.code==='SETUP_REQUIRED')storageReady=false;else throw error;}
  const readyBrands=trained.filter(item=>item.training.ready).map(item=>item.brand);
  return <PageFrame title="Marketing Agent" description="Request a post or let the agent create ideas. Review the copy, then publish or schedule to your connected Facebook Page.">
    {!storageReady?<div className="setup-callout"><strong>Automatic drafting is being connected</strong><p>The background-agent database update is pending. Your existing content and manual AI tools remain available below.</p></div>:null}
    <section className="card form-card agent-assignment" id="assignment"><div className="section-heading"><div><span className="eyebrow">ASK YOUR AGENT</span><h2>What would you like to post?</h2><p>Describe your idea. The agent creates the copy, then opens a preview where you can approve and publish or schedule a Facebook Page post.</p></div></div>
    {brands.length?<AgentDraftForm brands={brands} configured={hasAiEnvironment()} initialBrandId={brands.some(brand=>brand.id===requested.brand)?requested.brand:brands[0]?.id} initialBrief={requested.brief?.slice(0,4000)} readiness={trained.map(({brand,training})=>({brandId:brand.id,missing:training.checks.filter(c=>!c.passed).map(c=>c.label)}))}/>:<p>Add a brand to begin creating posts.</p>}</section>
    <AgentRefresh active={automatic.settings.some(s=>s.enabled)}/><AutomaticAgent brands={trained.map(({brand,training})=>({brand,ready:training.ready,missing:training.checks.filter(c=>!c.passed).map(c=>c.label)}))} settings={automatic.settings} runs={automatic.runs} configured={storageReady&&hasAiEnvironment()&&!!workerHash(process.env)}/>
    {budget ? <section className="card section-card settings-card"><div className="section-heading"><div><div className="eyebrow">API cost guard</div><h2>{formatMicros(budget.remainingCostMicros)} remaining this month</h2><p>Hard application cap: ${(budget.monthlyBudgetCents / 100).toFixed(2)} across all Brands. Briefings reserve up to $0.45 before any OpenAI request; routine Luna drafts reserve $0.01. Failed runs may count the full reservation against this app cap, so this is not an exact OpenAI bill.</p></div><span className="badge">{formatMicros(budget.usedCostMicros)} counted toward cap</span></div></section> : null}
    <details className="card section-card manual-agent-tools"><summary>Live research briefing</summary><p className="field-hint">Research current events from approved sources. Routine post requests belong in the prompt box above.</p>    {readyBrands.length ? <section className="card form-card"><div className="section-heading"><div><div className="eyebrow">Research director</div><h2>Build today&apos;s Brand briefing</h2><p>Live research is verified, ranked, and converted into a daily plan, distinct graphic directions, platform-native copy, and one complete article/SEO package.</p></div><span className="badge warning">Review required</span></div><DailyBriefingForm brands={readyBrands} configured={hasAiEnvironment()} /></section> : <p>Live research needs approved sources and complete Brand Knowledge. <Link href="/knowledge">Finish research setup</Link>. You can still request a post in the prompt box above.</p>}
</details><section className="card section-card settings-card"><div className="section-heading"><div><h2>Brand context</h2><p>Each generation retrieves this brand’s current verified facts, active rules, media policy, and voice guidance. A separate AI review pass checks routine drafts before they reach you.</p></div></div>
      {trained.length ? <div className="brand-list">{trained.map(({brand,training})=><Link className="settings-link" href={`/brands/${brand.id}/knowledge`} key={brand.id}><div><strong>{brand.name}</strong><span>{training.ready?'Foundation ready for grounded drafts':training.checks.filter(check=>!check.passed).map(check=>check.label).join(' · ')}</span></div><span>Teach this brand →</span></Link>)}</div> : <div className="mini-empty">Add a brand to begin teaching its agent.</div>}
      {readyBrands.length<brands.length?<div className="setup-callout"><strong>Improve automatic drafting and research</strong><p>Automatic drafting and live research need complete brand knowledge. Manual assignments above remain available and are flagged for your review.</p><Link className="text-link" href="/knowledge">Open Brand Knowledge →</Link></div>:null}
    </section>
  </PageFrame>;
}

function formatMicros(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value / 1_000_000);
}
