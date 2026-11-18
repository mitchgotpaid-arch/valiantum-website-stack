begin;

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
  p_prompt_version text
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
begin
  if actor_id is null or not public.can_edit_brand(p_brand_id) then
    raise exception 'AI briefing generation is not permitted for this brand' using errcode = '42501';
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

  insert into public.audit_logs (
    brand_id, content_id, actor_user_id, actor_type, action, new_state, metadata
  ) values (
    p_brand_id,
    content_id,
    actor_id,
    'AI',
    'content.ai_daily_briefing_created',
    jsonb_build_object(
      'status', 'NEEDS_REVIEW',
      'verification_status', 'UNVERIFIED',
      'risk', 'MEDIUM',
      'requires_human_approval', true,
      'media_policy_satisfied', false
    ),
    jsonb_build_object(
      'model', normalized_model,
      'prompt_version', normalized_prompt_version,
      'source_urls', p_source_urls
    )
  );

  return content_id;
end;
$$;

revoke all on function public.create_ai_briefing_for_review(uuid, text, text, text, integer, integer, bigint, integer, jsonb, text) from public;
grant execute on function public.create_ai_briefing_for_review(uuid, text, text, text, integer, integer, bigint, integer, jsonb, text) to authenticated;

commit;
