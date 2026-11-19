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
// Direct social credentials are admin-only; members see metadata, never ciphertext.
await actor(owner);
const cipher='v1.encrypted-test-credential-only';
const saveSocial=(expected=null)=>db.query("select public.save_social_connection($1,'X','account-1','Brand account',$2,array['tweet.read'],null,$3) as id",[brand,cipher,expected]);
const socialId=(await saveSocial()).rows[0].id;
const socialRow=(await db.query('select * from public.brand_social_connections where id=$1',[socialId])).rows[0];
assert.equal(JSON.stringify(socialRow).includes(cipher),false);
assert.equal((await db.query('select public.read_social_connection_token($1) as token',[socialId])).rows[0].token,cipher);
await assert.rejects(saveSocial('2001-01-01'),/connection changed/);
await assert.rejects(db.query('select * from private.social_connection_tokens'),/permission denied/);
await assert.rejects(db.query("update public.brand_social_connections set external_account_name='forged'"),/permission denied/);
for(const member of [viewer,editor,reviewer,other]){
 await actor(member);assert.equal((await db.query('select * from public.brand_social_connections')).rows.length,member===other?0:1);
 await assert.rejects(saveSocial(),/not permitted/);
 await assert.rejects(db.query('select public.read_social_connection_token($1)',[socialId]),/not permitted/);
 await assert.rejects(db.query('select public.disconnect_social_connection($1)',[socialId]),/not permitted/);
}
await actor(editor);
const channelDraft=(await db.query("select public.create_channel_draft($1,'PINTEREST','Pin draft','SOCIAL_POST','A reviewed draft') as id",[brand])).rows[0].id;
const channelItem=(await db.query('select * from public.content_items where id=$1',[channelDraft])).rows[0];
assert.equal(channelItem.target_channel,'PINTEREST');assert.equal(channelItem.status,'NEEDS_REVIEW');assert.equal(channelItem.requires_human_approval,true);assert.equal(channelItem.verification_status,'UNVERIFIED');
await actor(viewer);await assert.rejects(db.query("select public.create_channel_draft($1,'X','Not allowed','SOCIAL_POST','body')",[brand]),/not permitted/);
await actor(owner);
await db.query('select public.mark_social_connection_attention($1,$2)',[socialId,socialRow.updated_at]);
assert.equal((await db.query('select connection_status from public.brand_social_connections where id=$1',[socialId])).rows[0].connection_status,'ACTION_REQUIRED');
await db.query('select public.disconnect_social_connection($1)',[socialId]);
await db.exec('reset role');assert.equal((await db.query('select * from private.social_connection_tokens where connection_id=$1',[socialId])).rows.length,0);
// Autonomous jobs: owner opt-in, private worker capability, leases and budget.
const workerKey='k'.repeat(43),workerHash=require('node:crypto').createHash('sha256').update(workerKey).digest('hex');
await actor(viewer);await assert.rejects(db.query('select public.configure_draft_agent($1,true,2,$2)',[brand,workerHash]),/not permitted/);
await actor(owner);await db.query('select public.configure_draft_agent($1,true,2,$2)',[brand,workerHash]);
await assert.rejects(db.query('select * from private.agent_worker_keys'),/permission denied/);
await assert.rejects(db.query('update public.brand_agent_settings set enabled=false'),/permission denied/);
await actor(other);assert.equal((await db.query('select * from public.brand_agent_settings')).rows.length,0);
await actor('','anon');
assert.equal((await db.query('select public.claim_draft_agent_work($1) as work',['z'.repeat(43)])).rows[0].work,null);
let job=(await db.query('select public.claim_draft_agent_work($1) as work',[workerKey])).rows[0].work;assert.equal(job.brand.id,brand);
assert.equal((await db.query('select public.claim_draft_agent_work($1) as work',[workerKey])).rows[0].work,null);
await assert.rejects(db.query('select public.reserve_draft_agent_run($1,$2,$3)',['z'.repeat(43),job.runId,'gpt-6-luna']),/not permitted/);
await db.query('select public.reserve_draft_agent_run($1,$2,$3)',[workerKey,job.runId,'gpt-6-luna']);
await assert.rejects(db.query('select public.reserve_draft_agent_run($1,$2,$3)',[workerKey,job.runId,'gpt-6-luna']),/already reserved/);
const result={status:'SUCCEEDED',reason:'DRAFT_READY',summary:'A useful topic chosen automatically',plan:{topic:'Fresh angle',channel:'FACEBOOK'},channel:'FACEBOOK',title:'Agent-written draft',body:'An evergreen community conversation.',model:'gpt-6-luna',inputTokens:100,outputTokens:100,estimatedCostMicros:1000,latencyMs:10,researchNotes:['Human review is still required.']};
const agentDraft=(await db.query('select public.finish_draft_agent_run($1,$2,$3) as id',[workerKey,job.runId,result])).rows[0].id;
assert.equal((await db.query('select public.finish_draft_agent_run($1,$2,$3) as id',[workerKey,job.runId,result])).rows[0].id,agentDraft);
await actor(owner);const generated=(await db.query('select * from public.content_items where id=$1',[agentDraft])).rows[0];assert.equal(generated.status,'NEEDS_REVIEW');assert.equal(generated.requires_human_approval,true);assert.equal(generated.media_policy_satisfied,false);assert.equal(generated.target_channel,'FACEBOOK');
// Incomplete knowledge can close a run without spending or reserving anything.
await db.exec('reset role');await db.query("update public.brand_agent_settings set next_run_at=now()-interval '1 minute' where brand_id=$1",[brand]);
await actor('','anon');job=(await db.query('select public.claim_draft_agent_work($1) as work',[workerKey])).rows[0].work;
await db.query('select public.finish_draft_agent_run($1,$2,$3)',[workerKey,job.runId,{status:'BLOCKED',reason:'NEEDS_KNOWLEDGE',summary:'Teach this brand once.'}]);
await db.exec('reset role');assert.equal((await db.query('select reservation_id from public.agent_runs where id=$1',[job.runId])).rows[0].reservation_id,null);
// A restart never retries paid generation for an expired run.
await db.query("update public.brand_agent_settings set next_run_at=now()-interval '1 minute' where brand_id=$1",[brand]);await actor('','anon');job=(await db.query('select public.claim_draft_agent_work($1) as work',[workerKey])).rows[0].work;await db.query('select public.reserve_draft_agent_run($1,$2,$3)',[workerKey,job.runId,'gpt-6-luna']);
await db.exec('reset role');await db.query("update public.agent_runs set lease_until=now()-interval '1 minute' where id=$1",[job.runId]);await actor('','anon');assert.equal((await db.query('select public.claim_draft_agent_work($1) as work',[workerKey])).rows[0].work,null);
await db.exec('reset role');assert.equal((await db.query('select status,reason from public.agent_runs where id=$1',[job.runId])).rows[0].reason,'INTERRUPTED');
assert.equal((await db.query("select count(*)::int as n from public.ai_budget_reservations where status='RESERVED'")).rows[0].n,0);
// Budget exhaustion is checked atomically before any paid generation.
await db.exec('reset role');await db.query('update public.system_settings set monthly_ai_budget_cents=1');await db.query("update public.brand_agent_settings set next_run_at=now()-interval '1 minute' where brand_id=$1",[brand]);
await actor('','anon');job=(await db.query('select public.claim_draft_agent_work($1) as work',[workerKey])).rows[0].work;await assert.rejects(db.query('select public.reserve_draft_agent_run($1,$2,$3)',[workerKey,job.runId,'gpt-6-luna']),/budget exceeded/);await db.query('select public.finish_draft_agent_run($1,$2,$3)',[workerKey,job.runId,{status:'BLOCKED',reason:'BUDGET_LIMIT'}]);
await db.exec('reset role');await db.query('update public.system_settings set monthly_ai_budget_cents=1500');
// Five unreviewed agent drafts stop queue growth without another reservation.
for(let i=0;i<4;i++){await actor(owner);const id=(await db.query("select public.create_content_for_review($1,'Agent queue draft','SOCIAL_POST','Copy awaiting review') as id",[brand])).rows[0].id;await db.exec('reset role');await db.query("insert into public.agent_runs(brand_id,status,content_id) values($1,'SUCCEEDED',$2)",[brand,id]);}
await db.query("update public.brand_agent_settings set next_run_at=now()-interval '1 minute' where brand_id=$1",[brand]);await actor('','anon');assert.equal((await db.query('select public.claim_draft_agent_work($1) as work',[workerKey])).rows[0].work.blocked,true);
await actor(owner);await db.query('select public.configure_draft_agent($1,false,2,$2)',[brand,workerHash]);await actor('','anon');assert.equal((await db.query('select public.claim_draft_agent_work($1) as work',[workerKey])).rows[0].work,null);
// Explicit owner-authorized Facebook publishing and native scheduling.
await actor(owner);await db.query('select public.connect_meta_publishing_destinations($1,$2,$3,$4,$5,$6,$7)',[brand,'123','Brand Facebook Page','456','brand_ig','v1.encrypted-test-meta-token',null]);
const publishDraft=async(body='A reviewed community question.')=>{await actor(owner);const id=(await db.query("select public.create_channel_draft($1,'FACEBOOK','Facebook draft','SOCIAL_POST',$2) as id",[brand,body])).rows[0].id;return (await db.query('select id,updated_at from public.content_items where id=$1',[id])).rows[0];};
let publication=await publishDraft();
const claimLive=(reviewed=true,time=null,page='123',date=publication.updated_at)=>db.query('select public.claim_facebook_delivery($1,$2,$3,$4,$5) as claim',[publication.id,date,page,reviewed,time]);
for(const user of [other,viewer,editor,reviewer]){await actor(user);await assert.rejects(claimLive(),/not permitted/);}
await actor(owner);await assert.rejects(claimLive(false),/review the current copy/);await assert.rejects(claimLive(true,null,'wrong-page'),/Page changed/);await assert.rejects(claimLive(true,null,'123','2001-01-01'),/review the current copy/);await assert.rejects(claimLive(true,new Date(Date.now()+60000).toISOString()),/10 minutes/);
let live=(await claimLive()).rows[0].claim;assert.equal(live.shouldExecute,true);assert.ok(live.encryptedCredential);assert.equal((await claimLive()).rows[0].claim.shouldExecute,false);
assert.equal(JSON.stringify((await db.query('select * from public.facebook_deliveries')).rows).includes('encrypted-test-meta-token'),false);
assert.equal((await db.query('select status from public.content_items where id=$1',[publication.id])).rows[0].status,'PUBLISHING');
await db.query("select public.complete_facebook_delivery($1,'UNKNOWN',null,'OUTCOME_UNKNOWN')",[live.delivery.id]);assert.equal((await claimLive()).rows[0].claim.shouldExecute,false);
publication=await publishDraft();const planned=new Date(Date.now()+3600000).toISOString();live=(await claimLive(true,planned)).rows[0].claim;await db.query("select public.complete_facebook_delivery($1,'SENT','123_789',null)",[live.delivery.id]);assert.equal((await db.query('select status from public.content_items where id=$1',[publication.id])).rows[0].status,'SCHEDULED');
publication=await publishDraft('A claim with [VERIFY: unresolved evidence].');await assert.rejects(claimLive(),/needs editing/);
publication=await publishDraft();live=(await claimLive()).rows[0].claim;await db.query("select public.complete_facebook_delivery($1,'REJECTED',null,'PROVIDER_REJECTED')",[live.delivery.id]);await db.exec('reset role');await db.query("update public.facebook_deliveries set completed_at=now()-interval '1 minute' where id=$1",[live.delivery.id]);await actor(owner);publication=(await db.query('select id,updated_at from public.content_items where id=$1',[publication.id])).rows[0];live=(await claimLive()).rows[0].claim;assert.equal(live.shouldExecute,true);assert.equal(live.delivery.attempt_count,2);await db.query("select public.complete_facebook_delivery($1,'SENT','123_999',null)",[live.delivery.id]);assert.equal((await db.query('select status from public.content_items where id=$1',[publication.id])).rows[0].status,'PUBLISHED');
await actor(other);assert.equal((await db.query('select * from public.facebook_deliveries')).rows.length,0);await actor(owner);await assert.rejects(db.query("update public.facebook_deliveries set status='SENT'"),/permission denied/);
assert.equal((await db.query('select global_auto_publish_enabled from public.system_settings')).rows[0].global_auto_publish_enabled,false);
await actor('','anon');await assert.rejects(send(),/permission denied/);
for(const table of ['brands','content_items','approvals','audit_logs','ai_usage','project_card_briefs','brand_facts','brand_sources','brand_rules','brand_social_connections','brand_agent_settings','agent_runs','facebook_deliveries'])await assert.rejects(db.query('select * from public.'+table),/permission denied/);

await db.close();console.log('PASS: complete migration chain, role/tenant boundaries, private credentials/assets, direct-write denial, idempotency, review defaults and live progress.');})().catch(e=>{console.error(e);process.exitCode=1;});
