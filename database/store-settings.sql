create table public.ob_settings (
 id boolean primary key default true check(id),
 value jsonb not null,
 updated_at timestamptz not null default now()
);
insert into public.ob_settings(value) values('{"store_name":"OVERBLACK","checkout_enabled":false,"maintenance":false,"lima_enabled":true,"province_enabled":true,"lima_fee":null,"deposit_percent":50,"low_stock":3,"daily_games":5,"normal_points":2,"perfect_points":5,"rewards":[[2500,5],[5000,10],[10000,15]],"whatsapp":"51981947363","instagram":"https://www.instagram.com/overblack160926/","tiktok":"https://www.tiktok.com/@overblack2026","announcement":"","shalom_instructions":"Coordina tu agencia Shalom con OVERBLACK.","email_signature":"OVERBLACK","faq":"","privacy":"","terms":"","returns":"","shipping_policy":""}');
alter table public.ob_settings enable row level security;
revoke all on public.ob_settings from public,anon,authenticated;
grant select on public.ob_settings to anon,authenticated;
create policy settings_read on public.ob_settings for select to anon,authenticated using(true);
create function private.ob_settings_save(p_value jsonb) returns void language plpgsql security definer set search_path='' as $$
declare val jsonb; k text;
begin
 if not private.ob_is_admin() then raise exception 'Acceso denegado'; end if;
 select value||p_value into val from public.ob_settings where id for update;
 if jsonb_typeof(p_value) is distinct from 'object' then raise exception 'Configuración no válida'; end if;
 foreach k in array array['checkout_enabled','maintenance','lima_enabled','province_enabled'] loop
  if jsonb_typeof(val->k) is distinct from 'boolean' then raise exception 'Opción no válida: %',k; end if;
 end loop;
 foreach k in array array['deposit_percent','daily_games','normal_points','perfect_points','low_stock'] loop
  if jsonb_typeof(val->k) is distinct from 'number' then raise exception 'Número no válido: %',k; end if;
 end loop;
 if (val->>'deposit_percent')::numeric not between 1 and 100 or (val->>'daily_games')::integer not between 1 and 20 or (val->>'normal_points')::integer not between 1 and 20 or (val->>'perfect_points')::integer not between 1 and 50 or (val->>'low_stock')::integer not between 0 and 100 then raise exception 'Revisa los límites de configuración'; end if;
 if val->>'lima_fee' is not null and ((val->>'lima_fee')::integer not between 0 and 1000000) then raise exception 'Tarifa no válida'; end if;
 if length(val->>'store_name') not between 1 and 80 or length(val::text)>30000 then raise exception 'Textos demasiado largos'; end if;
 if jsonb_typeof(val->'rewards') is distinct from 'array' then raise exception 'Recompensas no válidas'; end if;
 if jsonb_array_length(val->'rewards') not between 1 and 10 then raise exception 'Define entre 1 y 10 recompensas'; end if;
 if exists(select 1 from jsonb_array_elements(val->'rewards') r where jsonb_typeof(r) is distinct from 'array') then raise exception 'Recompensas no válidas'; end if;
 if exists(select 1 from jsonb_array_elements(val->'rewards') r where jsonb_array_length(r)<>2 or coalesce(r->>0,'') !~ '^[0-9]+$' or coalesce(r->>1,'') !~ '^[0-9]+$') then raise exception 'Usa puntos y porcentaje enteros'; end if;
 if exists(select 1 from jsonb_array_elements(val->'rewards') r where (r->>0)::numeric not between 1 and 1000000 or (r->>1)::numeric not between 1 and 50) then raise exception 'Revisa puntos y descuentos'; end if;
 if (select count(distinct r->>0) from jsonb_array_elements(val->'rewards') r)<>jsonb_array_length(val->'rewards') then raise exception 'No repitas niveles de puntos'; end if;
 update public.ob_settings set value=val,updated_at=now() where id;
 insert into private.admin_audit(actor,target,action) values(auth.uid(),auth.uid(),'settings:update');
end $$;
revoke all on function private.ob_settings_save(jsonb) from public,anon;
grant execute on function private.ob_settings_save(jsonb) to authenticated;
create function public.ob_settings_save(p_value jsonb) returns void language sql set search_path='' as $$select private.ob_settings_save(p_value)$$;
revoke all on function public.ob_settings_save(jsonb) from public,anon;
grant execute on function public.ob_settings_save(jsonb) to authenticated;

create table public.ob_coupons(code text primary key check(code ~ '^[A-Z0-9_-]{3,30}$'),percent integer not null check(percent between 1 and 50),expires_at timestamptz not null,active boolean not null default true);
alter table public.ob_coupons enable row level security;
revoke all on public.ob_coupons from public,anon,authenticated;
grant select on public.ob_coupons to authenticated;
create policy coupons_admin_read on public.ob_coupons for select to authenticated using((select private.ob_is_admin()));
create function private.ob_coupon_save(p_code text,p_percent integer,p_expires timestamptz,p_active boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.ob_is_admin() then raise exception 'Acceso denegado'; end if;
 insert into public.ob_coupons values(upper(trim(p_code)),p_percent,p_expires,p_active) on conflict(code) do update set percent=excluded.percent,expires_at=excluded.expires_at,active=excluded.active;
 insert into private.admin_audit(actor,target,action) values(auth.uid(),auth.uid(),'coupon:'||upper(trim(p_code)));
end $$;
revoke all on function private.ob_coupon_save(text,integer,timestamptz,boolean) from public,anon;
grant execute on function private.ob_coupon_save(text,integer,timestamptz,boolean) to authenticated;
create function public.ob_coupon_save(p_code text,p_percent integer,p_expires timestamptz,p_active boolean) returns void language sql set search_path='' as $$select private.ob_coupon_save(p_code,p_percent,p_expires,p_active)$$;
revoke all on function public.ob_coupon_save(text,integer,timestamptz,boolean) from public,anon;
grant execute on function public.ob_coupon_save(text,integer,timestamptz,boolean) to authenticated;
