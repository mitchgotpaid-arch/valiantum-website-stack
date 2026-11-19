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
  return <PageFrame title="Marketing Agent" description="Your brands keep moving. Let the agent choose the next idea, write it, and bring you a draft to review.">
    {!storageReady?<div className="setup-callout"><strong>Automatic drafting is being connected</strong><p>The background-agent database update is pending. Your existing content and manual AI tools remain available below.</p></div>:null}
    <AgentRefresh active={automatic.settings.some(s=>s.enabled)}/><AutomaticAgent brands={trained.map(({brand,training})=>({brand,ready:training.ready,missing:training.checks.filter(c=>!c.passed).map(c=>c.label)}))} settings={automatic.settings} runs={automatic.runs} configured={storageReady&&hasAiEnvironment()&&!!workerHash(process.env)}/>
    <details className="card section-card manual-agent-tools"><summary>Give the agent a specific assignment</summary><p className="field-hint">Optional tools for a particular idea or a live research briefing. Automatic drafts need no brief.</p>
    {budget ? <section className="card section-card settings-card"><div className="section-heading"><div><div className="eyebrow">API cost guard</div><h2>{formatMicros(budget.remainingCostMicros)} remaining this month</h2><p>Hard application cap: ${(budget.monthlyBudgetCents / 100).toFixed(2)} across all Brands. Briefings reserve up to $0.45 before any OpenAI request; routine Luna drafts reserve $0.01. Failed runs may count the full reservation against this app cap, so this is not an exact OpenAI bill.</p></div><span className="badge">{formatMicros(budget.usedCostMicros)} counted toward cap</span></div></section> : null}
    {readyBrands.length ? <section className="card form-card"><div className="section-heading"><div><div className="eyebrow">Research director</div><h2>Build today&apos;s Brand briefing</h2><p>Live research is verified, ranked, and converted into a daily plan, distinct graphic directions, platform-native copy, and one complete article/SEO package.</p></div><span className="badge warning">Review required</span></div><DailyBriefingForm brands={readyBrands} configured={hasAiEnvironment()} /></section> : null}
    {readyBrands.length ? <section className="card form-card"><div className="section-heading"><div><h2>Generate a Brand-aware draft</h2><p>The Agent uses populated Brand Settings, produces a draft for review, and marks unsupported claims for verification. It cannot publish.</p></div><span className="badge warning">Review required</span></div><AgentDraftForm brands={readyBrands} configured={hasAiEnvironment()} initialBrandId={readyBrands.some(brand=>brand.id===requested.brand)?requested.brand:undefined} initialBrief={requested.brief?.slice(0,4000)} /></section> : null}
    </details><section className="card section-card settings-card"><div className="section-heading"><div><h2>Brand context</h2><p>Each generation retrieves this brand’s current verified facts, active rules, media policy, and voice guidance. A separate AI review pass checks routine drafts before they reach you.</p></div></div>
      {trained.length ? <div className="brand-list">{trained.map(({brand,training})=><Link className="settings-link" href={`/brands/${brand.id}/knowledge`} key={brand.id}><div><strong>{brand.name}</strong><span>{training.ready?'Foundation ready for grounded drafts':training.checks.filter(check=>!check.passed).map(check=>check.label).join(' · ')}</span></div><span>Teach this brand →</span></Link>)}</div> : <div className="mini-empty">Add a brand to begin teaching its agent.</div>}
      {readyBrands.length<brands.length?<div className="setup-callout"><strong>Finish Brand Knowledge before generating</strong><p>Only brands with complete teaching essentials can generate new AI drafts. No API credits are used for this setup check.</p><Link className="text-link" href="/knowledge">Open Brand Knowledge →</Link></div>:null}
    </section>
  </PageFrame>;
}

function formatMicros(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value / 1_000_000);
}
