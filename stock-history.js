window.OBStockHistory=async function({product,rpc,show,run,esc,reload},page=0){
 if(!product)throw Error('Selecciona un producto.');
 const rows=await rpc('ob_stock_history',{p_product:product.id,p_page:page});
 const labels={pedido:'Pedido confirmado',cancelacion:'Devolución por cancelación',ajuste_admin:'Ajuste de stock',talla_creada:'Talla creada',talla_eliminada:'Talla eliminada'};
 show('<h2>Historial de stock · '+esc(product.name)+'</h2><p>Movimientos registrados desde la activación del historial. Incluye cambios de ADMIN, ventas y devoluciones por cancelación.</p>'+(!rows.length?'<p>Aún no hay movimientos registrados.</p>':'')+rows.slice(0,50).map(row=>{const d=row.details;return '<div class="ob-row"><div><b>Talla '+esc(d.size)+' · '+esc(labels[d.reason]||d.reason)+'</b><p>'+esc(new Date(row.created_at).toLocaleString('es-PE',{timeZone:'America/Lima'}))+' · Perú<br>'+esc(row.actor_name)+(d.order_id?' · Pedido #OB-'+esc(String(d.order_id).padStart(5,'0')):'')+'<br>Antes: '+d.before+' · Cambio: '+(d.delta>0?'+':'')+d.delta+' · Después: '+d.after+'</p></div></div>';}).join('')+'<div class="ob-actions"><button id="ob-stock-prev" '+(!page?'disabled':'')+'>Anterior</button><span>Página '+(page+1)+'</span><button id="ob-stock-next" '+(rows.length<=50?'disabled':'')+'>Siguiente</button></div><button id="ob-stock-back">Volver a productos</button>',true);
 const context={product,rpc,show,run,esc,reload};
 document.getElementById('ob-stock-prev').onclick=e=>run(e.target,()=>window.OBStockHistory(context,page-1));
 document.getElementById('ob-stock-next').onclick=e=>run(e.target,()=>window.OBStockHistory(context,page+1));
 document.getElementById('ob-stock-back').onclick=e=>run(e.target,reload);
};
