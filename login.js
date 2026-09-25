(function () {
  'use strict';
  const accountPage=document.body.classList.contains('ob-account-page');
  const cfg = window.OBCommerceConfig || {};
  const configured = /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(cfg.supabaseUrl || '') && !!cfg.publishableKey && !!window.OBCreateClient;
  const client = configured ? window.OBCreateClient(cfg.supabaseUrl, cfg.publishableKey) : null;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = n => 'S/ ' + (n / 100).toFixed(2);
  let user = null, account = null, catalog = [], variants = [], shipping = [], basket = [], pendingOrder = null;
  let authReady;
  const ready = new Promise(r => authReady = r);
  const dialog = document.createElement('dialog');
  dialog.className = 'ob-commerce-dialog';
  dialog.setAttribute('aria-label', 'Mi cuenta OVERBLACK');
  document.body.append(dialog);
  const sidebar=accountPage?document.createElement('nav'):null;
  if(sidebar){sidebar.className='ob-account-sidebar';sidebar.setAttribute('aria-label','Opciones de mi cuenta');document.body.append(sidebar);}
  dialog.addEventListener('click', e => { if(e.target === dialog) { const r=dialog.getBoundingClientRect(); if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom) dialog.close(); } });
  function show(html, wide=false) {
    dialog.classList.toggle('ob-wide', wide);
    dialog.classList.remove('ob-auth-theme');
    dialog.innerHTML = '<button class="ob-close" aria-label="Cerrar">×</button>' + html + '<p class="ob-status" role="status" aria-live="polite"></p>';
    dialog.querySelector('.ob-close').onclick = () => dialog.close();
    if(account?.admin&&!html.includes('ob-auth-form')&&!html.includes('id="ob-signout"')){const back=document.createElement('button');back.className='ob-secondary';back.textContent=html.includes('id="ob-admin-stock"')?'← Mi cuenta':'← Panel ADMIN';back.onclick=()=>run(back,html.includes('id="ob-admin-stock"')?openAccount:admin);dialog.append(back);}
    if(accountPage){dialog.setAttribute('open','');document.getElementById('ob-account-loading')?.remove();dialog.querySelector('.ob-close').hidden=true;}else if (!dialog.open) dialog.showModal();
    if(sidebar){
      sidebar.replaceChildren();const label=document.createElement('p');label.textContent='TU ESPACIO OVERBLACK';sidebar.append(label);
      const home=document.createElement('button');home.textContent='Mi cuenta';home.onclick=()=>run(home,openAccount);sidebar.append(home);
      if(!html.includes('ob-auth-form')){
        const actions=dialog.querySelector('.ob-actions');if(actions)sidebar.append(actions);
        for(const id of ['ob-admin','ob-signout']){const button=dialog.querySelector('#'+id);if(button)sidebar.append(button);}
        for(const button of [...dialog.children])if(button.tagName==='BUTTON'&&!button.classList.contains('ob-close')){if(button.textContent==='← Mi cuenta')button.remove();else sidebar.append(button);}
      }
      const shop=document.createElement('a');shop.href='index.html';shop.textContent='← Volver a la tienda';sidebar.append(shop);
    }
    window.dispatchEvent(new Event('ob:dialog'));
  }
  function status(message) { const el=dialog.querySelector('.ob-status'); if(el) el.textContent=message; }
  async function run(button, fn) { if(button)button.disabled=true;try {await fn();}catch(e){status(e.message || 'No se pudo completar. Vuelve a intentarlo.');}finally {if(button)button.disabled=false;} }
  function needClient() { if(!client) throw Error('Estamos preparando las cuentas de OVERBLACK. Podrás registrarte cuando se active la tienda.'); return client; }
  async function rpc(name,args={}) { const {data,error}=await needClient().rpc(name,args);if(error)throw error;return data; }
  async function select(table, columns='*') {const {data,error}=await needClient().from(table).select(columns);if(error)throw error;return data;}
  async function refresh() {
    account = user ? await rpc('ob_account') : null;
    trigger.textContent = 'MI CUENTA';
    window.dispatchEvent(new CustomEvent('ob:account',{detail:account}));
    return account;
  }
  const trigger=document.createElement('button');trigger.className='ob-account-trigger';trigger.textContent='MI CUENTA';trigger.onclick=()=>run(null,openAccount);
  document.querySelector('.nav .cart')?.before(trigger);
  function auth(mode='login') {
    const signup=mode==='signup',recover=mode==='recover',reset=mode==='reset';
    show('<div class="ob-auth-edition" aria-hidden="true"><span>OB / STREET DEPT.</span><span>EST. PERÚ</span></div><div class="ob-auth-brand"><img src="logo-overblack.svg" alt="" width="58" height="48"><span>OVER<span class="ob-auth-word">BLACK</span></span></div><div class="ob-auth-stamp" aria-hidden="true">TU ESTILO. TUS REGLAS.</div><h2 class="ob-auth-title">'+(signup?'Crear cuenta':recover?'Recuperar contraseña':reset?'Nueva contraseña':'Iniciar sesión')+'</h2><p class="ob-auth-caption">ÚNETE A LA COMUNIDAD</p><form id="ob-auth-form">'+
      (signup?'<label>Nombre de usuario<input name="username" autocomplete="nickname" required maxlength="80"></label>':'')+
      (!reset?'<label>Correo electrónico<input type="email" name="email" autocomplete="email" required maxlength="254"></label>':'')+
      (!recover?'<label>Contraseña<input type="password" name="password" autocomplete="'+(signup||reset?'new-password':'current-password')+'" required minlength="8" maxlength="128"></label>':'')+
      (signup||reset?'<label>Confirmar contraseña<input type="password" name="confirm" autocomplete="new-password" required minlength="8" maxlength="128"></label>':'')+
      (signup?'<p class="ob-auth-notice">Tu nombre de usuario y correo se usarán para gestionar tu cuenta. Supabase procesa el registro y la autenticación. Te enviaremos un correo para confirmar tu dirección.</p>':'')+
      '<button class="ob-submit">'+(signup?'CREAR CUENTA':recover?'ENVIAR ENLACE':reset?'GUARDAR CONTRASEÑA':'INICIAR SESIÓN')+' <span aria-hidden="true">↗</span></button></form><div class="ob-actions"><button class="ob-secondary" id="ob-switch">'+(signup||recover||reset?'Iniciar sesión':'Crear cuenta')+'</button>'+(!signup&&!recover&&!reset?'<button class="ob-secondary" id="ob-recover">Olvidé mi contraseña</button>':'')+'</div><div class="ob-auth-footer"><span aria-hidden="true">✳</span> SÉ PARTE DE ALGO MÁS GRANDE</div>');
    dialog.classList.add('ob-auth-theme');
    document.getElementById('ob-switch').onclick=()=>auth(signup||recover||reset?'login':'signup');
    document.getElementById('ob-recover')?.addEventListener('click',()=>auth('recover'));
    document.getElementById('ob-auth-form').onsubmit=e=>{
      e.preventDefault();const f=new FormData(e.target);
      run(e.submitter,async()=>{
        needClient();
        if((signup||reset)&&f.get('password')!==f.get('confirm')) throw Error('Las contraseñas no coinciden.');
        const redirect=new URL('index.html',location.href).href;
        let result;
        if(signup) {
          result=await client.auth.signUp({email:f.get('email'),password:f.get('password'),options:{emailRedirectTo:redirect,data:{username:f.get('username')}}});
        } else if(recover) result=await client.auth.resetPasswordForEmail(f.get('email'),{redirectTo:redirect});
        else if(reset) result=await client.auth.updateUser({password:f.get('password')});
        else result=await client.auth.signInWithPassword({email:f.get('email'),password:f.get('password')});
        if(result.error){
          const code=result.error.code;
          if(code==='email_address_not_authorized'||code==='unexpected_failure'&&/email/i.test(result.error.message))throw Error('No pudimos enviar la confirmación. La tienda necesita terminar de configurar su servicio de correo.');
          if(code==='over_email_send_rate_limit')throw Error('Se alcanzó el límite temporal de correos. Espera unos minutos antes de volver a intentarlo.');
          if(code==='email_not_confirmed')throw Error('Confirma tu correo antes de iniciar sesión. Revisa también spam.');
          if(code==='invalid_credentials')throw Error('El correo o la contraseña no son correctos.');
          throw result.error;
        }
        if(signup||recover)status('Revisa tu correo para continuar. Si no aparece, revisa también spam.');
        else {user=result.data.user||user;await refresh();await openAccount();}
      });
    };
  }

  async function loadAdminCatalog(){[catalog,variants,shipping]=await Promise.all([select('ob_products'),select('ob_variants'),select('ob_shipping')]);}
  const statusLabels={nuevo:'Nuevo',preparando:'Preparando',enviado:'Enviado',entregado:'Entregado / Pagado',cancelado:'Cancelado'};
  async function orders(isAdmin) {
    await refresh();if(!account?.admin)throw Error('Acceso denegado.');
    let query=client.from('ob_orders').select('*,ob_order_items(*)').order('created_at',{ascending:false}).limit(100);
    if(!isAdmin)query=query.eq('user_id',user.id);
    const {data,error}=await query;if(error)throw error;
    show('<h2>'+ (isAdmin?'OVERBLACK ADMIN · Pedidos':'Mis pedidos')+'</h2>'+(!data.length?'<p>No hay pedidos.</p>':'')+data.map(o=>'<div class="ob-row"><div><b>#OB-'+String(o.id).padStart(5,'0')+' · '+esc(statusLabels[o.status])+'</b><p>'+o.ob_order_items.map(i=>esc(i.name)+' / '+esc(i.size)+' × '+i.quantity).join('<br>')+'</p><p>'+money(o.total)+' · '+(o.status==='entregado'?'Pagado':o.status==='cancelado'?'Cancelado':'Contra entrega — por cobrar')+'<br>'+esc(o.delivery.recipient)+' · '+esc(o.delivery.phone)+'<br>'+esc(o.delivery.address)+' · '+esc(o.delivery.district)+'<br>'+esc(o.delivery.reference)+'</p>'+(isAdmin&&!['entregado','cancelado'].includes(o.status)?'<div class="ob-actions">'+({nuevo:['preparando','cancelado'],preparando:['enviado','cancelado'],enviado:['entregado','cancelado']}[o.status]||[]).map(s=>'<button data-order="'+o.id+'" data-status="'+s+'">'+statusLabels[s]+'</button>').join('')+'</div>':'')+'</div></div>').join(''),true);
    dialog.querySelectorAll('[data-order]').forEach(b=>b.onclick=()=>run(b,async()=>{if(b.dataset.status==='cancelado'&&!confirm('¿Cancelar este pedido y devolver stock y puntos?'))return;if(b.dataset.status==='entregado'&&!confirm('¿Confirmas que el pedido fue entregado y cobrado?'))return;await rpc('ob_order_status',{p_order:Number(b.dataset.order),p_status:b.dataset.status});await orders(true);}));
  }
  async function admin() {
    await refresh();if(!account?.admin)throw Error('Acceso denegado.');
    show('<h2>Bienvenido, '+esc(account.username||'OVERBLACK')+'</h2><p>OVERBLACK ADMIN</p><div class="ob-actions"><button id="ob-admin-orders">Pedidos</button><button id="ob-admin-stock">Productos / stock</button><button id="ob-admin-shipping">Envíos</button><button id="ob-admin-customers">Clientes / puntos</button></div><p>Recompensas: 2,500 = 5%, 5,000 = 10%, 10,000 = 15%. Una por pedido, elegida por el cliente.</p>');
    document.getElementById('ob-admin-orders').onclick=()=>run(null,()=>orders(true));
    document.getElementById('ob-admin-customers').onclick=()=>run(null,async()=>{const rows=await select('ob_profiles');show('<h2>Clientes / puntos</h2>'+rows.map(p=>'<div class="ob-row"><span>'+esc(p.username||p.id)+'<br><small>Récord: '+p.best+' cajas</small></span><b>'+p.points+' pts</b></div>').join(''),true);});
    document.getElementById('ob-admin-stock').onclick=()=>run(null,()=>window.OBEditProducts({client,select,rpc,show,run,status,esc}));
    document.getElementById('ob-admin-shipping').onclick=()=>{
      show('<h2>Zonas y tarifas de envío</h2><form id="ob-shipping-form">'+['department','province','district'].map((name,i)=>'<label>'+['Departamento','Provincia','Distrito'][i]+'<input name="'+name+'" required maxlength="80"></label>').join('')+'<label>Tarifa S/<input name="fee" type="number" min="0" step="0.01" required></label><label class="ob-check"><input name="active" type="checkbox" checked> Zona activa</label><button class="ob-submit">Guardar zona</button></form>');
      document.getElementById('ob-shipping-form').onsubmit=e=>{e.preventDefault();run(e.submitter,async()=>{const f=new FormData(e.target);await rpc('ob_shipping_save',{p_department:f.get('department'),p_province:f.get('province'),p_district:f.get('district'),p_fee:Math.round(Number(f.get('fee'))*100),p_active:f.has('active')});await loadAdminCatalog();status('Zona guardada.');});};
    };
  }

  async function openAccount(){
    if(!accountPage){location.href='account.html';return;}
    await ready;
    if(!user){auth();return;}
    await refresh();
    show('<h2>Bienvenido, '+esc(account.username||'OVERBLACK')+'</h2><p>'+esc(user.email)+'</p><p>Estamos preparando los pedidos y beneficios de tu cuenta.</p>'+(account.admin?'<button id="ob-admin">PANEL ADMIN</button>':'')+'<button id="ob-signout">Cerrar sesión</button>');
    document.getElementById('ob-admin')?.addEventListener('click',()=>run(null,admin));
    document.getElementById('ob-signout').onclick=e=>run(e.target,async()=>{const {error}=await client.auth.signOut();if(error)throw error;user=null;account=null;auth();});
  }

  async function syncProductCards(){
    const [rows,sizes]=await Promise.all([select('ob_products'),select('ob_variants')]);
    const update=()=>document.querySelectorAll('#grid .product').forEach(card=>{
      const p=rows.find(p=>p.name===card.querySelector('h3')?.textContent);if(!p)return;
      card.hidden=!!p.archived;if(p.archived)return;
      if(p.image_path){const photo=card.querySelector('.photo');photo.innerHTML='';const img=document.createElement('img');img.alt=p.name;img.src=client.storage.from('product-images').getPublicUrl(p.image_path).data.publicUrl;img.style.cssText='width:100%;height:100%;object-fit:contain';photo.append(img);}
      if(p.price){card.querySelector('.price').textContent=money(p.price);let label=card.querySelector('.ob-availability');if(!label){label=document.createElement('p');label.className='ob-availability';card.querySelector('.price').after(label);}const vs=sizes.filter(v=>v.product_id===p.id&&v.stock>0);label.textContent=p.active&&vs.length?'En stock · Tallas: '+vs.map(v=>v.size).join(', '):'Sin stock';}
    });
    update();const grid=document.getElementById('grid');if(grid)new MutationObserver(update).observe(grid,{childList:true});
  }

  let dismissed=false;
  try{dismissed=sessionStorage.getItem('ob.login.dismissed')==='1';}catch{}
  dialog.addEventListener('close',()=>{try{sessionStorage.setItem('ob.login.dismissed','1');}catch{}});
  (async()=>{
    let recovery=false;
    try{
      if(client){
        client.auth.onAuthStateChange((event,session)=>{
          user=session?.user||null;
          if(event==='PASSWORD_RECOVERY'){recovery=true;setTimeout(()=>auth('reset'),0);}
        });
        const {data,error}=await client.auth.getSession();if(error)throw error;
        user=data.session?.user||null;
      }
    }catch{user=null;}
    finally{authReady();}
    if(accountPage&&!recovery)run(null,openAccount);else if(!user&&!dismissed&&!recovery)auth();
    if(!accountPage&&client)syncProductCards().catch(()=>{});
  })();
})();
