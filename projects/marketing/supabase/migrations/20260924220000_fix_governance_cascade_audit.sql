begin;

create or replace function public.audit_brand_governance_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
  target_brand_id uuid;
  action_name text := tg_table_name || '.' || lower(tg_op);
begin
  if tg_op = 'DELETE' then
    -- A direct child deletion keeps its Brand relationship. During a cascading
    -- Brand deletion the parent is already unavailable to the foreign key, so
    -- retain the former identifier in metadata instead.
    select b.id into target_brand_id
    from public.brands b
    where b.id = old.brand_id;

    insert into public.audit_logs (brand_id, actor_user_id, actor_type, action, previous_state, metadata)
    values (
      target_brand_id,
      current_user_id,
      case when current_user_id is null then 'SYSTEM'::public.actor_type else 'HUMAN'::public.actor_type end,
      action_name,
      to_jsonb(old),
      case when target_brand_id is null then jsonb_build_object('deleted_brand_id', old.brand_id) else '{}'::jsonb end
    );
    return old;
  elsif tg_op = 'INSERT' then
    target_brand_id := new.brand_id;
    insert into public.audit_logs (brand_id, actor_user_id, actor_type, action, new_state)
    values (target_brand_id, current_user_id, case when current_user_id is null then 'SYSTEM'::public.actor_type else 'HUMAN'::public.actor_type end, action_name, to_jsonb(new));
    return new;
  else
    target_brand_id := new.brand_id;
    insert into public.audit_logs (brand_id, actor_user_id, actor_type, action, previous_state, new_state)
    values (target_brand_id, current_user_id, case when current_user_id is null then 'SYSTEM'::public.actor_type else 'HUMAN'::public.actor_type end, action_name, to_jsonb(old), to_jsonb(new));
    return new;
  end if;
end;
$$;

commit;
