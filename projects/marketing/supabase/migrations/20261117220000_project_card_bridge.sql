begin;

create table public.project_card_briefs (
  id uuid primary key default gen_random_uuid(),
  source_project_id uuid not null,
  source_card_id uuid not null,
  source_project_name text not null check (char_length(source_project_name) between 1 and 160),
  brand_id uuid not null references public.brands(id) on delete restrict,
  content_id uuid not null unique references public.content_items(id) on delete restrict,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (created_by, source_project_id, source_card_id)
);
alter table public.project_card_briefs enable row level security;
create policy "project brief owner read" on public.project_card_briefs for select to authenticated
  using (created_by=auth.uid() and public.can_access_brand(brand_id));
revoke all on public.project_card_briefs from anon, authenticated;
grant select on public.project_card_briefs to authenticated;

create function public.import_project_card(
  p_source_project_id uuid, p_source_card_id uuid, p_source_project_name text,
  p_brand_id uuid, p_title text, p_body text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  existing public.project_card_briefs%rowtype;
  content uuid;
  brief uuid;
begin
  if actor is null or not public.can_edit_brand(p_brand_id) then
    raise exception 'not permitted' using errcode='42501';
  end if;
  if p_source_project_id is null or p_source_card_id is null or
    char_length(btrim(coalesce(p_source_project_name,''))) not between 1 and 160 or
    char_length(btrim(coalesce(p_title,''))) not between 1 and 200 or
    p_body is null or char_length(p_body)>50000 then
    raise exception 'invalid project brief' using errcode='23514';
  end if;
  -- A retry or two open browser tabs must not create duplicate review items.
  perform pg_advisory_xact_lock(hashtextextended(actor::text||p_source_project_id::text||p_source_card_id::text,0));
  select * into existing from public.project_card_briefs
    where created_by=actor and source_project_id=p_source_project_id and source_card_id=p_source_card_id;
  if found then
    if existing.brand_id<>p_brand_id then
      raise exception 'card already linked to another brand' using errcode='23514';
    end if;
    return jsonb_build_object('id',existing.id,'contentId',existing.content_id,'alreadyExists',true);
  end if;
  content := public.create_content_for_review(p_brand_id,p_title,'CAMPAIGN_CONTENT',p_body);
  insert into public.project_card_briefs(source_project_id,source_card_id,source_project_name,brand_id,content_id,created_by)
    values(p_source_project_id,p_source_card_id,btrim(p_source_project_name),p_brand_id,content,actor) returning id into brief;
  insert into public.audit_logs(brand_id,content_id,actor_user_id,actor_type,action,new_state)
    values(p_brand_id,content,actor,'HUMAN','projects.card_imported',jsonb_build_object('source_project_id',p_source_project_id,'source_card_id',p_source_card_id,'brief_id',brief));
  return jsonb_build_object('id',brief,'contentId',content,'alreadyExists',false);
end;
$$;

create function public.get_project_card_briefs(p_source_project_id uuid default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'authentication required' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(row_to_json(records)) from (
    select b.id,b.source_project_id as "sourceProjectId",b.source_card_id as "sourceCardId",
      b.source_project_name as "sourceProjectName",b.brand_id as "brandId",brands.name as "brandName",
      b.content_id as "contentId",c.title,c.status,c.updated_at as "updatedAt",b.created_at as "createdAt"
    from public.project_card_briefs b
    join public.content_items c on c.id=b.content_id join public.brands brands on brands.id=b.brand_id
    where b.created_by=auth.uid() and public.can_access_brand(b.brand_id)
      and (p_source_project_id is null or b.source_project_id=p_source_project_id)
    order by b.created_at desc limit 1000
  ) records),'[]'::jsonb);
end;
$$;
revoke all on function public.import_project_card(uuid,uuid,text,uuid,text,text) from public;
revoke all on function public.get_project_card_briefs(uuid) from public;
grant execute on function public.import_project_card(uuid,uuid,text,uuid,text,text) to authenticated;
grant execute on function public.get_project_card_briefs(uuid) to authenticated;
commit;
