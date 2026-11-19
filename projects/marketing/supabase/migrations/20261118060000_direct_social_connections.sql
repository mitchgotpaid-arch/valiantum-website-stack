begin;
create table public.brand_social_connections(
 id uuid primary key default gen_random_uuid(),
 brand_id uuid not null references public.brands(id) on delete cascade,
 provider text not null check(provider in('X','TIKTOK','PINTEREST','LINKEDIN','YOUTUBE','THREADS','REDDIT','MASTODON','BLUESKY')),
 external_account_id text not null check(char_length(external_account_id) between 1 and 512),
 external_account_name text not null check(char_length(external_account_name) between 1 and 512),
 connection_status text not null default 'CONNECTED' check(connection_status in('CONNECTED','ACTION_REQUIRED')),
 scopes text[] not null default '{}',
 expires_at timestamptz,
 last_validated_at timestamptz not null default now(),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(brand_id,provider),unique(provider,external_account_id)
);
alter table public.brand_social_connections enable row level security;
create policy "brand members read social connections" on public.brand_social_connections for select to authenticated using(public.can_access_brand(brand_id));
revoke all on public.brand_social_connections from public,anon,authenticated;
grant select on public.brand_social_connections to authenticated;
create trigger brand_social_connections_updated before update on public.brand_social_connections for each row execute function public.set_updated_at();
create trigger brand_social_connections_audit after insert or update or delete on public.brand_social_connections for each row execute function public.audit_brand_governance_change();
create table private.social_connection_tokens(
 connection_id uuid primary key references public.brand_social_connections(id) on delete cascade,
 encrypted_credential text not null check(char_length(encrypted_credential) between 20 and 50000),
 updated_at timestamptz not null default now()
);
alter table private.social_connection_tokens enable row level security;
revoke all on private.social_connection_tokens from public,anon,authenticated;
create function public.save_social_connection(p_brand_id uuid,p_provider text,p_account_id text,p_account_name text,p_encrypted_credential text,p_scopes text[],p_expires_at timestamptz,p_expected_updated_at timestamptz default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare selected_id uuid; existing public.brand_social_connections%rowtype;
begin
 if auth.uid() is null or not public.can_admin_brand(p_brand_id) then raise exception 'not permitted' using errcode='42501';end if;
 if p_provider not in('X','TIKTOK','PINTEREST','LINKEDIN','YOUTUBE','THREADS','REDDIT','MASTODON','BLUESKY') or p_provider is null
 or char_length(coalesce(p_account_id,'')) not between 1 and 512 or char_length(coalesce(p_account_name,'')) not between 1 and 512
 or char_length(coalesce(p_encrypted_credential,'')) not between 20 and 50000 or p_scopes is null or cardinality(p_scopes)>30
 or exists(select 1 from unnest(p_scopes) scope where char_length(scope)>300) then raise exception 'invalid connection' using errcode='23514';end if;
 select * into existing from public.brand_social_connections where brand_id=p_brand_id and provider=p_provider for update;
 if p_expected_updated_at is not null and (existing.id is null or existing.updated_at is distinct from p_expected_updated_at) then raise exception 'connection changed' using errcode='40001';end if;
 insert into public.brand_social_connections(brand_id,provider,external_account_id,external_account_name,scopes,expires_at,connection_status,last_validated_at)
 values(p_brand_id,p_provider,p_account_id,p_account_name,p_scopes,p_expires_at,'CONNECTED',now())
 on conflict(brand_id,provider) do update set external_account_id=excluded.external_account_id,external_account_name=excluded.external_account_name,scopes=excluded.scopes,expires_at=excluded.expires_at,connection_status='CONNECTED',last_validated_at=now()
 returning id into selected_id;
 insert into private.social_connection_tokens(connection_id,encrypted_credential) values(selected_id,p_encrypted_credential)
 on conflict(connection_id) do update set encrypted_credential=excluded.encrypted_credential,updated_at=now();
 return selected_id;
end;$$;
create function public.read_social_connection_token(p_connection_id uuid) returns text language plpgsql security definer set search_path='' as $$
declare brand uuid;credential text;
begin
 select brand_id into brand from public.brand_social_connections where id=p_connection_id;
 if auth.uid() is null or brand is null or not public.can_admin_brand(brand) then raise exception 'not permitted' using errcode='42501';end if;
 select encrypted_credential into credential from private.social_connection_tokens where connection_id=p_connection_id;return credential;
end;$$;
create function public.disconnect_social_connection(p_connection_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare brand uuid;
begin
 select brand_id into brand from public.brand_social_connections where id=p_connection_id for update;
 if auth.uid() is null or brand is null or not public.can_admin_brand(brand) then raise exception 'not permitted' using errcode='42501';end if;
 delete from public.brand_social_connections where id=p_connection_id;
end;$$;
create function public.mark_social_connection_attention(p_connection_id uuid,p_expected_updated_at timestamptz) returns void language plpgsql security definer set search_path='' as $$
declare brand uuid;
begin
 select brand_id into brand from public.brand_social_connections where id=p_connection_id;
 if auth.uid() is null or brand is null or not public.can_admin_brand(brand) then raise exception 'not permitted' using errcode='42501';end if;
 update public.brand_social_connections set connection_status='ACTION_REQUIRED' where id=p_connection_id and updated_at=p_expected_updated_at;
end;$$;
revoke all on function public.save_social_connection(uuid,text,text,text,text,text[],timestamptz,timestamptz) from public;
revoke all on function public.read_social_connection_token(uuid) from public;
revoke all on function public.disconnect_social_connection(uuid) from public;
revoke all on function public.mark_social_connection_attention(uuid,timestamptz) from public;
grant execute on function public.save_social_connection(uuid,text,text,text,text,text[],timestamptz,timestamptz) to authenticated;
grant execute on function public.read_social_connection_token(uuid) to authenticated;
grant execute on function public.disconnect_social_connection(uuid) to authenticated;
grant execute on function public.mark_social_connection_attention(uuid,timestamptz) to authenticated;
alter table public.content_items drop constraint if exists content_items_target_channel_check;
alter table public.content_items add constraint content_items_target_channel_check check(target_channel in('FACEBOOK','INSTAGRAM','X','TIKTOK','PINTEREST','LINKEDIN','YOUTUBE','THREADS','REDDIT','MASTODON','BLUESKY'));
create function public.create_channel_draft(p_brand_id uuid,p_channel text,p_title text,p_content_type text,p_body text) returns uuid language plpgsql security definer set search_path='' as $$
declare draft uuid;
begin
 if auth.uid() is null or not public.can_edit_brand(p_brand_id) then raise exception 'not permitted' using errcode='42501';end if;
 if p_channel not in('FACEBOOK','INSTAGRAM','X','TIKTOK','PINTEREST','LINKEDIN','YOUTUBE','THREADS','REDDIT','MASTODON','BLUESKY') or p_channel is null then raise exception 'invalid channel' using errcode='23514';end if;
 draft:=public.create_content_for_review(p_brand_id,p_title,p_content_type,p_body);
 update public.content_items set target_channel=p_channel where id=draft;
 return draft;
end;$$;
revoke all on function public.create_channel_draft(uuid,text,text,text,text) from public;
grant execute on function public.create_channel_draft(uuid,text,text,text,text) to authenticated;
commit;
