-- Save only edited settings, rejecting stale changes to the same setting.
create function private.ob_settings_patch(p_value jsonb,p_expected jsonb) returns void
language plpgsql security definer set search_path='' as $$
declare current_value jsonb;k text;
begin
 if auth.uid() is null or not private.ob_is_admin() then raise exception 'Acceso denegado';end if;
 if jsonb_typeof(p_value) is distinct from 'object' or jsonb_typeof(p_expected) is distinct from 'object' then raise exception 'Configuración no válida';end if;
 select value into current_value from public.ob_settings where id for update;
 for k in select jsonb_object_keys(p_value) loop
  if not p_expected ? k or current_value->k is distinct from p_expected->k then
   raise exception 'Otro administrador cambió esta configuración. Vuelve a abrirla y revisa tus cambios.';
  end if;
 end loop;
 if p_value<>'{}'::jsonb then perform private.ob_settings_save(p_value);end if;
end $$;
revoke all on function private.ob_settings_patch(jsonb,jsonb) from public,anon;
grant execute on function private.ob_settings_patch(jsonb,jsonb) to authenticated;
create function public.ob_settings_patch(p_value jsonb,p_expected jsonb) returns void
language sql security invoker set search_path='' as $$select private.ob_settings_patch(p_value,p_expected)$$;
revoke all on function public.ob_settings_patch(jsonb,jsonb) from public,anon;
grant execute on function public.ob_settings_patch(jsonb,jsonb) to authenticated;
