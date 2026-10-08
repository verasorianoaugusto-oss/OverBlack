-- Extend the existing catalog; preserve current IDs, images, stock and orders.
alter table public.ob_products add column description text not null default '' check(length(description)<=4000);
alter table public.ob_products add column gallery_paths text[] not null default '{}' check(cardinality(gallery_paths)<=7 and array_position(gallery_paths,null) is null);
alter table public.ob_products drop constraint ob_products_category_check;
alter table public.ob_products add constraint ob_products_category_check check(length(trim(category)) between 1 and 50 and category=lower(trim(category)));

create function private.ob_product_gallery(p_product bigint,p_images text[],p_expected text[]) returns void language plpgsql security definer set search_path='' as $$
declare item public.ob_products; old_images text[]; image text;
begin
 if auth.uid() is null or not private.ob_is_admin() then raise exception 'Acceso denegado'; end if;
 select * into item from public.ob_products where id=p_product and deleted_at is null for update;
 if not found then raise exception 'Producto inexistente'; end if;
 old_images:=case when item.image_path is null then '{}'::text[] else array[item.image_path] end||item.gallery_paths;
 if p_expected is distinct from old_images then raise exception 'Las fotos cambiaron. Vuelve a abrir el producto antes de guardar.'; end if;
 if p_images is null or cardinality(p_images)>8 or array_position(p_images,null) is not null or cardinality(p_images)<>(select count(distinct x) from unnest(p_images) x) then raise exception 'Elige hasta 8 fotos diferentes'; end if;
 foreach image in array p_images loop
  if not exists(select 1 from storage.objects where bucket_id='product-images' and name=image) or (split_part(image,'/',1)<>p_product::text and not image=any(old_images)) then raise exception 'Foto no válida para este producto'; end if;
 end loop;
 update public.ob_products set image_path=p_images[1],gallery_paths=coalesce(p_images[2:cardinality(p_images)],'{}'::text[]) where id=p_product;
 insert into private.admin_audit(actor,target,action) values(auth.uid(),auth.uid(),'product:gallery:'||p_product);
end $$;
revoke all on function private.ob_product_gallery(bigint,text[],text[]) from public,anon;
grant execute on function private.ob_product_gallery(bigint,text[],text[]) to authenticated;
create function public.ob_product_gallery(p_product bigint,p_images text[],p_expected text[]) returns void language sql security invoker set search_path='' as $$select private.ob_product_gallery(p_product,p_images,p_expected)$$;
revoke all on function public.ob_product_gallery(bigint,text[],text[]) from public,anon;
grant execute on function public.ob_product_gallery(bigint,text[],text[]) to authenticated;

create or replace function private.ob_product_manage(p_action text,p_product bigint default null,p_data jsonb default '{}') returns bigint language plpgsql security definer set search_path='' as $$
declare result bigint; size_name text;
begin
 if not private.ob_is_admin() then raise exception 'Acceso denegado'; end if;
 if p_action='create' then
   insert into public.ob_products(name,category,collection,description) values(trim(p_data->>'name'),lower(trim(p_data->>'category')),p_data->>'collection',coalesce(p_data->>'description','')) returning id into result;
 elsif p_action='edit' then
   update public.ob_products set name=trim(p_data->>'name'),category=lower(trim(p_data->>'category')),collection=p_data->>'collection',description=case when p_data ? 'description' then coalesce(p_data->>'description','') else description end where id=p_product returning id into result;
 elsif p_action='delete' then
   perform 1 from public.ob_products where id=p_product for update;
   if exists(select 1 from public.ob_order_items i join public.ob_variants v on v.id=i.variant_id where v.product_id=p_product) then raise exception 'Este producto tiene pedidos. Puedes ocultarlo para conservar el historial.'; end if;
   update public.ob_products set deleted_at=now(),archived=true,active=false where id=p_product and deleted_at is null returning id into result;
 elsif p_action='restore' then
   update public.ob_products set deleted_at=null,archived=true,active=false where id=p_product and deleted_at is not null returning id into result;
 elsif p_action='delete_size' then
   perform 1 from public.ob_products where id=p_product for update;
   size_name:=p_data->>'size';
   if exists(select 1 from public.ob_order_items i join public.ob_variants v on v.id=i.variant_id where v.product_id=p_product and v.size=size_name) then raise exception 'Esta talla tiene pedidos. Déjala sin stock para conservar su historial.'; end if;
   delete from public.ob_variants where product_id=p_product and size=size_name;
   result:=p_product;
 else raise exception 'Acción no válida'; end if;
 if result is null then raise exception 'Producto inexistente'; end if;
 insert into private.admin_audit(actor,target,action) values(auth.uid(),auth.uid(),'product:'||p_action||':'||result);
 return result;
end $$;
revoke all on function private.ob_product_manage(text,bigint,jsonb) from public,anon;
grant execute on function private.ob_product_manage(text,bigint,jsonb) to authenticated;
create or replace function public.ob_product_manage(p_action text,p_product bigint default null,p_data jsonb default '{}') returns bigint language sql set search_path='' as $$select private.ob_product_manage(p_action,p_product,p_data)$$;
revoke all on function public.ob_product_manage(text,bigint,jsonb) from public,anon;
grant execute on function public.ob_product_manage(text,bigint,jsonb) to authenticated;
-- Guard existing inventory writes against stale administrator forms.
create function private.ob_product_save_checked(p_product bigint,p_price integer,p_active boolean,p_size text,p_stock integer,p_image text,p_expected jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare product public.ob_products; current_stock integer; snapshot jsonb;
begin
 if auth.uid() is null or not private.ob_is_admin() then raise exception 'Acceso denegado'; end if;
 select * into product from public.ob_products where id=p_product and deleted_at is null for update;
 if not found then raise exception 'Producto inexistente'; end if;
 select stock into current_stock from public.ob_variants where product_id=p_product and size=trim(p_size) for update;
 snapshot:=jsonb_build_object('price',product.price,'active',product.active,'image_path',product.image_path,'archived',product.archived,'stock',current_stock);
 if p_expected is distinct from snapshot then
  raise exception 'El producto o el stock cambió mientras editabas. Recarga los datos y revisa la cantidad antes de guardar.';
 end if;
 perform private.ob_product_save(p_product,p_price,p_active,p_size,p_stock,p_image);
end $$;
revoke all on function private.ob_product_save_checked(bigint,integer,boolean,text,integer,text,jsonb) from public,anon;
grant execute on function private.ob_product_save_checked(bigint,integer,boolean,text,integer,text,jsonb) to authenticated;
create function public.ob_product_save_checked(p_product bigint,p_price integer,p_active boolean,p_size text,p_stock integer,p_image text,p_expected jsonb)
returns void language sql security invoker set search_path='' as $$select private.ob_product_save_checked(p_product,p_price,p_active,p_size,p_stock,p_image,p_expected)$$;
revoke all on function public.ob_product_save_checked(bigint,integer,boolean,text,integer,text,jsonb) from public,anon;
grant execute on function public.ob_product_save_checked(bigint,integer,boolean,text,integer,text,jsonb) to authenticated;
