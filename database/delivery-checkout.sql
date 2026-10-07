alter table public.ob_orders drop constraint ob_orders_status_check;
alter table public.ob_orders add constraint ob_orders_status_check check(status in ('nuevo','pendiente_adelanto','adelanto_confirmado','preparando','enviado','entregado','cancelado'));
alter table public.ob_orders drop constraint ob_orders_payment_method_check;
alter table public.ob_orders add constraint ob_orders_payment_method_check check(payment_method in ('contra_entrega','shalom_adelanto'));
alter table public.ob_orders add column advance_due integer not null default 0 check(advance_due>=0);
alter table public.ob_orders add column tracking text;
alter table public.ob_orders drop constraint ob_orders_points_spent_check;
alter table public.ob_orders add constraint ob_orders_points_spent_check check(points_spent>=0);
create or replace function private.ob_checkout(p_items jsonb,p_delivery jsonb,p_reward integer default 0,p_request uuid default null,p_commit boolean default false)
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); balance integer; ship public.ob_shipping; item record;
 subtotal integer:=0; discount integer; percent integer; result jsonb; existing public.ob_orders;
 v_order_id bigint; lines jsonb:='[]'; delivery jsonb; n integer; config jsonb; mode text; fee integer; deposit integer; coupon public.ob_coupons;
begin
 if uid is null then raise exception 'Inicia sesión para comprar'; end if;
 select points into strict balance from public.ob_profiles where id=uid for update;
 if p_commit then
   if p_request is null then raise exception 'Falta identificador del pedido'; end if;
   select * into existing from public.ob_orders where user_id=uid and request_id=p_request;
   if found then return to_jsonb(existing)||jsonb_build_object('code','#OB-'||lpad(existing.id::text,greatest(5,length(existing.id::text)),'0')); end if;
 end if;
 select value into config from public.ob_settings where id;
 if p_reward is null or (p_reward<>0 and not exists(select 1 from jsonb_array_elements(config->'rewards') r where (r->>0)::integer=p_reward)) then raise exception 'Recompensa no válida'; end if;
 if balance<p_reward then raise exception 'No tienes suficientes puntos'; end if;
 select value into config from public.ob_settings where id;
 if not (config->>'checkout_enabled')::boolean or (config->>'maintenance')::boolean then raise exception 'Las compras no están disponibles en este momento'; end if;
 select coalesce(max((r->>1)::integer),0) into percent from jsonb_array_elements(config->'rewards') r where (r->>0)::integer=p_reward;
 if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'Carrito no válido'; end if;
 if jsonb_array_length(p_items) not between 1 and 30 then raise exception 'Carrito vacío o demasiado grande'; end if;
 if exists(select 1 from jsonb_array_elements(p_items) e where jsonb_typeof(e->'quantity') is distinct from 'number' or (e->>'quantity') !~ '^[0-9]+$' or (e->>'quantity')::numeric not between 1 and 20 or e->>'variant_id' is null) then raise exception 'Cantidad no válida'; end if;
 if (select count(distinct e->>'variant_id') from jsonb_array_elements(p_items) e)<>jsonb_array_length(p_items) then raise exception 'Variantes duplicadas'; end if;
 mode:=p_delivery->>'mode';
 if mode is null or mode not in ('lima','shalom') then raise exception 'Selecciona Lima o provincias por Shalom'; end if;
 if mode='lima' and (not (config->>'lima_enabled')::boolean or config->>'lima_fee' is null) then raise exception 'Entrega Lima no disponible'; end if;
 if mode='shalom' and not (config->>'province_enabled')::boolean then raise exception 'Envíos a provincias no disponibles'; end if;
 if length(trim(coalesce(p_delivery->>'recipient',''))) not between 3 and 150 or coalesce(p_delivery->>'phone','') !~ '^[+]?[0-9 ()-]{9,20}$' then raise exception 'Completa nombre y celular'; end if;
 if mode='lima' and (length(trim(coalesce(p_delivery->>'district',''))) not between 2 and 80 or length(trim(coalesce(p_delivery->>'address',''))) not between 5 and 250) then raise exception 'Completa distrito y dirección de Lima Metropolitana'; end if;
 if mode='shalom' and (length(trim(coalesce(p_delivery->>'destination',''))) not between 3 and 150 or length(trim(coalesce(p_delivery->>'agency',''))) not between 3 and 150) then raise exception 'Completa destino y agencia Shalom'; end if;
 if length(coalesce(p_delivery->>'reference',''))>250 then raise exception 'Referencia demasiado larga'; end if;
 fee:=case when mode='lima' then (config->>'lima_fee')::integer else 0 end;
 delivery:=jsonb_build_object('mode',mode,'recipient',trim(p_delivery->>'recipient'),'phone',p_delivery->>'phone','district',case when mode='lima' then trim(p_delivery->>'district') else null end,'address',case when mode='lima' then trim(p_delivery->>'address') else null end,'destination',case when mode='shalom' then trim(p_delivery->>'destination') else null end,'agency',case when mode='shalom' then trim(p_delivery->>'agency') else null end,'reference',coalesce(p_delivery->>'reference',''));
 if nullif(trim(p_delivery->>'coupon'),'') is not null then
   if p_reward<>0 then raise exception 'Elige cupón o puntos; no se acumulan'; end if;
   select * into coupon from public.ob_coupons where code=upper(trim(p_delivery->>'coupon')) and active and expires_at>now() for share;
   if not found then raise exception 'Cupón no válido o vencido'; end if;
   percent:=coupon.percent;delivery:=delivery||jsonb_build_object('coupon',coupon.code);
 end if;
 -- Lock every requested product first, then every variant, deterministically.
 perform 1 from public.ob_products p where p.id in(select v.product_id from public.ob_variants v join jsonb_array_elements(p_items) e on v.id=(e->>'variant_id')::uuid) order by p.id for share;
 n:=0;
 for item in select v.id,v.size,v.stock,p.name,p.price,p.active,(e->>'quantity')::integer as quantity
   from jsonb_array_elements(p_items) e join public.ob_variants v on v.id=(e->>'variant_id')::uuid
   join public.ob_products p on p.id=v.product_id order by v.id for update of v loop
   n:=n+1;
   if not item.active or item.price is null then raise exception 'Producto no disponible'; end if;
   if item.stock<item.quantity then raise exception 'Stock insuficiente para % / %',item.name,item.size; end if;
   subtotal:=subtotal+item.price*item.quantity;
   lines:=lines||jsonb_build_array(jsonb_build_object('variant_id',item.id,'name',item.name,'size',item.size,'quantity',item.quantity,'unit_price',item.price));
 end loop;
 if n<>jsonb_array_length(p_items) then raise exception 'Hay productos no válidos'; end if;
 discount:=floor(subtotal::numeric*percent/100);
 deposit:=case when mode='shalom' then ceil((subtotal+fee-discount)::numeric*(config->>'deposit_percent')::numeric/100)::integer else 0 end;
 result:=jsonb_build_object('subtotal',subtotal,'shipping',fee,'discount',discount,'total',subtotal+fee-discount,'points_spent',p_reward,'points_after',balance-p_reward,'items',lines,'delivery',delivery,'advance_due',deposit);
 if not p_commit then return result; end if;
 -- Require the exact reviewed total; price/fee changes require a new review.
 if (p_delivery->>'expected_total') is null or (p_delivery->>'expected_total')::integer<>subtotal+fee-discount then raise exception 'El total cambió. Revisa nuevamente tu pedido.'; end if;
 if mode='shalom' and (p_delivery->>'expected_advance')::integer is distinct from deposit then raise exception 'El adelanto cambió. Revisa nuevamente tu pedido.'; end if;
 insert into public.ob_orders(user_id,request_id,subtotal,shipping,discount,total,points_spent,delivery,status,payment_method,advance_due)
 values(uid,p_request,subtotal,fee,discount,subtotal+fee-discount,p_reward,delivery,case when mode='shalom' then 'pendiente_adelanto' else 'nuevo' end,case when mode='shalom' then 'shalom_adelanto' else 'contra_entrega' end,deposit) returning id into v_order_id;
 insert into public.ob_order_items select v_order_id,(e->>'variant_id')::uuid,e->>'name',e->>'size',(e->>'quantity')::integer,(e->>'unit_price')::integer from jsonb_array_elements(lines) e;
 update public.ob_variants v set stock=v.stock-i.quantity from public.ob_order_items i where i.order_id=v_order_id and v.id=i.variant_id;
 update public.ob_profiles set points=points-p_reward where id=uid;
 if p_reward>0 then insert into public.ob_points_ledger(user_id,delta,reason,reference) values(uid,-p_reward,'reserva_pedido',v_order_id::text); end if;
 insert into private.email_outbox(order_id) values(v_order_id) on conflict do nothing;
 insert into private.order_events(order_id,actor,status) values(v_order_id,uid,case when mode='shalom' then 'pendiente_adelanto' else 'nuevo' end);
 return result||jsonb_build_object('id',v_order_id,'code','#OB-'||lpad(v_order_id::text,greatest(5,length(v_order_id::text)),'0'),'status',case when mode='shalom' then 'pendiente_adelanto' else 'nuevo' end);
