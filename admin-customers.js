window.OBAdminCustomers=async function({rpc,show,run,esc},search='',page=0){
 const context={rpc,show,run,esc},data=await rpc('ob_admin_customers',{p_search:search,p_page:page});
 const date=s=>new Date(s).toLocaleString('es-PE');
 show('<h2>Clientes y puntos</h2><form id="ob-customer-search"><label>Buscar por nombre o correo<input name="search" maxlength="150" value="'+esc(search)+'"></label><button>Buscar</button></form><p>'+data.total+' clientes encontrados</p>'+data.customers.map(p=>'<div class="ob-row"><div><button data-customer="'+p.id+'">'+esc(p.username||'Sin nombre')+'</button><p>'+esc(p.email)+'</p></div><span data-customer-points="'+p.id+'">'+p.points+' pts · Récord: '+p.best+'</span></div>').join('')+'<div class="ob-actions"><button id="ob-customers-prev" '+(page===0?'disabled':'')+'>Anterior</button><span>Página '+(page+1)+'</span><button id="ob-customers-next" '+((page+1)*25>=data.total?'disabled':'')+'>Siguiente</button></div>',true);
 const root=document.getElementById("ob-customer-search");
 window.OBRefreshCustomerPoints=async()=>{
  if(!root.isConnected)return;
  const fresh=await rpc("ob_admin_customers",{p_search:search,p_page:page});
  if(!root.isConnected)return;
  for(const p of fresh.customers){const el=document.querySelector('[data-customer-points="'+p.id+'"]');if(el)el.textContent=p.points+" pts · Récord: "+p.best;}
 };
 document.getElementById('ob-customer-search').onsubmit=e=>{e.preventDefault();run(e.submitter,()=>window.OBAdminCustomers(context,new FormData(e.target).get('search'),0));};
 document.getElementById('ob-customers-prev').onclick=e=>run(e.target,()=>window.OBAdminCustomers(context,search,page-1));
 document.getElementById('ob-customers-next').onclick=e=>run(e.target,()=>window.OBAdminCustomers(context,search,page+1));
 document.querySelectorAll('[data-customer]').forEach(b=>b.onclick=()=>run(b,async()=>{
  const p=await rpc('ob_admin_customers',{p_user:b.dataset.customer});
  show('<h2>'+esc(p.username||'Cliente')+'</h2><p>'+esc(p.email)+'<br>Registro: '+esc(date(p.created_at))+'</p><p><b>'+p.points+' puntos</b> · Récord STACK: '+p.best+'</p><p>Intentos de hoy: '+p.used+' usados · '+Math.max(0,p.daily_limit-p.used)+' disponibles</p><h3>Últimos pedidos (hasta 100)</h3>'+(!p.orders.length?'<p>Sin pedidos.</p>':p.orders.map(o=>'<p>#OB-'+String(o.id).padStart(5,'0')+' · '+esc(o.status.replaceAll('_',' '))+' · S/ '+(o.total/100).toFixed(2)+'<br>'+esc(date(o.created_at))+'</p>').join(''))+'<h3>Últimos movimientos de puntos (hasta 50)</h3>'+(!p.ledger.length?'<p>Sin movimientos.</p>':p.ledger.map(l=>'<p>'+(l.delta>0?'+':'')+l.delta+' · '+esc(l.reason)+' · '+esc(date(l.created_at))+'<br>Saldo anterior: '+l.balance_before+' · Saldo final: '+l.balance_after+'</p>').join(''))+'<button id="ob-customer-back">Volver a clientes</button>',true);
  document.getElementById('ob-customer-back').onclick=e=>run(e.target,()=>window.OBAdminCustomers(context,search,page));
 }));
};
window.addEventListener('ob:account',()=>{if(window.OBCommerce?.account?.admin)window.OBRefreshCustomerPoints?.().catch(()=>{});});
