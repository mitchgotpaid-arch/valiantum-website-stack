const {test}=require('node:test');const assert=require('node:assert/strict');const {createApp}=require('../app');const {createOwnerAuth}=require('../owner-auth.cjs');
const ownerId='965e186e-6d31-4a43-8031-ab6bb425ce51',email='owner@example.test',origin='https://projects.example.test';
test('one verified owner account opens both apps, signs out both and safely sets one password',async()=>{
 const calls={sent:0,updates:[]};const env={NODE_ENV:'production',APP_ORIGIN:origin,PROJECTS_EMAIL:email,PROJECTS_SUPABASE_OWNER_ID:ownerId,NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'public-test-key'};
 const factory=(_url,_key,{cookies})=>{
  let state=cookies.getAll().find(item=>item.name==='fake_session')?.value;
  const owner={id:ownerId,email},other={id:'11111111-1111-4111-8111-111111111111',email:'other@example.test'};
  const set=value=>{state=value;cookies.setAll([{name:'fake_session',value,options:{maxAge:value?3600:0}}]);};
  return {auth:{
   getUser:async()=>({data:{user:state==='owner'?owner:state==='other'?other:null},error:null}),
   signInWithPassword:async input=>{if(input.password!=='one-current-password')return {data:{user:null},error:{code:'invalid'}};const user=input.email===email?owner:other;set(user===owner?'owner':'other');return {data:{user},error:null};},
   signOut:async()=>{set('');return {error:null};},
   signInWithOtp:async input=>{assert.equal(input.options.shouldCreateUser,false);calls.sent++;return {error:null};},
   verifyOtp:async input=>{assert.equal(input.type,'email');if(!((input.email===email&&input.token==='12345678')||input.token_hash==='synthetic-email-token'))return {data:{user:null},error:{code:'invalid'}};set('owner');return {data:{user:owner,session:{access_token:'synthetic-owner-jwt'}},error:null};},
   exchangeCodeForSession:async code=>{if(code!=='synthetic-code')return {data:{user:null},error:{code:'invalid'}};set('owner');return {data:{user:owner,session:{access_token:'synthetic-owner-jwt'}},error:null};},
   getSession:async()=>({data:{session:state==='owner'?{access_token:'synthetic-owner-jwt'}:null}}),
   updateUser:async input=>{calls.updates.push(input.password);return {error:null};},
  }};
 };
 const service=await createApp(env,{ownerAuth:createOwnerAuth(env,factory),store:{read:async()=>({projects:[],revision:0}),close:async()=>{}},marketingHandler:async(req,res)=>res.json({marketing:true,ownerId:req.user.id})});
 const server=service.app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const base='http://127.0.0.1:'+server.address().port;
 const jar=new Map();const cookie=()=>[...jar].map(([key,value])=>key+'='+value).join('; ');
 async function req(path,body,source=origin){const response=await fetch(base+path,{method:body?'POST':'GET',redirect:'manual',headers:{cookie:cookie(),origin:source,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});for(const line of response.headers.getSetCookie()){const first=line.split(';')[0],index=first.indexOf('=');if(/Max-Age=0/i.test(line))jar.delete(first.slice(0,index));else jar.set(first.slice(0,index),first.slice(index+1));}return response;}
 try{
  assert.equal((await req('/api/auth/config')).status,200);
  jar.set('__Host-valiantum_session','obsolete-projects-cookie');assert.equal((await req('/api/workspace')).status,401);
  assert.equal((await req('/api/login',{email,password:'old-projects-only-password'})).status,401);
  assert.equal((await req('/api/login',{email:'other@example.test',password:'one-current-password'})).status,401);
  assert.equal((await req('/api/login',{email,password:'one-current-password'})).status,200);
  assert.equal((await req('/api/workspace')).status,200);
  const marketing=await req('/marketing');assert.equal(marketing.status,200);assert.equal((await marketing.json()).ownerId,ownerId);
  const session=await(await req('/api/session')).json();assert.equal(session.email,email);
  assert.equal((await req('/api/account/password',{password:'a-new-single-password',confirmation:'a-new-single-password'})).status,403);
  await req('/api/logout',{});assert.equal((await req('/api/workspace')).status,401);assert.equal((await req('/marketing')).status,302);
  await req('/api/login-code',{email:'unknown@example.test'});assert.equal(calls.sent,0);
  assert.equal((await req('/api/login-code',{email})).status,200);assert.equal(calls.sent,1);
  assert.equal((await req('/api/login-code',{email})).status,429);
  assert.equal((await req('/api/verify-code',{email,code:'00000000'})).status,401);
  const verified=await req('/api/verify-code',{email,code:'12345678'});assert.equal(verified.status,200);assert.equal((await verified.json()).redirect,'/account/password');
  const setupCookie=verified.headers.getSetCookie().find(line=>line.startsWith('valiantum_password_setup='));assert.match(setupCookie,/HttpOnly/);assert.match(setupCookie,/Secure/);assert.match(setupCookie,/Path=\/api\/account\/password/);
  const staleCookie=cookie();
  assert.equal((await req('/api/account/password',{password:'a-new-single-password',confirmation:'a-new-single-password'},'https://evil.example')).status,403);
  assert.equal((await req('/api/account/password',{password:'a-new-single-password',confirmation:'a-new-single-password'})).status,200);assert.equal(calls.updates.length,1);
  const replay=await fetch(base+'/api/account/password',{method:'POST',headers:{cookie:staleCookie,origin,'content-type':'application/json'},body:JSON.stringify({password:'a-new-single-password',confirmation:'a-new-single-password'})});assert.equal(replay.status,403);assert.equal(calls.updates.length,1);
  assert.equal((await req('/marketing')).status,200);
  await req('/api/logout',{});
  assert.equal((await req('/api/verify-code',{link:'https://evil.example/auth/v1/verify?token=synthetic-email-token&type=magiclink'})).status,401);
  assert.equal((await req('/api/verify-code',{link:'https://example.supabase.co/auth/v1/verify?token=synthetic-email-token&type=magiclink'})).status,200);
  assert.equal((await req('/api/workspace')).status,200);
  await req('/api/logout',{});
  const callback=await req('/auth/callback?code=synthetic-code');assert.equal(callback.status,302);assert.equal(callback.headers.get('location'),'/account/password');assert.equal((await req('/marketing')).status,200);
  jar.set('fake_session','other');assert.equal((await req('/api/workspace')).status,401);
 }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await service.close();}
});
test('single account configuration fails closed without an owner identity or trusted Supabase URL',()=>{
 assert.throws(()=>createOwnerAuth({PROJECTS_SUPABASE_OWNER_ID:'not-a-uuid'}),/Configure/);
 assert.throws(()=>createOwnerAuth({NODE_ENV:'production',PROJECTS_EMAIL:email,PROJECTS_SUPABASE_OWNER_ID:ownerId,NEXT_PUBLIC_SUPABASE_URL:'http://example.test',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'public'}),/HTTPS/);
});

