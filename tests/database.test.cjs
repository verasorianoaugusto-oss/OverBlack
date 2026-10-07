const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {PGlite}=require('@electric-sql/pglite');
const fs=require('node:fs');
let db;const u='11111111-1111-4111-8111-111111111111',v='22222222-2222-4222-8222-222222222222',admin='33333333-3333-4333-8333-333333333333';
const id=()=>require('node:crypto').randomUUID();
async function as(who,sql,params=[]){await db.exec("reset role; set role authenticated");await db.query("select set_config('request.jwt.claim.sub',$1,false)",[who]);return db.query(sql,params);}
async function owner(sql,params=[]){await db.exec('reset role');return db.query(sql,params);}
before(async()=>{
 db=new PGlite();
 await db.exec("create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz default now(),raw_user_meta_data jsonb default '{}');create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;");
 await db.exec(fs.readFileSync('database/baseline-commerce.sql','utf8'));
 await db.exec("create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(bucket_id text,name text);alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant select,insert on storage.objects to authenticated;");
 await db.exec(fs.readFileSync('database/admin-product-images.sql','utf8'));
 await db.exec(fs.readFileSync('database/admin-product-visibility.sql','utf8'));
 await db.exec(fs.readFileSync('database/admin-roles.sql','utf8'));
 await db.exec(fs.readFileSync('database/profile-avatar.sql','utf8'));
 await db.exec(fs.readFileSync('database/products.sql','utf8'));
 await db.exec(fs.readFileSync('database/store-settings.sql','utf8'));
 await db.exec(fs.readFileSync('database/settings-validation.sql','utf8'));
 await db.exec(fs.readFileSync('database/delivery-checkout.sql','utf8'));
 await db.exec(fs.readFileSync('database/cart.sql','utf8'));
 await db.exec(fs.readFileSync('database/admin-report.sql','utf8'));
 await db.exec(fs.readFileSync('database/stack-configuration.sql','utf8'));
 await db.exec(fs.readFileSync('database/order-email.sql','utf8'));
 await db.exec(fs.readFileSync('database/operational-recovery.sql','utf8'));
 await db.exec(fs.readFileSync('database/content-and-promotions.sql','utf8'));
 await db.exec(fs.readFileSync('database/admin-report-health.sql','utf8'));
 await db.exec(fs.readFileSync('database/admin-customers.sql','utf8'));
 await db.exec(fs.readFileSync('database/points-history.sql','utf8'));
 await db.exec(fs.readFileSync('database/customer-points-detail.sql','utf8'));
 await db.exec(fs.readFileSync('database/stack-session-completion.sql','utf8'));
 await db.exec(fs.readFileSync('database/product-details.sql','utf8'));
 await db.exec(fs.readFileSync('database/stock-history.sql','utf8'));
 for(const file of ['saved-delivery-addresses','customer-order-history','order-shipping-guard','settings-concurrent-edit','promotion-report','order-confirmed-state','checkout-discount-percent'])await db.exec(fs.readFileSync('database/'+file+'.sql','utf8'));
 await db.exec("update public.ob_settings set value=value||'{\"checkout_enabled\":true,\"lima_fee\":1000}'");
 await db.exec('grant update,delete on storage.objects to authenticated');
 await owner("insert into auth.users(id,email) values($1,'a@example.test'),($2,'b@example.test'),($3,'admin@example.test')",[u,v,admin]);
 await owner("insert into private.admins(slot,user_id,role) values(1,$1,'super_admin')",[admin]);
});
after(async()=>{await db?.close();});

test('STACK continues above 300 boxes and records server-side completion',async()=>{
 const player=id();await owner('insert into auth.users(id,email) values($1,$2)',[player,'longgame@example.test']);
 const g=(await as(player,"select public.ob_stack('start',null,0,$1) as g",[id()])).rows[0].g;
 await owner("update private.stack_games set height=299,score=598,state='paused',elapsed=(286*20+136)/(145.0*(1+299*0.055)),tick_at=clock_timestamp() where id=$1",[g.id]);
 await as(player,"select public.ob_stack('resume',$1,299,$2)",[g.id,id()]);
 const drop=(await as(player,"select public.ob_stack('drop',$1,299,$2) as g",[g.id,id()])).rows[0].g;
 assert.equal(drop.height,300);assert.equal(drop.state,'moving');
 await owner("update private.stack_games set tick_at=clock_timestamp()-interval '31 minutes' where id=$1",[g.id]);
 const expired=(await as(player,"select public.ob_stack('drop',$1,300,$2) as g",[g.id,id()])).rows[0].g;
 assert.equal(expired.state,'over');assert.equal((await owner('select end_reason from private.stack_games where id=$1',[g.id])).rows[0].end_reason,'expired');
 await owner('delete from public.ob_points_ledger where user_id=$1',[player]);await owner('delete from private.stack_games where user_id=$1',[player]);await owner('delete from public.ob_profiles where id=$1',[player]);await owner('delete from auth.users where id=$1',[player]);
});

