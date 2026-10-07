alter table private.email_outbox drop constraint email_outbox_pkey;
alter table private.email_outbox add column id bigint generated always as identity primary key;
alter table private.email_outbox add column event text not null default 'nuevo_pedido';
alter table private.email_outbox add column audience text not null default 'admin' check(audience in ('admin','customer'));
alter table private.email_outbox add column created_at timestamptz not null default now();
alter table private.email_outbox add constraint ob_email_event_unique unique(order_id,event,audience);
create table private.mail_runtime(id boolean primary key default true check(id),worker_token text not null default(gen_random_uuid()::text||gen_random_uuid()::text),last_run timestamptz,last_status text);
insert into private.mail_runtime(id) values(true);
alter table private.mail_runtime enable row level security;
revoke all on private.mail_runtime from public,anon,authenticated;
create function private.ob_queue_order_email() returns trigger language plpgsql security definer set search_path='' as $$
declare event_name text;
begin
 if tg_op='INSERT' then event_name:='nuevo_pedido';
 elsif new.status is distinct from old.status then event_name:=new.status;
 elsif new.tracking is distinct from old.tracking and new.tracking is not null then event_name:='tracking:'||md5(new.tracking);
 else return new; end if;
 insert into private.email_outbox(order_id,event,audience) values(new.id,event_name,'customer') on conflict do nothing;
 if tg_op='INSERT' then insert into private.email_outbox(order_id,event,audience) values(new.id,event_name,'admin') on conflict do nothing; end if;
 return new;
end $$;
revoke all on function private.ob_queue_order_email() from public,anon,authenticated;
create trigger ob_email_order_event after insert or update on public.ob_orders for each row execute function private.ob_queue_order_email();
create or replace function private.ob_email_claim() returns jsonb language plpgsql security definer set search_path='' as $$
declare q private.email_outbox; o public.ob_orders; recipients jsonb; config jsonb;
begin
 select * into q from private.email_outbox where sent_at is null and attempts<10 and (locked_until is null or locked_until<now()) order by id for update skip locked limit 1;
 if not found then return null; end if;
 select * into strict o from public.ob_orders where id=q.order_id;
 if q.audience='admin' then select jsonb_agg(u.email order by a.slot) into recipients from private.admins a join auth.users u on u.id=a.user_id;
 else select jsonb_build_array(email) into recipients from auth.users where id=o.user_id; end if;
 select value into config from public.ob_settings where id;
 update private.email_outbox set attempts=attempts+1,locked_until=now()+interval '5 minutes' where id=q.id;
 return jsonb_build_object('id',q.id,'order_id',o.id,'event',q.event,'status',o.status,'total',o.total,'advance_due',o.advance_due,'tracking',o.tracking,'recipients',recipients,'audience',q.audience,'signature',config->>'email_signature');
end $$;
create or replace function private.ob_email_ack(p_order bigint,p_error text default null) returns void language plpgsql security definer set search_path='' as $$
begin
 update private.email_outbox set sent_at=case when p_error is null then now() else null end,last_error=left(p_error,300),locked_until=case when p_error is null then null else now()+interval '15 minutes' end where id=p_order;
end $$;
create function private.ob_mail_authorize(p_token text,p_status text default null) returns boolean language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from private.mail_runtime where worker_token=p_token) then return false; end if;
 update private.mail_runtime set last_run=now(),last_status=left(p_status,200) where id;
 return true;
end $$;
revoke all on function private.ob_mail_authorize(text,text) from public,anon,authenticated;
grant execute on function private.ob_mail_authorize(text,text) to service_role;
create function public.ob_mail_authorize(p_token text,p_status text default null) returns boolean language sql set search_path='' as $$select private.ob_mail_authorize(p_token,p_status)$$;
revoke all on function public.ob_mail_authorize(text,text) from public,anon,authenticated;
grant execute on function public.ob_mail_authorize(text,text) to service_role;
create function private.ob_tracking(p_order bigint,p_tracking text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.ob_is_admin() then raise exception 'Acceso denegado'; end if;
 if length(trim(p_tracking)) not between 1 and 100 or p_tracking is null then raise exception 'Código de envío no válido'; end if;
 update public.ob_orders set tracking=trim(p_tracking) where id=p_order and status in('preparando','enviado');
 if not found then raise exception 'El pedido debe estar preparando o enviado'; end if;
 insert into private.order_events(order_id,actor,status) values(p_order,auth.uid(),'tracking_actualizado');
end $$;
revoke all on function private.ob_tracking(bigint,text) from public,anon;
grant execute on function private.ob_tracking(bigint,text) to authenticated;
create function public.ob_tracking(p_order bigint,p_tracking text) returns void language sql set search_path='' as $$select private.ob_tracking(p_order,p_tracking)$$;
revoke all on function public.ob_tracking(bigint,text) from public,anon;
grant execute on function public.ob_tracking(bigint,text) to authenticated;
