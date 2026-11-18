begin;

-- Connection state will eventually be changed only by narrow OAuth/provider
-- functions. Brand administrators may read it, but must not be able to mark a
-- channel connected or ready through the Data API.
drop policy "brand admins manage publishing destinations" on public.publishing_destinations;
revoke insert, update, delete on public.publishing_destinations from authenticated;

commit;
