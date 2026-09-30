import nodemailer from 'npm:nodemailer@10.0.11';
const reply=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
Deno.serve(async(req:Request)=>{
 if(req.method!=='POST')return reply(405,{error:'Method not allowed'});
 const token=req.headers.get('x-ob-worker-token');if(!token)return reply(401,{error:'Unauthorized'});
 const service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,url=Deno.env.get('SUPABASE_URL')!;
 async function rpc(name:string,body:unknown={}){
  const r=await fetch(url+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json'},body:JSON.stringify(body)});
  if(!r.ok)throw Error('Database operation failed');const t=await r.text();return t?JSON.parse(t):null;
 }
 try{
  if(!await rpc('ob_mail_authorize',{p_token:token,p_status:'Procesando'}))return reply(401,{error:'Unauthorized'});
  const password=Deno.env.get('ORDER_SMTP_PASSWORD'),user=Deno.env.get('ORDER_SMTP_USER');
  if(!password||!user){await rpc('ob_mail_authorize',{p_token:token,p_status:'Falta configurar el secreto del correo de pedidos'});return reply(503,{error:'Order email is not configured'});}
  const port=Number(Deno.env.get('ORDER_SMTP_PORT')||465);
  const transport=nodemailer.createTransport({host:Deno.env.get('ORDER_SMTP_HOST')||'smtp.gmail.com',port,secure:port===465,requireTLS:port!==465,auth:{user,pass:password},connectionTimeout:10000,greetingTimeout:10000,socketTimeout:20000,disableFileAccess:true,disableUrlAccess:true});
  try{await transport.verify();}catch{
   transport.close();
   await rpc('ob_mail_authorize',{p_token:token,p_status:'No se pudo verificar la conexión SMTP. Revisa usuario y contraseña de aplicación.'});
   return reply(503,{error:'SMTP verification failed'});
  }
  const labels:Record<string,string>={nuevo:'Pedido recibido',confirmado:'Confirmado',pendiente_adelanto:'Pendiente de adelanto',adelanto_confirmado:'Adelanto confirmado',preparando:'Preparando',enviado:'Enviado',entregado:'Entregado',cancelado:'Cancelado'};
  let sent=0;const started=Date.now();
  for(let i=0;i<5&&Date.now()-started<45000;i++){
   const job=await rpc('ob_email_claim');if(!job)break;
   try{
    const code='#OB-'+String(job.order_id).padStart(5,'0');
    const title=job.event==='nuevo_pedido'?'Pedido recibido':job.event.startsWith('tracking:')?'Información de envío':(labels[job.event]||'Actualización de pedido');
    const money=(amount:number)=>'S/ '+(amount/100).toFixed(2);
    const lines=[job.intro||'',code,'Notificación: '+title,'Estado actual: '+(labels[job.status]||job.status),'Total del pedido: '+money(job.total)];
    if(job.status==='cancelado'){
     lines.push('El pedido está cancelado. Los puntos utilizados y el stock se restituyen al cancelar.','Si realizaste un pago, coordina con OVERBLACK su devolución. La cancelación no transfiere dinero automáticamente.');
    }else if(job.status==='entregado'){
     lines.push('Entrega y pago completo confirmados por la tienda.');
    }else if(job.advance_due){
     lines.push((job.status==='pendiente_adelanto'?'Adelanto pendiente: ':'Adelanto confirmado: ')+money(job.advance_due),'Saldo después del adelanto: '+money(job.total-job.advance_due),'El flete de Shalom se coordina aparte.');
    }else lines.push('Pago contraentrega pendiente: '+money(job.total));
    if(job.tracking)lines.push('Código o referencia de envío actual: '+job.tracking);
    lines.push('Consulta los detalles actualizados en https://overblack.store/account.html','',job.signature||'OVERBLACK');
    await transport.sendMail({from:{name:'OVERBLACK',address:user},to:job.recipients,subject:title+' · '+code,
      messageId:'<overblack-'+job.id+'@overblack.store>',
      text:lines.join('\n')});
    await rpc('ob_email_ack',{p_order:job.id,p_error:null});sent++;
   }catch{await rpc('ob_email_ack',{p_order:job.id,p_error:'El proveedor no confirmó el envío. Revisa la configuración del correo.'});}
  }
  transport.close();await rpc('ob_mail_authorize',{p_token:token,p_status:'Conexión SMTP verificada. Procesado: '+sent+' correos'});return reply(200,{sent});
 }catch{return reply(503,{error:'Order email temporarily unavailable'});}
});
