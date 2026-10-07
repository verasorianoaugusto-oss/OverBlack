alter table public.ob_products add column archived boolean not null default false;
alter table public.ob_products add constraint ob_archived_not_active check(not archived or not active);
create function private.ob_product_visibility(p_product bigint,p_hidden boolean) returns void language plpgsql security definer set search_path='' as $$
begin
if not private.ob_is_admin() then raise exception 'Acceso denegado'; end if;
update public.ob_products set archived=p_hidden,active=case when p_hidden then false else active end where id=p_product;
if not found then raise exception 'Producto inexistente'; end if;
end $$;
revoke all on function private.ob_product_visibility(bigint,boolean) from public,anon;
grant execute on function private.ob_product_visibility(bigint,boolean) to authenticated;
create function public.ob_product_visibility(p_product bigint,p_hidden boolean) returns void language sql security invoker set search_path='' as $$select private.ob_product_visibility(p_product,p_hidden)$$;
revoke all on function public.ob_product_visibility(bigint,boolean) from public,anon;
grant execute on function public.ob_product_visibility(bigint,boolean) to authenticated;
