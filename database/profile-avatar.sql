alter table public.ob_profiles add column avatar_path text;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('avatars','avatars',false,2097152,array['image/jpeg','image/png','image/webp']);
create policy ob_avatar_read on storage.objects for select to authenticated
using(bucket_id='avatars' and split_part(name,'/',1)=(select auth.uid())::text);
create policy ob_avatar_upload on storage.objects for insert to authenticated
with check(bucket_id='avatars' and split_part(name,'/',1)=(select auth.uid())::text);
create policy ob_avatar_update on storage.objects for update to authenticated
using(bucket_id='avatars' and split_part(name,'/',1)=(select auth.uid())::text)
with check(bucket_id='avatars' and split_part(name,'/',1)=(select auth.uid())::text);
create policy ob_avatar_delete on storage.objects for delete to authenticated
using(bucket_id='avatars' and split_part(name,'/',1)=(select auth.uid())::text);
create function private.ob_profile_save(p_username text,p_avatar text) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Inicia sesión'; end if;
 if p_username is null or length(trim(p_username)) not between 1 and 80 then raise exception 'Revisa tu nombre'; end if;
 if p_avatar is not null and (split_part(p_avatar,'/',1)<>auth.uid()::text or not exists(select 1 from storage.objects where bucket_id='avatars' and name=p_avatar)) then raise exception 'Foto no válida'; end if;
 update public.ob_profiles set username=trim(p_username),avatar_path=p_avatar where id=auth.uid();
 return private.ob_account();
end $$;
revoke all on function private.ob_profile_save(text,text) from public,anon;
grant execute on function private.ob_profile_save(text,text) to authenticated;
create function public.ob_profile_save(p_username text,p_avatar text) returns jsonb language sql set search_path='' as $$select private.ob_profile_save(p_username,p_avatar)$$;
revoke all on function public.ob_profile_save(text,text) from public,anon;
grant execute on function public.ob_profile_save(text,text) to authenticated;
