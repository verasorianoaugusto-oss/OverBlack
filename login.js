(function () {
  'use strict';
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
  dialog.addEventListener('click', e => { if(e.target === dialog) { const r=dialog.getBoundingClientRect(); if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom) dialog.close(); } });
  function show(html, wide=false) {
    dialog.classList.toggle('ob-wide', wide);
    dialog.classList.remove('ob-auth-theme');
    dialog.innerHTML = '<button class="ob-close" aria-label="Cerrar">×</button>' + html + '<p class="ob-status" role="status" aria-live="polite"></p>';
    dialog.querySelector('.ob-close').onclick = () => dialog.close();
    if (!dialog.open) dialog.showModal();
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

  async function openAccount(){
    await ready;
    if(!user){auth();return;}
    await refresh();
    show('<h2>Hola, '+esc(account.username||'OVERBLACK')+'</h2><p>'+esc(user.email)+'</p><p>Estamos preparando los pedidos y beneficios de tu cuenta.</p><button id="ob-signout">Cerrar sesión</button>');
    document.getElementById('ob-signout').onclick=e=>run(e.target,async()=>{const {error}=await client.auth.signOut();if(error)throw error;user=null;account=null;dialog.close();});
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
    if(!user&&!dismissed&&!recovery)auth();
  })();
})();
