begin;

alter table public.brands
  add column logo_path text,
  add constraint brands_logo_path_matches_brand
    check (logo_path is null or logo_path = id::text || '/logo');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'brand-assets',
  'brand-assets',
  false,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "brand members read brand assets"
on storage.objects for select to authenticated
using (
  bucket_id = 'brand-assets'
  and public.can_access_brand(
    case
      when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then ((storage.foldername(name))[1])::uuid
      else null
    end
  )
);

create policy "brand editors create brand assets"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'brand-assets'
  and name = (storage.foldername(name))[1] || '/logo'
  and public.can_edit_brand(
    case
      when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then ((storage.foldername(name))[1])::uuid
      else null
    end
  )
);

create policy "brand editors update brand assets"
on storage.objects for update to authenticated
using (
  bucket_id = 'brand-assets'
  and public.can_edit_brand(
    case
      when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then ((storage.foldername(name))[1])::uuid
      else null
    end
  )
)
with check (
  bucket_id = 'brand-assets'
  and name = (storage.foldername(name))[1] || '/logo'
  and public.can_edit_brand(
    case
      when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then ((storage.foldername(name))[1])::uuid
      else null
    end
  )
);

create policy "brand editors delete brand assets"
on storage.objects for delete to authenticated
using (
  bucket_id = 'brand-assets'
  and public.can_edit_brand(
    case
      when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then ((storage.foldername(name))[1])::uuid
      else null
    end
  )
);

commit;
