begin;

alter table public.content_items
  add column source_content_id uuid references public.content_items(id) on delete restrict,
  add column source_opportunity_rank smallint check (source_opportunity_rank between 1 and 5),
  add column target_channel text check (target_channel in ('FACEBOOK', 'INSTAGRAM', 'X', 'TIKTOK')),
  add column source_urls jsonb not null default '[]'::jsonb
    check (jsonb_typeof(source_urls) = 'array' and jsonb_array_length(source_urls) <= 12);

create index content_items_source_content_idx on public.content_items(source_content_id)
  where source_content_id is not null;

create unique index content_items_briefing_social_unique
  on public.content_items(source_content_id, source_opportunity_rank, target_channel)
  where source_content_id is not null and source_opportunity_rank is not null and target_channel is not null;

-- A briefing is a research artifact, never the text sent to a social provider.
-- Derived posts get independent review and retain their source linkage.
create function public.create_social_draft_from_briefing(
  p_source_content_id uuid,
  p_source_updated_at timestamptz,
  p_opportunity_rank integer,
  p_channel text,
  p_title text,
  p_body text,
  p_source_urls jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  source_item public.content_items%rowtype;
  content_id uuid := gen_random_uuid();
  existing_id uuid;
  normalized_channel text := upper(btrim(coalesce(p_channel, '')));
begin
  if actor_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into source_item
  from public.content_items c
  where c.id = p_source_content_id
  for update;

  if not found then
    raise exception 'briefing not found' using errcode = 'P0002';
  end if;

  if not public.can_edit_brand(source_item.brand_id) then
    raise exception 'content creation is not permitted for this brand' using errcode = '42501';
  end if;

  if p_source_urls is null or jsonb_typeof(p_source_urls) <> 'array' then
    raise exception 'invalid source links' using errcode = '23514';
  end if;

  if source_item.content_type <> 'DAILY_BRIEFING'
    or source_item.status not in ('NEEDS_REVIEW', 'APPROVED')
    or source_item.updated_at is distinct from p_source_updated_at
    or p_opportunity_rank is null or p_opportunity_rank not between 1 and 5
    or normalized_channel not in ('FACEBOOK', 'INSTAGRAM', 'X')
    or char_length(btrim(coalesce(p_title, ''))) not between 1 and 200
    or char_length(btrim(coalesce(p_body, ''))) not between 1 and 50000
    or jsonb_array_length(p_source_urls) not between 1 and 8
    or exists (
      select 1 from jsonb_array_elements(p_source_urls) entry
      where jsonb_typeof(entry) <> 'string'
        or char_length(entry #>> '{}') > 2000
        or (entry #>> '{}') !~ '^https?://'
        or position((entry #>> '{}') in source_item.body) = 0
    ) then
    raise exception 'invalid or stale briefing draft' using errcode = '23514';
  end if;

  select c.id into existing_id
  from public.content_items c
  where c.source_content_id = source_item.id
    and c.source_opportunity_rank = p_opportunity_rank
    and c.target_channel = normalized_channel;

  if found then
    return existing_id;
  end if;

  insert into public.content_items (
    id, brand_id, source_content_id, source_opportunity_rank, target_channel, source_urls,
    title, content_type, body, status, verification_status, risk,
    requires_human_approval, has_prohibited_claim, media_policy_satisfied, created_by
  ) values (
    content_id, source_item.brand_id, source_item.id, p_opportunity_rank, normalized_channel, p_source_urls,
    btrim(p_title), case when normalized_channel = 'INSTAGRAM' then 'CAPTION' else 'SOCIAL_POST' end,
    btrim(p_body), 'NEEDS_REVIEW', 'UNVERIFIED', 'MEDIUM',
    true, false, false, actor_id
  );

  insert into public.audit_logs (
    brand_id, content_id, actor_user_id, actor_type, action, new_state, metadata
  ) values (
    source_item.brand_id, content_id, actor_id, 'HUMAN', 'content.created_from_briefing',
    jsonb_build_object('status', 'NEEDS_REVIEW', 'verification_status', 'UNVERIFIED', 'risk', 'MEDIUM', 'media_policy_satisfied', false),
    jsonb_build_object('source_content_id', source_item.id, 'opportunity_rank', p_opportunity_rank,
      'target_channel', normalized_channel, 'source_urls', p_source_urls)
  );

  return content_id;
end;
$$;

-- Editing and resubmitting are permitted only before approval. Every edit
-- resets any previous safety clearance and creates an immutable audit event.
create function public.revise_content_for_review(
  p_content_id uuid,
  p_title text,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  target public.content_items%rowtype;
  normalized_title text := btrim(coalesce(p_title, ''));
  normalized_body text := btrim(coalesce(p_body, ''));
begin
  if actor_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select * into target
  from public.content_items c
  where c.id = p_content_id
  for update;

  if not found then
    raise exception 'content item not found' using errcode = 'P0002';
  end if;

  if not public.can_edit_brand(target.brand_id) then
    raise exception 'content editing is not permitted for this brand' using errcode = '42501';
  end if;

  if target.status not in ('NEEDS_REVIEW', 'REJECTED')
    or target.content_type = 'RESEARCH_CAPTURE'
    or char_length(normalized_title) not between 1 and 200
    or char_length(normalized_body) not between 1 and 50000 then
    raise exception 'content cannot be revised for review' using errcode = '23514';
  end if;

  update public.content_items
  set title = normalized_title,
      body = normalized_body,
      status = 'NEEDS_REVIEW',
      verification_status = 'UNVERIFIED',
      risk = case when target.risk in ('HIGH', 'BLOCKED') then target.risk else 'MEDIUM' end,
      requires_human_approval = true,
      media_policy_satisfied = false
  where id = target.id;

  insert into public.audit_logs (
    brand_id, content_id, actor_user_id, actor_type, action, previous_state, new_state
  ) values (
    target.brand_id, target.id, actor_id, 'HUMAN', 'content.revised_for_review',
    jsonb_build_object('title', target.title, 'body', target.body, 'status', target.status,
      'verification_status', target.verification_status, 'risk', target.risk,
      'media_policy_satisfied', target.media_policy_satisfied),
    jsonb_build_object('title', normalized_title, 'body', normalized_body, 'status', 'NEEDS_REVIEW',
      'verification_status', 'UNVERIFIED', 'risk', case when target.risk in ('HIGH', 'BLOCKED') then target.risk else 'MEDIUM' end,
      'media_policy_satisfied', false)
  );

  return target.id;
end;
$$;

revoke all on function public.create_social_draft_from_briefing(uuid, timestamptz, integer, text, text, text, jsonb) from public;
revoke all on function public.revise_content_for_review(uuid, text, text) from public;
grant execute on function public.create_social_draft_from_briefing(uuid, timestamptz, integer, text, text, text, jsonb) to authenticated;
grant execute on function public.revise_content_for_review(uuid, text, text) to authenticated;

commit;
