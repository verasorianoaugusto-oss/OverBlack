-- Read the existing event journal; no duplicate history table.
create index order_events_order_page_idx on private.order_events(order_id,id desc);
create function private.ob_order_history(p_order bigint,p_page integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not exists(select 1 from public.ob_orders where id=p_order and (user_id=auth.uid() or private.ob_is_admin())) then
  raise exception 'Pedido no disponible';
 end if;
 if p_page is null or p_page<0 or p_page>100000 then raise exception 'Página no válida';end if;
 select coalesce(jsonb_agg(to_jsonb(e) order by e.id desc),'[]'::jsonb) into result from (
  select id,status,created_at from private.order_events where order_id=p_order order by id desc limit 51 offset p_page*50
 ) e;
 return result;
end $$;
revoke all on function private.ob_order_history(bigint,integer) from public,anon;
grant execute on function private.ob_order_history(bigint,integer) to authenticated;
create function public.ob_order_history(p_order bigint,p_page integer default 0) returns jsonb
language sql security invoker set search_path='' as $$select private.ob_order_history(p_order,p_page)$$;
revoke all on function public.ob_order_history(bigint,integer) from public,anon;
grant execute on function public.ob_order_history(bigint,integer) to authenticated;
