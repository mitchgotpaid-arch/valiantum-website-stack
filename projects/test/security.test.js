const {test}=require('node:test');const assert=require('node:assert/strict');const {scryptSync}=require('node:crypto');const {createApp}=require('../app');const {marketingSecurity}=require('../marketing-security.cjs');
test('Marketing CSP has unpredictable bootstrap nonces and no production script eval',()=>{
 const a=marketingSecurity({NODE_ENV:'production',NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co'}),b=marketingSecurity({NODE_ENV:'production'});
 assert.notEqual(a.nonce,b.nonce);assert.match(a.policy,/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);assert.doesNotMatch(a.policy,/unsafe-eval/);assert.match(a.policy,/object-src 'none'/);assert.match(a.policy,/img-src 'self' data: blob: https:\/\/example.supabase.co/);
});
test('production cookies, origin enforcement, private routes and spoofed Next headers',async()=>{
 const salt='c'.repeat(32),password='synthetic-test-password';const origin='https://projects.example.test';
 const env={NODE_ENV:'production',APP_ORIGIN:origin,PROJECTS_EMAIL:'owner@example.test',PROJECTS_PASSWORD_HASH:salt+':'+scryptSync(password,salt,64).toString('hex')};
 const store={read:async()=>({projects:[],revision:0}),close:async()=>{}};
 const service=await createApp(env,{store,marketingHandler:async(req,res)=>{let body='';for await(const chunk of req)body+=chunk;res.json({body,nonce:req.headers['x-nonce']});}});
 const server=service.app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
 try{
  for(const url of ['/marketing/api/projects/briefs','/marketing/_next/static/not-a-real-chunk.js','/.env','/marketing/.env','/marketing/../api/workspace']){
   const response=await fetch(base+url,{redirect:'manual',headers:{'x-middleware-subrequest':'proxy:proxy:proxy:proxy:proxy','x-invoke-path':'/marketing/api/projects/briefs'}});
   assert.ok([401,302].includes(response.status),url+' must remain private');
  }
  const login=await fetch(base+'/api/login',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({email:env.PROJECTS_EMAIL,password})});
  const setCookie=login.headers.get('set-cookie');assert.match(setCookie,/^__Host-valiantum_session=/);assert.match(setCookie,/; Secure/);assert.match(setCookie,/; HttpOnly/);assert.match(setCookie,/SameSite=Strict/);assert.doesNotMatch(setCookie,/Domain=/);
  const cookie=setCookie.split(';')[0];
  for(const source of [undefined,'https://evil.example','null']){
   const headers={cookie,'content-type':'application/json'};if(source)headers.origin=source;
   assert.equal((await fetch(base+'/marketing/api/projects/briefs',{method:'POST',headers,body:'{}'})).status,403);
  }
  const response=await fetch(base+'/marketing/projects',{method:'POST',headers:{cookie,origin,'content-type':'application/x-www-form-urlencoded','content-security-policy':"script-src * 'unsafe-inline'"},body:'action=hello'});
  assert.equal(response.status,200);assert.match(response.headers.get('strict-transport-security'),/max-age=31536000/);assert.match(response.headers.get('content-security-policy'),/strict-dynamic/);assert.doesNotMatch(response.headers.get('content-security-policy'),/script-src \*/);assert.equal((await response.json()).body,'action=hello');
  const payload=await(await fetch(base+'/marketing/projects',{headers:{cookie}})).json();assert.ok(payload.nonce);
  await fetch(base+'/api/logout',{method:'POST',headers:{cookie,origin,'content-type':'application/json'},body:'{}'});
  assert.equal((await fetch(base+'/marketing/api/projects/briefs',{headers:{cookie}})).status,401);
 }finally{await new Promise(r=>server.close(r));await service.close();}
});