test('points history is private, paginated and retains balances across page boundaries',async()=>{
 const customer=id();await owner('insert into auth.users(id,email) values($1,$2)',[customer,'history@example.test']);
 await owner('insert into public.ob_points_ledger(user_id,delta,reason) select $1,2,\'stack\' from generate_series(1,55)',[customer]);
 await owner('update public.ob_profiles set points=110 where id=$1',[customer]);
 await assert.rejects(as(u,'select public.ob_points_history($1)',[customer]),/Acceso denegado/);
 await db.exec('reset role;set role anon');await assert.rejects(db.query('select public.ob_points_history()'),/permission denied/);
 const a=(await as(customer,'select public.ob_points_history() as r')).rows[0].r;
 const b=(await as(customer,'select public.ob_points_history(null,1) as r')).rows[0].r;
 assert.equal(a.total,55);assert.equal(a.movements.length,50);assert.equal(a.movements[0].balance_after,110);
 assert.equal(a.movements.at(-1).balance_before,10);assert.equal(b.movements[0].balance_after,10);assert.equal(b.movements.at(-1).balance_before,0);
 assert.deepEqual((await as(admin,'select public.ob_points_history($1) as r',[customer])).rows[0].r,a);
 await owner('delete from public.ob_points_ledger where user_id=$1',[customer]);await owner('delete from public.ob_profiles where id=$1',[customer]);await owner('delete from auth.users where id=$1',[customer]);
});
test('recovery preserves inventory and restores hidden without enabling sales',async()=>{
 const p=(await as(admin,"select public.ob_product_manage('create',null,$1) as id",[{name:'Recovery fixture',category:'polos',collection:'unisex'}])).rows[0].id;
 await as(admin,"select public.ob_inventory($1,1000,true,'L',3)",[p]);
 await assert.rejects(as(u,"select public.ob_product_manage('delete',$1)",[p]),/Acceso denegado/);
 await as(admin,"select public.ob_product_manage('delete',$1)",[p]);
 assert.equal((await owner('select stock from public.ob_variants where product_id=$1',[p])).rows[0].stock,3);
 await assert.rejects(as(admin,'select public.ob_product_visibility($1,false)',[p]),/ob_deleted_product_hidden/);
 await as(admin,"select public.ob_product_manage('restore',$1)",[p]);
 assert.deepEqual((await owner('select deleted_at,archived,active from public.ob_products where id=$1',[p])).rows[0],{deleted_at:null,archived:true,active:false});
 await owner('delete from public.ob_variants where product_id=$1',[p]);
 await owner('delete from public.ob_products where id=$1',[p]);
});
test('mail retry rejects non-admin callers and nonexistent queue entries',async()=>{
 await assert.rejects(as(u,'select public.ob_retry_order_email(1)'),/Acceso denegado/);
 await assert.rejects(as(admin,'select public.ob_retry_order_email(-1)'),/ya fue enviado/);
});
test('customer directory and details require admin, support literal search and never expose mail credentials',async()=>{
 await assert.rejects(as(u,'select public.ob_admin_customers()'),/Acceso denegado/);
 await assert.rejects(as(u,'select public.ob_admin_customers(p_user:=$1)',[v]),/Acceso denegado/);
 await db.exec('reset role;set role anon');
 await assert.rejects(db.query('select public.ob_admin_customers()'),/permission denied/);
 const search=(await as(admin,'select public.ob_admin_customers($1) as r',['b@example.test'])).rows[0].r;
 assert.equal(search.total,1);assert.equal(search.customers[0].id,v);
 assert.equal((await as(admin,"select public.ob_admin_customers('%') as r")).rows[0].r.total,0);
 const detail=(await as(admin,'select public.ob_admin_customers(p_user:=$1) as r',[v])).rows[0].r;
 assert.equal(detail.email,'b@example.test');assert.ok(Array.isArray(detail.orders));assert.ok(Array.isArray(detail.ledger));
 await assert.rejects(as(admin,'select public.ob_admin_customers(p_page:=-1)'),/Búsqueda no válida/);
 await assert.rejects(as(admin,'select public.ob_admin_customers(p_user:=$1)',[id()]),/Cliente no encontrado/);
 const report=(await as(admin,'select public.ob_admin_report() as r')).rows[0].r;
 assert.deepEqual(Object.keys(report.mail_health).sort(),['last_run','last_status']);
});
test('settings reject unsafe links and malformed data and remain publicly readable but admin writable',async()=>{
 const original=(await owner('select value from public.ob_settings')).rows[0].value;
 await assert.rejects(as(u,"select public.ob_settings_save($1)",[{announcement:'forged'}]),/Acceso denegado/);
 for(const value of [{instagram:'javascript:alert(1)'},{tiktok:'https://tiktok.com.evil.test/'},{store_name:null},{store_name:' '},{daily_games:2.5},{password:'secret'}])await assert.rejects(as(admin,'select public.ob_settings_save($1)',[value]));
 await as(admin,'select public.ob_settings_save($1)',[{announcement:'Nuevo aviso',daily_games:6,rewards:[[1000,5],[3000,10]]}]);
 const account=(await as(u,'select public.ob_account() as a')).rows[0].a;
 assert.equal(account.daily_limit,6);assert.deepEqual(account.rewards,[[1000,5],[3000,10]]);
 await db.exec('reset role; set role anon');
 assert.equal((await db.query('select value from public.ob_settings')).rows[0].value.announcement,'Nuevo aviso');
 await assert.rejects(db.query('update public.ob_settings set value=value'),/permission denied/);
 await owner('update public.ob_settings set value=$1',[original]);
});
test('avatar ownership rejects another user path and preserves points on profile edit',async()=>{
 const path=u+'/photo.png';
 await as(u,'insert into storage.objects values($1,$2)',['avatars',path]);
 await assert.rejects(as(v,'insert into storage.objects values($1,$2)',['avatars',u+'/forged.png']),/row-level security/);
 await assert.rejects(as(v,'select public.ob_profile_save($1,$2)',['Attacker',path]),/Foto no válida/);
 const saved=(await as(u,'select public.ob_profile_save($1,$2) as p',['Cliente',path])).rows[0].p;
 assert.equal(saved.avatar_path,path);assert.equal(saved.points,0);
 assert.equal((await as(v,"delete from storage.objects where bucket_id='avatars' and name=$1 returning *",[path])).rows.length,0);
 await as(u,'select public.ob_profile_save($1,null)',['Cliente']);
 assert.equal((await as(u,"delete from storage.objects where bucket_id='avatars' and name=$1 returning *",[path])).rows.length,1);
});
test('only admins can hide products; hiding preserves variants and blocks activation until restored',async()=>{
 await assert.rejects(as(u,"select public.ob_product_visibility(6,true)"),/Acceso denegado/);
 await as(admin,"select public.ob_inventory(6,5000,true,'42',2)");
 await as(admin,"select public.ob_product_visibility(6,true)");
 const p=(await owner('select archived,active from public.ob_products where id=6')).rows[0];assert.deepEqual(p,{archived:true,active:false});
 assert.equal((await owner("select stock from public.ob_variants where product_id=6 and size='42'")).rows[0].stock,2);
 await assert.rejects(as(admin,"select public.ob_inventory(6,5000,true,'42',2)"),/ob_archived_not_active/);
 await as(admin,"select public.ob_product_visibility(6,false)");
 await as(admin,"select public.ob_inventory(6,5000,true,'42',2)");
 assert.equal((await owner('select archived from public.ob_products where id=6')).rows[0].archived,false);
});
test('product photos require admin, existing upload and preserve stock on failure',async()=>{
 await assert.rejects(as(u,"insert into storage.objects values('product-images','fake.jpg')"),/row-level security/);
 await assert.rejects(as(u,"select public.ob_product_save(5,5000,true,'40',1,null)"),/Acceso denegado/);
 await as(admin,"insert into storage.objects values('product-images','5/test.jpg')");
 await as(admin,"select public.ob_product_save(5,5000,true,'40',3,'5/test.jpg')");
 await assert.rejects(as(admin,"select public.ob_product_save(5,6000,true,'40',9,'missing.jpg')"),/Imagen no encontrada/);
 assert.equal((await owner('select image_path from public.ob_products where id=5')).rows[0].image_path,'5/test.jpg');
 assert.equal((await owner("select stock from public.ob_variants where product_id=5 and size='40'")).rows[0].stock,3);
 await as(admin,"select public.ob_product_save(5,5000,true,'40',0,'5/test.jpg')");
 assert.equal((await owner("select stock from public.ob_variants where product_id=5 and size='40'")).rows[0].stock,0);
});
test('anonymous cannot access accounts or mutate balances',async()=>{
 await db.exec("reset role;set role anon");
 await assert.rejects(db.query('select * from public.ob_profiles'),/permission denied/);
 await assert.rejects(db.query('select public.ob_account()'),/permission denied/);
 assert.equal((await db.query('select * from public.ob_products')).rows.length,8);
});
test('customer sees only own profile and cannot become admin or modify points',async()=>{
 assert.equal((await as(u,'select * from public.ob_profiles')).rows.length,1);
 await assert.rejects(as(u,"update public.ob_profiles set points=999999"),/permission denied/);
 await assert.rejects(as(u,"select * from private.admins"),/permission denied/);
 assert.equal((await as(u,'select public.ob_is_admin() as yes')).rows[0].yes,false);
 await assert.rejects(as(u,"select public.ob_inventory(1,100,true,'M',100)"),/Acceso denegado/);
});
test('five attempts, start idempotency, ownership, and forged step rejected',async()=>{
 let first;const req=id();
 first=(await as(u,"select public.ob_stack('start',null,0,$1) as game",[req])).rows[0].game;
 assert.equal((await as(u,"select public.ob_stack('start',null,0,$1) as game",[req])).rows[0].game.id,first.id);
 await assert.rejects(as(v,"select public.ob_stack('drop',$1,0,$2)",[first.id,id()]),/Partida no encontrada/);
 await assert.rejects(as(u,"select public.ob_stack('drop',$1,10,$2)",[first.id,id()]),/partida cambió/);
 for(let i=0;i<4;i++)await as(u,"select public.ob_stack('start',null,0,$1)",[id()]);
 await assert.rejects(as(u,"select public.ob_stack('start',null,0,$1)",[id()]),/partidas de hoy/);
 assert.equal((await as(u,"select public.ob_account() as a")).rows[0].a.used,5);
});
test('checkout uses server prices, idempotency, stock and refunds exactly once',async()=>{
 await as(admin,"select public.ob_inventory(1,10000,true,'M',2)");
 await as(admin,"select public.ob_shipping_save('Lima','Lima','Miraflores',1000,true)");
 const variant=(await owner("select id from public.ob_variants where product_id=1 and size='M'")).rows[0].id;
 const ship=(await owner("select id from public.ob_shipping limit 1")).rows[0].id;
 await owner("update public.ob_profiles set points=5000 where id=$1",[v]);
 const items=[{variant_id:variant,quantity:1,price:1}],delivery={mode:'lima',district:'Miraflores',shipping_id:ship,recipient:'Cliente Prueba',phone:'999999999',address:'Calle Prueba 123'};
 const quote=(await as(v,"select public.ob_checkout($1,$2,2500) as q",[JSON.stringify(items),JSON.stringify(delivery)])).rows[0].q;
 assert.equal(quote.total,10500);
 assert.equal(quote.points_after,2500);
 const request=id();delivery.expected_total=10500;
 const args=[JSON.stringify(items),JSON.stringify(delivery),request];
 const order=(await as(v,"select public.ob_checkout($1,$2,2500,$3,true) as q",args)).rows[0].q;
 const repeated=(await as(v,"select public.ob_checkout($1,$2,2500,$3,true) as q",args)).rows[0].q;
 assert.equal(order.id,repeated.id);
 assert.equal((await owner("select stock from public.ob_variants where id=$1",[variant])).rows[0].stock,1);
 assert.equal((await as(u,'select * from public.ob_orders')).rows.length,0);
 await assert.rejects(as(v,"select public.ob_order_status($1,'entregado')",[order.id]),/Acceso denegado/);
 await assert.rejects(as(admin,"select public.ob_order_status($1,'entregado')",[order.id]),/Cambio de estado/);
 await as(admin,"select public.ob_order_status($1,'cancelado')",[order.id]);
 await as(admin,"select public.ob_order_status($1,'cancelado')",[order.id]);
 assert.equal((await owner("select stock from public.ob_variants where id=$1",[variant])).rows[0].stock,2);
 assert.equal((await owner("select points from public.ob_profiles where id=$1",[v])).rows[0].points,5000);
 await assert.rejects(as(v,"select public.ob_checkout($1,$2,10000)",args.slice(0,2)),/suficientes puntos/);
 await assert.rejects(as(v,"select public.ob_checkout($1,$2,0)",[JSON.stringify([{variant_id:variant,quantity:3}]),JSON.stringify(delivery)]),/Stock insuficiente/);
});
test('email queue is inaccessible to clients',async()=>{
 await assert.rejects(as(v,'select public.ob_email_claim()'),/permission denied/);
 await assert.rejects(as(v,'select * from private.email_outbox'),/permission denied/);
});
test('STACK scores from server geometry and a duplicate drop never awards twice',async()=>{
 const start=(await as(v,"select public.ob_stack('start',null,0,$1) as g",[id()])).rows[0].g;
 await owner("update private.stack_games set tick_at=clock_timestamp()-interval '1.03448 seconds' where id=$1",[start.id]);
 const req=id();
 const drop=(await as(v,"select public.ob_stack('drop',$1,0,$2) as g",[start.id,req])).rows[0].g;
 assert.equal(drop.height,1);assert.equal(drop.points,5);
 const balance=(await owner("select points from public.ob_profiles where id=$1",[v])).rows[0].points;
 const replay=(await as(v,"select public.ob_stack('drop',$1,0,$2) as g",[start.id,req])).rows[0].g;
 assert.equal(replay.score,drop.score);
 assert.equal((await owner("select points from public.ob_profiles where id=$1",[v])).rows[0].points,balance);
 await assert.rejects(as(v,"select public.ob_stack('drop',$1,0,$2)",[start.id,id()]),/partida cambió/);
});
test('address ownership and spoofed discounts, empty carts, duplicate lines',async()=>{
 const ship=(await owner("select id from public.ob_shipping limit 1")).rows[0].id;
 const variant=(await owner("select id from public.ob_variants where product_id=1 and size='M'")).rows[0].id;
 const delivery={mode:'lima',district:'Miraflores',shipping_id:ship,recipient:'Cliente Prueba',phone:'999999999',address:'Calle Prueba 123',expected_total:1};
 const item={variant_id:variant,quantity:1};
 await as(v,"select public.ob_address_book('save',null,$1)",[delivery]);
 assert.equal((await as(u,"select * from public.ob_addresses")).rows.length,0);
 await assert.rejects(as(u,"insert into public.ob_addresses(user_id,recipient,phone,shipping_id,address) values($1,'Cliente Prueba','999999999',$2,'Calle Prueba 123')",[v,ship]),/permission denied/);
 await assert.rejects(as(v,"select public.ob_checkout($1,$2,1)",[JSON.stringify([item]),JSON.stringify(delivery)]),/Recompensa/);
 await assert.rejects(as(v,"select public.ob_checkout($1,$2,0)",['[]',JSON.stringify(delivery)]),/Carrito vacío/);
 await assert.rejects(as(v,"select public.ob_checkout($1,$2,0)",[JSON.stringify([item,item]),JSON.stringify(delivery)]),/duplicadas/);
 await assert.rejects(as(v,"select public.ob_checkout($1,$2,0,$3,true)",[JSON.stringify([item]),JSON.stringify(delivery),id()]),/total cambió/);
});
test('attempt limit rolls over by server Peru date, not client state',async()=>{
 await owner("update private.stack_games set day=(now() at time zone 'America/Lima')::date-1 where user_id=$1",[u]);
 const game=(await as(u,"select public.ob_stack('start',null,0,$1) as g",[id()])).rows[0].g;
 assert.equal(game.account.used,1);
});

