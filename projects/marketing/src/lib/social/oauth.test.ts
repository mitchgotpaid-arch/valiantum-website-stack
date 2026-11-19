import {afterEach,describe,expect,it,vi} from 'vitest';
import {catalog,type OAuthProvider} from './catalog';
import {createSocialAuthorization,verifySocialState,exchangeSocialCode,discoverSocialAccounts,refreshSocialToken,connectBluesky,providerJson} from './oauth';
import {createPendingConnection,getPendingConnection,claimPendingConnection,releasePendingConnection,deletePendingConnection} from './pending';
const brand='44444444-4444-4444-8444-444444444444',user='11111111-1111-4111-8111-111111111111';
const env:Record<string,string>={SOCIAL_CONNECTION_SECRET:'test-only-encryption-secret-at-least-32',NEXT_PUBLIC_APP_URL:'https://projects.valiantum.com',MASTODON_BASE_URL:'https://mastodon.social'};
for(const item of catalog)for(const key of item.credentials)if(!env[key])env[key]='test-'+key;
function reply(data:unknown){return vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify(data),{status:200}));}
afterEach(()=>vi.useRealTimers());
describe('direct OAuth boundaries',()=>{
 it('binds encrypted state to owner, provider, nonce and expiry',()=>{
  const flow=createSocialAuthorization('X',brand,user,env);expect(verifySocialState(flow.cookie,flow.state.state,'X',user,env).brandId).toBe(brand);
  for(const [cookie,nonce,provider,owner] of [[flow.cookie,'wrong','X',user],[flow.cookie,flow.state.state,'PINTEREST',user],[flow.cookie,flow.state.state,'X',brand],['tampered',flow.state.state,'X',user]] as const)expect(()=>verifySocialState(cookie,nonce,provider,owner,env)).toThrow('INVALID_STATE');
  vi.useFakeTimers();vi.setSystemTime(Date.now()+600001);expect(()=>verifySocialState(flow.cookie,flow.state.state,'X',user,env)).toThrow('INVALID_STATE');
 });
 it('uses S256 and exact HTTPS callbacks, with TikTok upload-only permission',()=>{
  for(const provider of ['X','YOUTUBE','MASTODON'] as const){const url=new URL(createSocialAuthorization(provider,brand,user,env).url);expect(url.searchParams.get('code_challenge_method')).toBe('S256');expect(url.searchParams.get('redirect_uri')).toBe(`https://projects.valiantum.com/marketing/api/social/${provider.toLowerCase()}/callback`);expect(url.href).not.toContain('SECRET');}
  const url=new URL(createSocialAuthorization('TIKTOK',brand,user,env).url);expect(url.searchParams.get('scope')).toBe('user.info.basic,video.upload');expect(url.searchParams.has('client_key')).toBe(true);
  expect(()=>createSocialAuthorization('X',brand,user,{...env,NEXT_PUBLIC_APP_URL:'http://localhost'})).toThrow();
 });
 it('exchanges codes server-side and preserves rotated refresh credentials',async()=>{
  const flow=createSocialAuthorization('X',brand,user,env),fetcher=reply({access_token:'private-access',refresh_token:'refresh-one',expires_in:7200,scope:'tweet.read tweet.write users.read offline.access'});
  const token=await exchangeSocialCode('X','one-use-code',flow.state,env,fetcher);const [,request]=fetcher.mock.calls[0];expect(request?.redirect).toBe('error');expect(String(request?.body)).toContain('code_verifier=');expect((request?.headers as Record<string,string>).authorization).toMatch(/^Basic /);
  const refreshed=await refreshSocialToken('X',token,env,reply({access_token:'new-private',refresh_token:'refresh-two',expires_in:7200}));expect(refreshed.refreshToken).toBe('refresh-two');expect(refreshed.scopes).toEqual(token.scopes);
  await expect(exchangeSocialCode('X','code',flow.state,env,reply({access_token:'x',scope:'tweet.read'}))).rejects.toThrow('SCOPE_REQUIRED');
 });
 it.each([
  ['X',{data:{id:'x1',name:'Brand',username:'brand'}},'x1'],['TIKTOK',{data:{user:{open_id:'t1',display_name:'Brand'}},error:{code:'ok'}},'t1'],['PINTEREST',{username:'pins'},'pins'],['LINKEDIN',{sub:'l1',name:'Brand'},'l1'],['YOUTUBE',{items:[{id:'y1',snippet:{title:'Brand'}}]},'y1'],['THREADS',{id:'th1',username:'brand'},'th1'],['REDDIT',{id:'r1',name:'brand'},'r1'],['MASTODON',{id:'m1',display_name:'Brand',acct:'brand'},'m1'],
 ] as const)('verifies %s identity using the provider response',async(provider,data,id)=>{const accounts=await discoverSocialAccounts(provider as OAuthProvider,{accessToken:'secret',expiresAt:null,scopes:[],serverOrigin:'https://mastodon.social'},env,reply(data));expect(accounts[0].id).toBe(id);});
 it('does not send Mastodon tokens to a changed server',async()=>{const fetcher=reply({});await expect(discoverSocialAccounts('MASTODON',{accessToken:'secret',expiresAt:null,scopes:[],serverOrigin:'https://old.example'},env,fetcher)).rejects.toThrow('RECONNECT_REQUIRED');expect(fetcher).not.toHaveBeenCalled();});
 it('separates temporary provider failures from revoked credentials',async()=>{
  await expect(providerJson('https://example.com',{},vi.fn<typeof fetch>().mockRejectedValue(Error('network secret')))).rejects.toThrow('PROVIDER_UNAVAILABLE');
  await expect(providerJson('https://example.com',{},vi.fn<typeof fetch>().mockResolvedValue(new Response('',{status:429})))).rejects.toThrow('PROVIDER_UNAVAILABLE');
  await expect(providerJson('https://example.com',{},vi.fn<typeof fetch>().mockResolvedValue(new Response('',{status:401})))).rejects.toThrow('RECONNECT_REQUIRED');
 });
 it('keeps the Bluesky app password out of stored session data',async()=>{const result=await connectBluesky('brand.bsky.social','private-app-password',reply({accessJwt:'access',refreshJwt:'refresh',did:'did:plc:brand',handle:'brand.bsky.social'}));expect(JSON.stringify(result)).not.toContain('private-app-password');expect(result.accounts[0].id).toBe('did:plc:brand');});
 it('keeps account selection owner-bound, expiring and single-claim',()=>{
  const ticket=createPendingConnection({userId:user,brandId:brand,provider:'X',token:{accessToken:'secret',expiresAt:null,scopes:[]},accounts:[{id:'account',name:'Brand'}]});expect(getPendingConnection(ticket,brand)).toBeNull();expect(claimPendingConnection(ticket,user)).not.toBeNull();expect(claimPendingConnection(ticket,user)).toBeNull();releasePendingConnection(ticket);expect(claimPendingConnection(ticket,user)).not.toBeNull();deletePendingConnection(ticket);expect(getPendingConnection(ticket,user)).toBeNull();
  const expiring=createPendingConnection({userId:user,brandId:brand,provider:'BLUESKY',token:{accessToken:'secret',expiresAt:null,scopes:[]},accounts:[]});vi.useFakeTimers();vi.setSystemTime(Date.now()+600001);expect(getPendingConnection(expiring,user)).toBeNull();
 });
});
