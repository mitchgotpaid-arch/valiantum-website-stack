begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.provider_credentials (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  provider text not null check (provider = 'META'),
  encrypted_credential text not null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, provider)
);

alter table private.provider_credentials enable row level security;

create trigger provider_credentials_set_updated_at
before update on private.provider_credentials
for each row execute function public.set_updated_at();

create function public.connect_meta_publishing_destinations(
  p_brand_id uuid,
  p_facebook_page_id text,
  p_facebook_page_name text,
  p_instagram_account_id text,
  p_instagram_account_name text,
  p_encrypted_credential text,
  p_expires_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not public.can_admin_brand(p_brand_id) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  if nullif(trim(p_facebook_page_id), '') is null
    or nullif(trim(p_facebook_page_name), '') is null
    or nullif(trim(p_encrypted_credential), '') is null then
    raise exception 'invalid Meta connection' using errcode = '23514';
  end if;

  insert into private.provider_credentials (
    brand_id,
    provider,
    encrypted_credential,
    expires_at
  ) values (
    p_brand_id,
    'META',
    p_encrypted_credential,
    p_expires_at
  )
  on conflict (brand_id, provider) do update set
    encrypted_credential = excluded.encrypted_credential,
    expires_at = excluded.expires_at;

  update public.publishing_destinations
  set
    connection_status = 'CONNECTED',
    external_account_id = p_facebook_page_id,
    external_account_name = p_facebook_page_name,
    last_validated_at = now(),
    last_error = null
  where brand_id = p_brand_id and channel = 'FACEBOOK';

  update public.publishing_destinations
  set
    connection_status = case when nullif(trim(p_instagram_account_id), '') is null then 'ACTION_REQUIRED' else 'CONNECTED' end,
    external_account_id = nullif(trim(p_instagram_account_id), ''),
    external_account_name = nullif(trim(p_instagram_account_name), ''),
    last_validated_at = case when nullif(trim(p_instagram_account_id), '') is null then null else now() end,
    last_error = case when nullif(trim(p_instagram_account_id), '') is null then 'No linked Instagram professional account was returned by Meta.' else null end
  where brand_id = p_brand_id and channel = 'INSTAGRAM';
end;
$$;

create function public.disconnect_meta_publishing_destinations(p_brand_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not public.can_admin_brand(p_brand_id) then
    raise exception 'insufficient privilege' using errcode = '42501';
  end if;

  delete from private.provider_credentials
  where brand_id = p_brand_id and provider = 'META';

  update public.publishing_destinations
  set
    connection_status = 'SETUP_REQUIRED',
    external_account_id = null,
    external_account_name = null,
    last_validated_at = null,
    last_error = null
  where brand_id = p_brand_id and channel in ('FACEBOOK', 'INSTAGRAM');
end;
$$;

revoke all on function public.connect_meta_publishing_destinations(uuid, text, text, text, text, text, timestamptz) from public;
revoke all on function public.disconnect_meta_publishing_destinations(uuid) from public;
grant execute on function public.connect_meta_publishing_destinations(uuid, text, text, text, text, text, timestamptz) to authenticated;
grant execute on function public.disconnect_meta_publishing_destinations(uuid) to authenticated;

commit;
