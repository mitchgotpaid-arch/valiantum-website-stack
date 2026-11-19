import 'server-only';
import {requireUser} from '@/data/auth';
import {canAdminPublishingBrand} from '@/data/publishing';
import {getMetaEnvironment} from '@/lib/publishing/config';
import {saveMetaConnection} from '@/data/publishing';
import {getSocialConnection,saveSocialConnection,readSocialToken,markSocialAttention} from '@/data/social-connections';
import {decryptProviderCredential,encryptProviderCredential} from '@/lib/publishing/credential-crypto';
import {claimPendingConnection,deletePendingConnection,releasePendingConnection} from './pending';
import {connectionSecret,refreshSocialToken,discoverSocialAccounts,checkBluesky,SocialError,type SocialToken} from './oauth';
export async function finalizeSocialChoice(ticket:string,accountId:string){
 const {user}=await requireUser();const pending=claimPendingConnection(ticket,user.id);if(!pending)throw new SocialError('INVALID_STATE');
 try{if(!await canAdminPublishingBrand(pending.brandId))throw Error('Not permitted.');const account=pending.accounts.find(item=>item.id===accountId);if(!account)throw new SocialError('INVALID_STATE');
 if(pending.provider==='META'){
  const page=pending.accounts.find(item=>item.id===accountId)!;const env=getMetaEnvironment();
  await saveMetaConnection({brandId:pending.brandId,facebookPageId:page.id,facebookPageName:page.name,instagramAccountId:page.instagram_business_account?.id||null,instagramAccountName:page.instagram_business_account?.username||null,expiresAt:pending.token.expires_in?new Date(Date.now()+pending.token.expires_in*1000).toISOString():null,encryptedCredential:encryptProviderCredential({systemAccessToken:pending.token.access_token,pageAccessToken:page.access_token||pending.token.access_token,facebookPageId:page.id,instagramAccountId:page.instagram_business_account?.id||null},env.META_APP_SECRET,`brand:${pending.brandId}:provider:META`)});
 }else{
  const encrypted=encryptProviderCredential(pending.token,connectionSecret(process.env),`brand:${pending.brandId}:provider:${pending.provider}`);
  await saveSocialConnection({brandId:pending.brandId,provider:pending.provider,accountId:account.id,accountName:account.name,encryptedCredential:encrypted,scopes:pending.token.scopes,expiresAt:pending.token.expiresAt});
 }
 deletePendingConnection(ticket);return {brandId:pending.brandId,provider:pending.provider};
 }catch(error){releasePendingConnection(ticket);throw error;}
}
const globalLocks=globalThis as typeof globalThis&{__valiantumSocialChecks?:Map<string,Promise<void>>};const locks=globalLocks.__valiantumSocialChecks??=new Map<string,Promise<void>>();
export async function validateSocialConnection(id:string){
 const existing=locks.get(id);if(existing)return existing;
 const pending=(async()=>{let connection=await getSocialConnection(id);if(!connection||!await canAdminPublishingBrand(connection.brand_id))throw Error('Not permitted.');
 try{const root=connectionSecret(process.env),context=`brand:${connection.brand_id}:provider:${connection.provider}`;let token=decryptProviderCredential<SocialToken>(await readSocialToken(id),root,context);
 if(token.expiresAt&&Date.parse(token.expiresAt)<Date.now()+120000){token=await refreshSocialToken(connection.provider,token,process.env);await saveSocialConnection({brandId:connection.brand_id,provider:connection.provider,accountId:connection.external_account_id,accountName:connection.external_account_name,encryptedCredential:encryptProviderCredential(token,root,context),scopes:token.scopes,expiresAt:token.expiresAt,expectedUpdatedAt:connection.updated_at});connection=(await getSocialConnection(id))!;}
 const accounts=connection.provider==='BLUESKY'?await checkBluesky(token):await discoverSocialAccounts(connection.provider,token,process.env);const account=accounts.find(item=>item.id===connection!.external_account_id);if(!account)throw new SocialError('RECONNECT_REQUIRED');
 await saveSocialConnection({brandId:connection.brand_id,provider:connection.provider,accountId:account.id,accountName:account.name,encryptedCredential:encryptProviderCredential(token,root,context),scopes:token.scopes,expiresAt:token.expiresAt,expectedUpdatedAt:connection.updated_at});
 }catch(error){if(!(error instanceof SocialError&&error.code==='PROVIDER_UNAVAILABLE'))await markSocialAttention(id,connection.updated_at);throw error;}
 })();locks.set(id,pending);try{await pending;}finally{locks.delete(id);}
}