test('product management enforces admin, validates classification and preserves ordered inventory',async()=>{
 await assert.rejects(as(u,"select public.ob_product_manage('create',null,$1)",[JSON.stringify({name:'Prueba',category:'polos',collection:'unisex'})]),/Acceso denegado/);
 const p=(await as(admin,"select public.ob_product_manage('create',null,$1) as id",[JSON.stringify({name:'Prueba',category:'polos',collection:'unisex'})])).rows[0].id;
 await as(admin,"select public.ob_product_manage('edit',$1,$2)",[p,JSON.stringify({name:'Editado',category:'hoodies',collection:'mujeres'})]);
 await as(admin,"select public.ob_inventory($1,5000,true,'M',2)",[p]);
 await as(admin,"select public.ob_product_manage('delete_size',$1,'{\"size\":\"M\"}')",[p]);
 assert.equal((await owner('select count(*)::int n from public.ob_variants where product_id=$1',[p])).rows[0].n,0);
 await assert.rejects(as(admin,"select public.ob_product_manage('delete',1)"),/tiene pedidos/);
 await as(admin,"select public.ob_product_manage('delete',$1)",[p]);
});
test('Shalom requires agency, 50 percent advance, valid transitions, coupon and exact refund',async()=>{
 const variant=(await owner("select id from public.ob_variants where product_id=1 and size='M'")).rows[0].id;
 const items=JSON.stringify([{variant_id:variant,quantity:1}]);
 const d={mode:'shalom',department:'Arequipa',province:'Arequipa',recipient:'Cliente Prueba',phone:'999999999',destination:'Arequipa',agency:'Agencia principal',expected_total:10000,expected_advance:5000};
 await assert.rejects(as(v,'select public.ob_checkout($1,$2)',[items,JSON.stringify({...d,agency:''})]),/agencia/);
 const quote=(await as(v,'select public.ob_checkout($1,$2) as q',[items,JSON.stringify(d)])).rows[0].q;
 assert.equal(quote.advance_due,5000);assert.equal(quote.shipping,0);
 const order=(await as(v,'select public.ob_checkout($1,$2,0,$3,true) as q',[items,JSON.stringify(d),id()])).rows[0].q;
 assert.equal(order.status,'pendiente_adelanto');
 await assert.rejects(as(admin,"select public.ob_order_status($1,'preparando')",[order.id]),/Cambio de estado/);
 await as(admin,"select public.ob_order_status($1,'adelanto_confirmado')",[order.id]);
 await as(admin,"select public.ob_order_status($1,'confirmado')",[order.id]);
 await as(admin,"select public.ob_order_status($1,'preparando')",[order.id]);
 await assert.rejects(as(admin,"select public.ob_order_status($1,'enviado')",[order.id]),/referencia de Shalom/);
 await as(admin,"select public.ob_tracking($1,'SH-LOCAL-TEST')",[order.id]);
 await as(admin,"select public.ob_tracking($1,'SH-LOCAL-TEST')",[order.id]);
 assert.equal((await owner("select count(*)::int n from private.order_events where order_id=$1 and status='tracking_actualizado'",[order.id])).rows[0].n,1);
 await as(admin,"select public.ob_order_status($1,'enviado')",[order.id]);
 await as(admin,"select public.ob_order_status($1,'cancelado')",[order.id]);
 await as(admin,"select public.ob_order_status($1,'cancelado')",[order.id]);
 assert.equal((await owner('select stock from public.ob_variants where id=$1',[variant])).rows[0].stock,2);
 await as(admin,"select public.ob_coupon_save('OBTEST',10,now()+interval '1 day',true)");
 assert.equal((await as(v,'select public.ob_checkout($1,$2) as q',[items,JSON.stringify({...d,coupon:'OBTEST'})])).rows[0].q.total,9000);
 await assert.rejects(as(v,'select public.ob_checkout($1,$2,2500)',[items,JSON.stringify({...d,coupon:'OBTEST'})]),/no se acumulan/);
 await as(admin,"select public.ob_coupon_save('OBTEST',10,now()-interval '1 day',true)");
 await assert.rejects(as(v,'select public.ob_checkout($1,$2)',[items,JSON.stringify({...d,coupon:'OBTEST'})]),/vencido/);
 await assert.rejects(as(v,"select public.ob_settings_save('{\"checkout_enabled\":false}')"),/Acceso denegado/);
});
test('only super admin manages roles, transfers atomically, protects self and audits',async()=>{
 await assert.rejects(as(u,"select public.ob_admin_roles('list')"),/Solo ADMIN GENERAL/);
 await as(admin,"select public.ob_admin_roles('add',$1)",[v]);
 await assert.rejects(as(v,"select public.ob_admin_roles('remove',$1)",[admin]),/Solo ADMIN GENERAL/);
 await assert.rejects(as(v,"select public.ob_admin_roles('add',$1)",[u]),/Solo ADMIN GENERAL/);
 await assert.rejects(as(admin,"select public.ob_admin_roles('remove',$1)",[admin]),/propio rango/);
 await assert.rejects(as(admin,"select public.ob_admin_roles('transfer',$1)",[u]),/Agrega primero/);
 await as(admin,"select public.ob_admin_roles('transfer',$1)",[v]);
 assert.equal((await as(v,'select public.ob_account() as a')).rows[0].a.super_admin,true);
 await assert.rejects(as(admin,"select public.ob_admin_roles('list')"),/Solo ADMIN GENERAL/);
 await as(v,"select public.ob_admin_roles('transfer',$1)",[admin]);
 await as(admin,"select public.ob_admin_roles('remove',$1)",[v]);
 assert.equal((await as(v,'select public.ob_is_admin() as a')).rows[0].a,false);
 assert.equal((await owner("select count(*)::int as n from private.admin_audit where action in ('add','remove','transfer')")).rows[0].n,4);
 await assert.rejects(as(admin,'select * from private.admin_audit'),/permission denied/);
});
test('mail events are unique and queue is gated; cart and reports are private',async()=>{
 const order=(await owner('select id from public.ob_orders order by id limit 1')).rows[0].id;
 const events=(await owner('select event,audience from private.email_outbox where order_id=$1',[order])).rows;
 assert.equal(events.filter(e=>e.event==='nuevo_pedido').length,2);
 assert.equal(events.filter(e=>e.event==='cancelado').length,1);
 await assert.rejects(as(v,"select public.ob_mail_authorize('guess')"),/permission denied/);
 await assert.rejects(as(v,'select public.ob_admin_report()'),/Acceso denegado/);
 assert.equal((await as(admin,'select public.ob_admin_report() as r')).rows[0].r.customers,3);
 const variant=(await owner("select id from public.ob_variants where product_id=1 and size='M'")).rows[0].id;
 await as(v,'insert into public.ob_cart_items(variant_id,quantity) values($1,1)',[variant]);
 assert.equal((await as(u,'select * from public.ob_cart_items')).rows.length,0);
 await assert.rejects(as(u,'insert into public.ob_cart_items(user_id,variant_id,quantity) values($1,$2,1)',[v,variant]),/row-level security/);
});

