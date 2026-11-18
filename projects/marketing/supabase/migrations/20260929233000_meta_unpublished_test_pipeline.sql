begin;

create table public.publication_attempts (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete restrict,
  content_id uuid not null references public.content_items(id) on delete restrict,
  destination_id uuid not null references public.publishing_destinations(id) on delete restrict,
  requested_by_user_id uuid not null references auth.users(id) on delete restrict,
  attempt_kind text not null check (attempt_kind = 'UNPUBLISHED_TEST'),
  status text not null check (status in ('PROCESSING', 'SUCCEEDED', 'FAILED')),
  idempotency_key text not null unique,
  attempt_count integer not null default 1 check (attempt_count between 1 and 3),
  external_post_id text,
  error_code text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint publication_attempts_completion_check check (
    (status = 'PROCESSING' and completed_at is null)
    or (status in ('SUCCEEDED', 'FAILED') and completed_at is not null)
  ),
  constraint publication_attempts_result_check check (
    (status = 'SUCCEEDED' and nullif(trim(external_post_id), '') is not null and error_code is null)
    or (status = 'FAILED' and nullif(trim(error_code), '') is not null and external_post_id is null)
    or status = 'PROCESSING'
  )
);

create index publication_attempts_content_created_idx
on public.publication_attempts(content_id, created_at desc);

create index publication_attempts_brand_created_idx
on public.publication_attempts(brand_id, created_at desc);

alter table public.publication_attempts enable row level security;

create policy "brand members read publication attempts"
on public.publication_attempts for select to authenticated
using (public.can_access_brand(brand_id));

revoke all privileges on table public.publication_attempts from anon, authenticated;
grant select on table public.publication_attempts to authenticated;

create trigger publication_attempts_set_updated_at
before update on public.publication_attempts
for each row execute function public.set_updated_at();

