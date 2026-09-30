-- Extend the existing protected ADMIN report using the current orders/ledger.
do $$
declare definition text;marker text:='return result;';
begin
 select pg_get_functiondef('private.ob_admin_report()'::regprocedure) into definition;
 if position(marker in definition)=0 then raise exception 'Review changed admin report';end if;
 execute replace(definition,marker,$replacement$
 return result||jsonb_build_object(
  'returned_points',(select coalesce(sum(delta),0) from public.ob_points_ledger where reason='devolucion_pedido'),
  'delivered_discounts',(select coalesce(sum(discount),0) from public.ob_orders where status='entregado'),
  'coupon_usage',(select coalesce(jsonb_agg(to_jsonb(s)),'[]'::jsonb) from (
   select delivery->>'coupon' as code,
    count(*) filter(where status<>'cancelado') as active_orders,
    count(*) filter(where status='entregado') as delivered_orders,
    count(*) filter(where status='cancelado') as cancelled_orders,
    coalesce(sum(discount) filter(where status='entregado'),0) as delivered_discount
   from public.ob_orders where nullif(delivery->>'coupon','') is not null group by delivery->>'coupon'
  ) s)
 );
 $replacement$);
end $$;
