begin;
create function public.create_ai_channel_draft(p_brand_id uuid,p_channel text,p_result jsonb,p_reservation_id uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare draft uuid;
begin
 if p_channel is null or p_channel not in('FACEBOOK','INSTAGRAM','X','TIKTOK','PINTEREST','LINKEDIN','YOUTUBE','THREADS','REDDIT','MASTODON','BLUESKY') then raise exception 'invalid channel' using errcode='23514';end if;
 draft:=public.create_ai_content_for_review(p_brand_id,p_result->>'title',p_result->>'contentType',p_result->>'body',p_result->>'model',(p_result->>'inputTokens')::integer,(p_result->>'outputTokens')::integer,(p_result->>'estimatedCostMicros')::bigint,(p_result->>'latencyMs')::integer,(p_result->>'requiresResearch')::boolean,p_result->'researchNotes',p_reservation_id);
 update public.content_items set target_channel=p_channel where id=draft;return draft;
end;$$;
revoke all on function public.create_ai_channel_draft(uuid,text,jsonb,uuid) from public;
grant execute on function public.create_ai_channel_draft(uuid,text,jsonb,uuid) to authenticated;
create table public.facebook_deliveries(
 id uuid primary key default gen_random_uuid(),brand_id uuid not null references public.brands(id),content_id uuid not null unique references public.content_items(id),
 destination_id uuid not null references public.publishing_destinations(id),page_id text not null,page_name text not null,
 requested_by uuid not null references auth.users(id),body_snapshot text not null,
 mode text not null check(mode in('NOW','SCHEDULED')),scheduled_for timestamptz,
 attempt_count integer not null default 1 check(attempt_count between 1 and 3),
 status text not null default 'PROCESSING' check(status in('PROCESSING','SENT','REJECTED','UNKNOWN')),
 external_post_id text,error_code text,created_at timestamptz not null default now(),completed_at timestamptz,
 check((mode='NOW' and scheduled_for is null) or (mode='SCHEDULED' and scheduled_for is not null)),
 check(status<>'SENT' or nullif(external_post_id,'') is not null)
);
alter table public.facebook_deliveries enable row level security;
revoke all on public.facebook_deliveries from public,anon,authenticated;
grant select on public.facebook_deliveries to authenticated;
create policy "brand members read facebook deliveries" on public.facebook_deliveries for select to authenticated using(public.can_access_brand(brand_id));
create function public.claim_facebook_delivery(p_content_id uuid,p_expected_updated_at timestamptz,p_expected_page_id text,p_reviewed boolean,p_scheduled_for timestamptz default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare item public.content_items%rowtype;destination public.publishing_destinations%rowtype;credential private.provider_credentials%rowtype;delivery public.facebook_deliveries%rowtype;delivery_mode text;
begin
 select * into item from public.content_items where id=p_content_id for update;
 if auth.uid() is null or item.id is null or not public.can_admin_brand(item.brand_id) then raise exception 'not permitted' using errcode='42501';end if;
 select * into delivery from public.facebook_deliveries where content_id=item.id;
 if found and (delivery.status<>'REJECTED' or delivery.attempt_count>=3) then return jsonb_build_object('shouldExecute',false,'delivery',to_jsonb(delivery));end if;
 if delivery.status='REJECTED' and delivery.completed_at>now()-interval '30 seconds' then raise exception 'wait before retrying' using errcode='23514';end if;
 if p_reviewed is distinct from true or p_expected_updated_at is distinct from item.updated_at then raise exception 'review the current copy' using errcode='23514';end if;
 if (item.status not in('NEEDS_REVIEW','APPROVED') and not(item.status='FAILED' and delivery.status='REJECTED')) or item.content_type not in('SOCIAL_POST','CAPTION','THREAD') or (item.target_channel is not null and item.target_channel<>'FACEBOOK') or item.risk in('HIGH','BLOCKED') or item.has_prohibited_claim or item.verification_status in('INCORRECT','CONFLICTING') or char_length(btrim(item.body)) not between 1 and 50000 or position('[VERIFY' in upper(item.body))>0 then raise exception 'content needs editing before publication' using errcode='23514';end if;
 if p_scheduled_for is not null and (p_scheduled_for<now()+interval '10 minutes' or p_scheduled_for>now()+interval '75 days') then raise exception 'schedule between 10 minutes and 75 days ahead' using errcode='23514';end if;
 select * into destination from public.publishing_destinations where brand_id=item.brand_id and provider='META' and channel='FACEBOOK' for update;
 if destination.connection_status is distinct from 'CONNECTED' or nullif(destination.external_account_id,'') is null or destination.external_account_id is distinct from p_expected_page_id then raise exception 'Facebook Page changed or is not connected' using errcode='23514';end if;
 select * into credential from private.provider_credentials where brand_id=item.brand_id and provider='META';
 if credential.encrypted_credential is null or (credential.expires_at is not null and credential.expires_at<=now()) then raise exception 'Reconnect Meta: credential missing or expired' using errcode='23514';end if;
 if item.status='NEEDS_REVIEW' then perform public.record_content_decision(item.id,'APPROVED','Owner reviewed the exact text and authorized Facebook Page publication.');end if;
 -- This explicit owner action attests text accuracy. Text-only posts have no
 -- media assets to clear. It does not enable unattended auto-publication.
 update public.content_items set status='PUBLISHING',verification_status='SUPPORTED',media_policy_satisfied=true,target_channel='FACEBOOK' where id=item.id;
 delivery_mode:=case when p_scheduled_for is null then 'NOW' else 'SCHEDULED' end;
 insert into public.facebook_deliveries(brand_id,content_id,destination_id,page_id,page_name,requested_by,body_snapshot,mode,scheduled_for) values(item.brand_id,item.id,destination.id,destination.external_account_id,coalesce(destination.external_account_name,'Facebook Page'),auth.uid(),item.body,delivery_mode,p_scheduled_for) on conflict(content_id) do update set destination_id=excluded.destination_id,page_id=excluded.page_id,page_name=excluded.page_name,requested_by=excluded.requested_by,body_snapshot=excluded.body_snapshot,mode=excluded.mode,scheduled_for=excluded.scheduled_for,status='PROCESSING',attempt_count=facebook_deliveries.attempt_count+1,error_code=null,completed_at=null returning * into delivery;
 insert into public.audit_logs(brand_id,content_id,actor_user_id,actor_type,action,metadata) values(item.brand_id,item.id,auth.uid(),'HUMAN','publication.facebook_authorized',jsonb_build_object('delivery_id',delivery.id,'page_id',delivery.page_id,'mode',delivery_mode,'scheduled_for',p_scheduled_for,'text_reviewed',true,'public',true));
 return jsonb_build_object('shouldExecute',true,'delivery',to_jsonb(delivery),'encryptedCredential',credential.encrypted_credential);
end;$$;
create function public.complete_facebook_delivery(p_delivery_id uuid,p_status text,p_external_post_id text default null,p_error_code text default null) returns void language plpgsql security definer set search_path='' as $$
declare delivery public.facebook_deliveries%rowtype;
begin
 select * into delivery from public.facebook_deliveries where id=p_delivery_id for update;
 if auth.uid() is null or delivery.id is null or not public.can_admin_brand(delivery.brand_id) then raise exception 'not permitted' using errcode='42501';end if;
 if delivery.status<>'PROCESSING' then return;end if;
 if p_status is null or p_status not in('SENT','REJECTED','UNKNOWN') or (p_status='SENT' and (nullif(p_external_post_id,'') is null or char_length(p_external_post_id)>200)) then raise exception 'invalid delivery result' using errcode='23514';end if;
 update public.facebook_deliveries set status=p_status,external_post_id=case when p_status='SENT' then p_external_post_id else null end,error_code=left(p_error_code,100),completed_at=now() where id=delivery.id;
 update public.content_items set status=case when p_status='SENT' and delivery.mode='NOW' then 'PUBLISHED'::public.content_status when p_status='SENT' then 'SCHEDULED'::public.content_status when p_status='REJECTED' then 'FAILED'::public.content_status else 'PUBLISHING'::public.content_status end where id=delivery.content_id;
 insert into public.audit_logs(brand_id,content_id,actor_user_id,actor_type,action,metadata) values(delivery.brand_id,delivery.content_id,auth.uid(),'HUMAN','publication.facebook_completed',jsonb_build_object('delivery_id',delivery.id,'status',p_status,'external_post_id',p_external_post_id,'error_code',p_error_code,'public',true));
end;$$;
revoke all on function public.claim_facebook_delivery(uuid,timestamptz,text,boolean,timestamptz),public.complete_facebook_delivery(uuid,text,text,text) from public;
grant execute on function public.claim_facebook_delivery(uuid,timestamptz,text,boolean,timestamptz),public.complete_facebook_delivery(uuid,text,text,text) to authenticated;
commit;
