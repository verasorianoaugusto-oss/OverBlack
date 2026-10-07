create or replace function private.ob_admin_report() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; threshold integer;
begin
 if not private.ob_is_admin() then raise exception 'Acceso denegado'; end if;
 select (value->>'low_stock')::integer into threshold from public.ob_settings where id;
 select jsonb_build_object(
 'customers',(select count(*) from public.ob_profiles),'games',(select count(*) from private.stack_games),
 'earned',(select coalesce(sum(delta),0) from public.ob_points_ledger where reason='stack'),
 'spent',(select coalesce(-sum(delta),0) from public.ob_points_ledger where reason='reserva_pedido'),
 'today',(select coalesce(sum(total),0) from public.ob_orders where status='entregado' and (created_at at time zone 'America/Lima')::date=(now() at time zone 'America/Lima')::date),
 'week',(select coalesce(sum(total),0) from public.ob_orders where status='entregado' and created_at>=now()-interval '7 days'),
 'month',(select coalesce(sum(total),0) from public.ob_orders where status='entregado' and created_at>=date_trunc('month',now() at time zone 'America/Lima') at time zone 'America/Lima'),
 'statuses',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from(select status,count(*) from public.ob_orders group by status)s),
 'low_stock',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from(select p.name,v.size,v.stock from public.ob_variants v join public.ob_products p on p.id=v.product_id where v.stock<=threshold and not p.archived order by v.stock limit 100)s),
 'best_sellers',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from(select i.name,sum(i.quantity) quantity from public.ob_order_items i join public.ob_orders o on o.id=i.order_id where o.status='entregado' group by i.name order by quantity desc limit 10)s),
 'mail_health',(select jsonb_build_object('last_run',last_run,'last_status',last_status) from private.mail_runtime where id),
 'pending_emails',(select count(*) from private.email_outbox where sent_at is null),
 'errors',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from(select id,order_id,attempts,last_error from private.email_outbox where sent_at is null order by order_id limit 100)s),
 'audit',(select coalesce(jsonb_agg(to_jsonb(s)),'[]') from(select * from private.admin_audit order by id desc limit 100)s),
 'manual',jsonb_build_array('PRODUCTOS: crea un producto inactivo, elige categoría y colección, carga foto, precio y cada talla con su stock. Activa la venta al terminar. Ocultar conserva el historial.','LIMA: revisa nombre, celular, distrito y dirección. Los pedidos se pagan contraentrega. Marca preparando, enviado y entregado cuando corresponda.','SHALOM: revisa destino y agencia. Confirma el adelanto solo cuando hayas comprobado su recepción. Después prepara y registra el envío. Coordina el flete con el cliente.','CANCELACIONES: cancelar restaura stock y puntos una sola vez. Si recibiste un adelanto, coordina y registra la devolución del dinero fuera del sistema; la web no mueve fondos.','STACK: el servidor guarda puntos e intentos. Los puntos locales antiguos no se aceptan como saldo confirmado.','ADMINISTRADORES: solo ADMIN GENERAL puede agregar, quitar o transferir permisos. Las transferencias requieren confirmación y quedan registradas.','CONFIGURACIÓN: completa entrega, textos y políticas antes de habilitar compras. No guardes contraseñas ni claves en los campos de la tienda.','ERRORES: los pedidos se guardan aunque falle el correo. Revisa pendientes en Centro de errores. Las copias de seguridad y recuperación de infraestructura requieren acceso al proveedor.')) into result;
 return result;
end $$;
revoke all on function private.ob_admin_report() from public,anon;
grant execute on function private.ob_admin_report() to authenticated;
create or replace function public.ob_admin_report() returns jsonb language sql set search_path='' as $$select private.ob_admin_report()$$;
revoke all on function public.ob_admin_report() from public,anon;
grant execute on function public.ob_admin_report() to authenticated;
