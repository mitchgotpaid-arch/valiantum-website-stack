begin;

create function public.create_ai_briefing_capture(
  p_brand_id uuid,
  p_title text,
  p_body text,
  p_input_tokens integer,
  p_output_tokens integer,
  p_latency_ms integer,
  p_source_urls jsonb,
  p_quality_issues jsonb,
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
  reservation public.ai_budget_reservations%rowtype;
begin
  if actor_id is null or not public.can_edit_brand(p_brand_id) then
    raise exception 'AI briefing capture is not permitted for this brand' using errcode = '42501';
  end if;

  select * into reservation
  from public.ai_budget_reservations
  where id = p_reservation_id and actor_user_id = actor_id and brand_id = p_brand_id
  for update;

  if not found or reservation.status <> 'RESERVED' or reservation.task <> 'DAILY_BRIEFING_GENERATION' then
    raise exception 'invalid AI budget reservation' using errcode = '23514';
  end if;

  if char_length(btrim(p_title)) not between 1 and 200
    or char_length(p_body) not between 1 and 50000
    or char_length(btrim(p_prompt_version)) not between 1 and 100
    or p_input_tokens < 0 or p_output_tokens < 0 or p_latency_ms < 0
    or p_source_urls is null or jsonb_typeof(p_source_urls) <> 'array'
    or p_quality_issues is null or jsonb_typeof(p_quality_issues) <> 'array' then
    raise exception 'invalid AI briefing capture' using errcode = '23514';
  end if;

  if jsonb_array_length(p_source_urls) > 100
    or jsonb_array_length(p_quality_issues) not between 1 and 20
    or char_length(p_quality_issues::text) > 4000 then
    raise exception 'invalid AI briefing capture metadata' using errcode = '23514';
  end if;

  insert into public.content_items (
    id, brand_id, title, content_type, body, status, verification_status, risk,
    requires_human_approval, has_prohibited_claim, media_policy_satisfied, created_by
  ) values (
    content_id, p_brand_id, btrim(p_title), 'RESEARCH_CAPTURE', p_body, 'VERIFYING',
    'UNVERIFIED', 'HIGH', true, false, false, actor_id
  );

  -- A returned provider response may incur cost even when it fails our local checks.
  -- Charge the fixed reservation rather than trusting a client-supplied discount.
  insert into public.ai_usage (
    brand_id, content_id, provider, model, task, input_tokens, output_tokens,
    estimated_cost_micros, latency_ms, succeeded
  ) values (
    p_brand_id, content_id, 'OPENAI', reservation.model, 'DAILY_BRIEFING_GENERATION',
    p_input_tokens, p_output_tokens, reservation.reserved_cost_micros, p_latency_ms, false
  );

  update public.ai_budget_reservations
  set status = 'FAILED', actual_cost_micros = reserved_cost_micros, completed_at = now()
  where id = reservation.id;

  insert into public.audit_logs (
    brand_id, content_id, actor_user_id, actor_type, action, new_state, metadata
  ) values (
    p_brand_id, content_id, actor_id, 'AI', 'content.ai_daily_briefing_captured',
    jsonb_build_object('status', 'VERIFYING', 'verification_status', 'UNVERIFIED', 'risk', 'HIGH', 'requires_human_approval', true),
    jsonb_build_object('model', reservation.model, 'prompt_version', p_prompt_version,
      'quality_issues', p_quality_issues, 'source_urls', p_source_urls,
      'budget_reservation_id', reservation.id,
      'reserved_cost_micros', reservation.reserved_cost_micros)
  );

  return content_id;
end;
$$;

revoke all on function public.create_ai_briefing_capture(uuid, text, text, integer, integer, integer, jsonb, jsonb, text, uuid) from public;
grant execute on function public.create_ai_briefing_capture(uuid, text, text, integer, integer, integer, jsonb, jsonb, text, uuid) to authenticated;

commit;
