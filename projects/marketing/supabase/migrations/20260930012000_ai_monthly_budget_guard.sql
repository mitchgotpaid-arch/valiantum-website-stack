begin;

alter table public.system_settings
  add column monthly_ai_budget_cents integer not null default 1500
  check (monthly_ai_budget_cents between 1 and 1500);

create table public.ai_budget_reservations (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete restrict,
  actor_user_id uuid references auth.users(id) on delete set null,
  model text not null,
  task text not null check (task in ('BRAND_DRAFT_GENERATION', 'DAILY_BRIEFING_GENERATION')),
  reserved_cost_micros bigint not null check (reserved_cost_micros > 0),
  actual_cost_micros bigint check (actual_cost_micros >= 0),
  status text not null default 'RESERVED' check (status in ('RESERVED', 'COMPLETED', 'FAILED')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index ai_budget_reservations_month_idx
  on public.ai_budget_reservations(created_at, status);

alter table public.ai_budget_reservations enable row level security;
revoke all on table public.ai_budget_reservations from anon, authenticated;

create function public.get_ai_budget_status()
returns table (
  monthly_budget_cents integer,
  used_cost_micros bigint,
  reserved_cost_micros bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  month_start timestamptz := date_trunc('month', now());
begin
  if actor_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  return query
    select
      settings.monthly_ai_budget_cents,
      coalesce((select sum(usage.estimated_cost_micros) from public.ai_usage usage where usage.created_at >= month_start), 0)::bigint,
      coalesce((select sum(reservation.reserved_cost_micros) from public.ai_budget_reservations reservation where reservation.created_at >= month_start and reservation.status = 'RESERVED'), 0)::bigint
    from public.system_settings settings
    where settings.singleton;
end;
$$;

create function public.reserve_ai_budget(
  p_brand_id uuid,
  p_model text,
  p_task text,
  p_reserved_cost_micros bigint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  reservation_id uuid := gen_random_uuid();
  month_start timestamptz := date_trunc('month', now());
  limit_micros bigint;
  used_micros bigint;
  active_micros bigint;
begin
  if actor_id is null or not public.can_edit_brand(p_brand_id) then
    raise exception 'AI budget reservation is not permitted for this brand' using errcode = '42501';
  end if;

  if char_length(btrim(p_model)) not between 1 and 100
    or p_task not in ('BRAND_DRAFT_GENERATION', 'DAILY_BRIEFING_GENERATION')
    or p_reserved_cost_micros <= 0 then
    raise exception 'invalid AI budget reservation' using errcode = '23514';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('valiantum_global_ai_budget', 0));

  select monthly_ai_budget_cents * 10000::bigint
  into limit_micros
  from public.system_settings
  where singleton;

  select coalesce(sum(estimated_cost_micros), 0)::bigint
  into used_micros
  from public.ai_usage
  where created_at >= month_start;

  select coalesce(sum(reserved_cost_micros), 0)::bigint
  into active_micros
  from public.ai_budget_reservations
  where created_at >= month_start and status = 'RESERVED';

  if used_micros + active_micros + p_reserved_cost_micros > limit_micros then
    raise exception 'monthly OpenAI budget exceeded' using errcode = 'P0001';
  end if;

  insert into public.ai_budget_reservations (
    id, brand_id, actor_user_id, model, task, reserved_cost_micros
  ) values (
    reservation_id, p_brand_id, actor_id, btrim(p_model), p_task, p_reserved_cost_micros
  );

  return reservation_id;
end;
$$;

create function public.fail_ai_budget_reservation(p_reservation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  reservation public.ai_budget_reservations%rowtype;
begin
  select * into reservation
  from public.ai_budget_reservations
  where id = p_reservation_id and actor_user_id = actor_id
  for update;

  if actor_id is null or not found then
    raise exception 'AI budget reservation not found' using errcode = '42501';
  end if;
  if reservation.status <> 'RESERVED' then return; end if;

  update public.ai_budget_reservations
  set status = 'FAILED', actual_cost_micros = reserved_cost_micros, completed_at = now()
  where id = reservation.id;

  insert into public.ai_usage (
    brand_id, provider, model, task, input_tokens, output_tokens,
    estimated_cost_micros, latency_ms, succeeded
  ) values (
    reservation.brand_id, 'OPENAI', reservation.model, reservation.task,
    0, 0, reservation.reserved_cost_micros, null, false
  );

  insert into public.audit_logs (
    brand_id, actor_user_id, actor_type, action, metadata
  ) values (
    reservation.brand_id, actor_id, 'AI', 'ai.budget_reservation_failed',
    jsonb_build_object(
      'model', reservation.model,
      'task', reservation.task,
      'reserved_cost_micros', reservation.reserved_cost_micros
    )
  );
end;
$$;

drop function public.create_ai_content_for_review(uuid, text, text, text, text, integer, integer, bigint, integer, boolean, jsonb);

create function public.create_ai_content_for_review(
  p_brand_id uuid,
  p_title text,
  p_content_type text,
  p_body text,
  p_model text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_estimated_cost_micros bigint,
  p_latency_ms integer,
  p_requires_research boolean,
  p_research_notes jsonb,
  p_reservation_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  content_id uuid := gen_random_uuid();
  normalized_title text := btrim(p_title);
  normalized_type text := upper(btrim(p_content_type));
  normalized_model text := btrim(p_model);
  reservation public.ai_budget_reservations%rowtype;
begin
  if actor_id is null or not public.can_edit_brand(p_brand_id) then
    raise exception 'AI draft generation is not permitted for this brand' using errcode = '42501';
  end if;

  select * into reservation
  from public.ai_budget_reservations
  where id = p_reservation_id and actor_user_id = actor_id and brand_id = p_brand_id
  for update;

  if not found or reservation.status <> 'RESERVED'
    or reservation.task <> 'BRAND_DRAFT_GENERATION'
    or reservation.model <> normalized_model
    or p_estimated_cost_micros > reservation.reserved_cost_micros then
    raise exception 'invalid AI budget reservation' using errcode = '23514';
  end if;

  if char_length(normalized_title) not between 1 and 200
    or normalized_type not in ('SOCIAL_POST', 'CAPTION', 'THREAD')
    or char_length(p_body) not between 1 and 50000
    or char_length(normalized_model) not between 1 and 100
    or p_input_tokens < 0
    or p_output_tokens < 0
    or p_estimated_cost_micros < 0
    or p_latency_ms < 0
    or jsonb_typeof(p_research_notes) <> 'array' then
    raise exception 'invalid AI draft result' using errcode = '23514';
  end if;

  insert into public.content_items (
    id, brand_id, title, content_type, body, status, verification_status, risk,
    requires_human_approval, has_prohibited_claim, media_policy_satisfied, created_by
  ) values (
    content_id, p_brand_id, normalized_title, normalized_type, p_body, 'NEEDS_REVIEW',
    'UNVERIFIED', 'MEDIUM', true, false, false, actor_id
  );

  insert into public.ai_usage (
    brand_id, content_id, provider, model, task, input_tokens, output_tokens,
    estimated_cost_micros, latency_ms, succeeded
  ) values (
    p_brand_id, content_id, 'OPENAI', normalized_model, 'BRAND_DRAFT_GENERATION',
    p_input_tokens, p_output_tokens, p_estimated_cost_micros, p_latency_ms, true
  );

  update public.ai_budget_reservations
  set status = 'COMPLETED', actual_cost_micros = p_estimated_cost_micros, completed_at = now()
  where id = reservation.id;

  insert into public.audit_logs (
    brand_id, content_id, actor_user_id, actor_type, action, new_state, metadata
  ) values (
    p_brand_id, content_id, actor_id, 'AI', 'content.ai_draft_created',
    jsonb_build_object('status', 'NEEDS_REVIEW', 'verification_status', 'UNVERIFIED', 'risk', 'MEDIUM', 'requires_human_approval', true, 'media_policy_satisfied', false),
    jsonb_build_object('model', normalized_model, 'requires_research', p_requires_research, 'research_notes', p_research_notes, 'budget_reservation_id', reservation.id)
  );

  return content_id;
end;
$$;

drop function public.create_ai_briefing_for_review(uuid, text, text, text, integer, integer, bigint, integer, jsonb, text);

create function public.create_ai_briefing_for_review(
  p_brand_id uuid,
  p_title text,
  p_body text,
  p_model text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_estimated_cost_micros bigint,
  p_latency_ms integer,
  p_source_urls jsonb,
  p_prompt_version text,
  p_reservation_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  content_id uuid := gen_random_uuid();
  normalized_title text := btrim(p_title);
  normalized_model text := btrim(p_model);
  normalized_prompt_version text := btrim(p_prompt_version);
  reservation public.ai_budget_reservations%rowtype;
begin
  if actor_id is null or not public.can_edit_brand(p_brand_id) then
    raise exception 'AI briefing generation is not permitted for this brand' using errcode = '42501';
  end if;

  select * into reservation
  from public.ai_budget_reservations
  where id = p_reservation_id and actor_user_id = actor_id and brand_id = p_brand_id
  for update;

  if not found or reservation.status <> 'RESERVED'
    or reservation.task <> 'DAILY_BRIEFING_GENERATION'
    or reservation.model <> normalized_model
    or p_estimated_cost_micros > reservation.reserved_cost_micros then
    raise exception 'invalid AI budget reservation' using errcode = '23514';
  end if;

  if char_length(normalized_title) not between 1 and 200
    or char_length(p_body) not between 1 and 50000
    or char_length(normalized_model) not between 1 and 100
    or char_length(normalized_prompt_version) not between 1 and 100
    or p_input_tokens < 0
    or p_output_tokens < 0
    or p_estimated_cost_micros < 0
    or p_latency_ms < 0
    or jsonb_typeof(p_source_urls) <> 'array'
    or jsonb_array_length(p_source_urls) < 1 then
    raise exception 'invalid AI briefing result' using errcode = '23514';
  end if;

  insert into public.content_items (
    id, brand_id, title, content_type, body, status, verification_status, risk,
    requires_human_approval, has_prohibited_claim, media_policy_satisfied, created_by
  ) values (
    content_id, p_brand_id, normalized_title, 'ARTICLE', p_body, 'NEEDS_REVIEW',
    'UNVERIFIED', 'MEDIUM', true, false, false, actor_id
  );

  insert into public.ai_usage (
    brand_id, content_id, provider, model, task, input_tokens, output_tokens,
    estimated_cost_micros, latency_ms, succeeded
  ) values (
    p_brand_id, content_id, 'OPENAI', normalized_model, 'DAILY_BRIEFING_GENERATION',
    p_input_tokens, p_output_tokens, p_estimated_cost_micros, p_latency_ms, true
  );

  update public.ai_budget_reservations
  set status = 'COMPLETED', actual_cost_micros = p_estimated_cost_micros, completed_at = now()
  where id = reservation.id;

  insert into public.audit_logs (
    brand_id, content_id, actor_user_id, actor_type, action, new_state, metadata
  ) values (
    p_brand_id, content_id, actor_id, 'AI', 'content.ai_daily_briefing_created',
    jsonb_build_object('status', 'NEEDS_REVIEW', 'verification_status', 'UNVERIFIED', 'risk', 'MEDIUM', 'requires_human_approval', true, 'media_policy_satisfied', false),
    jsonb_build_object('model', normalized_model, 'prompt_version', normalized_prompt_version, 'source_urls', p_source_urls, 'budget_reservation_id', reservation.id)
  );

  return content_id;
end;
$$;

revoke all on function public.get_ai_budget_status() from public;
revoke all on function public.reserve_ai_budget(uuid, text, text, bigint) from public;
revoke all on function public.fail_ai_budget_reservation(uuid) from public;
revoke all on function public.create_ai_content_for_review(uuid, text, text, text, text, integer, integer, bigint, integer, boolean, jsonb, uuid) from public;
revoke all on function public.create_ai_briefing_for_review(uuid, text, text, text, integer, integer, bigint, integer, jsonb, text, uuid) from public;

grant execute on function public.get_ai_budget_status() to authenticated;
grant execute on function public.reserve_ai_budget(uuid, text, text, bigint) to authenticated;
grant execute on function public.fail_ai_budget_reservation(uuid) to authenticated;
grant execute on function public.create_ai_content_for_review(uuid, text, text, text, text, integer, integer, bigint, integer, boolean, jsonb, uuid) to authenticated;
grant execute on function public.create_ai_briefing_for_review(uuid, text, text, text, integer, integer, bigint, integer, jsonb, text, uuid) to authenticated;

commit;
