'use server';
import {z} from 'zod';
import {revalidatePath} from 'next/cache';
import {configureDraftAgent} from '@/data/draft-agent';
import {workerHash} from '@/lib/agent/worker-auth.cjs';
import {hasAiEnvironment} from '@/lib/ai/config';
export interface AutomaticState {error?:string;success?:string}
export async function saveAutomaticAgent(brandId:string,_state:AutomaticState,form:FormData):Promise<AutomaticState>{const parsed=z.object({brandId:z.uuid(),enabled:z.enum(['true','false']),drafts:z.coerce.number().int().min(1).max(3)}).safeParse({brandId,enabled:form.get('enabled'),drafts:form.get('drafts')});if(!parsed.success)return {error:'Choose a valid drafting pace.'};const hash=workerHash(process.env);if(!hash||!hasAiEnvironment())return {error:'The background agent needs its server configuration before starting.'};try{await configureDraftAgent(brandId,parsed.data.enabled==='true',parsed.data.drafts,hash);}catch{return {error:'Settings could not be saved. Confirm you own this brand and refresh.'};}revalidatePath('/agent');return {success:parsed.data.enabled==='true'?'Automatic drafting is on. The agent checks for work every minute, even when you close this page.':'Automatic drafting is paused.'};}
