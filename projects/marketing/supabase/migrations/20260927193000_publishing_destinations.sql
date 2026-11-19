begin;

create table public.publishing_destinations (
  id uuid primary key default gen_random_uuid(),
  brand_id uuid not null references public.brands(id) on delete cascade,
  provider text not null check (provider in ('META', 'X')),
  channel text not null check (channel in ('FACEBOOK', 'INSTAGRAM', 'X')),
  publish_mode text not null check (publish_mode in ('AUTOMATIC', 'MANUAL_HANDOFF')),
  connection_status text not null check (connection_status in ('SETUP_REQUIRED', 'CONNECTED', 'ACTION_REQUIRED', 'READY')),
  external_account_id text,
  external_account_name text,
  last_validated_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (brand_id, channel),
  constraint publishing_destinations_provider_channel_check check (
    (provider = 'META' and channel in ('FACEBOOK', 'INSTAGRAM'))
    or (provider = 'X' and channel = 'X')
  ),
  constraint publishing_destinations_mode_check check (
    (channel in ('FACEBOOK', 'INSTAGRAM') and publish_mode = 'AUTOMATIC')
    or (channel = 'X' and publish_mode = 'MANUAL_HANDOFF')
  ),
  constraint publishing_destinations_manual_ready_check check (
    channel <> 'X' or connection_status = 'READY'
  )
);

create index publishing_destinations_brand_idx on public.publishing_destinations(brand_id);

alter table public.publishing_destinations enable row level security;

create policy "brand members read publishing destinations"
on public.publishing_destinations for select to authenticated
using (public.can_access_brand(brand_id));

create policy "brand admins manage publishing destinations"
on public.publishing_destinations for all to authenticated
using (public.can_admin_brand(brand_id))
with check (public.can_admin_brand(brand_id));

revoke all privileges on table public.publishing_destinations from anon, authenticated;
grant select, insert, update, delete on public.publishing_destinations to authenticated;

create function public.seed_brand_publishing_destinations()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.publishing_destinations (brand_id, provider, channel, publish_mode, connection_status)
  values
    (new.id, 'META', 'FACEBOOK', 'AUTOMATIC', 'SETUP_REQUIRED'),
    (new.id, 'META', 'INSTAGRAM', 'AUTOMATIC', 'SETUP_REQUIRED'),
    (new.id, 'X', 'X', 'MANUAL_HANDOFF', 'READY')
  on conflict (brand_id, channel) do nothing;
  return new;
end;
$$;

revoke all on function public.seed_brand_publishing_destinations() from public;

create trigger brands_seed_publishing_destinations
after insert on public.brands
for each row execute function public.seed_brand_publishing_destinations();

insert into public.publishing_destinations (brand_id, provider, channel, publish_mode, connection_status)
select b.id, defaults.provider, defaults.channel, defaults.publish_mode, defaults.connection_status
from public.brands b
cross join (values
  ('META', 'FACEBOOK', 'AUTOMATIC', 'SETUP_REQUIRED'),
  ('META', 'INSTAGRAM', 'AUTOMATIC', 'SETUP_REQUIRED'),
  ('X', 'X', 'MANUAL_HANDOFF', 'READY')
) as defaults(provider, channel, publish_mode, connection_status)
on conflict (brand_id, channel) do nothing;

create trigger publishing_destinations_set_updated_at
before update on public.publishing_destinations
for each row execute function public.set_updated_at();

create trigger publishing_destinations_audit_changes
after insert or update or delete on public.publishing_destinations
for each row execute function public.audit_brand_governance_change();

commit;
