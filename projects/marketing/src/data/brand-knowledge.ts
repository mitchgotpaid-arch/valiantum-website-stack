import 'server-only';
import {requireUser} from './auth';
import {BrandDataError} from './brands';
import type {VoiceTrainingInput} from '@/lib/brands/knowledge-schema';
import {savedKnowledgeRecordSchema,type SavedKnowledgeRecord} from '@/lib/brands/knowledge-schema';
import type {BrandFactInput} from '@/lib/brands/governance-schema';
import {getContentReview} from './content';
import type {Json} from '@/types/database';
export class KnowledgeConflictError extends Error {constructor(){super('This brand changed in another tab. Reload before saving.');}}
function profileObject(value:Json):Record<string,Json|undefined>{return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}
export async function saveVoiceTraining(brandId:string,input:VoiceTrainingInput){
 const {supabase}=await requireUser();
 const {data:brand,error}=await supabase.from('brands').select('agent_profile,updated_at').eq('id',brandId).maybeSingle();
 if(error)throw new BrandDataError('DATABASE_ERROR');if(!brand)throw new BrandDataError('NOT_FOUND');
 if(brand.updated_at!==input.updatedAt)throw new KnowledgeConflictError();
 const {data,error:updateError}=await supabase.from('brands').update({description:input.description,target_audience:input.targetAudience||null,brand_voice:input.brandVoice||null,agent_profile:{...profileObject(brand.agent_profile),approvedExamples:input.approvedExamples,avoidExamples:input.avoidExamples,requiredDisclosures:input.requiredDisclosures,avoidedVocabulary:input.avoidedVocabulary}}).eq('id',brandId).eq('updated_at',input.updatedAt).select('id,updated_at').maybeSingle();
 if(updateError)throw new BrandDataError('DATABASE_ERROR');if(!data)throw new KnowledgeConflictError();return data.updated_at;
}
export async function saveTrainingFact(brandId:string,factId:string|null,input:BrandFactInput&{updatedAt?:string;validUntil:string|null}){
 const {supabase}=await requireUser();
 const values={value:{value:input.value},fact_key:input.factKey,verification_status:input.verificationStatus,source_url:input.sourceUrl,valid_until:input.validUntil};
 if(factId){if(!input.updatedAt)throw new KnowledgeConflictError();const {data,error}=await supabase.from('brand_facts').update(values).eq('brand_id',brandId).eq('id',factId).eq('updated_at',input.updatedAt).select('id,updated_at').maybeSingle();if(error)throw new BrandDataError(error.code==='23505'?'DUPLICATE_KEY':'DATABASE_ERROR');if(!data)throw new KnowledgeConflictError();return data.updated_at;}
 else{const {data,error}=await supabase.from('brand_facts').insert({brand_id:brandId,...values}).select('updated_at').single();if(error)throw new BrandDataError(error.code==='23505'?'DUPLICATE_KEY':'DATABASE_ERROR');return data!.updated_at;}
}
export async function promoteApprovedVoiceExample(contentId:string){
 const content=await getContentReview(contentId);
 if(!content||!content.canEdit||content.status!=='APPROVED'||!['SOCIAL_POST','CAPTION','THREAD'].includes(content.contentType))throw new BrandDataError('NOT_FOUND');
 const {supabase}=await requireUser();
 const {data:brand,error}=await supabase.from('brands').select('agent_profile,updated_at').eq('id',content.brandId).maybeSingle();if(error||!brand)throw new BrandDataError('NOT_FOUND');
 const profile=profileObject(brand.agent_profile),old=typeof profile.approvedExamples==='string'?profile.approvedExamples:'';
 const example=`[Voice example: ${content.title}]\n${content.body}`;
 if(old.includes(example))return content.brandId;
 const next=[old,example].filter(Boolean).join('\n\n');if(next.length>6000)throw new Error('EXAMPLES_FULL');
 const {data,error:updateError}=await supabase.from('brands').update({agent_profile:{...profile,approvedExamples:next}}).eq('id',content.brandId).eq('updated_at',brand.updated_at).select('id').maybeSingle();
 if(updateError)throw new BrandDataError('DATABASE_ERROR');if(!data)throw new KnowledgeConflictError();return content.brandId;
}
export async function getGenerationKnowledge(contentId:string):Promise<{record:SavedKnowledgeRecord|null;briefingFingerprint:string|null;generatedAt:string|null}>{
 const {supabase}=await requireUser();const {data,error}=await supabase.from('audit_logs').select('metadata,created_at').eq('content_id',contentId).in('action',['content.ai_draft_created','content.ai_daily_briefing_created','content.ai_briefing_captured']).order('created_at',{ascending:false}).limit(1).maybeSingle();
 if(error)throw new BrandDataError('DATABASE_ERROR');const metadata=data?.metadata;
 if(!metadata||typeof metadata!=='object'||Array.isArray(metadata))return {record:null,briefingFingerprint:null,generatedAt:null};
 const note=Array.isArray(metadata.research_notes)?metadata.research_notes.at(-1):null;
 if(typeof note==='string'&&note.length<=100000&&note.startsWith('VALIANTUM_KNOWLEDGE_V1:')){try{const parsed=savedKnowledgeRecordSchema.safeParse(JSON.parse(note.slice('VALIANTUM_KNOWLEDGE_V1:'.length)));if(parsed.success)return {record:parsed.data,briefingFingerprint:null,generatedAt:data?.created_at||null};}catch{/* Invalid historical evidence is never rendered as a trusted record. */}}

 const prompt=metadata.prompt_version;return {record:null,briefingFingerprint:typeof prompt==='string'?prompt.match(/@([a-f0-9]{64})$/)?.[1]||null:null,generatedAt:data?.created_at||null};
}
export async function setTrainingSourceApproval(brandId:string,sourceId:string,approved:boolean){
 const {supabase}=await requireUser();const {data:source,error}=await supabase.from('brand_sources').select('id,base_url,source_tier').eq('brand_id',brandId).eq('id',sourceId).maybeSingle();
 if(error||!source)throw new BrandDataError('NOT_FOUND');
 if(approved){const {matchesApprovedSource}=await import('@/lib/brands/knowledge');if(source.source_tier>3||!source.base_url||!matchesApprovedSource(source.base_url,source.base_url))throw new Error('INVALID_SOURCE_APPROVAL');}
 const {data,error:updateError}=await supabase.from('brand_sources').update({is_approved:approved}).eq('brand_id',brandId).eq('id',sourceId).select('id').maybeSingle();if(updateError||!data)throw new BrandDataError('NOT_FOUND');
}
export async function setTrainingRuleActive(brandId:string,ruleId:string,active:boolean){
 const {supabase}=await requireUser();const {data,error}=await supabase.from('brand_rules').update({is_active:active}).eq('brand_id',brandId).eq('id',ruleId).select('id').maybeSingle();if(error||!data)throw new BrandDataError('NOT_FOUND');
}
