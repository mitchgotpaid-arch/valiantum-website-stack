'use server';
import {z} from 'zod';
import {revalidatePath} from 'next/cache';
import {executeFacebookDelivery} from '@/lib/publishing/facebook-delivery-service';
import {validateFacebookSchedule} from '@/lib/publishing/facebook-live';
import {FacebookDataError} from '@/data/facebook-deliveries';
export interface FacebookActionState{error?:string;success?:string}
export async function publishFacebookAction(contentId:string,updatedAt:string,pageId:string,_state:FacebookActionState,form:FormData):Promise<FacebookActionState>{
 if(!z.uuid().safeParse(contentId).success||form.get('reviewed')!=='on')return {error:'Review the exact copy and confirm approval before publishing.'};const mode=form.get('mode');if(!['NOW','SCHEDULED'].includes(String(mode)))return {error:'Choose publish now or schedule.'};let scheduledFor:string|null=null;
 try{scheduledFor=mode==='SCHEDULED'?validateFacebookSchedule(String(form.get('scheduledFor')||'')):null;if(mode==='SCHEDULED'&&!scheduledFor)return {error:'Choose a date and time.'};}catch(error){return {error:error instanceof Error?error.message:'Choose a valid date and time.'};}
 try{const delivery=await executeFacebookDelivery({contentId,updatedAt,pageId,reviewed:true,scheduledFor});revalidatePath('/content');revalidatePath('/calendar');revalidatePath(`/content/${contentId}`);if(delivery.status==='SENT')return {success:delivery.mode==='SCHEDULED'?'Scheduled on Facebook. Facebook will publish it at the selected time.':'Published to your Facebook Page.'};return {error:'This post already has a delivery record. Review its status below before sending anything else.'};}
 catch(error){revalidatePath(`/content/${contentId}`);if(error instanceof FacebookDataError){if(error.code==='SETUP_REQUIRED')return {error:'The live-publishing database update is still being applied.'};if(error.code==='REVIEW_REQUIRED')return {error:'The copy or Page changed, the credential expired, or the draft needs editing. Refresh, remove verification markers, and confirm the current Page.'};return {error:'You must be a brand administrator to publish this post.'};}return {error:error instanceof Error?error.message:'The post could not be sent.'};}
}
