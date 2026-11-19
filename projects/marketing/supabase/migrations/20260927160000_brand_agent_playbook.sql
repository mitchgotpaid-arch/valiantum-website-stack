begin;

alter table public.brands
  add column agent_profile jsonb not null default '{}'::jsonb,
  add constraint brands_agent_profile_is_object
    check (jsonb_typeof(agent_profile) = 'object');

commit;
