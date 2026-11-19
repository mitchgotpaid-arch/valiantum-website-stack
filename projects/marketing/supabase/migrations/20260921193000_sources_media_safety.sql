begin;

create unique index brand_sources_unique_name_idx on public.brand_sources (brand_id, lower(name));

create trigger brand_sources_audit_changes after insert or update or delete on public.brand_sources for each row execute function public.audit_brand_governance_change();
create trigger brand_media_policies_set_updated_at before update on public.brand_media_policies for each row execute function public.set_updated_at();
create trigger brand_media_policies_audit_changes after insert or update or delete on public.brand_media_policies for each row execute function public.audit_brand_governance_change();

commit;
