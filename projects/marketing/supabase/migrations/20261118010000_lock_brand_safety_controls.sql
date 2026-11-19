begin;
-- Brand editing does not need authority to change ownership, autonomy, publishing
-- or budgets. Keep these controls outside direct authenticated Data API writes.
revoke update on table public.brands from authenticated;
grant update (
  name, slug, description, website_url, industry, target_audience, brand_voice,
  marketing_objectives, content_pillars, freeform_instructions, agent_profile, logo_path
) on table public.brands to authenticated;
commit;
