begin;
create table public.brand_agent_settings(
 brand_id uuid primary key references public.brands(id) on delete cascade,
 enabled boolean not null default false,drafts_per_day integer not null default 2 check(drafts_per_day between 1 and 3),
 next_run_at timestamptz not null default now(),last_run_at timestamptz,
 updated_at timestamptz not null default now()
);
create table public.agent_runs(
 id uuid primary key default gen_random_uuid(),brand_id uuid not null references public.brands(id) on delete cascade,
 status text not null check(status in('RUNNING','SUCCEEDED','BLOCKED','FAILED','SKIPPED')),
 reason text not null default '',summary text not null default '',plan jsonb,
 content_id uuid references public.content_items(id) on delete set null,
 reservation_id uuid references public.ai_budget_reservations(id),
 started_at timestamptz not null default now(),finished_at timestamptz,lease_until timestamptz not null default now()+interval '10 minutes'
);
create index agent_runs_brand_recent on public.agent_runs(brand_id,started_at desc);
create table private.agent_worker_keys(brand_id uuid primary key references public.brands(id) on delete cascade,owner_id uuid not null references auth.users(id),key_hash text not null check(key_hash ~ '^[a-f0-9]{64}$'));
alter table public.brand_agent_settings enable row level security;
alter table public.agent_runs enable row level security;
alter table private.agent_worker_keys enable row level security;
revoke all on public.brand_agent_settings,public.agent_runs,private.agent_worker_keys from public,anon,authenticated;
grant select on public.brand_agent_settings,public.agent_runs to authenticated;
create policy "members read agent settings" on public.brand_agent_settings for select to authenticated using(public.can_access_brand(brand_id));
create policy "members read agent runs" on public.agent_runs for select to authenticated using(public.can_access_brand(brand_id));
create trigger brand_agent_settings_audit after insert or update or delete on public.brand_agent_settings for each row execute function public.audit_brand_governance_change();
create function public.configure_draft_agent(p_brand_id uuid,p_enabled boolean,p_drafts_per_day integer,p_worker_hash text) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.can_admin_brand(p_brand_id) or not exists(select 1 from public.brands where id=p_brand_id and owner_user_id=auth.uid()) then raise exception 'not permitted' using errcode='42501';end if;
 if p_enabled is null or p_drafts_per_day is null or p_drafts_per_day not between 1 and 3 or p_worker_hash is null or p_worker_hash !~ '^[a-f0-9]{64}$' then raise exception 'invalid agent settings' using errcode='23514';end if;
 insert into private.agent_worker_keys values(p_brand_id,auth.uid(),p_worker_hash) on conflict(brand_id) do update set owner_id=excluded.owner_id,key_hash=excluded.key_hash;
 insert into public.brand_agent_settings(brand_id,enabled,drafts_per_day) values(p_brand_id,p_enabled,p_drafts_per_day)
 on conflict(brand_id) do update set enabled=excluded.enabled,drafts_per_day=excluded.drafts_per_day,next_run_at=case when excluded.enabled and not brand_agent_settings.enabled then now() else brand_agent_settings.next_run_at end,updated_at=now();
end;$$;
-- The worker is authenticated by a high-entropy application key. Only its hash
-- is stored, privately. No service-role key or end-user refresh token is needed.
create function private.agent_run_owner(p_worker_key text,p_run_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare owner_id uuid;
begin
 if p_worker_key is null or char_length(p_worker_key)<>43 then raise exception 'not permitted' using errcode='42501';end if;
 select k.owner_id into owner_id from public.agent_runs r join private.agent_worker_keys k using(brand_id) join public.brands b on b.id=r.brand_id and b.owner_user_id=k.owner_id
 where r.id=p_run_id and k.key_hash=encode(sha256(convert_to(p_worker_key,'UTF8')),'hex');
 if owner_id is null then raise exception 'not permitted' using errcode='42501';end if;return owner_id;
end;$$;
revoke all on function private.agent_run_owner(text,uuid) from public,anon,authenticated;
create function public.claim_draft_agent_work(p_worker_key text) returns jsonb language plpgsql security definer set search_path='' as $$
declare cfg public.brand_agent_settings%rowtype; job public.agent_runs%rowtype; owner_id uuid; backlog integer;
begin
 if p_worker_key is null or char_length(p_worker_key)<>43 then raise exception 'not permitted' using errcode='42501';end if;
 -- Expired work is never regenerated automatically. Charge any reserved work
 -- conservatively and expose the interruption in the activity feed.
 for job in select r.* from public.agent_runs r join private.agent_worker_keys k using(brand_id) join public.brands b on b.id=r.brand_id and b.owner_user_id=k.owner_id where r.status='RUNNING' and r.lease_until<now() and k.key_hash=encode(sha256(convert_to(p_worker_key,'UTF8')),'hex') for update of r skip locked loop
   select k.owner_id into owner_id from private.agent_worker_keys k where k.brand_id=job.brand_id;
   perform set_config('request.jwt.claim.sub',owner_id::text,true);
   if job.reservation_id is not null then perform public.fail_ai_budget_reservation(job.reservation_id);end if;
   update public.agent_runs set status='FAILED',reason='INTERRUPTED',summary='The worker stopped before completing this draft. The next regular run will continue.',finished_at=now() where id=job.id;
 end loop;
 select s.* into cfg from public.brand_agent_settings s join private.agent_worker_keys k using(brand_id) join public.brands b on b.id=s.brand_id and b.owner_user_id=k.owner_id where s.enabled and s.next_run_at<=now() and k.key_hash=encode(sha256(convert_to(p_worker_key,'UTF8')),'hex') order by s.next_run_at for update of s skip locked limit 1;
 if not found then return null;end if;
 update public.brand_agent_settings set next_run_at=now()+interval '24 hours'/cfg.drafts_per_day,last_run_at=now() where brand_id=cfg.brand_id;
 select count(*) into backlog from public.content_items where brand_id=cfg.brand_id and status='NEEDS_REVIEW' and exists(select 1 from public.agent_runs where content_id=public.content_items.id and status='SUCCEEDED');
 insert into public.agent_runs(brand_id,status,reason,summary,finished_at) values(cfg.brand_id,case when backlog>=5 then 'BLOCKED' else 'RUNNING' end,case when backlog>=5 then 'QUEUE_FULL' else '' end,case when backlog>=5 then 'Five agent drafts are waiting for review. Review them before more drafts are created.' else '' end,case when backlog>=5 then now() else null end) returning * into job;
 if backlog>=5 then return jsonb_build_object('blocked',true);end if;
 return jsonb_build_object('runId',job.id,'brand',(select to_jsonb(b) from public.brands b where b.id=cfg.brand_id),'facts',(select coalesce(jsonb_agg(to_jsonb(f)),'[]') from public.brand_facts f where f.brand_id=cfg.brand_id),'rules',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from public.brand_rules r where r.brand_id=cfg.brand_id),'sources',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from public.brand_sources s where s.brand_id=cfg.brand_id),'media',(select to_jsonb(m) from public.brand_media_policies m where m.brand_id=cfg.brand_id),'recent',(select coalesce(jsonb_agg(to_jsonb(c)),'[]') from (select title,left(body,1500) as body,target_channel from public.content_items where brand_id=cfg.brand_id order by created_at desc limit 20)c));
