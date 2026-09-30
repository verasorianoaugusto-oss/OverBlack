-- Preserve the existing atomic status/cancellation function.
do $$
declare definition text; marker text:='if p_status is null then raise exception ''Estado no válido''; end if;';
begin
 select pg_get_functiondef('private.ob_order_status(bigint,text)'::regprocedure) into definition;
 if position(marker in definition)=0 then raise exception 'Review changed status function';end if;
 execute replace(definition,marker,marker||' if p_status=''enviado'' and o.payment_method=''shalom_adelanto'' and nullif(trim(o.tracking),'''') is null then raise exception ''Guarda el código o referencia de Shalom antes de marcar enviado'';end if;');
end $$;

-- Do not create duplicate timeline entries when the same reference is saved twice.
create or replace function private.ob_tracking(p_order bigint,p_tracking text) returns void
language plpgsql security definer set search_path='' as $$
declare o public.ob_orders;
begin
 if auth.uid() is null or not private.ob_is_admin() then raise exception 'Acceso denegado';end if;
 if p_tracking is null or length(trim(p_tracking)) not between 1 and 100 then raise exception 'Código de envío no válido';end if;
 select * into o from public.ob_orders where id=p_order for update;
 if not found or o.status not in('preparando','enviado') then raise exception 'El pedido debe estar preparando o enviado';end if;
 if o.tracking is not distinct from trim(p_tracking) then return;end if;
 update public.ob_orders set tracking=trim(p_tracking) where id=p_order;
 insert into private.order_events(order_id,actor,status) values(p_order,auth.uid(),'tracking_actualizado');
end $$;