test('saved addresses enforce ownership and reject incompatible delivery modes',async()=>{
 const delivery={recipient:'Cliente Local',phone:'999999999',department:'Lima',province:'Lima',district:'Miraflores',address:'Calle Local 123',mode:'lima'};
 const saved=(await as(u,"select public.ob_address_book('save',null,$1) as a",[delivery])).rows[0].a;
 await assert.rejects(as(v,"select public.ob_address_book('save',$1,$2)",[saved.id,delivery]),/Dirección inexistente/);
 await assert.rejects(as(v,"select public.ob_address_book('delete',$1)",[saved.id]),/Dirección inexistente/);
 await assert.rejects(as(u,"select public.ob_address_book('save',null,$1)",[{...delivery,mode:'shalom'}]),/modalidad|Modalidad/);
 await assert.rejects(as(u,"select public.ob_address_book('save',null,$1)",[{...delivery,district:'Inventado'}]),/distrito|Distrito/);
 await as(u,"select public.ob_address_book('save',$1,$2)",[saved.id,{...delivery,address:'Calle Editada 456'}]);
 assert.equal((await as(u,'select public.ob_address_book() as r')).rows[0].r.find(a=>a.id===saved.id).delivery.address,'Calle Editada 456');
 await as(u,"select public.ob_address_book('delete',$1)",[saved.id]);
 assert.ok(!(await as(u,'select public.ob_address_book() as r')).rows[0].r.some(a=>a.id===saved.id));
});

