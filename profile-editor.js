window.OBEditProfile=async function({client,user,account,rpc,show,run,status,esc,refresh,openAccount}){
 show('<h2>Mi perfil</h2><form id="ob-profile-form"><fieldset><img id="ob-profile-preview" src="avatar-ob.svg" alt="Vista previa de tu foto de perfil" class="ob-avatar" style="width:96px;height:96px"><label>Nombre<input name="username" value="'+esc(account.username)+'" required maxlength="80"></label><label>Foto de perfil<input name="photo" type="file" accept="image/jpeg,image/png,image/webp"></label><p>JPG, PNG o WebP · hasta 2 MB. Verás tu foto antes de guardarla.</p><button>Guardar cambios</button><button type="button" id="ob-avatar-remove">Eliminar foto</button></fieldset></form>');
 const bucket=client.storage.from('avatars'),form=document.getElementById('ob-profile-form'),fieldset=form.querySelector('fieldset'),preview=document.getElementById('ob-profile-preview');
 let busy=false,previewRevision=0,currentPhoto='avatar-ob.svg';
 const sameUser=()=>window.OBCommerce?.user?.id===user.id;
 function validate(file){if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>2097152)throw Error('Elige JPG, PNG o WebP de hasta 2 MB.');}
 if(account.avatar_path){bucket.createSignedUrl(account.avatar_path,3600).then(({data,error})=>{if(!error&&data?.signedUrl){currentPhoto=data.signedUrl;if(!previewRevision&&preview.isConnected)preview.src=currentPhoto;}}).catch(()=>{});}
 preview.onerror=()=>{preview.onerror=null;preview.src='avatar-ob.svg';};
 form.elements.photo.onchange=()=>{const revision=++previewRevision,file=form.elements.photo.files[0];if(!file){preview.src=currentPhoto;return;}try{validate(file);}catch(e){form.elements.photo.value='';preview.src=currentPhoto;status(e.message);return;}const reader=new FileReader();reader.onload=()=>{if(revision===previewRevision&&preview.isConnected)preview.src=reader.result;};reader.onerror=()=>{if(revision===previewRevision)status('No se pudo abrir la imagen. Elige otra foto.');};reader.readAsDataURL(file);};
 async function save(name,path){if(!sameUser())throw Error('Tu sesión cambió. Abre Mi Cuenta de nuevo.');await rpc('ob_profile_save',{p_username:name,p_avatar:path});account={...account,username:name,avatar_path:path};}
 async function displaySaved(){if(!sameUser()||!form.isConnected)return;try{await refresh();if(sameUser()&&form.isConnected)await openAccount();}catch{if(sameUser())status('Perfil guardado. Vuelve a abrir Mi Cuenta para actualizar la vista.');}}
 function edit(button,action){if(busy)return;busy=true;fieldset.disabled=true;return run(button,async()=>{try{if(!sameUser())throw Error('Tu sesión cambió. Abre Mi Cuenta de nuevo.');await action();}finally{busy=false;fieldset.disabled=false;}});}
 form.onsubmit=e=>{e.preventDefault();const f=new FormData(form);edit(e.submitter,async()=>{
   const file=f.get('photo'),old=account.avatar_path;let path=old;
   if(file?.size){validate(file);path=user.id+'/'+crypto.randomUUID()+'.'+({'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type]);const {error}=await bucket.upload(path,file,{contentType:file.type});if(error)throw error;}
   await save(f.get('username'),path);await displaySaved();
   if(sameUser()&&old&&old!==path){const {error}=await bucket.remove([old]);if(error)status('Perfil guardado. No se pudo borrar el archivo de la foto anterior.');}
 });};
 document.getElementById('ob-avatar-remove').onclick=e=>edit(e.target,async()=>{const old=account.avatar_path;await save(account.username,null);await displaySaved();if(sameUser()&&old){const {error}=await bucket.remove([old]);if(error)status('Foto desvinculada. No se pudo eliminar el archivo anterior.');}});
};
