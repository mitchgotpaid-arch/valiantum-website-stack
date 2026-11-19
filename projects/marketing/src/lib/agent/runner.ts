import {createClient} from '@supabase/supabase-js';
import {getPublicEnv} from '@/lib/env';
import {getAiEnvironment} from '@/lib/ai/config';
import {buildBrandKnowledge} from '@/lib/brands/knowledge';
import {generateBrandDraft} from '@/lib/ai/draft-generator';
import {chooseAgentPlan,repeatsRecentDraft} from './planner';
import {decodeAgentContext,type AgentWork} from './work';
import {workerKey} from './worker-auth.cjs';
export async function runDraftAgentTick(){
 const key=workerKey(process.env);if(!key)throw Error('Worker not configured');const env=getPublicEnv(),ai=getAiEnvironment();
 const db=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
 const claimed=await db.rpc('claim_draft_agent_work',{p_worker_key:key});if(claimed.error){if(claimed.error.code==='PGRST202')return {processed:false,setupRequired:true};throw Error('Worker claim failed');}if(!claimed.data||claimed.data.blocked)return {processed:!!claimed.data};
 const work=claimed.data as AgentWork;const finish=async(result:Record<string,unknown>)=>{const response=await db.rpc('finish_draft_agent_run',{p_worker_key:key,p_run_id:work.runId,p_result:result});if(response.error)throw Error('Worker result save failed');return response.data;};
 let reserved=false;
 try{
  const {brand,governance}=decodeAgentContext(work),training=buildBrandKnowledge(brand,governance);
  if(!training.ready){await finish({status:'BLOCKED',reason:'NEEDS_KNOWLEDGE',summary:'Complete Brand Knowledge: '+training.checks.filter(c=>!c.passed).map(c=>c.label).join(', ')});return {processed:true};}
  const reservation=await db.rpc('reserve_draft_agent_run',{p_worker_key:key,p_run_id:work.runId,p_model:ai.OPENAI_DRAFT_MODEL});
  if(reservation.error){await finish({status:'BLOCKED',reason:reservation.error.code==='P0001'?'BUDGET_LIMIT':'PAUSED',summary:reservation.error.code==='P0001'?'The monthly AI budget is fully used or reserved. No AI request was made.':'The run could not reserve its budget. Check settings before the next run.'});return {processed:true};}
  reserved=true;const planned=await chooseAgentPlan(training.context,work.recent,ai);
  const focused=buildBrandKnowledge(brand,governance,planned.plan.brief);
  const started=performance.now();const draft=await generateBrandDraft({brand:focused.context,brief:planned.plan.brief+'\nTarget channel: '+planned.plan.channel,contentType:'SOCIAL_POST'},ai);
  if(repeatsRecentDraft(draft.body,work.recent)){await finish({status:'SKIPPED',reason:'REPEATED_CONTENT',summary:'The draft was too similar to recent content. It was not added to your queue.',plan:planned.plan});return {processed:true};}
  const cost=planned.estimatedCostMicros+draft.estimatedCostMicros;
  if(cost>30000)throw Error('Run cost exceeded reservation');
  await finish({status:'SUCCEEDED',reason:'DRAFT_READY',summary:planned.plan.rationale,plan:planned.plan,channel:planned.plan.channel,title:draft.title,body:draft.body,model:draft.model,inputTokens:planned.inputTokens+draft.inputTokens,outputTokens:planned.outputTokens+draft.outputTokens,estimatedCostMicros:cost,latencyMs:Math.round(performance.now()-started),researchNotes:[...draft.researchNotes,...(draft.knowledgeRecord?['VALIANTUM_KNOWLEDGE_V1:'+JSON.stringify(draft.knowledgeRecord)]:[])]});
  return {processed:true};
 }catch(error){console.error('[draft-agent] run failed',{error:error instanceof Error?error.name:'unknown',reserved});await finish({status:'FAILED',reason:'GENERATION_FAILED',summary:reserved?'The AI run could not finish. Its reserved cost was counted conservatively. The next regular run will try a fresh topic.':'The run stopped before generation. No AI request was made.'});return {processed:true};}
}