test('order timeline is owner/admin only and retains confirmation and cancellation',async()=>{
 const order=(await owner("select id from public.ob_orders where payment_method='shalom_adelanto' order by id desc limit 1")).rows[0].id;
 await assert.rejects(as(u,'select public.ob_order_history($1)',[order]),/Pedido no disponible/);
 const events=(await as(v,'select public.ob_order_history($1) as r',[order])).rows[0].r;
 assert.ok(events.some(e=>e.status==='confirmado'));assert.equal(events[0].status,'cancelado');
 assert.ok(events.every(e=>!('actor' in e)));
 assert.deepEqual((await as(admin,'select public.ob_order_history($1) as r',[order])).rows[0].r,events);
});

test('configuration rejects stale edits while merging unrelated changes',async()=>{
 const original=(await owner('select value from public.ob_settings')).rows[0].value;
 await assert.rejects(as(u,'select public.ob_settings_patch($1,$2)',[{announcement:'Forged'},{announcement:original.announcement}]),/Acceso denegado/);
 await as(admin,'select public.ob_settings_patch($1,$2)',[{announcement:'First change'},{announcement:original.announcement}]);
 await assert.rejects(as(admin,'select public.ob_settings_patch($1,$2)',[{announcement:'Stale change'},{announcement:original.announcement}]),/Otro administrador/);
 await as(admin,'select public.ob_settings_patch($1,$2)',[{email_intro:'Independent change'},{email_intro:original.email_intro}]);
 const saved=(await owner('select value from public.ob_settings')).rows[0].value;assert.equal(saved.announcement,'First change');assert.equal(saved.email_intro,'Independent change');
 await owner('update public.ob_settings set value=$1',[original]);
});

