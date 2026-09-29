(() => {
 'use strict';
 const C=window.OBCommerce;if(!C)return;
 const pages={faq:'Preguntas frecuentes',terms:'Términos y condiciones',privacy:'Privacidad',returns:'Cambios y devoluciones',shipping_policy:'Política de envíos'};
 const originalContent=new Map();
 function apply(settings){
  if(!settings||typeof settings!=='object')return;
  document.title=(document.body.classList.contains('ob-account-page')?'Mi cuenta | ':'')+(settings.store_name||'OVERBLACK')+' | Streetwear';
  for(const [key,selector] of Object.entries({home_text:'.hero-copy > p',about_text:'.about-story',contact_text:'.contact-panel > p'})){
   const el=document.querySelector(selector);if(!el)continue;
   if(!originalContent.has(key))originalContent.set(key,el.innerHTML);
   if(settings[key]){el.textContent=settings[key];el.style.whiteSpace='pre-line';}else el.innerHTML=originalContent.get(key);
  }
  let banner=document.getElementById('ob-promotion');
  if(!banner&&document.getElementById('productos')){banner=document.createElement('p');banner.id='ob-promotion';banner.className='ob-store-notice container';document.getElementById('productos').prepend(banner);}
  if(banner){banner.textContent=[settings.banner_text,settings.general_discount>0?'Promoción: '+settings.general_discount+'% de descuento en productos. No acumulable con cupones ni puntos.':'',settings.benefits].filter(Boolean).join('\n');banner.hidden=!banner.textContent;}
  for(const [key,domain] of [['instagram','instagram.com'],['tiktok','tiktok.com']]){
   let url;try{url=new URL(settings[key]);}catch{continue;}
   if(url.protocol!=='https:'||!['www.'+domain,domain].includes(url.hostname)||url.username||url.password)continue;
   document.querySelectorAll('a[href*="'+domain+'/"]').forEach(a=>a.href=url.href);
  }
  if(/^[0-9]{8,15}$/.test(settings.whatsapp||''))document.querySelectorAll('a[href^="https://wa.me/"]').forEach(a=>{const url=new URL(a.href);url.pathname='/'+settings.whatsapp;a.href=url.href;});
  let notice=document.getElementById('ob-store-notice');
  if(!notice){notice=document.createElement('div');notice.id='ob-store-notice';notice.className='ob-store-notice';notice.setAttribute('role','status');document.querySelector('header')?.after(notice);}
  notice.textContent=[settings.announcement,settings.maintenance?'Estamos realizando mantenimiento. Puedes explorar la tienda; las compras y nuevas partidas están temporalmente pausadas.':''].filter(Boolean).join(' ');
  notice.hidden=!notice.textContent;
  const footer=document.querySelector('footer');
  if(footer){
   let links=document.getElementById('ob-info-links');
   if(!links){links=document.createElement('nav');links.id='ob-info-links';links.className='ob-info-links container';links.setAttribute('aria-label','Información de la tienda');footer.append(links);}
   links.replaceChildren();
   for(const [key,title] of Object.entries(pages)){
    if(typeof settings[key]!=='string'||!settings[key].trim())continue;
    const button=document.createElement('button');button.type='button';button.textContent=title;
    button.onclick=()=>C.show('<h2>'+C.esc(title)+'</h2><div class="ob-policy-text">'+C.esc(settings[key])+'</div>');links.append(button);
   }
  }
  window.dispatchEvent(new CustomEvent('ob:settings-applied',{detail:settings}));
 }
 window.addEventListener('ob:settings',e=>apply(e.detail));
 C.ready.then(()=>C.select('ob_settings')).then(rows=>apply(rows[0]?.value)).catch(()=>{});
})();
