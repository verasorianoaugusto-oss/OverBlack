alter table public.ob_orders drop constraint ob_orders_status_check;
alter table public.ob_orders add constraint ob_orders_status_check check(status in('nuevo','confirmado','pendiente_adelanto','adelanto_confirmado','preparando','enviado','entregado','cancelado'));
do $$
declare definition text;a text;b text;c text;
begin
 select pg_get_functiondef('private.ob_order_status(bigint,text)'::regprocedure) into definition;
 a:='o.status=''nuevo'' and p_status in(''preparando'',''cancelado'')';
 b:='o.status=''adelanto_confirmado'' and p_status in(''preparando'',''cancelado'')';
 c:='(o.status=''enviado'' and p_status in(''entregado'',''cancelado''))';
 if position(a in definition)=0 or position(b in definition)=0 or position(c in definition)=0 then raise exception 'Review changed order transitions';end if;
 definition:=replace(definition,a,'o.status=''nuevo'' and p_status in(''confirmado'',''preparando'',''cancelado'')');
 definition:=replace(definition,b,'o.status=''adelanto_confirmado'' and p_status in(''confirmado'',''preparando'',''cancelado'')');
 definition:=replace(definition,c,c||' or (o.status=''confirmado'' and p_status in(''preparando'',''cancelado''))');
 execute definition;
end $$;