end;$$;
create function public.reserve_draft_agent_run(p_worker_key text,p_run_id uuid,p_model text) returns uuid language plpgsql security definer set search_path='' as $$
declare owner_id uuid;job public.agent_runs%rowtype;reservation uuid;
begin
 owner_id:=private.agent_run_owner(p_worker_key,p_run_id);
 select * into job from public.agent_runs where id=p_run_id for update;
 if job.status<>'RUNNING' or job.lease_until<now() or not exists(select 1 from public.brand_agent_settings where brand_id=job.brand_id and enabled) then raise exception 'agent run unavailable' using errcode='23514';end if;
 if job.reservation_id is not null then raise exception 'agent run already reserved' using errcode='23514';end if;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 reservation:=public.reserve_ai_budget(job.brand_id,p_model,'BRAND_DRAFT_GENERATION',30000);
 update public.agent_runs set reservation_id=reservation where id=job.id;return reservation;
end;$$;
create function public.finish_draft_agent_run(p_worker_key text,p_run_id uuid,p_result jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare owner_id uuid;job public.agent_runs%rowtype;draft uuid;outcome text;run_reason text;run_summary text;
begin
 owner_id:=private.agent_run_owner(p_worker_key,p_run_id);select * into job from public.agent_runs where id=p_run_id for update;
 if job.status='SUCCEEDED' then return job.content_id;end if;
 if job.status<>'RUNNING' or job.lease_until<now() then raise exception 'agent run unavailable' using errcode='23514';end if;
 outcome:=p_result->>'status';run_reason:=left(coalesce(p_result->>'reason',''),80);run_summary:=left(coalesce(p_result->>'summary',''),800);
 if outcome is null or outcome not in('SUCCEEDED','BLOCKED','FAILED','SKIPPED') then raise exception 'invalid result' using errcode='23514';end if;
 if not exists(select 1 from public.brand_agent_settings where brand_id=job.brand_id and enabled) then outcome:='SKIPPED';run_reason:='PAUSED';run_summary:='The agent was paused before this draft could be saved.';end if;
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
 if outcome='SUCCEEDED' then
   if job.reservation_id is null or p_result->>'channel' not in('FACEBOOK','INSTAGRAM','X','TIKTOK','PINTEREST','LINKEDIN','YOUTUBE','THREADS','REDDIT','MASTODON','BLUESKY') or p_result->>'channel' is null then raise exception 'invalid result' using errcode='23514';end if;
   draft:=public.create_ai_content_for_review(job.brand_id,p_result->>'title','SOCIAL_POST',p_result->>'body',p_result->>'model',(p_result->>'inputTokens')::integer,(p_result->>'outputTokens')::integer,(p_result->>'estimatedCostMicros')::bigint,(p_result->>'latencyMs')::integer,true,p_result->'researchNotes',job.reservation_id);
   update public.content_items set target_channel=p_result->>'channel' where id=draft;
 elsif job.reservation_id is not null then perform public.fail_ai_budget_reservation(job.reservation_id);
 end if;
 update public.agent_runs set status=outcome,reason=run_reason,summary=run_summary,plan=p_result->'plan',content_id=draft,finished_at=now() where id=job.id;
 return draft;
end;$$;
revoke all on function public.configure_draft_agent(uuid,boolean,integer,text),public.claim_draft_agent_work(text),public.reserve_draft_agent_run(text,uuid,text),public.finish_draft_agent_run(text,uuid,jsonb) from public;
grant execute on function public.configure_draft_agent(uuid,boolean,integer,text) to authenticated;
grant execute on function public.claim_draft_agent_work(text),public.reserve_draft_agent_run(text,uuid,text),public.finish_draft_agent_run(text,uuid,jsonb) to anon;
commit;
