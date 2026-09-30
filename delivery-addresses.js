window.OBDeliveryFields=function(form,options,esc,initial={},deposit=50){
 const root=form.querySelector('[data-delivery-fields]');
 const choices=items=>'<option value="">Selecciona</option>'+items.map(v=>'<option value="'+esc(v)+'">'+esc(v)+'</option>').join('');
 root.innerHTML='<label>Departamento / región<select name="department" required>'+choices(options.departments)+'</select></label><div data-province></div><input name="mode" type="hidden"><div data-route></div>';
 const dept=form.elements.department;dept.value=initial.department||(initial.mode==='lima'?'Lima':'');
 let routeMode;
 function route(){
  const province=form.elements.province.value;
  const mode=dept.value&&province.trim()?(dept.value==='Lima'&&province==='Lima'?'lima':'shalom'):'';
  form.elements.mode.value=mode;if(routeMode===mode)return;routeMode=mode;
  root.querySelector('[data-route]').innerHTML=mode==='lima'?'<p><strong>Lima Metropolitana · pago contraentrega</strong></p><label>Distrito<select name="district" required>'+choices(options.lima_districts)+'</select></label><label>Dirección<input name="address" required minlength="5" maxlength="250" autocomplete="street-address"></label>':mode==='shalom'?'<p><strong>Envío por Shalom'+(deposit===null?'':' · adelanto '+deposit+'%')+'</strong></p><label>Ciudad / destino<input name="destination" required minlength="3" maxlength="150"></label><label>Agencia Shalom<input name="agency" required minlength="3" maxlength="150"></label><p>El flete de Shalom se coordina aparte y no está incluido en el total.</p>':'<p>Selecciona tu ubicación para conocer la modalidad de entrega.</p>';
  for(const name of ['district','address','destination','agency'])if(form.elements[name])form.elements[name].value=initial[name]||'';
 }
 function province(){
  root.querySelector('[data-province]').innerHTML=dept.value==='Lima'?'<label>Provincia<select name="province" required>'+choices(options.lima_provinces)+'</select></label>':'<label>Provincia<input name="province" required minlength="2" maxlength="80"></label>';
  form.elements.province.value=initial.province||(initial.mode==='lima'?'Lima':'');
  form.elements.province.onchange=route;form.elements.province.oninput=route;routeMode=undefined;route();
 }
 dept.onchange=()=>{initial={};province();};province();
};

window.OBAddressBook=async function({rpc,show,run,esc,openAccount},editing){
 const uid=window.OBCommerce.user?.id;if(!uid)return openAccount();
 const options=await rpc('ob_delivery_options');if(window.OBCommerce.user?.id!==uid)return;
 const context={rpc,show,run,esc,openAccount};
 if(editing){
  const d=editing.delivery||{};
  show('<h2>'+(editing.id?'Editar dirección':'Añadir dirección')+'</h2><form id="ob-address-form"><label>Nombre completo<input name="recipient" required minlength="3" maxlength="150" autocomplete="name"></label><label>Celular<input name="phone" type="tel" required pattern="[+0-9 ()-]{9,20}" maxlength="20" autocomplete="tel"></label><div data-delivery-fields></div><label>Referencia<input name="reference" maxlength="250"></label><button>Guardar dirección</button></form><button id="ob-address-back">Volver a mis direcciones</button>');
  const form=document.getElementById('ob-address-form');
  for(const name of ['recipient','phone','reference'])form.elements[name].value=d[name]||'';
  window.OBDeliveryFields(form,options,esc,d,null);
  let addressId=editing.id||null;
  form.onsubmit=e=>{e.preventDefault();run(e.submitter,async()=>{const result=await rpc('ob_address_book',{p_action:'save',p_id:addressId,p_delivery:Object.fromEntries(new FormData(form))});addressId=result.id;await window.OBAddressBook(context);});};
  document.getElementById('ob-address-back').onclick=e=>run(e.target,()=>window.OBAddressBook(context));return;
 }
 const rows=await rpc('ob_address_book');if(window.OBCommerce.user?.id!==uid)return;
 show('<h2>Mis direcciones</h2><p>Guarda hasta 10 destinos para utilizarlos al comprar.</p>'+(!rows.length?'<p>Todavía no tienes direcciones guardadas.</p>':'')+rows.map(row=>{const d=row.delivery;return '<div class="ob-row"><div><b>'+esc(d.recipient)+'</b><p>'+esc(d.phone)+'<br>'+esc(d.department)+' · '+esc(d.province)+'<br>'+esc(d.mode==='lima'?d.district+' · '+d.address:d.destination+' · '+d.agency)+'</p><button data-address-edit="'+row.id+'">Editar</button><button data-address-delete="'+row.id+'">Eliminar</button></div></div>';}).join('')+'<button id="ob-address-add" '+(rows.length>=10?'disabled':'')+'>Añadir dirección</button><button id="ob-address-account">Volver a Mi Cuenta</button>');
 document.querySelectorAll('[data-address-edit]').forEach(b=>b.onclick=()=>run(b,()=>window.OBAddressBook(context,rows.find(r=>r.id===b.dataset.addressEdit))));
 document.querySelectorAll('[data-address-delete]').forEach(b=>b.onclick=()=>run(b,async()=>{if(!confirm('¿Eliminar esta dirección guardada? Los pedidos anteriores se conservarán.'))return;await rpc('ob_address_book',{p_action:'delete',p_id:b.dataset.addressDelete});await window.OBAddressBook(context);}));
 document.getElementById('ob-address-add').onclick=e=>run(e.target,()=>window.OBAddressBook(context,{}));
 document.getElementById('ob-address-account').onclick=e=>run(e.target,openAccount);
};