end $$;

create or replace function private.ob_order_status(p_order bigint,p_status text) returns void language plpgsql security definer set search_path='' as $$
declare o public.ob_orders;
begin
 if not public.ob_is_admin() then raise exception 'Acceso denegado'; end if;
 select * into strict o from public.ob_orders where id=p_order;
 perform 1 from public.ob_profiles where id=o.user_id for update;
 select * into strict o from public.ob_orders where id=p_order for update;
 if o.status=p_status then return; end if;
 if p_status is null then raise exception 'Estado no válido'; end if;
 if not ((o.status='pendiente_adelanto' and p_status in('adelanto_confirmado','cancelado')) or (o.status='adelanto_confirmado' and p_status in('preparando','cancelado')) or (o.status='nuevo' and p_status in('preparando','cancelado')) or (o.status='preparando' and p_status in('enviado','cancelado')) or (o.status='enviado' and p_status in('entregado','cancelado'))) then raise exception 'Cambio de estado no permitido'; end if;
 if p_status='cancelado' then
   -- Same lock order as checkout (profile then sorted variants).
   perform 1 from public.ob_profiles where id=o.user_id for update;
   perform 1 from public.ob_variants v join public.ob_order_items i on i.variant_id=v.id where i.order_id=o.id order by v.id for update of v;
   update public.ob_variants v set stock=v.stock+i.quantity from public.ob_order_items i where i.order_id=o.id and i.variant_id=v.id;
   update public.ob_profiles set points=points+o.points_spent where id=o.user_id;
   if o.points_spent>0 then insert into public.ob_points_ledger(user_id,delta,reason,reference) values(o.user_id,o.points_spent,'devolucion_pedido',o.id::text); end if;
 end if;
 update public.ob_orders set status=p_status where id=o.id;
 insert into private.order_events(order_id,actor,status) values(o.id,auth.uid(),p_status);
end $$;

