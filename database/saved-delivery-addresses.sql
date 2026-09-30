-- Geography reference: INEI/PCM province of Lima (43 districts).
-- https://www.gob.pe/institucion/pcm/campa%C3%B1as/4355-lima-metropolitana-informacion-territorial
create function public.ob_delivery_options() returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object(
 'departments',array['Amazonas','Áncash','Apurímac','Arequipa','Ayacucho','Cajamarca','Callao','Cusco','Huancavelica','Huánuco','Ica','Junín','La Libertad','Lambayeque','Lima','Loreto','Madre de Dios','Moquegua','Pasco','Piura','Puno','San Martín','Tacna','Tumbes','Ucayali'],
 'lima_provinces',array['Barranca','Cajatambo','Canta','Cañete','Huaral','Huarochirí','Huaura','Lima','Oyón','Yauyos'],
 'lima_districts',array['Lima','Ancón','Ate','Barranco','Breña','Carabayllo','Chaclacayo','Chorrillos','Cieneguilla','Comas','El Agustino','Independencia','Jesús María','La Molina','La Victoria','Lince','Los Olivos','Lurigancho','Lurín','Magdalena del Mar','Miraflores','Pachacámac','Pucusana','Pueblo Libre','Puente Piedra','Punta Hermosa','Punta Negra','Rímac','San Bartolo','San Borja','San Isidro','San Juan de Lurigancho','San Juan de Miraflores','San Luis','San Martín de Porres','San Miguel','Santa Anita','Santa María del Mar','Santa Rosa','Santiago de Surco','Surquillo','Villa El Salvador','Villa María del Triunfo']);
$$;
revoke all on function public.ob_delivery_options() from public;
grant execute on function public.ob_delivery_options() to anon,authenticated;