test('the real SDK exchanges an email PKCE code in another browser using only the server verifier',async()=>{
 const {createServerClient}=require('@supabase/ssr');const {createHash}=require('node:crypto');
 const env={NODE_ENV:'production',APP_ORIGIN:origin,PROJECTS_EMAIL:email,PROJECTS_SUPABASE_OWNER_ID:ownerId,NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co',NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'public-test-key'};
 let challenge,exchanges=0;
 const jwt=['eyJhbGciOiJIUzI1NiJ9',Buffer.from(JSON.stringify({sub:ownerId,exp:Math.floor(Date.now()/1000)+3600})).toString('base64url'),'signature'].join('.');
 const mockFetch=async(url,options)=>{
  const body=JSON.parse(options.body);
  if(String(url).includes('/otp')){assert.equal(body.create_user,false);challenge=body.code_challenge;assert.equal(body.code_challenge_method,'s256');return new Response('{}',{status:200,headers:{'content-type':'application/json'}});}
  assert.match(String(url),/grant_type=pkce/);assert.equal(body.auth_code,'email-code');
  assert.equal(createHash('sha256').update(body.code_verifier).digest('base64url'),challenge);exchanges++;
  return new Response(JSON.stringify({access_token:jwt,refresh_token:'synthetic-refresh',expires_in:3600,token_type:'bearer',user:{id:ownerId,email}}),{headers:{'content-type':'application/json'}});
 };
 const auth=createOwnerAuth(env,(url,key,options)=>createServerClient(url,key,{...options,global:{fetch:mockFetch}}));
 const sent=[];const request={path:'/api/login-code',headers:{}};
 assert.equal(await auth.forRequest(request,{append:(name,value)=>sent.push(value)}).sendCode(email),true);
 assert.ok(sent.some(value=>value.includes('-code-verifier=')));
 const received=[];const anotherBrowser={path:'/auth/callback',headers:{}};
 const result=await auth.forRequest(anotherBrowser,{append:(name,value)=>received.push(value)}).exchangeCode('email-code');
 assert.equal(result.user.id,ownerId);assert.equal(exchanges,1);
 assert.ok(received.some(value=>value.includes('auth-token=')&&value.includes('HttpOnly')&&value.includes('Secure')));
 const replay=await auth.forRequest({path:'/auth/callback',headers:{}},{append:()=>{}}).exchangeCode('email-code');
 assert.equal(replay,null);assert.equal(exchanges,1);
});
