create function private.ob_admin_customers(p_search text default '',p_page integer default 0,p_user uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare result jsonb; term text:=lower(trim(coalesce(p_search,'')));
begin
 if not private.ob_is_admin() then raise exception 'Acceso denegado'; end if;
 if p_page is null or p_page<0 or p_page>100000 or length(term)>150 then raise exception 'Búsqueda no válida'; end if;
 if p_user is not null then
  select jsonb_build_object('id',p.id,'username',p.username,'email',u.email,'points',p.points,'best',p.best,'created_at',p.created_at,
   'orders',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from(select id,status,total,created_at from public.ob_orders where user_id=p.id order by created_at desc,id desc limit 100)x),
   'ledger',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from(select delta,reason,created_at from public.ob_points_ledger where user_id=p.id order by created_at desc limit 100)x))
  into result from public.ob_profiles p join auth.users u on u.id=p.id where p.id=p_user;
  if result is null then raise exception 'Cliente no encontrado'; end if;
  return result;
 end if;
 select jsonb_build_object('total',(select count(*) from public.ob_profiles p join auth.users u on u.id=p.id where term='' or position(term in lower(coalesce(p.username,'')||' '||coalesce(u.email,'')))>0),
  'customers',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from(
   select p.id,p.username,u.email,p.points,p.best,p.created_at from public.ob_profiles p join auth.users u on u.id=p.id
   where term='' or position(term in lower(coalesce(p.username,'')||' '||coalesce(u.email,'')))>0
   order by p.created_at desc,p.id limit 25 offset p_page*25)x)) into result;
 return result;
end $$;
revoke all on function private.ob_admin_customers(text,integer,uuid) from public,anon;
grant execute on function private.ob_admin_customers(text,integer,uuid) to authenticated;
create function public.ob_admin_customers(p_search text default '',p_page integer default 0,p_user uuid default null) returns jsonb
language sql set search_path='' as $$select private.ob_admin_customers(p_search,p_page,p_user)$$;
revoke all on function public.ob_admin_customers(text,integer,uuid) from public,anon;
grant execute on function public.ob_admin_customers(text,integer,uuid) to authenticated;
