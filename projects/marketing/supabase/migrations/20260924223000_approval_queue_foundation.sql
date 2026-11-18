begin;

-- Content status, verification, risk, and approval flags are safety-sensitive.
-- Authenticated clients must use the narrow functions below instead of writing
-- content or approval rows directly.
revoke insert, update on public.content_items from authenticated;
revoke insert on public.approvals from authenticated;

drop policy if exists "content create" on public.content_items;
drop policy if exists "content update" on public.content_items;
drop policy if exists "approval create" on public.approvals;

create trigger content_items_set_updated_at
before update on public.content_items
for each row execute function public.set_updated_at();

create function public.create_content_for_review(
  p_brand_id uuid,
  p_title text,
  p_content_type text,
  p_body text
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
begin
  if actor_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not public.can_edit_brand(p_brand_id) then
    raise exception 'content creation is not permitted for this brand' using errcode = '42501';
  end if;

  if char_length(normalized_title) not between 1 and 200 then
    raise exception 'content title must contain 1 to 200 characters' using errcode = '23514';
  end if;

  if normalized_type not in (
    'ARTICLE',
    'SOCIAL_POST',
    'CAPTION',
    'THREAD',
    'GRAPHIC',
    'CAROUSEL',
    'VIDEO_CONCEPT',
    'VIDEO_SCRIPT',
    'CAMPAIGN_CONTENT'
  ) then
    raise exception 'unsupported content type' using errcode = '23514';
  end if;

  if char_length(p_body) > 50000 then
    raise exception 'content body exceeds 50000 characters' using errcode = '23514';
  end if;

  insert into public.content_items (
    id,
    brand_id,
    title,
    content_type,
    body,
    status,
    verification_status,
    risk,
    requires_human_approval,
    has_prohibited_claim,
    media_policy_satisfied,
    created_by
  )
  values (
    content_id,
    p_brand_id,
    normalized_title,
    normalized_type,
    p_body,
    'NEEDS_REVIEW',
    'UNVERIFIED',
    'MEDIUM',
    true,
    false,
    false,
    actor_id
  );

  insert into public.audit_logs (
    brand_id,
    content_id,
    actor_user_id,
    actor_type,
    action,
    new_state
  )
  values (
    p_brand_id,
    content_id,
    actor_id,
    'HUMAN',
    'content.created_for_review',
    jsonb_build_object(
      'status', 'NEEDS_REVIEW',
      'verification_status', 'UNVERIFIED',
      'risk', 'MEDIUM',
      'requires_human_approval', true,
      'media_policy_satisfied', false
    )
  );

  return content_id;
end;
$$;

create function public.record_content_decision(
  p_content_id uuid,
  p_decision text,
  p_notes text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  target_brand_id uuid;
  current_status public.content_status;
  normalized_decision text := upper(btrim(p_decision));
  normalized_notes text := btrim(coalesce(p_notes, ''));
  next_status public.content_status;
  approval_id uuid := gen_random_uuid();
begin
  if actor_id is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;

  select c.brand_id, c.status
  into target_brand_id, current_status
  from public.content_items c
  where c.id = p_content_id;

  if not found then
    raise exception 'content item not found' using errcode = 'P0002';
  end if;

  if not public.can_review_brand(target_brand_id) then
    raise exception 'review is not permitted for this brand' using errcode = '42501';
  end if;

  if current_status <> 'NEEDS_REVIEW' then
    raise exception 'content item is not awaiting review' using errcode = '23514';
  end if;

  if normalized_decision not in ('APPROVED', 'REJECTED') then
    raise exception 'decision must be APPROVED or REJECTED' using errcode = '23514';
  end if;

  if char_length(normalized_notes) > 4000 then
    raise exception 'decision notes exceed 4000 characters' using errcode = '23514';
  end if;

  next_status := case
    when normalized_decision = 'APPROVED' then 'APPROVED'::public.content_status
    else 'REJECTED'::public.content_status
  end;

  insert into public.approvals (id, content_id, reviewer_user_id, decision, notes)
  values (approval_id, p_content_id, actor_id, normalized_decision, normalized_notes);

  update public.content_items
  set status = next_status
  where id = p_content_id;

  insert into public.audit_logs (
    brand_id,
    content_id,
    actor_user_id,
    actor_type,
    action,
    previous_state,
    new_state
  )
  values (
    target_brand_id,
    p_content_id,
    actor_id,
    'HUMAN',
    'content.review_decision',
    jsonb_build_object('status', current_status),
    jsonb_build_object(
      'approval_id', approval_id,
      'decision', normalized_decision,
      'notes', normalized_notes,
      'status', next_status
    )
  );

  return approval_id;
end;
$$;

revoke all on function public.create_content_for_review(uuid, text, text, text) from public;
revoke all on function public.record_content_decision(uuid, text, text) from public;
grant execute on function public.create_content_for_review(uuid, text, text, text) to authenticated;
grant execute on function public.record_content_decision(uuid, text, text) to authenticated;

commit;
