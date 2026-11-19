import {z} from 'zod';
import type {MetaEnvironment} from './config';
export class FacebookDeliveryError extends Error {constructor(public readonly code:'REJECTED'|'UNKNOWN'){super(code);}}
export function validateFacebookSchedule(value:string|undefined,now=Date.now()){if(!value)return null;const time=Date.parse(value);if(!Number.isFinite(time)||time<now+600000||time>now+75*86400000)throw Error('Choose a time between 10 minutes and 75 days ahead.');return new Date(time).toISOString();}
export async function sendFacebookText(input:{pageId:string;token:string;body:string;scheduledFor:string|null},env:MetaEnvironment,request:typeof fetch=fetch){
 if(!input.pageId||!input.token||!input.body.trim()||input.body.length>50000)throw new FacebookDeliveryError('REJECTED');
 if(input.scheduledFor)validateFacebookSchedule(input.scheduledFor);
 const body=new URLSearchParams({message:input.body,published:input.scheduledFor?'false':'true'});if(input.scheduledFor)body.set('scheduled_publish_time',String(Math.floor(Date.parse(input.scheduledFor)/1000)));
 let response:Response;try{response=await request(`https://graph.facebook.com/${env.META_GRAPH_API_VERSION}/${encodeURIComponent(input.pageId)}/feed`,{method:'POST',headers:{authorization:'Bearer '+input.token,'content-type':'application/x-www-form-urlencoded'},body,cache:'no-store',redirect:'error',signal:AbortSignal.timeout(30000)});}catch{throw new FacebookDeliveryError('UNKNOWN');}
 let data:unknown;try{data=await response.json();}catch{throw new FacebookDeliveryError('UNKNOWN');}
 if(!response.ok){const explicitRejection=response.status>=400&&response.status<500&&typeof data==='object'&&data!==null&&'error' in data;throw new FacebookDeliveryError(explicitRejection?'REJECTED':'UNKNOWN');}
 const parsed=z.object({id:z.string().regex(/^[0-9]+(?:_[0-9]+)?$/).max(200)}).safeParse(data);if(!parsed.success)throw new FacebookDeliveryError('UNKNOWN');return parsed.data.id;
}
