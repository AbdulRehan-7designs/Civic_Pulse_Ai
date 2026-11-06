-- Storage for citizen evidence and address-only reports.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('issue-media','issue-media',true,52428800,array[
'image/jpeg','image/png','image/webp','image/gif','audio/mpeg','audio/wav','audio/ogg','audio/webm','audio/mp4','video/mp4','video/webm','video/quicktime'
])
on conflict (id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists issue_media_public_read on storage.objects;
create policy issue_media_public_read on storage.objects for select to public using (bucket_id='issue-media');
drop policy if exists issue_media_insert_own_folder on storage.objects;
create policy issue_media_insert_own_folder on storage.objects for insert to authenticated with check (bucket_id='issue-media' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists issue_media_delete_own_folder on storage.objects;
create policy issue_media_delete_own_folder on storage.objects for delete to authenticated using (bucket_id='issue-media' and (storage.foldername(name))[1]=(select auth.uid())::text);
alter table public.issues alter column coordinates drop not null;
