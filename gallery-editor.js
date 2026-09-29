window.OBEditGallery=async function({product,client,rpc,show,run,status,esc,optimizePhoto,reload}){
 if(!product)throw Error('Selecciona un producto.');
 const expected=[...(product.image_path?[product.image_path]:[]),...(product.gallery_paths||[])];
 let photos=[...expected];
 const url=path=>client.storage.from('product-images').getPublicUrl(path).data.publicUrl;
 show('<h2>Fotos · '+esc(product.name)+'</h2><p>Hasta 8 fotos por producto. La primera es la principal. Quitar una foto de la galería no borra el archivo original.</p><form id="ob-gallery-form"><fieldset><div id="ob-gallery-list" class="ob-gallery-editor"></div><label>Añadir fotos<input name="photos" type="file" multiple accept="image/jpeg,image/png,image/webp"></label><p>JPG, PNG o WebP · máximo 5 MB por foto. Se optimizan al guardar.</p><button>Guardar galería</button><button type="button" id="ob-gallery-back">Volver a productos</button></fieldset></form>',true);
 const form=document.getElementById('ob-gallery-form'),fieldset=form.querySelector('fieldset');
 function render(){
  document.getElementById('ob-gallery-list').innerHTML=photos.length?photos.map((path,i)=>'<div><img src="'+esc(url(path))+'" alt="Foto '+(i+1)+' de '+esc(product.name)+'" loading="lazy"><p>'+(i===0?'Principal':'Foto '+(i+1))+'</p><button type="button" data-main="'+i+'" '+(!i?'disabled':'')+'>Hacer principal</button><button type="button" data-remove="'+i+'">Quitar</button></div>').join(''):'<p>Este producto todavía no tiene fotos.</p>';
  form.querySelectorAll('[data-main]').forEach(b=>b.onclick=()=>{const [photo]=photos.splice(Number(b.dataset.main),1);photos.unshift(photo);render();});
  form.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{photos.splice(Number(b.dataset.remove),1);render();});
 }
 render();document.getElementById('ob-gallery-back').onclick=()=>run(null,reload);
 form.onsubmit=e=>{e.preventDefault();run(e.submitter,async()=>{
  const files=[...form.elements.photos.files];
  if(photos.length+files.length>8)throw Error('Puedes guardar hasta 8 fotos. Quita alguna o selecciona menos archivos.');
  if(files.some(f=>!['image/jpeg','image/png','image/webp'].includes(f.type)||f.size>5242880))throw Error('Cada foto debe ser JPG, PNG o WebP de hasta 5 MB.');
  fieldset.disabled=true;
  try{
   for(let i=0;i<files.length;i++){
    status('Preparando foto '+(i+1)+' de '+files.length+'…');
    const photo=await optimizePhoto(files[i]);
    const path=product.id+'/'+crypto.randomUUID()+'.'+({'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[photo.type]);
    const {error}=await client.storage.from('product-images').upload(path,photo,{contentType:photo.type,upsert:false});if(error)throw error;
    photos.push(path);
   }
   form.elements.photos.value='';render();
   await rpc('ob_product_gallery',{p_product:product.id,p_images:photos,p_expected:expected});
   await reload();status('Galería guardada. Las fotos ya están disponibles en la tienda.');
  }catch(e){form.elements.photos.value='';render();throw e;}finally{fieldset.disabled=false;}
 });};
};
