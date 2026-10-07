-- Extend the existing administrator system; preserve both current administrators.
alter table private.admins drop constraint admins_slot_check;
alter table private.admins alter column slot type integer;
alter table private.admins add column role text not null default 'admin' check(role in ('admin','super_admin'));
create unique index ob_one_super_admin on private.admins(role) where role='super_admin';
create table private.admin_audit (
 id bigint generated always as identity primary key,
 actor uuid not null, target uuid not null, action text not null,
 created_at timestamptz not null default now()
);
alter table private.admin_audit enable row level security;
revoke all on private.admin_audit from public,anon,authenticated;
create function private.ob_is_super_admin() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from private.admins where user_id=auth.uid() and role='super_admin')
$$;
revoke all on function private.ob_is_super_admin() from public,anon;
grant execute on function private.ob_is_super_admin() to authenticated;
create function private.ob_admin_roles(p_action text default 'list',p_target uuid default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare target_role text;
begin
 -- Serialize transfers and role mutations; recheck the actor after acquiring the lock.
 perform pg_advisory_xact_lock(76123491);
 if not private.ob_is_super_admin() then raise exception 'Solo ADMIN GENERAL puede gestionar administradores'; end if;
 if p_action='list' then
   return jsonb_build_object('admins',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'username',p.username,'role',a.role,'email',u.email) order by a.slot),'[]') from private.admins a join public.ob_profiles p on p.id=a.user_id join auth.users u on u.id=a.user_id),
   'audit',(select coalesce(jsonb_agg(to_jsonb(e)),'[]') from (select * from private.admin_audit order by id desc limit 100)e));
 end if;
 if p_action is null or p_action not in ('add','remove','transfer') then raise exception 'Acción no válida'; end if;
 if p_target is null or p_target=auth.uid() then raise exception 'No puedes quitarte ni transferirte tu propio rango'; end if;
 if not exists(select 1 from public.ob_profiles p join auth.users u on u.id=p.id where p.id=p_target and u.email_confirmed_at is not null) then raise exception 'Selecciona una cuenta con correo confirmado'; end if;
 select role into target_role from private.admins where user_id=p_target;
 if target_role='super_admin' then raise exception 'No puedes degradar ADMIN GENERAL'; end if;
 if p_action='add' then
   if target_role is not null then return jsonb_build_object('ok',true); end if;
   insert into private.admins(slot,user_id) select coalesce(max(slot),0)+1,p_target from private.admins;
 elsif p_action='remove' then
   if target_role is null then return jsonb_build_object('ok',true); end if;
   delete from private.admins where user_id=p_target and role='admin';
 else
   if target_role is distinct from 'admin' then raise exception 'Agrega primero a la persona como administrador'; end if;
   update private.admins set role='admin' where user_id=auth.uid();
   update private.admins set role='super_admin' where user_id=p_target;
 end if;
 insert into private.admin_audit(actor,target,action) values(auth.uid(),p_target,p_action);
 return jsonb_build_object('ok',true);
end $$;
revoke all on function private.ob_admin_roles(text,uuid) from public,anon;
grant execute on function private.ob_admin_roles(text,uuid) to authenticated;
create function public.ob_admin_roles(p_action text default 'list',p_target uuid default null) returns jsonb language sql set search_path='' as $$select private.ob_admin_roles(p_action,p_target)$$;
revoke all on function public.ob_admin_roles(text,uuid) from public,anon;
grant execute on function public.ob_admin_roles(text,uuid) to authenticated;
create or replace function private.ob_account() returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.ob_profiles; used integer;
begin
 if auth.uid() is null then raise exception 'Inicia sesión para continuar'; end if;
 select * into strict p from public.ob_profiles where id=auth.uid();
 select count(*) into used from private.stack_games where user_id=p.id and day=(now() at time zone 'America/Lima')::date;
 return to_jsonb(p)||jsonb_build_object('used',used,'admin',private.ob_is_admin(),'super_admin',private.ob_is_super_admin());
end $$;
-- The email worker must continue working if the administrator count changes.
create or replace function private.ob_email_claim() returns jsonb language plpgsql security definer set search_path='' as $$
declare q private.email_outbox; o public.ob_orders; recipients jsonb;
begin
 select * into q from private.email_outbox where sent_at is null and (locked_until is null or locked_until<now()) order by order_id for update skip locked limit 1;
 if not found then return null; end if;
 select jsonb_agg(u.email order by a.slot) into recipients from private.admins a join auth.users u on u.id=a.user_id;
 if coalesce(jsonb_array_length(recipients),0)=0 then raise exception 'Configura un administrador'; end if;
 update private.email_outbox set attempts=attempts+1,locked_until=now()+interval '5 minutes' where order_id=q.order_id;
 select * into strict o from public.ob_orders where id=q.order_id;
 return jsonb_build_object('id',o.id,'total',o.total,'district',o.delivery->>'district','recipients',recipients);
end $$;
