import {createHash,randomBytes,timingSafeEqual} from 'node:crypto';
import {z} from 'zod';
import {decryptProviderCredential,encryptProviderCredential} from '@/lib/publishing/credential-crypto';
import {catalog,callbackPath,type OAuthProvider,type SocialProvider,isOAuthProvider} from './catalog';
export interface SocialToken {accessToken:string;refreshToken?:string;expiresAt:string|null;scopes:string[];serverOrigin?:string}
export interface SocialAccount {id:string;name:string;username?:string}
export type SocialEnv=Record<string,string|undefined>;
export class SocialError extends Error {constructor(public readonly code:'SETUP_REQUIRED'|'INVALID_STATE'|'TOKEN_FAILED'|'IDENTITY_FAILED'|'SCOPE_REQUIRED'|'NO_ACCOUNT'|'RECONNECT_REQUIRED'|'PROVIDER_UNAVAILABLE'){super(code);this.name='SocialError';}}
export function socialOrigin(env:SocialEnv){const url=new URL(env.NEXT_PUBLIC_APP_URL||env.APP_ORIGIN||'https://projects.valiantum.com');if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new SocialError('SETUP_REQUIRED');return url.origin;}
export function connectionSecret(env:SocialEnv){const secret=env.SOCIAL_CONNECTION_SECRET||env.META_APP_SECRET;if(!secret||secret.length<20)throw new SocialError('SETUP_REQUIRED');return secret;}
export function missingProviderSettings(provider:SocialProvider,env:SocialEnv){const info=catalog.find(item=>item.id===provider)!;const missing=info.credentials.filter(name=>!env[name]?.trim());try{connectionSecret(env);socialOrigin(env);}catch{missing.push('SOCIAL_CONNECTION_SECRET or existing Meta encryption configuration');}return missing;}
function mastodonOrigin(env:SocialEnv){const url=new URL(env.MASTODON_BASE_URL||'https://mastodon.social');if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash||url.port||url.hostname==='localhost'||/^[\d.:]+$/.test(url.hostname)||/\.(?:local|internal|localhost)$/.test(url.hostname))throw new SocialError('SETUP_REQUIRED');return url.origin;}
function endpoints(provider:OAuthProvider,env:SocialEnv){const mastodon=provider==='MASTODON'?mastodonOrigin(env):'';return {
X:['https://x.com/i/oauth2/authorize','https://api.x.com/2/oauth2/token','https://api.x.com/2/users/me?user.fields=username'],
TIKTOK:['https://www.tiktok.com/v2/auth/authorize/','https://open.tiktokapis.com/v2/oauth/token/','https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name'],
PINTEREST:['https://www.pinterest.com/oauth/','https://api.pinterest.com/v5/oauth/token','https://api.pinterest.com/v5/user_account'],
LINKEDIN:['https://www.linkedin.com/oauth/v2/authorization','https://www.linkedin.com/oauth/v2/accessToken','https://api.linkedin.com/v2/userinfo'],
YOUTUBE:['https://accounts.google.com/o/oauth2/v2/auth','https://oauth2.googleapis.com/token','https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true&maxResults=50'],
THREADS:['https://threads.com/oauth/authorize','https://graph.threads.com/oauth/access_token','https://graph.threads.com/v1.0/me?fields=id,username'],
REDDIT:['https://www.reddit.com/api/v1/authorize','https://www.reddit.com/api/v1/access_token','https://oauth.reddit.com/api/v1/me'],
MASTODON:[mastodon+'/oauth/authorize',mastodon+'/oauth/token',mastodon+'/api/v1/accounts/verify_credentials'],
}[provider];}
function credentials(provider:OAuthProvider,env:SocialEnv){const names=catalog.find(item=>item.id===provider)!.credentials;const clientId=env[names[0]],clientSecret=env[names[1]];if(!clientId||!clientSecret)throw new SocialError('SETUP_REQUIRED');return {clientId,clientSecret};}
export const oauthStateSchema=z.object({provider:z.string(),brandId:z.uuid(),userId:z.uuid(),state:z.string().min(40).max(100),verifier:z.string().min(40).max(100),issuedAt:z.number().int().positive()});
export type OAuthState=z.infer<typeof oauthStateSchema>;
export function createSocialAuthorization(provider:OAuthProvider,brandId:string,userId:string,env:SocialEnv){
 if(missingProviderSettings(provider,env).length)throw new SocialError('SETUP_REQUIRED');
 const {clientId}=credentials(provider,env),state:OAuthState={provider,brandId,userId,state:randomBytes(32).toString('base64url'),verifier:randomBytes(32).toString('base64url'),issuedAt:Date.now()};
 const url=new URL(endpoints(provider,env)[0]),scopes=catalog.find(item=>item.id===provider)!.scopes;
 url.searchParams.set(provider==='TIKTOK'?'client_key':'client_id',clientId);url.searchParams.set('redirect_uri',socialOrigin(env)+callbackPath(provider));url.searchParams.set('response_type','code');url.searchParams.set('state',state.state);
 url.searchParams.set('scope',scopes.join(['TIKTOK','PINTEREST','THREADS'].includes(provider)?',':' '));
 if(['X','YOUTUBE','MASTODON'].includes(provider)){url.searchParams.set('code_challenge',createHash('sha256').update(state.verifier).digest('base64url'));url.searchParams.set('code_challenge_method','S256');}
 if(provider==='YOUTUBE'){url.searchParams.set('access_type','offline');url.searchParams.set('prompt','consent');}
 if(provider==='REDDIT')url.searchParams.set('duration','permanent');
 return {url:url.href,state,cookie:encryptProviderCredential(state,connectionSecret(env),'social-oauth:'+provider)};
}
export function verifySocialState(cookie:string|undefined,received:string|null,provider:OAuthProvider,userId:string,env:SocialEnv){
 try{const state=oauthStateSchema.parse(decryptProviderCredential(cookie||'',connectionSecret(env),'social-oauth:'+provider));const actual=Buffer.from(received||''),expected=Buffer.from(state.state);if(state.provider!==provider||state.userId!==userId||Date.now()-state.issuedAt>600000||state.issuedAt>Date.now()+5000||actual.length!==expected.length||!timingSafeEqual(actual,expected))throw Error();return state;}catch{throw new SocialError('INVALID_STATE');}
}
export async function providerJson(url:string,init:RequestInit={},fetcher:typeof fetch=fetch){
 let response:Response;try{response=await fetcher(url,{...init,redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000)});}catch{throw new SocialError('PROVIDER_UNAVAILABLE');}if(response.status===429||response.status>=500)throw new SocialError('PROVIDER_UNAVAILABLE');if(!response.ok)throw new SocialError(response.status===401||response.status===403?'RECONNECT_REQUIRED':'IDENTITY_FAILED');const text=await response.text();if(text.length>1000000)throw new SocialError('IDENTITY_FAILED');try{return JSON.parse(text) as Record<string,unknown>;}catch{throw new SocialError('IDENTITY_FAILED');}
}
function tokenFromJson(provider:OAuthProvider,data:Record<string,unknown>,fallback?:SocialToken):SocialToken{
 const result=(provider==='TIKTOK'&&data.data&&typeof data.data==='object'?data.data:data) as Record<string,unknown>;
 if(typeof result.access_token!=='string'||!result.access_token||result.error)throw new SocialError('TOKEN_FAILED');
 const scopes=typeof result.scope==='string'?result.scope.split(/[ ,]+/).filter(Boolean):fallback?.scopes||[];
 const required=catalog.find(item=>item.id===provider)!.scopes;if(typeof result.scope==='string'&&required.some(scope=>!scopes.includes(scope)))throw new SocialError('SCOPE_REQUIRED');
 const lifetime=typeof result.expires_in==='number'?result.expires_in:provider==='THREADS'?3600:null;
 return {accessToken:result.access_token,refreshToken:typeof result.refresh_token==='string'?result.refresh_token:fallback?.refreshToken,expiresAt:lifetime!==null?new Date(Date.now()+lifetime*1000).toISOString():null,scopes};
}
export async function exchangeSocialCode(provider:OAuthProvider,code:string,state:OAuthState,env:SocialEnv,fetcher:typeof fetch=fetch){
 const {clientId,clientSecret}=credentials(provider,env),body=new URLSearchParams({grant_type:'authorization_code',code,redirect_uri:socialOrigin(env)+callbackPath(provider)}),headers:Record<string,string>={'content-type':'application/x-www-form-urlencoded'};
 if(['X','PINTEREST','REDDIT'].includes(provider))headers.authorization='Basic '+Buffer.from(clientId+':'+clientSecret).toString('base64');else {body.set(provider==='TIKTOK'?'client_key':'client_id',clientId);body.set('client_secret',clientSecret);}
 if(provider==='X')body.set('client_id',clientId);if(['X','YOUTUBE','MASTODON'].includes(provider))body.set('code_verifier',state.verifier);if(provider==='REDDIT')headers['user-agent']=env.REDDIT_USER_AGENT||'ValiantumProjects/1.0';
 let token=tokenFromJson(provider,await providerJson(endpoints(provider,env)[1],{method:'POST',headers,body},fetcher));
 if(provider==='THREADS'){const url=new URL('https://graph.threads.com/access_token');url.search=new URLSearchParams({grant_type:'th_exchange_token',client_secret:clientSecret,access_token:token.accessToken}).toString();token=tokenFromJson(provider,await providerJson(url.href,{},fetcher),token);}
 return provider==='MASTODON'?{...token,serverOrigin:mastodonOrigin(env)}:token;
}
export async function discoverSocialAccounts(provider:OAuthProvider,token:SocialToken,env:SocialEnv,fetcher:typeof fetch=fetch):Promise<SocialAccount[]>{
 if(provider==='MASTODON'&&token.serverOrigin!==mastodonOrigin(env))throw new SocialError('RECONNECT_REQUIRED');
 const headers:Record<string,string>={authorization:'Bearer '+token.accessToken};if(provider==='REDDIT')headers['user-agent']=env.REDDIT_USER_AGENT||'ValiantumProjects/1.0';
 const data=await providerJson(endpoints(provider,env)[2],{headers},fetcher);const account=(id:unknown,name:unknown,username?:unknown)=>{if((typeof id!=='string'&&typeof id!=='number')||!String(id)||typeof name!=='string'||!name||String(id).length>512||name.length>512)throw new SocialError('IDENTITY_FAILED');return {id:String(id),name,username:typeof username==='string'?username:undefined};};
 if(provider==='X'){const user=data.data as Record<string,unknown>;if(!user)throw new SocialError('IDENTITY_FAILED');return [account(user.id,user.name||user.username,user.username)];}
 if(provider==='TIKTOK'){const error=data.error as Record<string,unknown>|undefined;if(error?.code&&error.code!=='ok')throw new SocialError('IDENTITY_FAILED');const user=(data.data as {user?:Record<string,unknown>})?.user;if(!user)throw new SocialError('IDENTITY_FAILED');return [account(user.open_id,user.display_name)];}
 if(provider==='PINTEREST')return [account(data.id||data.username,data.username)];
 if(provider==='LINKEDIN')return [account(data.sub,data.name)];
 if(provider==='YOUTUBE'){if(!Array.isArray(data.items)||!data.items.length)throw new SocialError('NO_ACCOUNT');return data.items.map((item:Record<string,unknown>)=>account(item.id,(item.snippet as Record<string,unknown>)?.title));}
 if(provider==='THREADS')return [account(data.id,data.username,data.username)];
 if(provider==='REDDIT')return [account(data.id,data.name,data.name)];
 return [account(data.id,data.display_name||data.username,data.acct)];
}
export async function refreshSocialToken(provider:SocialProvider,token:SocialToken,env:SocialEnv,fetcher:typeof fetch=fetch):Promise<SocialToken>{
 if(provider==='BLUESKY'){const data=await providerJson('https://bsky.social/xrpc/com.atproto.server.refreshSession',{method:'POST',headers:{authorization:'Bearer '+token.refreshToken}},fetcher);if(typeof data.accessJwt!=='string'||typeof data.refreshJwt!=='string')throw new SocialError('RECONNECT_REQUIRED');return {...token,accessToken:data.accessJwt,refreshToken:data.refreshJwt,expiresAt:new Date(Date.now()+90*60000).toISOString()};}
 if(provider==='THREADS'){const url=new URL('https://graph.threads.com/refresh_access_token');url.search=new URLSearchParams({grant_type:'th_refresh_token',access_token:token.accessToken}).toString();return tokenFromJson(provider,await providerJson(url.href,{},fetcher),token);}
 if(provider==='MASTODON'&&token.serverOrigin!==mastodonOrigin(env))throw new SocialError('RECONNECT_REQUIRED');
 if(!isOAuthProvider(provider)||!token.refreshToken)throw new SocialError('RECONNECT_REQUIRED');
 const {clientId,clientSecret}=credentials(provider,env),body=new URLSearchParams({grant_type:'refresh_token',refresh_token:token.refreshToken}),headers:Record<string,string>={'content-type':'application/x-www-form-urlencoded'};
 if(['X','PINTEREST','REDDIT'].includes(provider))headers.authorization='Basic '+Buffer.from(clientId+':'+clientSecret).toString('base64');else{body.set(provider==='TIKTOK'?'client_key':'client_id',clientId);body.set('client_secret',clientSecret);}
 if(provider==='X')body.set('client_id',clientId);if(provider==='REDDIT')headers['user-agent']=env.REDDIT_USER_AGENT||'ValiantumProjects/1.0';
 const refreshed=tokenFromJson(provider,await providerJson(endpoints(provider,env)[1],{method:'POST',headers,body},fetcher),token);return provider==='MASTODON'?{...refreshed,serverOrigin:token.serverOrigin}:refreshed;
}
export async function connectBluesky(identifier:string,password:string,fetcher:typeof fetch=fetch){
 const data=await providerJson('https://bsky.social/xrpc/com.atproto.server.createSession',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({identifier,password})},fetcher);
 if(typeof data.accessJwt!=='string'||typeof data.refreshJwt!=='string'||typeof data.did!=='string'||typeof data.handle!=='string')throw new SocialError('IDENTITY_FAILED');
 return {token:{accessToken:data.accessJwt,refreshToken:data.refreshJwt,expiresAt:new Date(Date.now()+90*60000).toISOString(),scopes:['app-password-session']},accounts:[{id:data.did,name:data.handle,username:data.handle}]};
}
export async function checkBluesky(token:SocialToken,fetcher:typeof fetch=fetch){const data=await providerJson('https://bsky.social/xrpc/com.atproto.server.getSession',{headers:{authorization:'Bearer '+token.accessToken}},fetcher);if(typeof data.did!=='string'||typeof data.handle!=='string')throw new SocialError('IDENTITY_FAILED');return [{id:data.did,name:data.handle,username:data.handle}];}
