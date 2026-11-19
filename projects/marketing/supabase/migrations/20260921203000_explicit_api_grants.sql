begin;

-- Project creation disables automatic Data API grants. Keep anonymous callers
-- out of every application table and grant authenticated users only the SQL
-- operations that also have an explicit RLS policy.
revoke all privileges on table
  public.system_settings,
  public.brands,
  public.brand_memberships,
  public.brand_facts,
  public.brand_rules,
  public.brand_sources,
  public.brand_media_policies,
  public.content_items,
  public.approvals,
  public.audit_logs,
  public.ai_usage
from anon, authenticated;

grant usage on schema public to authenticated;

grant select on public.system_settings to authenticated;

grant select, insert, update, delete on public.brands to authenticated;
grant select, insert, update, delete on public.brand_memberships to authenticated;
grant select, insert, update, delete on public.brand_facts to authenticated;
grant select, insert, update, delete on public.brand_rules to authenticated;
grant select, insert, update, delete on public.brand_sources to authenticated;
grant select, insert, update, delete on public.brand_media_policies to authenticated;

grant select, insert, update on public.content_items to authenticated;
grant select, insert on public.approvals to authenticated;
grant select on public.audit_logs to authenticated;
grant select on public.ai_usage to authenticated;

commit;
