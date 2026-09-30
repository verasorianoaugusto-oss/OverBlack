-- Reuse the private audit trail for stock movements; do not duplicate inventory.
alter table private.admin_audit add column details jsonb not null default '{}';
create index ob_stock_audit_product on private.admin_audit ((details->>'product_id'),id desc) where action='stock:movement';
create function private.ob_record_stock() returns trigger language plpgsql security definer set search_path='' as $$
declare item public.ob_variants; before_stock integer; after_stock integer; actor_id uuid; reason text; product_name text;
begin
 if TG_OP='DELETE' then item:=old;before_stock:=old.stock;after_stock:=0;
 elsif TG_OP='INSERT' then item:=new;before_stock:=0;after_stock:=new.stock;
 else item:=new;before_stock:=old.stock;after_stock:=new.stock;if before_stock=after_stock then return new;end if;
 end if;
 actor_id:=coalesce(auth.uid(),'00000000-0000-0000-0000-000000000000'::uuid);
 reason:=coalesce(nullif(current_setting('overblack.stock_reason',true),''),case TG_OP when 'INSERT' then 'talla_creada' when 'DELETE' then 'talla_eliminada' else 'ajuste_admin' end);
 select name into product_name from public.ob_products where id=item.product_id;
 insert into private.admin_audit(actor,target,action,details) values(actor_id,actor_id,'stock:movement',jsonb_build_object('product_id',item.product_id,'variant_id',item.id,'product_name',product_name,'size',item.size,'before',before_stock,'after',after_stock,'delta',after_stock-before_stock,'reason',reason,'order_id',nullif(current_setting('overblack.stock_order',true),'')));
 if TG_OP='DELETE' then return old;end if;return new;
end $$;
revoke all on function private.ob_record_stock() from public,anon,authenticated;
create trigger ob_stock_movement after insert or update or delete on public.ob_variants for each row execute function private.ob_record_stock();

-- Annotate the existing atomic checkout/cancellation, preserving their logic.
do $$
declare definition text; marker text; replacement text;
begin
 marker:='update public.ob_variants v set stock=v.stock-i.quantity from public.ob_order_items i where i.order_id=v_order_id and v.id=i.variant_id;';
 select pg_get_functiondef('private.ob_checkout(jsonb,jsonb,integer,uuid,boolean)'::regprocedure) into definition;
 if position(marker in definition)=0 then raise exception 'Checkout changed; review stock annotation';end if;
 replacement:='perform set_config(''overblack.stock_reason'',''pedido'',true); perform set_config(''overblack.stock_order'',v_order_id::text,true);'||marker||'perform set_config(''overblack.stock_reason'','''',true); perform set_config(''overblack.stock_order'','''',true);';
 execute replace(definition,marker,replacement);
 marker:='update public.ob_variants v set stock=v.stock+i.quantity from public.ob_order_items i where i.order_id=o.id and i.variant_id=v.id;';
 select pg_get_functiondef('private.ob_order_status(bigint,text)'::regprocedure) into definition;
 if position(marker in definition)=0 then raise exception 'Cancellation changed; review stock annotation';end if;
 replacement:='perform set_config(''overblack.stock_reason'',''cancelacion'',true); perform set_config(''overblack.stock_order'',o.id::text,true);'||marker||'perform set_config(''overblack.stock_reason'','''',true); perform set_config(''overblack.stock_order'','''',true);';
 execute replace(definition,marker,replacement);
end $$;

create function private.ob_stock_history(p_product bigint,p_page integer default 0) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not private.ob_is_admin() then raise exception 'Acceso denegado';end if;
 if p_page is null or p_page<0 or p_page>100000 then raise exception 'Página no válida';end if;
 select coalesce(jsonb_agg(to_jsonb(e) order by e.id desc),'[]') into result from (
 select a.id,a.created_at,a.details,coalesce(p.username,'Sistema') as actor_name from private.admin_audit a left join public.ob_profiles p on p.id=a.actor
 where a.action='stock:movement' and a.details->>'product_id'=p_product::text order by a.id desc limit 51 offset p_page*50
 ) e;
 return result;
end $$;
revoke all on function private.ob_stock_history(bigint,integer) from public,anon;
grant execute on function private.ob_stock_history(bigint,integer) to authenticated;
create function public.ob_stock_history(p_product bigint,p_page integer default 0) returns jsonb language sql security invoker set search_path='' as $$select private.ob_stock_history(p_product,p_page)$$;
revoke all on function public.ob_stock_history(bigint,integer) from public,anon;
grant execute on function public.ob_stock_history(bigint,integer) to authenticated;