create function private.ob_validate_delivery(d jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare opts jsonb:=public.ob_delivery_options(); dept text; province text; district text; expected_mode text;
begin
 if jsonb_typeof(d) is distinct from 'object' then raise exception 'Completa los datos de entrega';end if;
 -- Preserve old Lima clients during the incremental publication.
 dept:=trim(coalesce(d->>'department',case when d->>'mode'='lima' then 'Lima' end));
 province:=trim(coalesce(d->>'province',case when d->>'mode'='lima' then 'Lima' end));
 select value into dept from jsonb_array_elements_text(opts->'departments') where lower(value)=lower(dept);
 if dept is null then raise exception 'Selecciona el departamento o región de entrega';end if;
 if length(coalesce(province,'')) not between 2 and 80 then raise exception 'Completa la provincia';end if;
 if dept='Lima' then
  select value into province from jsonb_array_elements_text(opts->'lima_provinces') where lower(value)=lower(province);
  if province is null then raise exception 'Selecciona una provincia válida de Lima';end if;
 end if;
 expected_mode:=case when dept='Lima' and province='Lima' then 'lima' else 'shalom' end;
 if d->>'mode' is not null and d->>'mode'<>expected_mode then raise exception 'La modalidad no corresponde al destino. Revisa la entrega.';end if;
 if length(trim(coalesce(d->>'recipient',''))) not between 3 and 150 or coalesce(d->>'phone','') !~ '^[+]?[0-9 ()-]{9,20}$' then raise exception 'Completa nombre y celular';end if;
 if length(coalesce(d->>'reference',''))>250 then raise exception 'Referencia demasiado larga';end if;
 if expected_mode='lima' then
  district:=trim(d->>'district');if lower(district)='cercado de lima' then district:='Lima';end if;
  select value into district from jsonb_array_elements_text(opts->'lima_districts') where lower(value)=lower(district);
  if district is null then raise exception 'Selecciona un distrito de Lima Metropolitana';end if;
  if length(trim(coalesce(d->>'address',''))) not between 5 and 250 then raise exception 'Completa la dirección de entrega';end if;
 else
  if length(trim(coalesce(d->>'destination',''))) not between 3 and 150 or length(trim(coalesce(d->>'agency',''))) not between 3 and 150 then raise exception 'Completa ciudad y agencia Shalom';end if;
 end if;
 return d||jsonb_build_object('department',dept,'province',province,'district',district,'mode',expected_mode,'recipient',trim(d->>'recipient'),'reference',coalesce(d->>'reference',''));
end $$;
revoke all on function private.ob_validate_delivery(jsonb) from public,anon,authenticated;

alter table public.ob_addresses alter column shipping_id drop not null;
alter table public.ob_addresses add column delivery_details jsonb not null default '{}' check(jsonb_typeof(delivery_details)='object');
alter table public.ob_addresses drop constraint ob_addresses_address_check;
alter table public.ob_addresses add constraint ob_addresses_address_check check(length(address)<=250 and (length(address)>=5 or coalesce(delivery_details->>'mode'='shalom',false)));
revoke insert,update,delete on public.ob_addresses from authenticated;

create function private.ob_address_book(p_action text default 'list',p_id uuid default null,p_delivery jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); d jsonb; result uuid; info jsonb;
begin
 if uid is null then raise exception 'Inicia sesión para gestionar direcciones';end if;
 if p_action='list' then
  return (select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'delivery',a.delivery_details||jsonb_build_object('recipient',a.recipient,'phone',a.phone,'address',a.address,'reference',a.reference)) order by a.id),'[]') from public.ob_addresses a where a.user_id=uid);
 end if;
 perform 1 from public.ob_profiles where id=uid for update;
 if p_action='delete' then
  delete from public.ob_addresses where id=p_id and user_id=uid returning id into result;
  if result is null then raise exception 'Dirección inexistente';end if;
  return jsonb_build_object('id',result);
 elsif p_action='save' then
  d:=private.ob_validate_delivery(p_delivery);
  info:=jsonb_build_object('mode',d->>'mode','department',d->>'department','province',d->>'province','district',d->>'district','destination',d->>'destination','agency',d->>'agency');
  if p_id is null then
   if (select count(*) from public.ob_addresses where user_id=uid)>=10 then raise exception 'Puedes guardar hasta 10 direcciones. Edita o elimina una para añadir otra.';end if;
   insert into public.ob_addresses(user_id,recipient,phone,address,reference,delivery_details) values(uid,d->>'recipient',d->>'phone',case when d->>'mode'='lima' then trim(d->>'address') else '' end,d->>'reference',info) returning id into result;
  else
   update public.ob_addresses set recipient=d->>'recipient',phone=d->>'phone',address=case when d->>'mode'='lima' then trim(d->>'address') else '' end,reference=d->>'reference',delivery_details=info,shipping_id=null where id=p_id and user_id=uid returning id into result;
   if result is null then raise exception 'Dirección inexistente';end if;
  end if;
  return jsonb_build_object('id',result);
 end if;
 raise exception 'Acción no válida';
end $$;
revoke all on function private.ob_address_book(text,uuid,jsonb) from public,anon;
grant execute on function private.ob_address_book(text,uuid,jsonb) to authenticated;
create function public.ob_address_book(p_action text default 'list',p_id uuid default null,p_delivery jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select private.ob_address_book(p_action,p_id,p_delivery)$$;
revoke all on function public.ob_address_book(text,uuid,jsonb) from public,anon;
grant execute on function public.ob_address_book(text,uuid,jsonb) to authenticated;

do $$
declare definition text; marker text;
begin
 select pg_get_functiondef('private.ob_checkout(jsonb,jsonb,integer,uuid,boolean)'::regprocedure) into definition;
 marker:='mode:=p_delivery->>''mode'';';
 if position(marker in definition)=0 then raise exception 'Checkout changed; review delivery validation';end if;
 definition:=replace(definition,marker,'p_delivery:=private.ob_validate_delivery(p_delivery);'||marker);
 marker:='delivery:=jsonb_build_object(''mode'',mode,';
 if position(marker in definition)=0 then raise exception 'Checkout changed; review delivery snapshot';end if;
 definition:=replace(definition,marker,'delivery:=jsonb_build_object(''department'',p_delivery->>''department'',''province'',p_delivery->>''province'',''mode'',mode,');
 execute definition;
end $$;
