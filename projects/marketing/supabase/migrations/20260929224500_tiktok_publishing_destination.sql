begin;

alter table public.publishing_destinations
  drop constraint if exists publishing_destinations_provider_check,
  drop constraint if exists publishing_destinations_channel_check,
  drop constraint if exists publishing_destinations_publish_mode_check,
  drop constraint if exists publishing_destinations_provider_channel_check,
  drop constraint if exists publishing_destinations_mode_check,
  drop constraint if exists publishing_destinations_manual_ready_check;

alter table public.publishing_destinations
  add constraint publishing_destinations_provider_check
    check (provider in ('META', 'TIKTOK', 'X')),
  add constraint publishing_destinations_channel_check
    check (channel in ('FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'X')),
  add constraint publishing_destinations_publish_mode_check
    check (publish_mode in ('AUTOMATIC', 'MANUAL_HANDOFF', 'REVIEW_REQUIRED')),
  add constraint publishing_destinations_provider_channel_check check (
    (provider = 'META' and channel in ('FACEBOOK', 'INSTAGRAM'))
    or (provider = 'TIKTOK' and channel = 'TIKTOK')
    or (provider = 'X' and channel = 'X')
  ),
  add constraint publishing_destinations_mode_check check (
    (channel in ('FACEBOOK', 'INSTAGRAM') and publish_mode = 'AUTOMATIC')
    or (channel = 'TIKTOK' and publish_mode = 'REVIEW_REQUIRED')
    or (channel = 'X' and publish_mode = 'MANUAL_HANDOFF')
  ),
  add constraint publishing_destinations_manual_ready_check check (
    channel <> 'X' or connection_status = 'READY'
  );

create or replace function public.seed_brand_publishing_destinations()
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
    (new.id, 'TIKTOK', 'TIKTOK', 'REVIEW_REQUIRED', 'SETUP_REQUIRED'),
    (new.id, 'X', 'X', 'MANUAL_HANDOFF', 'READY')
  on conflict (brand_id, channel) do nothing;
  return new;
end;
$$;

revoke all on function public.seed_brand_publishing_destinations() from public;

insert into public.publishing_destinations (brand_id, provider, channel, publish_mode, connection_status)
select id, 'TIKTOK', 'TIKTOK', 'REVIEW_REQUIRED', 'SETUP_REQUIRED'
from public.brands
on conflict (brand_id, channel) do nothing;

commit;