create function public.claim_facebook_unpublished_test(p_content_id uuid)
returns table (
  attempt_id uuid,
  should_execute boolean,
  attempt_status text,
  brand_id uuid,
  page_id text,
  content_body text,
  encrypted_credential text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  target_content public.content_items%rowtype;
  target_destination public.publishing_destinations%rowtype;
  stored_credential private.provider_credentials%rowtype;
  target_attempt public.publication_attempts%rowtype;
  generated_key text;
begin
  if actor_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into target_content
  from public.content_items c
  where c.id = p_content_id;

  if not found then
    raise exception 'content item not found' using errcode = 'P0002';
  end if;

  if not public.can_admin_brand(target_content.brand_id) then
    raise exception 'publishing test is not permitted for this brand' using errcode = '42501';
  end if;

  if target_content.status <> 'APPROVED' then
    raise exception 'only approved content can be used for a provider test' using errcode = '23514';
  end if;

  if nullif(btrim(target_content.body), '') is null then
    raise exception 'content body is required for a provider test' using errcode = '23514';
  end if;

  select * into target_destination
  from public.publishing_destinations d
  where d.brand_id = target_content.brand_id
    and d.provider = 'META'
    and d.channel = 'FACEBOOK';

  if not found
    or target_destination.connection_status <> 'CONNECTED'
    or nullif(btrim(target_destination.external_account_id), '') is null then
    raise exception 'Facebook publishing destination is not connected' using errcode = '23514';
  end if;

  select * into stored_credential
  from private.provider_credentials c
  where c.brand_id = target_content.brand_id
    and c.provider = 'META';

  if not found
    or nullif(btrim(stored_credential.encrypted_credential), '') is null
    or (stored_credential.expires_at is not null and stored_credential.expires_at <= now()) then
    raise exception 'Meta credential is missing or expired' using errcode = '23514';
  end if;

  generated_key := concat(
    'meta:facebook:unpublished-test:',
    target_content.id,
    ':',
    target_destination.id,
    ':v1'
  );

  select * into target_attempt
  from public.publication_attempts a
  where a.idempotency_key = generated_key
  for update;

  if not found then
    insert into public.publication_attempts (
      brand_id,
      content_id,
      destination_id,
      requested_by_user_id,
      attempt_kind,
      status,
      idempotency_key
    ) values (
      target_content.brand_id,
      target_content.id,
      target_destination.id,
      actor_id,
      'UNPUBLISHED_TEST',
      'PROCESSING',
      generated_key
    ) returning * into target_attempt;

    insert into public.audit_logs (
      brand_id,
      content_id,
      actor_user_id,
      actor_type,
      action,
      new_state,
      metadata
    ) values (
      target_content.brand_id,
      target_content.id,
      actor_id,
      'HUMAN',
      'publication.unpublished_test_requested',
      jsonb_build_object('attempt_id', target_attempt.id, 'status', 'PROCESSING'),
      jsonb_build_object('provider', 'META', 'channel', 'FACEBOOK', 'public', false)
    );
  elsif target_attempt.status = 'FAILED' and target_attempt.attempt_count < 3 then
    update public.publication_attempts
    set
      status = 'PROCESSING',
      attempt_count = attempt_count + 1,
      requested_by_user_id = actor_id,
      external_post_id = null,
      error_code = null,
      started_at = now(),
      completed_at = null
    where id = target_attempt.id
    returning * into target_attempt;
  else
    return query select
      target_attempt.id,
      false,
      target_attempt.status,
      target_content.brand_id,
      target_destination.external_account_id,
      target_content.body,
      stored_credential.encrypted_credential;
    return;
  end if;

  return query select
    target_attempt.id,
    true,
    target_attempt.status,
    target_content.brand_id,
    target_destination.external_account_id,
    target_content.body,
    stored_credential.encrypted_credential;
end;
$$;

create function public.complete_facebook_unpublished_test(
  p_attempt_id uuid,
  p_succeeded boolean,
  p_external_post_id text default null,
  p_error_code text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  target_attempt public.publication_attempts%rowtype;
  normalized_post_id text := nullif(btrim(coalesce(p_external_post_id, '')), '');
  normalized_error_code text := nullif(upper(btrim(coalesce(p_error_code, ''))), '');
begin
  if actor_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into target_attempt
  from public.publication_attempts a
  where a.id = p_attempt_id
  for update;

  if not found then
    raise exception 'publication attempt not found' using errcode = 'P0002';
  end if;

  if not public.can_admin_brand(target_attempt.brand_id) then
    raise exception 'publishing test is not permitted for this brand' using errcode = '42501';
  end if;

  if target_attempt.status <> 'PROCESSING' then
    raise exception 'publication attempt is not processing' using errcode = '23514';
  end if;

  if p_succeeded and normalized_post_id is null then
    raise exception 'successful publication attempt requires an external post id' using errcode = '23514';
  end if;

  if not p_succeeded and normalized_error_code is null then
    raise exception 'failed publication attempt requires an error code' using errcode = '23514';
  end if;

  update public.publication_attempts
  set
    status = case when p_succeeded then 'SUCCEEDED' else 'FAILED' end,
    external_post_id = case when p_succeeded then normalized_post_id else null end,
    error_code = case when p_succeeded then null else left(normalized_error_code, 100) end,
    completed_at = now()
  where id = target_attempt.id;

  if p_succeeded then
    update public.publishing_destinations
    set last_validated_at = now(), last_error = null
    where id = target_attempt.destination_id;
  end if;

  insert into public.audit_logs (
    brand_id,
    content_id,
    actor_user_id,
    actor_type,
    action,
    previous_state,
    new_state,
    metadata
  ) values (
    target_attempt.brand_id,
    target_attempt.content_id,
    actor_id,
    'HUMAN',
    case when p_succeeded then 'publication.unpublished_test_succeeded' else 'publication.unpublished_test_failed' end,
    jsonb_build_object('attempt_id', target_attempt.id, 'status', 'PROCESSING'),
    jsonb_build_object(
      'attempt_id', target_attempt.id,
      'status', case when p_succeeded then 'SUCCEEDED' else 'FAILED' end,
      'external_post_id', normalized_post_id,
      'error_code', normalized_error_code
    ),
    jsonb_build_object('provider', 'META', 'channel', 'FACEBOOK', 'public', false)
  );
end;
$$;

revoke all on function public.claim_facebook_unpublished_test(uuid) from public;
revoke all on function public.complete_facebook_unpublished_test(uuid, boolean, text, text) from public;
grant execute on function public.claim_facebook_unpublished_test(uuid) to authenticated;
grant execute on function public.complete_facebook_unpublished_test(uuid, boolean, text, text) to authenticated;

commit;
