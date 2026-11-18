begin;

create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger brands_set_updated_at
before update on public.brands
for each row execute function public.set_updated_at();

create function public.audit_brand_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    insert into public.audit_logs (brand_id, actor_user_id, actor_type, action, new_state)
    values (new.id, current_user_id, case when current_user_id is null then 'SYSTEM'::public.actor_type else 'HUMAN'::public.actor_type end, 'brand.created', to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.audit_logs (brand_id, actor_user_id, actor_type, action, previous_state, new_state)
    values (new.id, current_user_id, case when current_user_id is null then 'SYSTEM'::public.actor_type else 'HUMAN'::public.actor_type end, 'brand.updated', to_jsonb(old), to_jsonb(new));
    return new;
  else
    insert into public.audit_logs (brand_id, actor_user_id, actor_type, action, previous_state, metadata)
    values (old.id, current_user_id, case when current_user_id is null then 'SYSTEM'::public.actor_type else 'HUMAN'::public.actor_type end, 'brand.deleted', to_jsonb(old), jsonb_build_object('deleted_brand_id', old.id));
    return old;
  end if;
end;
$$;

revoke all on function public.set_updated_at() from public;
revoke all on function public.audit_brand_change() from public;

create trigger brands_audit_changes
after insert or update or delete on public.brands
for each row execute function public.audit_brand_change();

commit;
