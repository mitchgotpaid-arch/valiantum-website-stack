// Run after a production build with the same public Supabase configuration.
// Uses only synthetic Projects credentials and an in-memory store; no paid calls.
const assert=require('node:assert/strict');const {scryptSync}=require('node:crypto');
process.env.NODE_ENV='production';
// This synthetic smoke test exercises Next missing-session handling; the shared
// account provider is covered separately with isolated provider fixtures.
process.env.PROJECTS_SUPABASE_OWNER_ID='';
const {createApp}=require('../app');
const timedFetch=(url,options={})=>fetch(url,{...options,signal:AbortSignal.timeout(15000)});
(async()=>{
 if(!process.env.NEXT_PUBLIC_SUPABASE_URL||!process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)throw Error('Public Supabase configuration is required for this smoke test.');
 const origin=process.env.APP_ORIGIN||'https://projects.valiantum.com';const salt='d'.repeat(32),password='local-runtime-test-only-password';
 const env={...process.env,APP_ORIGIN:origin,PROJECTS_EMAIL:'runtime@example.test',PROJECTS_PASSWORD_HASH:salt+':'+scryptSync(password,salt,64).toString('hex')};
 const service=await createApp(env,{store:{read:async()=>({projects:[],revision:0}),close:async()=>{}}});
 const server=service.app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const base='http://127.0.0.1:'+server.address().port;env.PORT=String(server.address().port);
 try{
  const login=await timedFetch(base+'/api/login',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({email:env.PROJECTS_EMAIL,password})});assert.equal(login.status,200);
  const cookie=login.headers.get('set-cookie').split(';')[0];
  for(const path of ['/marketing','/marketing/brands','/marketing/content','/marketing/projects','/marketing/agent','/marketing/settings','/marketing/knowledge','/marketing/brands/11111111-1111-4111-8111-111111111111/knowledge']){
   console.log('Checking '+path);const response=await timedFetch(base+path,{headers:{cookie},redirect:'manual'});assert.ok([303,307].includes(response.status),path+' must redirect, got '+response.status);
   const target=new URL(response.headers.get('location'),origin);assert.equal(target.pathname,'/marketing/login');assert.equal(target.origin,origin);await response.body?.cancel();
  }
  const loginPage=await timedFetch(base+'/marketing/login',{headers:{cookie},redirect:'manual'});assert.equal(loginPage.status,200);const html=await loginPage.text();
  const policy=loginPage.headers.get('content-security-policy');assert.doesNotMatch(policy,/unsafe-eval/);const nonce=policy.match(/'nonce-([^']+)'/)[1];
  const scripts=html.match(/<script\b[^>]*>/g)||[];assert.ok(scripts.length);for(const script of scripts)assert.ok(script.includes('nonce="'+nonce+'"'),'Every bootstrap script must carry the response nonce');
  for(const path of ['/marketing/api/projects/brands','/marketing/api/projects/briefs']){
   const response=await timedFetch(base+path,{headers:{cookie},redirect:'manual'});assert.equal(response.status,401);assert.equal((await response.json()).loginUrl,'/marketing/login');
  }
  console.log('PASS: configured Marketing runtime redirects missing sessions, returns API 401s, uses canonical URLs and nonces every bootstrap script.');
 }finally{await new Promise(resolve=>server.close(resolve));await service.close();}
})().then(()=>process.exit(0)).catch(error=>{console.error(error.name+': '+error.message);process.exit(1);});
