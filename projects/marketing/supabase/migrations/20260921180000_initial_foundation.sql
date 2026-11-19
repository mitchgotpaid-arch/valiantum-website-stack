begin;

create type public.brand_role as enum ('OWNER', 'ADMIN', 'EDITOR', 'REVIEWER', 'VIEWER');
create type public.autonomy_level as enum ('LEVEL_1_MANUAL', 'LEVEL_2_ASSISTED', 'LEVEL_3_TRUSTED', 'LEVEL_4_AUTONOMOUS');
create type public.content_status as enum ('IDEA', 'RESEARCHING', 'DRAFTING', 'VERIFYING', 'NEEDS_REVIEW', 'APPROVED', 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'FAILED', 'REJECTED');
create type public.verification_status as enum ('VERIFIED', 'SUPPORTED', 'UNVERIFIED', 'CONFLICTING', 'INCORRECT');
create type public.risk_level as enum ('LOW', 'MEDIUM', 'HIGH', 'BLOCKED');
create type public.actor_type as enum ('HUMAN', 'AI', 'SYSTEM');

create table public.system_settings (
  singleton boolean primary key default true check (singleton),
  global_auto_publish_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);
insert into public.system_settings (singleton) values (true);

create table public.brands (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  name text not null check (char_length(name) between 1 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text not null default '',
  website_url text,
  industry text,
  target_audience text,
  brand_voice text,
  marketing_objectives jsonb not null default '[]'::jsonb,
  content_pillars jsonb not null default '[]'::jsonb,
  freeform_instructions text not null default '',
  autonomy public.autonomy_level not null default 'LEVEL_1_MANUAL',
  publishing_enabled boolean not null default false,
  monthly_ai_budget_cents integer not null default 0 check (monthly_ai_budget_cents >= 0),
  ai_budget_warning_percent smallint not null default 80 check (ai_budget_warning_percent between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.brand_memberships (
  brand_id uuid not null references public.brands(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.brand_role not null,
  created_at timestamptz not null default now(),
  primary key (brand_id, user_id)
);

create function public.can_access_brand(target_brand_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.brands b
    where b.id = target_brand_id and b.owner_user_id = (select auth.uid())
  ) or exists (
    select 1 from public.brand_memberships m
    where m.brand_id = target_brand_id and m.user_id = (select auth.uid())
  );
$$;

create function public.can_admin_brand(target_brand_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.brands b
    where b.id = target_brand_id and b.owner_user_id = (select auth.uid())
  ) or exists (
    select 1 from public.brand_memberships m
    where m.brand_id = target_brand_id
      and m.user_id = (select auth.uid())
      and m.role in ('OWNER', 'ADMIN')
  );
$$;

create function public.can_edit_brand(target_brand_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.brands b
    where b.id = target_brand_id and b.owner_user_id = (select auth.uid())
  ) or exists (
    select 1 from public.brand_memberships m
    where m.brand_id = target_brand_id
      and m.user_id = (select auth.uid())
      and m.role in ('OWNER', 'ADMIN', 'EDITOR')
  );
$$;

create function public.can_review_brand(target_brand_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.brands b
    where b.id = target_brand_id and b.owner_user_id = (select auth.uid())
  ) or exists (
    select 1 from public.brand_memberships m
    where m.brand_id = target_brand_id
      and m.user_id = (select auth.uid())
      and m.role in ('OWNER', 'ADMIN', 'REVIEWER')
  );
$$;

revoke all on function public.can_access_brand(uuid) from public;
revoke all on function public.can_admin_brand(uuid) from public;
revoke all on function public.can_edit_brand(uuid) from public;
revoke all on function public.can_review_brand(uuid) from public;
grant execute on function public.can_access_brand(uuid) to authenticated;
grant execute on function public.can_admin_brand(uuid) to authenticated;
grant execute on function public.can_edit_brand(uuid) to authenticated;
grant execute on function public.can_review_brand(uuid) to authenticated;

create table public.brand_facts (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  fact_key text not null,
  value jsonb not null,
  verification_status public.verification_status not null default 'UNVERIFIED',
  source_url text,
  valid_from timestamptz,
  valid_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, fact_key)
);

create table public.brand_rules (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  rule_type text not null check (rule_type in ('ALWAYS', 'NEVER', 'REQUIRE_REVIEW')),
  rule_text text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.brand_sources (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  name text not null,
  base_url text,
  source_tier smallint not null check (source_tier between 1 and 4),
  is_approved boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.brand_media_policies (
  brand_id uuid primary key references public.brands(id) on delete cascade,
  ai_illustrations_allowed boolean not null default false,
  ai_backgrounds_allowed boolean not null default false,
  ai_real_person_likenesses_allowed boolean,
  real_person_photos_require_approval boolean not null default true,
  text_graphics_allowed boolean not null default true,
  statistical_graphics_allowed boolean not null default true,
  policy_notes text not null default '',
  updated_at timestamptz not null default now()
);

create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete restrict,
  title text not null,
  content_type text not null,
  body text not null default '',
  status public.content_status not null default 'IDEA',
  verification_status public.verification_status not null default 'UNVERIFIED',
  risk public.risk_level not null default 'MEDIUM',
  requires_human_approval boolean not null default true,
  has_prohibited_claim boolean not null default false,
  media_policy_satisfied boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.content_items(id) on delete cascade,
  reviewer_user_id uuid not null references auth.users(id) on delete restrict,
  decision text not null check (decision in ('APPROVED', 'REJECTED')),
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  brand_id uuid references public.brands(id) on delete set null,
  content_id uuid references public.content_items(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_type public.actor_type not null,
  action text not null,
  previous_state jsonb,
  new_state jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.ai_usage (
  id bigint generated always as identity primary key,
  brand_id uuid references public.brands(id) on delete set null,
  content_id uuid references public.content_items(id) on delete set null,
  provider text not null,
  model text not null,
  task text not null,
  input_tokens integer not null check (input_tokens >= 0),
  output_tokens integer not null check (output_tokens >= 0),
  estimated_cost_micros bigint not null check (estimated_cost_micros >= 0),
  latency_ms integer check (latency_ms >= 0),
  succeeded boolean not null,
  created_at timestamptz not null default now()
);

create index brand_memberships_user_idx on public.brand_memberships(user_id);
create index brand_facts_brand_idx on public.brand_facts(brand_id);
create index brand_rules_brand_idx on public.brand_rules(brand_id) where is_active;
create index brand_sources_brand_tier_idx on public.brand_sources(brand_id, source_tier);
create index content_items_brand_status_idx on public.content_items(brand_id, status);
create index content_items_created_idx on public.content_items(created_at desc);
create index approvals_content_idx on public.approvals(content_id, created_at desc);
create index audit_logs_brand_created_idx on public.audit_logs(brand_id, created_at desc);
create index ai_usage_brand_created_idx on public.ai_usage(brand_id, created_at desc);

alter table public.system_settings enable row level security;
alter table public.brands enable row level security;
alter table public.brand_memberships enable row level security;
alter table public.brand_facts enable row level security;
alter table public.brand_rules enable row level security;
alter table public.brand_sources enable row level security;
alter table public.brand_media_policies enable row level security;
alter table public.content_items enable row level security;
alter table public.approvals enable row level security;
alter table public.audit_logs enable row level security;
alter table public.ai_usage enable row level security;

create policy "authenticated users read global safety state" on public.system_settings for select to authenticated using (true);
create policy "users read accessible brands" on public.brands for select to authenticated using (public.can_access_brand(id));
create policy "users create owned brands" on public.brands for insert to authenticated with check (owner_user_id = (select auth.uid()) and publishing_enabled = false and autonomy = 'LEVEL_1_MANUAL');
create policy "owners administer brands" on public.brands for update to authenticated using (owner_user_id = (select auth.uid())) with check (owner_user_id = (select auth.uid()));
create policy "owners delete brands" on public.brands for delete to authenticated using (owner_user_id = (select auth.uid()));
create policy "users read accessible memberships" on public.brand_memberships for select to authenticated using (public.can_access_brand(brand_id));
create policy "admins manage memberships" on public.brand_memberships for all to authenticated using (public.can_admin_brand(brand_id)) with check (public.can_admin_brand(brand_id));

create policy "brand facts access" on public.brand_facts for select to authenticated using (public.can_access_brand(brand_id));
create policy "brand facts admin" on public.brand_facts for all to authenticated using (public.can_admin_brand(brand_id)) with check (public.can_admin_brand(brand_id));
create policy "brand rules access" on public.brand_rules for select to authenticated using (public.can_access_brand(brand_id));
create policy "brand rules admin" on public.brand_rules for all to authenticated using (public.can_admin_brand(brand_id)) with check (public.can_admin_brand(brand_id));
create policy "brand sources access" on public.brand_sources for select to authenticated using (public.can_access_brand(brand_id));
create policy "brand sources admin" on public.brand_sources for all to authenticated using (public.can_admin_brand(brand_id)) with check (public.can_admin_brand(brand_id));
create policy "media policies access" on public.brand_media_policies for select to authenticated using (public.can_access_brand(brand_id));
create policy "media policies admin" on public.brand_media_policies for all to authenticated using (public.can_admin_brand(brand_id)) with check (public.can_admin_brand(brand_id));
create policy "content access" on public.content_items for select to authenticated using (public.can_access_brand(brand_id));
create policy "content create" on public.content_items for insert to authenticated with check (public.can_edit_brand(brand_id) and created_by = (select auth.uid()));
create policy "content update" on public.content_items for update to authenticated using (public.can_edit_brand(brand_id)) with check (public.can_edit_brand(brand_id));
create policy "approval access" on public.approvals for select to authenticated using (public.can_access_brand((select c.brand_id from public.content_items c where c.id = content_id)));
create policy "approval create" on public.approvals for insert to authenticated with check (reviewer_user_id = (select auth.uid()) and public.can_review_brand((select c.brand_id from public.content_items c where c.id = content_id)));
create policy "audit access" on public.audit_logs for select to authenticated using (brand_id is not null and public.can_access_brand(brand_id));
create policy "usage access" on public.ai_usage for select to authenticated using (brand_id is not null and public.can_access_brand(brand_id));

commit;
