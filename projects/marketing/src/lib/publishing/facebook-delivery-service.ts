import 'server-only';
import {z} from 'zod';
import {claimFacebookDelivery,completeFacebookDelivery} from '@/data/facebook-deliveries';
import {getMetaEnvironment} from './config';
import {decryptProviderCredential} from './credential-crypto';
import {FacebookDeliveryError,sendFacebookText} from './facebook-live';
const credentialSchema=z.object({pageAccessToken:z.string().min(1),facebookPageId:z.string().min(1)});
export async function executeFacebookDelivery(input:{contentId:string;updatedAt:string;pageId:string;reviewed:boolean;scheduledFor:string|null}){
 const claim=await claimFacebookDelivery(input.contentId,input.updatedAt,input.pageId,input.reviewed,input.scheduledFor);
 if(!claim.shouldExecute)return claim.delivery;
 let env:ReturnType<typeof getMetaEnvironment>;let credential:z.infer<typeof credentialSchema>;
 try{env=getMetaEnvironment();credential=credentialSchema.parse(decryptProviderCredential(claim.encryptedCredential||'',env.META_APP_SECRET,`brand:${claim.delivery.brand_id}:provider:META`));if(credential.facebookPageId!==claim.delivery.page_id)throw Error();}catch{await completeFacebookDelivery(claim.delivery.id,'REJECTED',null,'CREDENTIAL_INVALID');throw Error('The Meta credential could not be used. Reconnect the Facebook Page before trying again.');}
 let postId:string;
 try{postId=await sendFacebookText({pageId:claim.delivery.page_id,token:credential.pageAccessToken,body:claim.delivery.body_snapshot,scheduledFor:claim.delivery.scheduled_for},env);}catch(error){const status=error instanceof FacebookDeliveryError?error.code:'UNKNOWN';await completeFacebookDelivery(claim.delivery.id,status,null,status==='REJECTED'?'PROVIDER_REJECTED':'OUTCOME_UNKNOWN');throw Error(status==='REJECTED'?'Meta rejected this post. Check the Page permissions and reconnect if needed.':'Facebook may have accepted the post. Check the Page or Facebook’s scheduled posts before taking further action. No automatic retry was sent.');}
 try{await completeFacebookDelivery(claim.delivery.id,'SENT',postId,null);}catch{throw Error('Facebook accepted the post, but the receipt could not be saved. Do not resend it; check Facebook first.');}
 return {...claim.delivery,status:'SENT' as const,external_post_id:postId};
}
