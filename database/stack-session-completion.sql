alter table private.stack_games add column ended_at timestamptz;
alter table private.stack_games add column end_reason text check(end_reason in ('miss','replaced','expired'));
-- Historical finish reasons cannot be inferred; existing rows remain null.
create or replace function private.ob_stack(p_action text, p_game uuid default null, p_step integer default 0, p_request uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare g private.stack_games; t timestamptz:=clock_timestamp(); age double precision;
 travel double precision; lim double precision; pos double precision; w double precision; l double precision;
 perfect boolean; pts integer:=0; answer jsonb; uid uuid:=auth.uid(); config jsonb;
begin
 if uid is null then raise exception 'Inicia sesión para jugar'; end if;
 perform 1 from public.ob_profiles where id=uid for update;
 if p_request is null then raise exception 'Falta identificador de operación'; end if;
 select value into config from public.ob_settings where id;
 if p_action='start' then
   if (config->>'maintenance')::boolean then raise exception 'STACK está en mantenimiento'; end if;
   select * into g from private.stack_games where user_id=uid and last_request=p_request;
   if found then return g.last_response; end if;
   if (select count(*) from private.stack_games where user_id=uid and day=(t at time zone 'America/Lima')::date)>=(config->>'daily_games')::integer then raise exception 'Ya jugaste tus partidas de hoy. Vuelve mañana.'; end if;
   update private.stack_games set state='over',ended_at=t,end_reason='replaced' where user_id=uid and state<>'over';
   insert into private.stack_games(user_id,day,started_at,tick_at) values(uid,(t at time zone 'America/Lima')::date,t,t) returning * into g;
 else
   select * into g from private.stack_games where id=p_game and user_id=uid for update;
   if not found then raise exception 'Partida no encontrada'; end if;
   if g.last_request=p_request then return g.last_response; end if;
   if g.state='over' then raise exception 'La partida terminó o caducó'; end if;
   if t-g.tick_at>interval '30 minutes' then
     update private.stack_games set state='over',ended_at=t,end_reason='expired' where id=g.id;
     return jsonb_build_object('id',g.id,'x',g.x,'width',g.width,'height',g.height,'score',g.score,'state','over','points',0,'drop_x',null,'perfect',false,'elapsed',0,'delay',0,'account',public.ob_account());
   end if;
   if p_step<>g.height then raise exception 'La partida cambió; vuelve a intentarlo'; end if;
   age:=g.elapsed + case when g.state='moving' then extract(epoch from t-g.tick_at) else 0 end;
   if p_action='pause' then g.elapsed:=age; g.state:='paused';
   elsif p_action='resume' then
     if g.state<>'paused' then raise exception 'La partida no está en pausa'; end if;
     g.state:='moving'; g.tick_at:=t;
   elsif p_action='drop' then
     if g.state<>'moving' or age<0.12 then raise exception 'Espera antes de soltar'; end if;
     lim:=600-g.width-14;
     travel:=mod((145*(1+g.height*0.055)*age)::numeric,(2*lim)::numeric)::double precision;
     pos:=case when travel<=lim then travel else 2*lim-travel end;
     if mod(g.height,2)=1 then pos:=lim-pos; end if;
     perfect:=abs(pos-g.x)<=least(6,g.width*0.12);
     l:=greatest(g.x,pos); w:=least(g.x+g.width,pos+g.width)-l;
     if perfect then l:=g.x; w:=g.width; pts:=(config->>'perfect_points')::integer;
     elsif w>0 then pts:=(config->>'normal_points')::integer; end if;
     if pts=0 then g.state:='over';
     else
       g.x:=l; g.width:=w; g.height:=g.height+1; g.score:=g.score+pts;
       -- Fall animation runs for 160ms before the next box starts moving.
       g.tick_at:=t+interval '160 milliseconds'; g.elapsed:=0;
       update public.ob_profiles set points=points+pts,best=greatest(best,g.height),best_score=greatest(best_score,g.score) where id=uid;
       insert into public.ob_points_ledger(user_id,delta,reason,reference) values(uid,pts,'stack',g.id::text||':'||g.height);
     end if;
   else raise exception 'Acción desconocida'; end if;
 end if;
 answer:=jsonb_build_object('id',g.id,'x',g.x,'width',g.width,'height',g.height,'score',g.score,'state',g.state,'points',pts,'perfect',coalesce(perfect,false),'drop_x',pos,'elapsed',greatest(0,g.elapsed+case when g.state='moving' then extract(epoch from t-g.tick_at) else 0 end),'delay',greatest(0,extract(epoch from g.tick_at-t)),'account',public.ob_account());
 update private.stack_games set x=g.x,width=g.width,height=g.height,score=g.score,state=g.state,tick_at=g.tick_at,elapsed=g.elapsed,last_request=p_request,last_response=answer,ended_at=case when g.state='over' then t end,end_reason=case when g.state='over' then 'miss' end where id=g.id;
 return answer;
end $$;
