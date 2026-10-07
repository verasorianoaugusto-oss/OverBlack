alter table public.ob_products add column image_path text;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('product-images','product-images',true,5242880,array['image/jpeg','image/png','image/webp']);
create policy ob_product_upload on storage.objects for insert to authenticated with check(bucket_id='product-images' and (select public.ob_is_admin()));
create policy ob_product_image_read on storage.objects for select to authenticated using(bucket_id='product-images' and (select public.ob_is_admin()));
create function private.ob_product_save(p_product bigint,p_price integer,p_active boolean,p_size text,p_stock integer,p_image text) returns void language plpgsql security definer set search_path='' as $$
begin
if not private.ob_is_admin() then raise exception 'Acceso denegado'; end if;
if p_image is not null and not exists(select 1 from storage.objects where bucket_id='product-images' and name=p_image) then raise exception 'Imagen no encontrada'; end if;
perform private.ob_inventory(p_product,p_price,p_active,p_size,p_stock);
update public.ob_products set image_path=p_image where id=p_product;
end $$;
revoke all on function private.ob_product_save(bigint,integer,boolean,text,integer,text) from public,anon;
grant execute on function private.ob_product_save(bigint,integer,boolean,text,integer,text) to authenticated;
create function public.ob_product_save(p_product bigint,p_price integer,p_active boolean,p_size text,p_stock integer,p_image text) returns void language sql security invoker set search_path='' as $$select private.ob_product_save(p_product,p_price,p_active,p_size,p_stock,p_image)$$;
revoke all on function public.ob_product_save(bigint,integer,boolean,text,integer,text) from public,anon;
grant execute on function public.ob_product_save(bigint,integer,boolean,text,integer,text) to authenticated;