test('gallery rejects other products, duplicate photos and stale edits',async()=>{
 const product=(await as(admin,"select public.ob_product_manage('create',null,$1) as id",[{name:'Gallery isolated',category:'hoodie',collection:'unisex'}])).rows[0].id;
 const a=product+'/a.webp',b=product+'/b.webp';
 await as(admin,"insert into storage.objects values('product-images',$1),('product-images',$2)",[a,b]);
 await assert.rejects(as(u,'select public.ob_product_gallery($1,$2,$3)',[product,[a],[]]),/Acceso denegado/);
 await assert.rejects(as(admin,'select public.ob_product_gallery($1,$2,$3)',[product,['5/test.jpg'],[]]),/Foto no válida/);
 await assert.rejects(as(admin,'select public.ob_product_gallery($1,$2,$3)',[product,[a,a],[]]),/fotos diferentes/);
 await as(admin,'select public.ob_product_gallery($1,$2,$3)',[product,[a,b],[]]);
 await assert.rejects(as(admin,'select public.ob_product_gallery($1,$2,$3)',[product,[b],[]]),/Las fotos cambiaron/);
 await as(admin,'select public.ob_product_gallery($1,$2,$3)',[product,[b,a],[a,b]]);
 const row=(await owner('select image_path,gallery_paths from public.ob_products where id=$1',[product])).rows[0];
 assert.equal(row.image_path,b);assert.deepEqual(row.gallery_paths,[a]);
 await as(admin,'select public.ob_product_gallery($1,$2,$3)',[product,[],[b,a]]);
 assert.equal((await owner('select count(*)::int n from storage.objects where name=any($1)',[[a,b]])).rows[0].n,2);
});

test('stock history is private and cancellation restores each ordered quantity once',async()=>{
 await assert.rejects(as(u,'select public.ob_stock_history(1)'),/Acceso denegado/);
 await assert.rejects(as(admin,'select public.ob_stock_history(1,-1)'),/Página no válida/);
 const history=(await as(admin,'select public.ob_stock_history(1) as h')).rows[0].h;
 const orders=history.filter(e=>e.details.reason==='pedido');
 assert.ok(orders.length>0);
 for(const sale of orders){
  assert.ok(sale.details.delta<0);
  const refunds=history.filter(e=>e.details.reason==='cancelacion'&&e.details.order_id===sale.details.order_id&&e.details.variant_id===sale.details.variant_id);
  assert.equal(refunds.length,1);assert.equal(refunds[0].details.delta,-sale.details.delta);
 }
});
