const {test}=require('node:test');
const assert=require('node:assert/strict');
const {scryptSync}=require('node:crypto');
const {mkdtemp,rm}=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {createApp}=require('../app');
test('Marketing mount is private and passes raw Next bodies without weakening Projects',async()=>{
 const folder=await mkdtemp(path.join(os.tmpdir(),'valiantum-marketing-test-'));
 const salt='a'.repeat(32),password='local-only-test-password';
 const env={PROJECTS_EMAIL:'owner@example.com',PROJECTS_PASSWORD_HASH:salt+':'+scryptSync(password,salt,64).toString('hex'),APP_ORIGIN:'http://localhost',PROJECTS_DATA_FILE:path.join(folder,'data.json')};
 const service=await createApp(env,{marketingHandler:async(req,res)=>{let body='';for await(const chunk of req)body+=chunk;res.json({url:req.url,body});}});
 const server=service.app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 const base='http://127.0.0.1:'+server.address().port;
 try{
  const protectedPage=await fetch(base+'/marketing/projects',{redirect:'manual'});
  assert.equal(protectedPage.status,302);assert.equal(protectedPage.headers.get('location'),'/login?next=%2Fmarketing%2Fprojects');
  assert.equal((await fetch(base+'/marketing/api/projects/briefs')).status,401);
  assert.equal((await fetch(base+'/api/marketing/config')).status,401);
  // Only the exact OAuth callback may reach its own state/session validator.
  assert.equal((await fetch(base+'/marketing/api/meta/callback')).status,200);
  assert.equal((await fetch(base+'/marketing/api/meta/callback/extra')).status,401);
  const login=await fetch(base+'/api/login',{method:'POST',headers:{origin:'http://localhost','content-type':'application/json'},body:JSON.stringify({email:env.PROJECTS_EMAIL,password})});
  const cookie=login.headers.get('set-cookie').split(';')[0];
  const nextBody='action=hello&payload=raw';
  const response=await fetch(base+'/marketing/projects',{method:'POST',headers:{cookie,'content-type':'application/x-www-form-urlencoded'},body:nextBody});
  assert.equal(response.status,200);assert.equal((await response.json()).body,nextBody);
  assert.equal(response.headers.get('x-robots-tag'),'noindex, nofollow');
  assert.equal((await fetch(base+'/api/workspace',{method:'PUT',headers:{cookie,'content-type':'application/json',origin:'https://elsewhere.example'},body:'{}'})).status,403);
  assert.equal((await fetch(base+'/marketing-other',{headers:{cookie}})).status,404);
 }finally{await new Promise(r=>server.close(r));await service.close?.();await rm(folder,{recursive:true,force:true});}
});
