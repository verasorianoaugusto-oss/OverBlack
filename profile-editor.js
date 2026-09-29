window.OBEditProfile=async function({client,user,account,rpc,show,run,status,esc,refresh,openAccount}){
 show('<h2>Mi perfil</h2><form id="ob-profile-form"><label>Nombre<input name="username" value="'+esc(account.username)+'" required maxlength="80"></label><label>Foto de perfil<input name="photo" type="file" accept="image/jpeg,image/png,image/webp"></label><p>JPG, PNG o WebP · hasta 2 MB. Solo tú puedes modificar tu foto.</p><button>Guardar cambios</button></form><button id="ob-avatar-remove">Eliminar foto</button>');
 const bucket=client.storage.from('avatars');
 async function save(name,path){await rpc('ob_profile_save',{p_username:name,p_avatar:path});}
 async function displaySaved(){try{await refresh();await openAccount();}catch{status('Perfil guardado. Vuelve a abrir Mi Cuenta para actualizar la vista.');}}
 document.getElementById('ob-profile-form').onsubmit=e=>{e.preventDefault();run(e.submitter,async()=>{
   const f=new FormData(e.target),file=f.get('photo'),old=account.avatar_path;let path=old;
   if(file?.size){if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>2097152)throw Error('Elige JPG, PNG o WebP de hasta 2 MB.');path=user.id+'/'+crypto.randomUUID()+'.'+({'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type]);const {error}=await bucket.upload(path,file,{contentType:file.type});if(error)throw error;}
   await save(f.get('username'),path);
   await displaySaved();
   if(old&&old!==path){const {error}=await bucket.remove([old]);if(error)status('Perfil guardado. No se pudo borrar la foto anterior; vuelve a intentarlo más tarde.');}
 });};
 document.getElementById('ob-avatar-remove').onclick=e=>run(e.target,async()=>{const old=account.avatar_path;await save(account.username,null);await displaySaved();if(old){const {error}=await bucket.remove([old]);if(error)status('Foto desvinculada. No se pudo eliminar el archivo anterior; vuelve a intentarlo más tarde.');}});
};
