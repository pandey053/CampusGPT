grant insert, update, delete on table public.documents, public.chunks
  to authenticated;

insert into storage.buckets (id, name, public, allowed_mime_types)
values (
  'college-documents',
  'college-documents',
  false,
  array['application/pdf']::text[]
) 
on conflict (id) do update
set
  name = excluded.name, 
  public = false,
  allowed_mime_types = excluded.allowed_mime_types;

grant select, insert, update, delete on table storage.objects to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'CampusGPT admins manage college documents'
  ) then
    create policy "CampusGPT admins manage college documents"
      on storage.objects
      as permissive
      for all
      to authenticated
      using (
        bucket_id = 'college-documents'
        and (select public.is_admin())
      )
      with check (
        bucket_id = 'college-documents'
        and (select public.is_admin())
      );
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'CampusGPT restricts college documents to admins'
  ) then
    create policy "CampusGPT restricts college documents to admins"
      on storage.objects
      as restrictive
      for all
      to authenticated
      using (
        bucket_id <> 'college-documents'
        or (select public.is_admin())
      )
      with check (
        bucket_id <> 'college-documents'
        or (select public.is_admin())
      );
  end if;
end;
$$;
