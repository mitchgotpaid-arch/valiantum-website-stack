begin;

create function public.audit_brand_governance_change()
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
    target_brand_id := old.brand_id;
    insert into public.audit_logs (brand_id, actor_user_id, actor_type, action, previous_state)
    values (target_brand_id, current_user_id, case when current_user_id is null then 'SYSTEM'::public.actor_type else 'HUMAN'::public.actor_type end, action_name, to_jsonb(old));
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

revoke all on function public.audit_brand_governance_change() from public;

create trigger brand_facts_set_updated_at before update on public.brand_facts for each row execute function public.set_updated_at();
create trigger brand_facts_audit_changes after insert or update or delete on public.brand_facts for each row execute function public.audit_brand_governance_change();
create trigger brand_rules_audit_changes after insert or update or delete on public.brand_rules for each row execute function public.audit_brand_governance_change();

commit;
