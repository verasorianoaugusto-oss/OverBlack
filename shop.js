(() => {
 'use strict';
 const C=window.OBCommerce;if(!document.getElementById('grid')||!C)return;
 const {client,rpc,select,show,run,esc}=C;
 const money=n=>'S/ '+(n/100).toFixed(2);
 let catalog=[],sizes=[],basket=[],settings={},loadedUser=null,syncing=null;
 try{const saved=JSON.parse(sessionStorage.getItem('ob.guest.cart')||'[]');if(Array.isArray(saved))basket=saved.filter(i=>typeof i.variant_id==='string'&&Number.isInteger(i.quantity)&&i.quantity>0&&i.quantity<=20).slice(0,30);}catch{}
 const remember=()=>{try{sessionStorage.setItem('ob.guest.cart',JSON.stringify(basket));}catch{}};
 async function load(){[catalog,sizes]=await Promise.all([select('ob_products'),select('ob_variants')]);const rows=await select('ob_settings');settings=rows[0].value;}
 async function saveCart(){
  if(!C.user){remember();return;}
  if(!basket.length)return;
  const {error}=await client.from('ob_cart_items').upsert(basket.map(i=>({...i,user_id:C.user.id})));if(error)throw error;
 }
 async function syncUser(){
  if(syncing)return syncing;
  syncing=mergeUser();try{await syncing;}finally{syncing=null;}
 }
 async function mergeUser(){
  await C.ready;const uid=C.user?.id;if(!uid||uid===loadedUser)return;
  const {data,error}=await client.from('ob_cart_items').select('variant_id,quantity').eq('user_id',uid);if(error)throw error;
  const merged=new Map(data.map(i=>[i.variant_id,i]));for(const i of basket)if(!merged.has(i.variant_id))merged.set(i.variant_id,i);
  if(C.user?.id!==uid)return;
  basket=[...merged.values()];if(basket.length)await saveCart();loadedUser=uid;sessionStorage.removeItem('ob.guest.cart');count();
 }
 function count(){document.getElementById('count').textContent=basket.reduce((s,i)=>s+i.quantity,0);}
 function syncCategories(){
  const group=document.querySelector('.filters');if(!group)return;
  const categories=['todos',...new Set(['polos','pantalones','zapatillas','hoodies',...catalog.filter(p=>!p.archived&&!p.deleted_at).map(p=>p.category)])];
  const key=JSON.stringify(categories);if(group.dataset.categories===key)return;
  const selected=group.querySelector('[aria-pressed="true"]')?.textContent.toLowerCase()||'todos';
  const active=categories.includes(selected)?selected:'todos';
  group.innerHTML=categories.map(c=>'<button class="filter '+(c===active?'active':'')+'" aria-pressed="'+(c===active)+'">'+esc(c.charAt(0).toUpperCase()+c.slice(1))+'</button>').join('');
  group.querySelectorAll('button').forEach(b=>b.onclick=()=>filter('.filter',b));group.dataset.categories=key;
 }
 function productDetails(id){
  const p=catalog.find(p=>String(p.id)===String(id));if(!p)return;
  const photos=[...new Set([p.image_path,...(p.gallery_paths||[])].filter(Boolean))];
  const url=path=>client.storage.from('product-images').getPublicUrl(path).data.publicUrl;
  show('<h2>'+esc(p.name)+'</h2><p>'+esc(p.category)+' · '+esc(p.collection)+'</p>'+(photos.length?'<div class="ob-product-view"><img id="ob-product-large" src="'+esc(url(photos[0]))+'" alt="'+esc(p.name)+'"></div><button id="ob-product-zoom" aria-pressed="false">Ampliar foto</button><div class="ob-product-thumbs">'+photos.map((photo,i)=>'<button data-photo-index="'+i+'" aria-label="Ver foto '+(i+1)+'" aria-pressed="'+(!i)+'"><img loading="lazy" src="'+esc(url(photo))+'" alt=""></button>').join('')+'</div>':'<p>Fotos próximamente.</p>')+'<p class="ob-product-description">'+esc(p.description||'Pronto añadiremos más detalles de este producto.')+'</p><p><strong>'+(p.price?money(p.price):'Próximamente')+'</strong></p><p>'+sizes.filter(v=>v.product_id===p.id).map(v=>esc(v.size)+' · '+(v.stock>0?(v.stock===1?'Última unidad':'Disponible'):'Agotado')).join(' / ')+'</p><button id="ob-product-return">Volver al catálogo</button>',true);
  document.querySelectorAll('[data-photo-index]').forEach(b=>b.onclick=()=>{document.getElementById('ob-product-large').src=url(photos[Number(b.dataset.photoIndex)]);document.querySelectorAll('[data-photo-index]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));});
  document.getElementById('ob-product-zoom')?.addEventListener('click',e=>{const expanded=e.currentTarget.getAttribute('aria-pressed')!=='true';e.currentTarget.setAttribute('aria-pressed',String(expanded));e.currentTarget.textContent=expanded?'Reducir foto':'Ampliar foto';document.getElementById('ob-product-large').classList.toggle('ob-zoomed',expanded);});
  document.getElementById('ob-product-return').onclick=e=>e.currentTarget.closest('dialog').close();
 }
 function renderStore(){
  syncCategories();
  const collection=document.querySelector('.collection[aria-pressed="true"]')?.textContent.toLowerCase()||'todos';
  const category=document.querySelector('.filter[aria-pressed="true"]')?.textContent.toLowerCase()||'todos';
  const list=catalog.filter(p=>!p.archived&&(category==='todos'||p.category===category)&&(collection==='todos'||p.collection===collection||p.collection==='unisex'));
  document.getElementById('grid').innerHTML=list.length?list.map(p=>{
   const available=sizes.filter(v=>v.product_id===p.id&&v.stock>0),buy=p.active&&p.price&&available.length;
   const photo=p.image_path?'<img loading="lazy" src="'+esc(client.storage.from('product-images').getPublicUrl(p.image_path).data.publicUrl)+'" alt="'+esc(p.name)+'" style="width:100%;height:100%;object-fit:contain">':'<img src="logo-overblack.svg" alt="" width="80"><span>Foto próximamente</span>';
   return '<article class="product"><div class="photo">'+photo+'</div><div class="info"><div class="cat">'+esc(p.category)+'</div><h3>'+esc(p.name)+'</h3><button class="ob-secondary" data-product-details="'+p.id+'">Ver fotos y detalles</button><div class="price">'+(p.price?money(p.price):'Próximamente')+'</div>'+(buy?'<label>Talla<select data-size-for="'+p.id+'">'+sizes.filter(v=>v.product_id===p.id).map(v=>'<option value="'+v.id+'" '+(v.stock<1?'disabled':'')+'>'+esc(v.size)+(v.stock<1?' · Agotado':v.stock===1?' · Última unidad':'')+'</option>').join('')+'</select></label><button class="buy" data-add-product="'+p.id+'">Añadir al carrito</button>':'<p class="coming-soon">'+(p.active?'Agotado':'Próximamente')+'</p>')+'</div></article>';
  }).join(''):'<p class="empty">Estamos preparando productos para esta selección.</p>';
  document.querySelectorAll('[data-product-details]').forEach(b=>b.onclick=()=>productDetails(b.dataset.productDetails));
  document.querySelectorAll('[data-add-product]').forEach(b=>b.onclick=()=>run(b,async()=>{
   await syncUser();const id=document.querySelector('[data-size-for="'+b.dataset.addProduct+'"]').value,v=sizes.find(v=>v.id===id);let item=basket.find(i=>i.variant_id===id);
   if((item?.quantity||0)>=Math.min(20,v.stock))throw Error('No hay más stock de esta talla.');
   if(item)item.quantity++;else basket.push({variant_id:id,quantity:1});await saveCart();count();await openCart();
  }));
 }
 async function openCart(){
  await syncUser();await load();count();
  show('<h2>Tu carrito</h2>'+(!basket.length?'<p>Tu carrito está vacío.</p>':'')+basket.map(i=>{const v=sizes.find(v=>v.id===i.variant_id),p=catalog.find(p=>p.id===v?.product_id);return '<div class="ob-row"><span>'+esc(p?.name||'Producto no disponible')+' / '+esc(v?.size||'')+'<br>'+money((p?.price||0)*i.quantity)+'</span><div><button data-change="'+i.variant_id+'" data-delta="-1" aria-label="Disminuir cantidad">−</button> '+i.quantity+' <button data-change="'+i.variant_id+'" data-delta="1" aria-label="Aumentar cantidad">+</button><button data-change="'+i.variant_id+'" data-delta="0">Eliminar</button></div></div>';}).join('')+'<p>Subtotal: '+money(basket.reduce((sum,i)=>{const v=sizes.find(v=>v.id===i.variant_id);return sum+(catalog.find(p=>p.id===v?.product_id)?.price||0)*i.quantity;},0))+'</p>'+(basket.length?'<button id="ob-checkout">Continuar con mi pedido</button>':'')+'<p id="ob-cart-feedback" role="status"></p>');
  document.querySelectorAll('[data-change]').forEach(b=>b.onclick=()=>run(b,async()=>{
   const i=basket.find(i=>i.variant_id===b.dataset.change),delta=Number(b.dataset.delta),v=sizes.find(v=>v.id===i.variant_id);
   if(delta>0&&i.quantity>=Math.min(20,v?.stock||0))throw Error('Stock insuficiente.');
   i.quantity=delta===0?0:i.quantity+delta;
   if(i.quantity===0){basket=basket.filter(x=>x!==i);if(C.user){const {error}=await client.from('ob_cart_items').delete().eq('user_id',C.user.id).eq('variant_id',i.variant_id);if(error)throw error;}}
   await saveCart();await openCart();
  }));
  document.getElementById('ob-checkout')?.addEventListener('click',()=>run(null,checkout));
 }
 async function checkout(){
  remember();if(!await C.requireUser())return;await C.refresh();await load();
  if(!settings.checkout_enabled||settings.maintenance)throw Error('Las compras todavía no están habilitadas.');
  show('<h2>Datos de entrega</h2><p>Puntos disponibles: '+C.account.points+'</p><form id="ob-checkout-form"><label>Entrega<select name="mode"><option value="lima">Lima Metropolitana · contraentrega</option><option value="shalom">Provincias · Shalom</option></select></label><label>Nombre completo<input name="recipient" required minlength="3" maxlength="150"></label><label>Celular<input name="phone" type="tel" required pattern="[+0-9 ()-]{9,20}" maxlength="20"></label><div id="ob-delivery-fields"></div><label>Referencia<input name="reference" maxlength="250"></label><label>Usar puntos<select name="reward"><option value="0">Guardar mis puntos</option>'+(C.account.rewards||[[2500,5],[5000,10],[10000,15]]).map(([n,p])=>'<option value="'+n+'" '+(C.account.points<n?'disabled':'')+'>'+n+' puntos = '+p+'%</option>').join('')+'</select></label><label>Cupón (opcional, no acumulable con puntos)<input name="coupon" maxlength="30"></label><button>Revisar pedido</button></form>');
  const form=document.getElementById('ob-checkout-form');
  for(const option of [...form.elements.mode.options])if((option.value==='lima'&&!settings.lima_enabled)||(option.value==='shalom'&&!settings.province_enabled))option.remove();
  if(!form.elements.mode.options.length)throw Error('No hay modalidades de entrega disponibles en este momento.');
  const fields=()=>document.getElementById('ob-delivery-fields').innerHTML=form.elements.mode.value==='lima'?'<label>Distrito de Lima Metropolitana<input name="district" required minlength="2" maxlength="80"></label><label>Dirección<input name="address" required minlength="5" maxlength="250"></label>':'<label>Ciudad / destino<input name="destination" required minlength="3" maxlength="150"></label><label>Agencia Shalom<input name="agency" required minlength="3" maxlength="150"></label><p>'+esc(settings.shalom_instructions)+' Adelanto: '+settings.deposit_percent+'%. El flete de Shalom se coordina aparte y no está incluido en este total.</p>';
  form.elements.mode.onchange=fields;fields();
  form.onsubmit=e=>{e.preventDefault();run(e.submitter,async()=>{
   const delivery=Object.fromEntries(new FormData(form)),reward=Number(delivery.reward),items=basket.map(i=>({...i}));delete delivery.reward;
   const quote=await rpc('ob_checkout',{p_items:items,p_delivery:delivery,p_reward:reward});
   delivery.expected_total=quote.total;delivery.expected_advance=quote.advance_due;
   const request=crypto.randomUUID();
   show('<h2>Revisa tu pedido</h2>'+quote.items.map(i=>'<p>'+esc(i.name)+' · '+esc(i.size)+' × '+i.quantity+' · '+money(i.unit_price*i.quantity)+'</p>').join('')+'<p>'+esc(delivery.recipient)+' · '+esc(delivery.phone)+'<br>'+esc(delivery.address||delivery.destination)+' · '+esc(delivery.district||delivery.agency)+'</p><p>Subtotal: '+money(quote.subtotal)+'<br>Entrega: '+(delivery.mode==='shalom'?'Flete Shalom por coordinar':money(quote.shipping))+'<br>Descuento: '+money(quote.discount)+'<br>Puntos usados: '+quote.points_spent+'</p><h3>Total: '+money(quote.total)+'</h3><p>'+(quote.advance_due?'Adelanto: '+money(quote.advance_due)+' · Saldo: '+money(quote.total-quote.advance_due):'Pago contraentrega')+'</p><button id="ob-confirm-order">Confirmar pedido</button><button id="ob-edit-order">Editar datos</button>');
   document.getElementById('ob-edit-order').onclick=()=>run(null,checkout);
   document.getElementById('ob-confirm-order').onclick=e=>run(e.target,async()=>{
    const order=await rpc('ob_checkout',{p_items:items,p_delivery:delivery,p_reward:reward,p_request:request,p_commit:true});
    basket=[];remember();count();let error=null;
    try{const result=await client.from('ob_cart_items').delete().eq('user_id',C.user.id);error=result.error;}catch(e){error=e;}
    try{await C.refresh();}catch{}
    show('<h2>Pedido recibido</h2><h3>'+esc(order.code)+'</h3><p>Total: '+money(order.total)+'</p><p>'+(order.advance_due?'Pendiente de adelanto: '+money(order.advance_due)+'. Coordina el pago con OVERBLACK.':'Lima Metropolitana · pago contraentrega.')+'</p><a href="account.html">Ver mis pedidos</a>'+(error?'<p>Tu pedido está registrado. No pudimos limpiar el carrito guardado.</p>':''));
   });
  });};
 }
 function filter(group,el){document.querySelectorAll(group).forEach(b=>{b.classList.toggle('active',b===el);b.setAttribute('aria-pressed',String(b===el));});renderStore();}
 window.filterProducts=(category,el)=>filter('.filter',el);
 window.selectCollection=(collection,el)=>filter('.collection',el);
 window.openCart=()=>run(null,openCart);
 document.querySelectorAll('.filter,.collection').forEach(b=>b.setAttribute('aria-pressed',String(b.classList.contains('active'))));
 window.addEventListener('ob:account',()=>{if(!C.user){if(loadedUser){basket=[];remember();count();}loadedUser=null;}else syncUser().catch(()=>{});});
 C.ready.then(async()=>{
  try{await load();await syncUser();window.render=renderStore;window.openCart=()=>run(null,openCart);renderStore();count();}
  catch(e){document.getElementById('grid').innerHTML='<p role="status">No pudimos cargar los productos. <button id="ob-retry-store">Reintentar</button></p>';document.getElementById('ob-retry-store').onclick=()=>location.reload();}
 });
 let refreshing=false;
 setInterval(async()=>{if(document.hidden||refreshing||!catalog.length)return;refreshing=true;try{await load();renderStore();}catch{}finally{refreshing=false;}},60000);
})();
