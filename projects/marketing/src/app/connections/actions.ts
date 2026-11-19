'use server';
import {z} from 'zod';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {requireUser} from '@/data/auth';
import {canAdminPublishingBrand} from '@/data/publishing';
import {disconnectSocialConnection,getSocialConnection,SocialDataError} from '@/data/social-connections';
import {finalizeSocialChoice,validateSocialConnection} from '@/lib/social/service';
import {connectBluesky,SocialError} from '@/lib/social/oauth';
import {createPendingConnection} from '@/lib/social/pending';
export interface ConnectionState {error?:string;success?:string}
function publicError(error:unknown){if(error instanceof SocialDataError){if(error.code==='SETUP_REQUIRED')return 'The connection database update must be applied before linking accounts.';if(error.code==='CONFLICT')return 'This account is already linked elsewhere, or the connection changed. Refresh and check the brand mapping.';}if(error instanceof SocialError){if(error.code==='PROVIDER_UNAVAILABLE')return 'The provider is temporarily unavailable or rate-limited. Wait and check again; this does not require a new subscription.';if(error.code==='SCOPE_REQUIRED')return 'The provider did not grant all requested permissions. Reconnect and review the consent screen.';if(error.code==='INVALID_STATE')return 'This connection request expired or was already used. Start Connect again.';}return 'The provider connection could not be completed. Check the account, app permissions and setup instructions, then reconnect.';}
export async function selectAccountAction(ticket:string,_state:ConnectionState,form:FormData):Promise<ConnectionState>{
 const accountId=form.get('accountId');if(!/^[A-Za-z0-9_-]{43}$/.test(ticket)||typeof accountId!=='string'||!accountId||accountId.length>512)return {error:'Select an account.'};
 let result:{brandId:string;provider:string};try{result=await finalizeSocialChoice(ticket,accountId);}catch(error){return {error:publicError(error)};}revalidatePath('/connections');revalidatePath('/settings');redirect(`/connections?brand=${result.brandId}&outcome=connected&platform=${result.provider}`);
}
export async function connectBlueskyAction(brandId:string,_state:ConnectionState,form:FormData):Promise<ConnectionState>{
 if(!z.uuid().safeParse(brandId).success)return {error:'Invalid brand.'};const parsed=z.object({identifier:z.string().trim().min(3).max(250),appPassword:z.string().min(8).max(200)}).safeParse(Object.fromEntries(form));if(!parsed.success)return {error:'Enter your Bluesky handle and a dedicated app password.'};let ticket:string;
 try{const {user}=await requireUser();if(!await canAdminPublishingBrand(brandId))return {error:'Only a brand administrator can connect accounts.'};const result=await connectBluesky(parsed.data.identifier,parsed.data.appPassword);ticket=createPendingConnection({userId:user.id,brandId,provider:'BLUESKY',...result});}catch(error){return {error:publicError(error)};}redirect('/connections/select?ticket='+ticket);
}
export async function disconnectConnectionAction(id:string,_state:ConnectionState):Promise<ConnectionState>{if(!z.uuid().safeParse(id).success)return {error:'Invalid connection.'};try{const connection=await getSocialConnection(id);if(!connection||!await canAdminPublishingBrand(connection.brand_id))return {error:'Not permitted.'};await disconnectSocialConnection(id);revalidatePath('/connections');return {success:'Disconnected from Valiantum. To revoke the grant at the provider too, remove Valiantum in that platform’s app settings.'};}catch(error){return {error:publicError(error)};}}
export async function checkConnectionAction(id:string,_state:ConnectionState):Promise<ConnectionState>{if(!z.uuid().safeParse(id).success)return {error:'Invalid connection.'};try{await validateSocialConnection(id);revalidatePath('/connections');return {success:'The provider confirmed this account connection.'};}catch(error){revalidatePath('/connections');return {error:publicError(error)};}}
