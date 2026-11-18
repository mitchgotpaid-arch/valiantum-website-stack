'use server';
import {revalidatePath} from 'next/cache';
import {z} from 'zod';
import {AuthenticationRequiredError} from '@/data/auth';
import {KnowledgeConflictError,promoteApprovedVoiceExample,saveTrainingFact,saveVoiceTraining} from '@/data/brand-knowledge';
import {BrandDataError} from '@/data/brands';
import {trainedFactSchema,voiceTrainingSchema} from '@/lib/brands/knowledge-schema';
export interface TrainingState {error?:string;success?:string;updatedAt?:string;fieldErrors?:Record<string,string[]>}
function failure(error:unknown):TrainingState{if(error instanceof AuthenticationRequiredError)return {error:'Sign in again before saving.'};if(error instanceof KnowledgeConflictError)return {error:error.message};if(error instanceof BrandDataError&&error.code==='DUPLICATE_KEY')return {error:'A fact with that key already exists. Edit the existing fact instead.'};if(error instanceof Error&&error.message==='EXAMPLES_FULL')return {error:'Your voice examples are full. Edit them in Brand Knowledge before adding another.'};return {error:'The change could not be saved. Reload and check your brand access.'};}
function refresh(brandId:string){revalidatePath(`/brands/${brandId}/knowledge`);revalidatePath('/knowledge');revalidatePath('/agent');revalidatePath('/settings');}
export async function saveVoiceAction(brandId:string,_state:TrainingState,form:FormData):Promise<TrainingState>{
 if(!z.uuid().safeParse(brandId).success)return {error:'Invalid brand.'};const parsed=voiceTrainingSchema.safeParse(Object.fromEntries(form));if(!parsed.success)return {updatedAt:_state.updatedAt,fieldErrors:parsed.error.flatten().fieldErrors};
 try{const updatedAt=await saveVoiceTraining(brandId,parsed.data);refresh(brandId);return {updatedAt,success:'Brand voice saved. New drafts will use this guidance.'};}catch(error){return {updatedAt:_state.updatedAt,...failure(error)};}
}
export async function saveFactAction(brandId:string,factId:string|null,_state:TrainingState,form:FormData):Promise<TrainingState>{
 if(!z.uuid().safeParse(brandId).success||(factId&&!z.uuid().safeParse(factId).success))return {error:'Invalid brand or fact.'};
 const parsed=trainedFactSchema.safeParse({...Object.fromEntries(form),ownerReviewed:form.get('ownerReviewed')==='on'});if(!parsed.success)return {updatedAt:_state.updatedAt,fieldErrors:parsed.error.flatten().fieldErrors};
 try{const updatedAt=await saveTrainingFact(brandId,factId,parsed.data);refresh(brandId);return {updatedAt,success:factId?'Fact updated. Verified facts are checked for source approval and freshness before use.':'Fact saved. Only fresh, verified facts with approved sources are supplied to the agents.'};}catch(error){return {updatedAt:_state.updatedAt,...failure(error)};}
}
export async function useVoiceExampleAction(contentId:string,_state:TrainingState):Promise<TrainingState>{if(!z.uuid().safeParse(contentId).success)return {error:'Invalid content.'};try{const brandId=await promoteApprovedVoiceExample(contentId);refresh(brandId);revalidatePath(`/content/${contentId}`);return {success:'Added as a voice example. Its factual claims are not automatically approved for reuse.'};}catch(error){return {updatedAt:_state.updatedAt,...failure(error)};}}
export async function setKnowledgeItemAction(brandId:string,itemId:string,kind:'source'|'rule',enabled:boolean,_state:TrainingState):Promise<TrainingState>{
 if(!z.uuid().safeParse(brandId).success||!z.uuid().safeParse(itemId).success||!['source','rule'].includes(kind)||typeof enabled!=='boolean')return {error:'Invalid change.'};
 try{const {setTrainingSourceApproval,setTrainingRuleActive}=await import('@/data/brand-knowledge');if(kind==='source')await setTrainingSourceApproval(brandId,itemId,enabled);else await setTrainingRuleActive(brandId,itemId,enabled);refresh(brandId);return {success:'Knowledge updated. New drafts will use the current active sources and rules.'};}catch(error){return error instanceof Error&&error.message==='INVALID_SOURCE_APPROVAL'?{error:'Approve an HTTPS source in tiers 1–3. Edit the source in your source library first.'}:failure(error);}
}
