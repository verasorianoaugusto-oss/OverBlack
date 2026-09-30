-- Reads the existing ledger; no second balance or duplicated movements.
create or replace function private.ob_points_history(p_user uuid default null,p_page integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare uid uuid:=coalesce(p_user,auth.uid()); result jsonb;
begin
 if auth.uid() is null or (uid<>auth.uid() and not private.ob_is_admin()) then raise exception 'Acceso denegado'; end if;
 if p_page is null or p_page<0 or p_page>100000 then raise exception 'Página no válida'; end if;
 select jsonb_build_object('balance',p.points,'total',(select count(*) from public.ob_points_ledger where user_id=uid),
 'movements',(select coalesce(jsonb_agg(to_jsonb(x) order by x.id desc),'[]'::jsonb) from (
   select l.id,l.delta,l.reason,l.reference,l.created_at,
    p.points-sum(l.delta) over(order by l.id desc rows unbounded preceding) as balance_before,
    p.points-sum(l.delta) over(order by l.id desc rows unbounded preceding)+l.delta as balance_after
   from public.ob_points_ledger l where l.user_id=uid
   order by l.id desc limit 50 offset p_page*50
 )x)) into result from public.ob_profiles p where p.id=uid;
 if result is null then raise exception 'Cuenta no encontrada'; end if;
 return result;
end $$;
revoke all on function private.ob_points_history(uuid,integer) from public,anon;
grant execute on function private.ob_points_history(uuid,integer) to authenticated;
create or replace function public.ob_points_history(p_user uuid default null,p_page integer default 0)
returns jsonb language sql stable security invoker set search_path='' as $$select private.ob_points_history(p_user,p_page)$$;
revoke all on function public.ob_points_history(uuid,integer) from public,anon;
grant execute on function public.ob_points_history(uuid,integer) to authenticated;
