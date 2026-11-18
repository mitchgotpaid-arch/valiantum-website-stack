const {PGlite}=require('@electric-sql/pglite');const fs=require('node:fs');const assert=require('node:assert/strict');
(async()=>{const db=new PGlite();const dir=require('node:path').join(__dirname,'../marketing/supabase/migrations/');
await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth,public to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`);
// Minimal Supabase platform schemas; all application migrations run unchanged.
await db.exec(`create schema storage;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,unique(bucket_id,name));
alter table storage.objects enable row level security;
create function storage.foldername(text) returns text[] language sql immutable as $$select (string_to_array($1,'/'))[1:greatest(array_length(string_to_array($1,'/'),1)-1,0)]$$;
grant usage on schema storage to authenticated;grant select,insert,update,delete on storage.objects to authenticated;`);
for(const name of fs.readdirSync(dir).filter(name=>name.endsWith('.sql')).sort())await db.exec(fs.readFileSync(dir+name,'utf8'));

const owner='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222',viewer='33333333-3333-4333-8333-333333333333',brand='44444444-4444-4444-8444-444444444444',project='55555555-5555-4555-8555-555555555555',card='66666666-6666-4666-8666-666666666666';
await db.exec(`insert into auth.users values('${owner}'),('${other}'),('${viewer}');select set_config('request.jwt.claim.sub','${owner}',false);insert into public.brands(id,owner_user_id,name,slug) values('${brand}','${owner}','Valiantum','valiantum');insert into public.brand_memberships values('${brand}','${viewer}','VIEWER',now());`);
async function actor(user,role='authenticated'){await db.exec(`reset role;select set_config('request.jwt.claim.sub','${user}',false);set role ${role};`);}
const editor='77777777-7777-4777-8777-777777777777',reviewer='88888888-8888-4888-8888-888888888888';
await db.exec(`insert into auth.users values('${editor}'),('${reviewer}');insert into public.brand_memberships values('${brand}','${editor}','EDITOR',now()),('${brand}','${reviewer}','REVIEWER',now());`);
const input=[project,card,'Launch',brand,'Launch campaign','A saved brief'];
const send=()=>db.query('select public.import_project_card($1,$2,$3,$4,$5,$6) as result',input);
await actor(owner);const first=(await send()).rows[0].result;assert.equal(first.alreadyExists,false);const second=(await send()).rows[0].result;assert.equal(second.alreadyExists,true);assert.equal(first.contentId,second.contentId);
assert.equal((await db.query('select public.get_project_card_briefs() as result')).rows[0].result[0].status,'NEEDS_REVIEW');
await db.exec('reset role');let content=(await db.query('select * from public.content_items')).rows;assert.equal(content.length,1);assert.equal(content[0].requires_human_approval,true);assert.equal(content[0].media_policy_satisfied,false);assert.equal(content[0].verification_status,'UNVERIFIED');
await db.query("update public.content_items set status='APPROVED' where id=$1",[first.contentId]);await actor(owner);assert.equal((await db.query('select public.get_project_card_briefs() as result')).rows[0].result[0].status,'APPROVED');
await assert.rejects(db.query('insert into public.project_card_briefs(source_project_id) values($1)',[project]),/permission denied/);
for(const user of [other,viewer,reviewer]){await actor(user);await assert.rejects(send(),/not permitted/);assert.deepEqual((await db.query('select public.get_project_card_briefs() as result')).rows[0].result,[]);assert.equal((await db.query('select * from public.project_card_briefs')).rows.length,0);}
await actor(editor);const editorBrief=(await send()).rows[0].result;assert.equal(editorBrief.alreadyExists,false);
await assert.rejects(db.query("select public.record_content_decision($1,'APPROVED','')",[editorBrief.contentId]),/not permitted/);
await actor(reviewer);await db.query("select public.record_content_decision($1,'APPROVED','Reviewed locally')",[editorBrief.contentId]);
await actor(editor);assert.equal((await db.query('select public.get_project_card_briefs() as result')).rows[0].result[0].status,'APPROVED');
await actor(owner);
await db.query('update public.brands set name=$1 where id=$2',['Valiantum edited',brand]);
await assert.rejects(db.query("update public.brands set publishing_enabled=true where id=$1",[brand]),/permission denied/);
await assert.rejects(db.query("update public.brands set autonomy='LEVEL_4_AUTONOMOUS' where id=$1",[brand]),/permission denied/);
await assert.rejects(db.query("update public.content_items set status='APPROVED' where id=$1",[first.contentId]),/permission denied/);
await assert.rejects(db.query('update public.system_settings set global_auto_publish_enabled=true'),/permission denied/);
await assert.rejects(db.query('select * from private.provider_credentials'),/permission denied/);
await db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['brand-assets',brand+'/logo']);
await actor(other);assert.equal((await db.query('select * from public.brands')).rows.length,0);assert.equal((await db.query('select * from public.content_items')).rows.length,0);assert.equal((await db.query('select * from storage.objects')).rows.length,0);
await assert.rejects(db.query('insert into storage.objects(bucket_id,name) values($1,$2)',['brand-assets',brand+'/logo']),/row-level security/);
await actor(owner);
const knowledgeFact=(await db.query("insert into public.brand_facts(brand_id,fact_key,value,verification_status,source_url,valid_until) values($1,'product.feature',$2,'VERIFIED','https://brand.example/product',now()+interval '30 days') returning id,updated_at",[brand,{value:'Organizes recipes.'}])).rows[0];
const knowledgeSource=(await db.query("insert into public.brand_sources(brand_id,name,base_url,source_tier,is_approved) values($1,'Official product','https://brand.example',1,true) returning id",[brand])).rows[0];
const knowledgeRule=(await db.query("insert into public.brand_rules(brand_id,rule_type,rule_text,is_active) values($1,'NEVER','Never invent pricing.',true) returning id",[brand])).rows[0];
assert.equal((await db.query("update public.brand_facts set value=$1 where id=$2 and brand_id=$3 and updated_at=$4 returning id",[{value:'Updated reviewed fact.'},knowledgeFact.id,brand,knowledgeFact.updated_at])).rows.length,1);
assert.equal((await db.query("update public.brand_facts set value=$1 where id=$2 and brand_id=$3 and updated_at='2001-01-01' returning id",[{value:'Stale overwrite'},knowledgeFact.id,brand])).rows.length,0);
await db.query('update public.brand_sources set is_approved=false where id=$1',[knowledgeSource.id]);
await db.query('update public.brand_rules set is_active=false where id=$1',[knowledgeRule.id]);
await db.query("update public.brands set agent_profile=$1 where id=$2",[{mission:'Preserved context',approvedExamples:'A reviewed style example.'},brand]);
await actor(other);
for(const table of ['brand_facts','brand_sources','brand_rules'])assert.equal((await db.query('select * from public.'+table)).rows.length,0);
assert.equal((await db.query("update public.brand_facts set verification_status='VERIFIED' where id=$1 returning id",[knowledgeFact.id])).rows.length,0);
await actor(viewer);assert.equal((await db.query("update public.brand_facts set verification_status='VERIFIED' where id=$1 returning id",[knowledgeFact.id])).rows.length,0);
await actor(owner);assert.ok((await db.query("select action from public.audit_logs where action='brand_facts.update'")).rows.length);
await actor('','anon');await assert.rejects(send(),/permission denied/);
for(const table of ['brands','content_items','approvals','audit_logs','ai_usage','project_card_briefs','brand_facts','brand_sources','brand_rules'])await assert.rejects(db.query('select * from public.'+table),/permission denied/);

await db.close();console.log('PASS: complete migration chain, role/tenant boundaries, private credentials/assets, direct-write denial, idempotency, review defaults and live progress.');})().catch(e=>{console.error(e);process.exitCode=1;});
