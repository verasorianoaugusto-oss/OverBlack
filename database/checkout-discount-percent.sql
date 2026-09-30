do $$
declare definition text;marker text:='''discount'',discount,''total''';
begin
 select pg_get_functiondef('private.ob_checkout(jsonb,jsonb,integer,uuid,boolean)'::regprocedure) into definition;
 if position(marker in definition)=0 then raise exception 'Review changed checkout result';end if;
 execute replace(definition,marker,'''discount'',discount,''discount_percent'',percent,''total''');
end $$;
