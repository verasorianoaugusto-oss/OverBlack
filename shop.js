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
   const id=document.querySelector('[data-size-for="'+b.dataset.addProduct+'"]').value;
   await changeCart(id,1);await openCart();
  }));
 }
 let cartBusy=false;
 async function changeCart(id,delta){
  await syncUser();if(cartBusy)throw Error('Espera a que termine de guardarse el carrito.');
  const uid=C.user?.id;cartBusy=true;
  try{
   const item=basket.find(i=>i.variant_id===id),v=sizes.find(v=>v.id===id),p=catalog.find(p=>p.id===v?.product_id);
   const quantity=delta===0?0:Math.max(0,(item?.quantity||0)+delta);
   if(delta>0&&(!p?.active||p.archived||!p.price||quantity>Math.min(20,v?.stock||0)))throw Error('No hay más unidades disponibles de esta talla.');
   if(uid){
    const result=quantity?await client.from('ob_cart_items').upsert({user_id:uid,variant_id:id,quantity}):await client.from('ob_cart_items').delete().eq('user_id',uid).eq('variant_id',id);
    if(result.error)throw result.error;
   }
   if(C.user?.id!==uid)return;
   basket=basket.filter(i=>i.variant_id!==id);if(quantity)basket.push({variant_id:id,quantity});
   if(!uid)remember();count();
  }finally{cartBusy=false;}
 }
 async function clearCart(){
  await syncUser();if(cartBusy)throw Error('Espera a que termine de guardarse el carrito.');
  const uid=C.user?.id;cartBusy=true;
  try{
   if(uid){const {error}=await client.from('ob_cart_items').delete().eq('user_id',uid);if(error)throw error;}
   if(C.user?.id!==uid)return;
   basket=[];if(!uid)remember();count();
  }finally{cartBusy=false;}
  await openCart();
 }
 async function openCart(){
  await syncUser();await load();count();
  const subtotal=basket.reduce((sum,i)=>{const v=sizes.find(v=>v.id===i.variant_id);return sum+(catalog.find(p=>p.id===v?.product_id)?.price||0)*i.quantity;},0);
  show('<h2>Tu carrito</h2>'+(!basket.length?'<p>Tu carrito está vacío.</p><a href="index.html#productos">Ver productos</a>':'')+basket.map(i=>{
   const v=sizes.find(v=>v.id===i.variant_id),p=catalog.find(p=>p.id===v?.product_id),unavailable=!p?.active||p.archived||!p.price||!v?.stock;
   const photo=p?.image_path?client.storage.from('product-images').getPublicUrl(p.image_path).data.publicUrl:'logo-overblack.svg';
   return '<div class="ob-row ob-cart-row"><div class="ob-cart-product"><img src="'+esc(photo)+'" alt="'+esc(p?.name||'Producto')+'" width="64" height="80"><div><b>'+esc(p?.name||'Producto no disponible')+'</b><br>Talla: '+esc(v?.size||'—')+'<br>Precio unitario: '+money(p?.price||0)+'<br>Importe: '+money((p?.price||0)*i.quantity)+(unavailable?'<p>Ya no está disponible. Elimínalo para continuar.</p>':i.quantity>v.stock?'<p>Solo quedan '+v.stock+' unidades. Reduce la cantidad.</p>':'')+'</div></div><div><button data-change="'+i.variant_id+'" data-delta="-1" aria-label="Disminuir cantidad">−</button> '+i.quantity+' <button data-change="'+i.variant_id+'" data-delta="1" aria-label="Aumentar cantidad" '+(unavailable||i.quantity>=Math.min(20,v.stock)?'disabled':'')+'>+</button><button data-change="'+i.variant_id+'" data-delta="0">Eliminar</button></div></div>';
  }).join('')+(basket.length?'<p><strong>Subtotal: '+money(subtotal)+'</strong></p><p>El descuento y la entrega se calculan al revisar el pedido.</p><button id="ob-checkout">Continuar con mi pedido</button><button id="ob-clear-cart" class="ob-secondary">Vaciar carrito</button>':'')+'<p id="ob-cart-feedback" role="status"></p>');
  document.querySelectorAll('[data-change]').forEach(b=>b.onclick=()=>run(b,async()=>{await changeCart(b.dataset.change,Number(b.dataset.delta));await openCart();}));
  document.getElementById('ob-clear-cart')?.addEventListener('click',e=>run(e.target,clearCart));
  const deliveryInfo=document.createElement('p');deliveryInfo.textContent=[settings.lima_enabled?'Lima Metropolitana: pago contraentrega.':'',settings.province_enabled?'Provincias: Shalom con '+settings.deposit_percent+'% de adelanto. Flete por coordinar aparte.':''].filter(Boolean).join(' ');document.getElementById('ob-cart-feedback').before(deliveryInfo);
  document.getElementById('ob-checkout')?.addEventListener('click',()=>run(null,checkout));
 }
 async function checkout(draft={}){
  if(cartBusy)throw Error('Espera a que termine de guardarse el carrito.');
  if(!C.user)remember();if(!await C.requireUser())return;await C.refresh();await load();
  if(!settings.checkout_enabled||settings.maintenance)throw Error('Las compras todavía no están habilitadas.');
  const checkoutUser=C.user.id;
  const [options,addresses]=await Promise.all([rpc('ob_delivery_options'),rpc('ob_address_book')]);
  if(C.user?.id!==checkoutUser)throw Error('Tu sesión cambió. Vuelve a abrir el carrito.');
  let savedAddressId=draft.saved_address_id||null;
  show('<h2>Datos de entrega</h2><p>Puntos disponibles: '+C.account.points+'</p><form id="ob-checkout-form"><label>Dirección guardada<select name="saved_address_id"><option value="">Usar una dirección nueva</option>'+addresses.map(a=>'<option value="'+a.id+'">'+esc(a.delivery.recipient+' · '+(a.delivery.district||a.delivery.destination||a.delivery.province))+'</option>').join('')+'</select></label><label>Nombre completo<input name="recipient" required minlength="3" maxlength="150" autocomplete="name"></label><label>Celular<input name="phone" type="tel" required pattern="[+0-9 ()-]{9,20}" maxlength="20" autocomplete="tel"></label><div data-delivery-fields></div><label>Referencia<input name="reference" maxlength="250"></label><label class="ob-check"><input name="save_address" type="checkbox"> Guardar estos datos en mis direcciones</label><label>Usar puntos<select name="reward"><option value="0">Guardar mis puntos</option>'+(C.account.rewards||[[2500,5],[5000,10],[10000,15]]).map(([n,p])=>'<option value="'+n+'" '+(C.account.points<n?'disabled':'')+'>'+n+' puntos = '+p+'%</option>').join('')+'</select></label><label>Cupón (opcional, no acumulable con puntos)<input name="coupon" maxlength="30"></label><button>Revisar pedido</button></form>');
  const form=document.getElementById('ob-checkout-form');
  const fillAddress=d=>{for(const name of ['recipient','phone','reference'])form.elements[name].value=d[name]||'';window.OBDeliveryFields(form,options,esc,d,settings.deposit_percent);};
  fillAddress(draft);form.elements.saved_address_id.value=savedAddressId||'';
  form.elements.reward.value=String(draft.reward||0);form.elements.coupon.value=draft.coupon||'';form.elements.save_address.checked=draft.save_address==='on';
  form.elements.saved_address_id.onchange=()=>{savedAddressId=form.elements.saved_address_id.value||null;fillAddress(addresses.find(a=>a.id===savedAddressId)?.delivery||{});form.elements.save_address.checked=false;};
  form.onsubmit=e=>{e.preventDefault();run(e.submitter,async()=>{
   draft=Object.fromEntries(new FormData(form));const delivery={...draft},reward=Number(delivery.reward),items=basket.map(i=>({...i}));delete delivery.reward;delete delivery.save_address;delete delivery.saved_address_id;
   const quote=await rpc('ob_checkout',{p_items:items,p_delivery:delivery,p_reward:reward});
   if(C.user?.id!==checkoutUser)throw Error('Tu sesión cambió. Vuelve a abrir el carrito.');
   Object.assign(delivery,quote.delivery);
   if(draft.save_address==='on'){const saved=await rpc('ob_address_book',{p_action:'save',p_id:savedAddressId,p_delivery:delivery});savedAddressId=saved.id;draft.saved_address_id=saved.id;}
   if(C.user?.id!==checkoutUser)return;
   delivery.expected_total=quote.total;delivery.expected_advance=quote.advance_due;
   const request=crypto.randomUUID();
   show('<h2>Revisa tu pedido</h2>'+quote.items.map(i=>'<p>'+esc(i.name)+' · '+esc(i.size)+' × '+i.quantity+' · '+money(i.unit_price*i.quantity)+'</p>').join('')+'<p>'+esc(delivery.recipient)+' · '+esc(delivery.phone)+'<br>'+esc(delivery.department)+' · '+esc(delivery.province)+'<br>'+esc(delivery.address||delivery.destination)+' · '+esc(delivery.district||delivery.agency)+'</p><p>Subtotal: '+money(quote.subtotal)+'<br>Entrega: '+(delivery.mode==='shalom'?'Flete Shalom por coordinar':money(quote.shipping))+'<br>Descuento: '+money(quote.discount)+' ('+Number(quote.discount_percent||0)+'%)<br>Puntos usados: '+quote.points_spent+'</p><h3>Total: '+money(quote.total)+'</h3><p>'+(quote.advance_due?'Adelanto: '+money(quote.advance_due)+' · Saldo: '+money(quote.total-quote.advance_due):'Pago contraentrega')+'</p><button id="ob-confirm-order">Confirmar pedido</button><button id="ob-edit-order">Editar datos</button>');
   document.getElementById('ob-edit-order').onclick=()=>run(null,()=>checkout(draft));
   document.getElementById('ob-confirm-order').onclick=e=>run(e.target,async()=>{
    if(C.user?.id!==checkoutUser)throw Error('Tu sesión cambió. Vuelve a abrir el carrito.');
    const order=await rpc('ob_checkout',{p_items:items,p_delivery:delivery,p_reward:reward,p_request:request,p_commit:true});
    if(C.user?.id!==checkoutUser)return;
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
