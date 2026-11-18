begin;

create or replace function public.record_content_decision(
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
  where c.id = p_content_id
  for update;

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

  if normalized_decision = 'REJECTED' and normalized_notes = '' then
    raise exception 'rejection requires reviewer notes' using errcode = '23514';
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

commit;
