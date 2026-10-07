create or replace function private.ob_validate_settings() returns trigger
language plpgsql set search_path='' as $$
declare k text; v jsonb:=new.value;
begin
 if jsonb_typeof(v) is distinct from 'object' then raise exception 'Configuración no válida'; end if;
 for k in select jsonb_object_keys(v) loop
  if k <> all(array['store_name','checkout_enabled','maintenance','lima_enabled','province_enabled','lima_fee','deposit_percent','low_stock','daily_games','normal_points','perfect_points','rewards','whatsapp','instagram','tiktok','announcement','shalom_instructions','email_signature','faq','privacy','terms','returns','shipping_policy']) then
   raise exception 'Opción de configuración desconocida: %',k;
  end if;
 end loop;
 foreach k in array array['store_name','whatsapp','instagram','tiktok','announcement','shalom_instructions','email_signature','faq','privacy','terms','returns','shipping_policy'] loop
  if jsonb_typeof(v->k) is distinct from 'string' or length(v->>k)>4000 then raise exception 'Texto no válido: %',k; end if;
 end loop;
 if length(trim(v->>'store_name')) not between 1 and 80 then raise exception 'Nombre de tienda no válido'; end if;
 if v->>'whatsapp' !~ '^[0-9]{8,15}$' then raise exception 'WhatsApp debe contener código de país y número, solo dígitos'; end if;
 if v->>'instagram' !~ '^https://(www\.)?instagram\.com/[^[:space:]]*$' or v->>'tiktok' !~ '^https://(www\.)?tiktok\.com/[^[:space:]]*$' then raise exception 'Usa enlaces HTTPS de Instagram y TikTok'; end if;
 foreach k in array array['deposit_percent','low_stock','daily_games','normal_points','perfect_points'] loop
  if coalesce(v->>k,'') !~ '^[0-9]+$' then raise exception 'Usa un número entero: %',k; end if;
 end loop;
 if v->>'lima_fee' is not null and v->>'lima_fee' !~ '^[0-9]+$' then raise exception 'Tarifa no válida'; end if;
 return new;
end $$;
revoke all on function private.ob_validate_settings() from public,anon,authenticated;
create trigger ob_settings_validate before insert or update on public.ob_settings
for each row execute function private.ob_validate_settings();
