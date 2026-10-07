create function private.ob_product_manage(p_action text,p_product bigint default null,p_data jsonb default '{}') returns bigint language plpgsql security definer set search_path='' as $$
declare result bigint; size_name text;
begin
 if not private.ob_is_admin() then raise exception 'Acceso denegado'; end if;
 if p_action='create' then
   insert into public.ob_products(name,category,collection) values(trim(p_data->>'name'),p_data->>'category',p_data->>'collection') returning id into result;
 elsif p_action='edit' then
   update public.ob_products set name=trim(p_data->>'name'),category=p_data->>'category',collection=p_data->>'collection' where id=p_product returning id into result;
 elsif p_action='delete' then
   perform 1 from public.ob_products where id=p_product for update;
   if exists(select 1 from public.ob_order_items i join public.ob_variants v on v.id=i.variant_id where v.product_id=p_product) then raise exception 'Este producto tiene pedidos. Puedes ocultarlo para conservar el historial.'; end if;
   delete from public.ob_variants where product_id=p_product;
   delete from public.ob_products where id=p_product returning id into result;
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
create function public.ob_product_manage(p_action text,p_product bigint default null,p_data jsonb default '{}') returns bigint language sql set search_path='' as $$select private.ob_product_manage(p_action,p_product,p_data)$$;
revoke all on function public.ob_product_manage(text,bigint,jsonb) from public,anon;
grant execute on function public.ob_product_manage(text,bigint,jsonb) to authenticated;
