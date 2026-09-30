(function () {
  'use strict';
  const accountPage=document.body.classList.contains('ob-account-page');
  const cfg = window.OBCommerceConfig || {};
  const configured = /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(cfg.supabaseUrl || '') && !!cfg.publishableKey && !!window.OBCreateClient;
  const client = configured ? window.OBCreateClient(cfg.supabaseUrl, cfg.publishableKey) : null;
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money = n => 'S/ ' + (n / 100).toFixed(2);
  let user = null, account = null, accountRevision = 0;
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
  function status(message) { if(!dialog.open)show('<h2>OVERBLACK</h2>');const el=dialog.querySelector('.ob-status'); if(el) el.textContent=message; }
  async function run(button, fn) { if(button)button.disabled=true;try {await fn();}catch(e){status(e.message || 'No se pudo completar. Vuelve a intentarlo.');}finally {if(button)button.disabled=false;} }
  function needClient() { if(!client) throw Error('Estamos preparando las cuentas de OVERBLACK. Podrás registrarte cuando se active la tienda.'); return client; }
  async function rpc(name,args={}) { const {data,error}=await needClient().rpc(name,args);if(error)throw error;return data; }
  async function select(table, columns='*') {const {data,error}=await needClient().from(table).select(columns);if(error)throw error;return data;}
  let avatarVersion=0;
  async function renderAvatar(){
    const version=++avatarVersion;
    const img=document.createElement('img');img.alt='';img.className='ob-avatar';img.src='avatar-ob.svg';
    trigger.replaceChildren(img,document.createTextNode(' MI CUENTA'));
    if(account?.avatar_path){const {data,error}=await client.storage.from('avatars').createSignedUrl(account.avatar_path,3600);if(!error&&version===avatarVersion)img.src=data.signedUrl;}
  }
  function acceptAccount(value) {
    accountRevision++;
    account=value;
    renderAccountStats();
    renderAvatar();
    window.dispatchEvent(new CustomEvent('ob:account',{detail:account}));
  }
  window.OBCommerce={ready,rpc,refresh,acceptAccount,openAccount,client,select,show,run,esc,
    get user(){return user;},get account(){return account;},
    async requireUser(){await ready;if(!user){auth();return false;}return true;}
  };
  async function refresh() {
    const revision=++accountRevision;
    const uid=user?.id;
    const value=uid?await rpc('ob_account'):null;
    if(user?.id!==uid||revision!==accountRevision)return account;
    account=value;
    renderAccountStats();
    renderAvatar();
    window.dispatchEvent(new CustomEvent('ob:account',{detail:account}));
    return account;
  }
  const trigger=document.createElement('button');trigger.className='ob-account-trigger';trigger.textContent='MI CUENTA';trigger.onclick=()=>run(null,openAccount);
  document.querySelector('.nav .cart')?.before(trigger);
  if(accountPage)document.querySelector('header')?.append(trigger);
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
        if(signup&&!result.data.session)confirmationPending(f.get('email'));
        else if(recover)confirmationPending(f.get('email'),true);
        else {user=result.data.user||user;await refresh();await openAccount();}
      });
    };
  }

  function confirmationPending(email, recover=false) {
    show('<section class="ob-confirmation" aria-labelledby="ob-confirm-title"><div class="ob-confirm-icon" aria-hidden="true">✉</div><p class="ob-confirm-label">'+(recover?'RECUPERA EL ACCESO A TU CUENTA':'UN PASO MÁS PARA ENTRAR')+'</p><h2 id="ob-confirm-title" tabindex="-1">'+(recover?'Revisa tu correo':'Confirma tu correo')+'</h2><p>'+(recover?'Si hay una cuenta asociada, recibirás un enlace de recuperación en:':'Revisa el correo que usaste para registrarte:')+'</p><strong class="ob-confirm-email">'+esc(email)+'</strong><div class="ob-confirm-wait" role="status">'+(recover?'Continúa desde el enlace del correo':'Pendiente de confirmación')+'</div><ol><li>'+(recover?'Abre el mensaje de recuperación de tu cuenta.':'Abre el mensaje de <strong>OverBlack</strong>.')+'</li>'+(recover?'<li>Pulsa el enlace para restablecer tu contraseña.</li><li>Elige y guarda tu nueva contraseña en la página que se abre.</li>':'<li>Pulsa <strong>CONFIRMAR MI CUENTA</strong> en el correo.</li><li>Después, vuelve aquí e inicia sesión.</li>')+'</ol><p class="ob-confirm-help">¿No lo encuentras? Revisa Spam o Correo no deseado. Puede tardar unos minutos.</p><button class="ob-submit" id="ob-confirm-login">'+(recover?'VOLVER A INICIAR SESIÓN':'YA CONFIRMÉ · INICIAR SESIÓN')+' <span aria-hidden="true">↗</span></button><button class="ob-secondary" id="ob-confirm-back">Corregir mi correo</button><a class="ob-confirm-shop" href="index.html">Seguir viendo la tienda</a></section>');
    dialog.classList.add('ob-auth-theme');
    document.getElementById('ob-confirm-login').onclick=()=>{auth();dialog.querySelector('input[name="email"]').value=email;};
    document.getElementById('ob-confirm-back').onclick=()=>auth(recover?'recover':'signup');
    dialog.scrollTop=0;
    document.getElementById('ob-confirm-title').focus({preventScroll:true});
    if(accountPage)dialog.scrollIntoView({block:'start'});
  }

  const statusLabels={pendiente_adelanto:'Pendiente de adelanto',adelanto_confirmado:'Adelanto confirmado',nuevo:'Nuevo',preparando:'Preparando',enviado:'Enviado',entregado:'Entregado / Pagado',cancelado:'Cancelado'};
  async function orders(isAdmin) {
    await refresh();if(!user||(isAdmin&&!account?.admin))throw Error('Acceso denegado.');
    let query=client.from('ob_orders').select('*,ob_order_items(*)').order('created_at',{ascending:false}).limit(100);
    if(!isAdmin)query=query.eq('user_id',user.id);
    const {data,error}=await query;if(error)throw error;
    show('<h2>'+ (isAdmin?'OVERBLACK ADMIN · Pedidos':'Mis pedidos')+'</h2>'+(!data.length?'<p>No hay pedidos.</p>':'')+data.map(o=>'<div class="ob-row"><div><b>#OB-'+String(o.id).padStart(5,'0')+' · '+esc(statusLabels[o.status])+'</b><p>'+o.ob_order_items.map(i=>esc(i.name)+' / '+esc(i.size)+' × '+i.quantity).join('<br>')+'</p><p>'+money(o.total)+' · Descuento: '+money(o.discount)+' · Puntos usados: '+o.points_spent+' · '+(o.status==='entregado'?'Pagado':o.status==='cancelado'?'Cancelado':o.payment_method==='shalom_adelanto'?'Shalom · Adelanto '+money(o.advance_due):'Contra entrega — por cobrar')+'<br>'+esc(o.delivery.recipient)+' · '+esc(o.delivery.phone)+'<br>'+esc(o.delivery.address||o.delivery.destination)+' · '+esc(o.delivery.district||o.delivery.agency)+'<br>'+esc(o.delivery.reference)+(o.tracking?'<br>Envío: '+esc(o.tracking):'')+'</p>'+(isAdmin&&['preparando','enviado'].includes(o.status)?'<form data-tracking-form="'+o.id+'"><label>Código o referencia de envío<input name="tracking" required maxlength="100" value="'+esc(o.tracking||'')+'"></label><button>Guardar envío</button></form>':'')+(isAdmin&&!['entregado','cancelado'].includes(o.status)?'<div class="ob-actions">'+({pendiente_adelanto:['adelanto_confirmado','cancelado'],adelanto_confirmado:['preparando','cancelado'],nuevo:['preparando','cancelado'],preparando:['enviado','cancelado'],enviado:['entregado','cancelado']}[o.status]||[]).map(s=>'<button data-order="'+o.id+'" data-status="'+s+'">'+statusLabels[s]+'</button>').join('')+'</div>':'')+'</div></div>').join(''),true);
    dialog.querySelectorAll('[data-tracking-form]').forEach(form=>form.onsubmit=e=>{e.preventDefault();run(e.submitter,async()=>{await rpc('ob_tracking',{p_order:Number(form.dataset.trackingForm),p_tracking:new FormData(form).get('tracking')});await orders(true);status('Información de envío guardada.');});});
    dialog.querySelectorAll('[data-order]').forEach(b=>b.onclick=()=>run(b,async()=>{if(b.dataset.status==='cancelado'&&!confirm('¿Cancelar este pedido y devolver stock y puntos?'))return;if(b.dataset.status==='entregado'&&!confirm('¿Confirmas que el pedido fue entregado y cobrado?'))return;await rpc('ob_order_status',{p_order:Number(b.dataset.order),p_status:b.dataset.status});await orders(true);}));
  }
  async function admin() {
    await refresh();if(!account?.admin)throw Error('Acceso denegado.');
    show('<h2>Bienvenido, '+esc(account.username||'OVERBLACK')+'</h2><p>OVERBLACK ADMIN</p><div class="ob-actions"><button id="ob-admin-orders">Pedidos</button><button id="ob-admin-stock">Productos / stock</button><button id="ob-admin-shipping">Centro de configuración</button><button id="ob-admin-customers">Clientes / puntos</button>'+(account.super_admin?'<button id="ob-admin-security">Seguridad y administradores</button>':'')+'</div><div class="ob-actions">'+['dashboard','coupons','errors','audit','manual','recovery'].map((k,i)=>'<button data-center="'+k+'">'+['Dashboard','Cupones','Centro de errores','Auditoría','Manual privado','Papelera / recuperación'][i]+'</button>').join('')+'</div><p>Recompensas: '+(account.rewards||[[2500,5],[5000,10],[10000,15]]).map(r=>r[0]+' = '+r[1]+'%').join(' · ')+'. Una por pedido, elegida por el cliente.</p>');
    document.getElementById('ob-admin-security')?.addEventListener('click',()=>run(null,()=>window.OBAdminSecurity({client,rpc,show,run,status,esc,refresh})));
    document.getElementById('ob-admin-orders').onclick=()=>run(null,()=>orders(true));
    document.getElementById('ob-admin-customers').onclick=()=>run(null,()=>window.OBAdminCustomers({rpc,show,run,esc}));
    document.getElementById('ob-admin-stock').onclick=()=>run(null,()=>window.OBEditProducts({client,select,rpc,show,run,status,esc}));
    const center=section=>window.OBAdminCenter(section,{client,rpc,select,show,run,status,esc});
    document.querySelectorAll('[data-center]').forEach(b=>b.onclick=()=>run(b,()=>center(b.dataset.center)));
    document.getElementById('ob-admin-shipping').onclick=()=>run(null,()=>center('settings'));
  }

  async function openAccount(){
    if(!accountPage){location.href='account.html';return;}
    await ready;
    if(!user){auth();return;}
    await refresh();
    show('<h2>Bienvenido, '+esc(account.username||'OVERBLACK')+'</h2><p>'+esc(user.email)+'</p><div id="ob-account-stats"></div><div class="ob-actions"><button id="ob-profile">Datos y foto de perfil</button><button id="ob-my-orders">Mis pedidos</button><button id="ob-my-points">Historial de puntos</button><a href="index.html#stack">Jugar STACK</a></div>'+(account.admin?'<button id="ob-admin">PANEL ADMIN</button>':'')+'<button id="ob-signout">Cerrar sesión</button>');
    renderAccountStats();
    document.getElementById('ob-profile').onclick=()=>run(null,()=>window.OBEditProfile({client,user,account,rpc,show,run,status,esc,refresh,openAccount}));
    document.getElementById('ob-my-orders').onclick=()=>run(null,()=>orders(false));
    const addressesButton=document.createElement('button');addressesButton.textContent='Mis direcciones';addressesButton.onclick=()=>run(addressesButton,()=>window.OBAddressBook({rpc,show,run,esc,openAccount}));document.getElementById('ob-my-orders').after(addressesButton);
    document.getElementById('ob-my-points').onclick=()=>run(null,()=>pointsHistory());
    const rewardsButton=document.createElement('button');rewardsButton.textContent='Mis descuentos';rewardsButton.onclick=()=>run(rewardsButton,()=>rewardsHistory());document.getElementById('ob-my-points').after(rewardsButton);
    document.getElementById('ob-admin')?.addEventListener('click',()=>run(null,admin));
    document.getElementById('ob-signout').onclick=e=>run(e.target,async()=>{const {error}=await client.auth.signOut();if(error)throw error;user=null;account=null;auth();});
  }

  function renderAccountStats(){
    const root=document.getElementById('ob-account-stats');if(!root||!account)return;
    const rewards=account.rewards||[[2500,5],[5000,10],[10000,15]];
    const target=(rewards.find(r=>r[0]>account.points)||rewards.at(-1))[0];
    root.innerHTML='<p><strong>'+account.points.toLocaleString('es-PE')+' puntos</strong> · Récord: '+account.best+' cajas · '+account.best_score+' puntos</p><p>Intentos de hoy: '+account.used+' usados · '+Math.max(0,(account.daily_limit||5)-account.used)+' disponibles</p><p>Se renuevan a las 00:00 de Perú.</p>'+rewards.map(([pts,pct])=>'<p>'+pts.toLocaleString('es-PE')+' puntos = '+pct+'% · '+(account.points>=pts?'Disponible al comprar':'Te faltan '+(pts-account.points).toLocaleString('es-PE')+' puntos')+'</p>').join('')+'<progress max="'+target+'" value="'+Math.min(target,account.points)+'" aria-label="Progreso de recompensas"></progress>';
  }
  async function rewardsHistory(page=0){
    const uid=user?.id;if(!uid)return auth();
    await refresh();
    const {data,error}=await client.from('ob_orders').select('id,created_at,status,points_spent,discount').eq('user_id',uid).gt('points_spent',0).order('id',{ascending:false}).range(page*50,page*50+50);
    if(error)throw error;if(user?.id!==uid)return;
    show('<h2>Mis descuentos</h2><div id="ob-account-stats"></div><p>Elige tu recompensa al revisar la compra. Los puntos se descuentan solo cuando se confirma el pedido. Puedes utilizar una recompensa por pedido.</p><a href="index.html#productos">Ver productos</a><h3>Recompensas utilizadas</h3>'+(!data.length?'<p>Todavía no has utilizado puntos en un pedido.</p>':'')+data.slice(0,50).map(o=>'<div class="ob-row"><div><b>#OB-'+String(o.id).padStart(5,'0')+'</b><p>'+esc(new Date(o.created_at).toLocaleString('es-PE',{timeZone:'America/Lima'}))+' · Perú<br>'+o.points_spent+' puntos · Descuento '+money(o.discount)+'<br>'+(o.status==='cancelado'?'Pedido cancelado · puntos devueltos':'Recompensa aplicada a este pedido')+'</p></div></div>').join('')+'<div class="ob-actions"><button id="ob-rewards-prev" '+(!page?'disabled':'')+'>Anterior</button><span>Página '+(page+1)+'</span><button id="ob-rewards-next" '+(data.length<=50?'disabled':'')+'>Siguiente</button></div><button id="ob-rewards-back">Volver a Mi Cuenta</button>');
    renderAccountStats();
    document.getElementById('ob-rewards-prev').onclick=e=>run(e.target,()=>rewardsHistory(page-1));
    document.getElementById('ob-rewards-next').onclick=e=>run(e.target,()=>rewardsHistory(page+1));
    document.getElementById('ob-rewards-back').onclick=()=>run(null,openAccount);
  }
  async function pointsHistory(page=0){
    const data=await rpc('ob_points_history',{p_page:page});
    const labels={stack:'STACK',reserva_pedido:'Puntos usados en pedido',devolucion_pedido:'Devolución por cancelación'};
    show('<h2>Historial de puntos</h2><p>Saldo actual: '+data.balance+' puntos</p>'+(!data.movements.length?'<p>Aún no tienes movimientos.</p>':'')+data.movements.map(p=>'<div class="ob-row"><span>'+esc(labels[p.reason]||p.reason)+'<br><small>'+esc(new Date(p.created_at).toLocaleString('es-PE',{timeZone:'America/Lima'}))+' · Perú</small><br>Saldo anterior: '+p.balance_before+' · Saldo final: '+p.balance_after+'</span><b>'+(p.delta>0?'+':'')+p.delta+' pts</b></div>').join('')+'<div class="ob-actions"><button id="ob-points-prev" '+(!page?'disabled':'')+'>Anterior</button><span>Página '+(page+1)+'</span><button id="ob-points-next" '+((page+1)*50>=data.total?'disabled':'')+'>Siguiente</button></div><button id="ob-points-back">Volver a Mi Cuenta</button>');
    document.getElementById('ob-points-prev').onclick=e=>run(e.target,()=>pointsHistory(page-1));
    document.getElementById('ob-points-next').onclick=e=>run(e.target,()=>pointsHistory(page+1));
    document.getElementById('ob-points-back').onclick=()=>run(null,openAccount);
  }
  let accountRefreshing=false;
  async function refreshVisibleAccount(){
    if(document.hidden||!user||accountRefreshing)return;
    accountRefreshing=true;try{await refresh();}catch{}finally{accountRefreshing=false;}
  }
  setInterval(refreshVisibleAccount,15000);
  document.addEventListener('visibilitychange',refreshVisibleAccount);
  window.addEventListener('focus',refreshVisibleAccount);

  (async()=>{
    let recovery=false;
    try{
      if(client){
        client.auth.onAuthStateChange((event,session)=>{
          user=session?.user||null;
          if(event==='SIGNED_OUT'){acceptAccount(null);if(accountPage)auth();else{dialog.close();dialog.innerHTML='';}}
          else if(event!=='INITIAL_SESSION')setTimeout(()=>refresh().catch(()=>{}),0);
          if(event==='PASSWORD_RECOVERY'){recovery=true;setTimeout(()=>auth('reset'),0);}
        });
        const {data,error}=await client.auth.getSession();if(error)throw error;
        user=data.session?.user||null;
      }
    }catch{user=null;}
    finally{authReady();}
    if(accountPage&&!recovery)run(null,openAccount);else if(!accountPage&&!recovery)refresh().catch(()=>{});

  })();
})();
