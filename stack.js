(function () {
  'use strict';
  const R = window.OBStackRules;
  const $ = id => document.getElementById('ob-' + id);
  if (!R || !$('canvas')) return;
  const canvas = $('canvas'), ctx = canvas.getContext('2d');
  if (!ctx) { $('error').hidden = false; $('error').textContent = 'Este navegador no puede mostrar el juego. Prueba con un navegador actualizado.'; return; }
  const C = window.OBCommerce;
  let networkBusy = false, gameId = null, pendingResult = null, clockAnchor = 0, clockElapsed = 0, clockDelay = 0, needsPause = false;
  let phase = 'ready', resumePhase = 'moving', score = 0, height = 0, blocks = [], moving, fall = null, debris = null;
  let lastFrame = 0, raf = 0, visible = false, direction = 1, camera = 0, popTime = 0, settlementBusy = false;
  const WIDTH = 600, HEIGHT = 780, BOX = 75, FLOOR = 650;
  const sprite = document.createElement('img');
  let spriteReady = false;
  sprite.onload = () => { spriteReady = true; draw(); };
  sprite.src = 'stack-box.png';
  const fmt = n => n.toLocaleString('en-US');
  function warn(message) { $('error').textContent = message; $('error').hidden = false; }
  function updateAccount(s = C.account) {
    const p = s || {points:0,best:0,best_score:0,used:0};const daily=p.daily_limit||5,rewards=(p.rewards||[[2500,5],[5000,10],[10000,15]]).slice().sort((a,b)=>a[0]-b[0]);
    $('balance').textContent=fmt(p.points); $('best').textContent=fmt(p.best); $('best-score').textContent=fmt(p.best_score);
    $('remaining').textContent=s?Math.max(0,daily-p.used):'—'; $('free').textContent=s?Math.max(0,daily-p.used):'—'; $('extra').textContent='0';
    if($('attempt-dots').children.length!==daily)$('attempt-dots').innerHTML='<i></i>'.repeat(daily);
    const limit=document.getElementById('ob-daily-limit');if(limit)limit.textContent=daily;
    document.querySelector('#stack .ob-reset').textContent=daily+' gratis cada día · 00:00 de Perú';
    document.querySelector('#stack .ob-hint').textContent='Clic / tap / Espacio para soltar · PERFECT +'+(p.perfect_points||5)+' pts · Normal +'+(p.normal_points||2)+' pts';
    document.querySelector('#stack .ob-reward-goal').textContent=rewards.map(([pts,pct])=>fmt(pts)+' = '+pct+'%').join(' · ');
    [...$('attempt-dots').children].forEach((dot,i)=>dot.classList.toggle('spent',i<p.used));
    const target=(rewards.find(r=>p.points<r[0])||rewards.at(-1))[0];
    $('progress').max=target;$('progress').value=Math.min(target,p.points);$('progress-text').textContent=fmt(p.points)+' / '+fmt(target)+' pts';
    $('percent').textContent=Math.min(100,Math.floor(p.points/target*100))+'%';
    $('unlocked').hidden=p.points<rewards[0][0]; $('claim').hidden=p.points<rewards[0][0];
    $('reward-copy').textContent=p.points>=rewards[0][0]?'Elige si usas tus puntos al comprar.':'Te faltan '+fmt(rewards[0][0]-p.points)+' puntos para tu primer descuento.';
    $('claim').removeAttribute('target'); $('claim').href='#'; $('claim').onclick=e=>{e.preventDefault();C.openAccount();};
    $('achievements').innerHTML=rewards.map(([pts,pct])=>'<div class="ob-achievement '+(p.points>=pts?'is-earned':'')+'"><span>'+fmt(pts)+' pts</span><b>'+pct+'% OFF</b></div>').join('');
    if(phase==='ready'||phase==='over'){
      $('action').disabled=!!s&&p.used>=daily;
      $('action').textContent=!s?'INICIA SESIÓN PARA JUGAR':p.used>=daily?'SIN INTENTOS · VUELVE MAÑANA':phase==='ready'?'EMPEZAR PARTIDA ↗':'VOLVER A JUGAR ↗';
    }
  }
  async function command(action) {
    const began=performance.now(), request=crypto.randomUUID();
    const args={p_action:action,p_game:gameId,p_step:height,p_request:request};
    let response;
    try { response=await C.rpc('ob_stack',args); }
    catch(error) {
      // Retry transport failures with the SAME operation ID, never award twice.
      if(error.code || !/fetch|network|Failed/i.test(error.message||''))throw error;
      response=await C.rpc('ob_stack',args);
    }
    const rtt=performance.now()-began;
    clockAnchor=performance.now();clockElapsed=response.elapsed;clockDelay=response.delay-rtt/2000;
    C.acceptAccount(response.account); updateAccount(response.account);
    return response;
  }
  function connectionError(e) {
    phase='over';networkBusy=false;settlementBusy=false;moving=null;
    $('pause').disabled=true;warn(e.message||'No pudimos conectar. Tus puntos ya confirmados siguen guardados.');
    overlay('CONEXIÓN INTERRUMPIDA','Tus puntos están guardados.','Vuelve a entrar a tu cuenta antes de iniciar otra partida.');
    C.refresh().then(()=>updateAccount()).catch(()=>updateAccount());
  }
  function updateGame() {
    $('score').textContent = fmt(score); $('height').textContent = height;
    const speed = '×' + R.speed(height).toFixed(2);
    $('speed').textContent = speed; $('speed-stage').textContent = 'VELOCIDAD ' + speed;
  }
  function overlay(label, title, copy) {
    $('overlay-label').textContent = label; $('overlay-title').textContent = title; $('overlay-copy').textContent = copy; $('overlay').hidden = false;
  }
  function makeMoving() {
    const previous = blocks[blocks.length - 1];
    direction = height % 2 ? -1 : 1;
    moving = { x: direction === 1 ? 0 : WIDTH - previous.width - 14, width: previous.width, level: height + 1 };
  }
  function resetTower() {
    blocks = [{ x: 150, width: 300, level: 0 }]; camera = 0; debris = null; fall = null; makeMoving();
  }
  async function start() {
    if(!['ready','over'].includes(phase)||networkBusy)return;
    networkBusy=true;
    try{
      if(!await C.requireUser()){networkBusy=false;return;}
      phase='starting';$('action').disabled=true;needsPause=false;pendingResult=null;
      const data=await command('start');gameId=data.id;
      score=0;height=0;resetTower();updateGame();pop('','');
      phase='moving';$('error').hidden=true;$('overlay').hidden=true;$('pause').disabled=false;$('pause').textContent='PAUSA';
      $('action').disabled=false;$('action').textContent='SOLTAR CAJA ↓';networkBusy=false;
      canvas.focus({preventScroll:true});lastFrame=0;
      if(document.hidden||!visible)pause();else schedule();
    }catch(e){connectionError(e);}
  }
  async function drop() {
    if(phase!=='moving'||networkBusy||settlementBusy)return;
    networkBusy=true;phase='requesting';$('action').disabled=true;
    try{
      pendingResult=await command('drop');
      if(pendingResult.drop_x!==null)moving.x=pendingResult.drop_x;
      phase='falling';fall={start:yFor(moving.level)-80,y:yFor(moving.level)-80,end:yFor(moving.level)};
      networkBusy=false;schedule();
      if(document.hidden||!visible||needsPause){await settle();pause();}
    }catch(e){connectionError(e);}
  }
  function action() {
    if(phase==='paused'){resume();return;}
    if(phase==='ready'||phase==='over'){start();return;}
    drop();
  }
  function pop(title,text){$('perfect').textContent=title;$('points-pop').textContent=text;popTime=title?1.25:0;}
  async function settle() {
    if(!pendingResult)return;
    settlementBusy=true;const result=pendingResult;pendingResult=null;fall=null;
    if(result.points>0){
      if(!result.perfect)debris={x:moving.x<result.x?moving.x:result.x+result.width,width:moving.width-result.width,y:yFor(moving.level),age:0};
      height=result.height;score=result.score;blocks.push({x:result.x,width:result.width,level:height});
      if(blocks.length>18)blocks.shift();
      pop(result.perfect?'PERFECT':'BIEN COLOCADA','+'+result.points+' PTS');updateGame();makeMoving();
    }
    if(result.state==='over'){
      if(!result.points)debris={x:moving.x,width:moving.width,y:yFor(moving.level),age:0};
      moving=null;phase='over';$('pause').disabled=true;
      overlay('PARTIDA TERMINADA',height?height+' cajas. Sigue subiendo.':'Encuentra tu ritmo.',fmt(score)+' puntos guardados en tu cuenta.');
      C.refresh().then(()=>updateAccount()).catch(()=>updateAccount());
    }else{phase='moving';$('action').disabled=false;}
    settlementBusy=false;
    if(needsPause||document.hidden||!visible)pause();
  }
  async function pause(){
    if(!['moving','falling','requesting','pausing','starting'].includes(phase))return;
    if(networkBusy||phase==='falling'||phase==='requesting'){needsPause=true;return;}
    needsPause=false;networkBusy=true;phase='pausing';$('action').disabled=true;
    try{await command('pause');phase='paused';networkBusy=false;
      overlay('TÓMATE UN RESPIRO','Tu torre te espera.','Continúa cuando estés listo. No se consume otro intento.');
      $('action').textContent='CONTINUAR PARTIDA →';$('action').disabled=false;$('pause').textContent='CONTINUAR';
    }catch(e){connectionError(e);}
  }
  async function resume(){
    if(phase!=='paused'||networkBusy||document.hidden)return;
    networkBusy=true;$('action').disabled=true;
    try{await command('resume');networkBusy=false;phase='moving';$('overlay').hidden=true;$('action').textContent='SOLTAR CAJA ↓';$('action').disabled=false;$('pause').textContent='PAUSA';lastFrame=0;schedule();}
    catch(e){connectionError(e);}
  }
  function yFor(level) { return FLOOR - level * BOX + camera; }
  function box(x, y, width, level = 0, opacity = 1) {
    if (spriteReady) {
      ctx.save(); ctx.globalAlpha = opacity;
      // Crop the photographic face as boxes shrink, rather than compressing the logo.
      const depth = 20, fullWidth = 320, fullHeight = BOX + 24;
      ctx.beginPath(); ctx.rect(x, y - 24, width + depth, fullHeight); ctx.clip();
      const sx = Math.max(0, (300 - width) / 2);
      ctx.drawImage(sprite, x - sx, y - 24, fullWidth, fullHeight);
      ctx.strokeStyle = '#b7b7b75c'; ctx.lineWidth = .7;
      ctx.strokeRect(x, y, width, BOX);
      ctx.restore(); return;
    }
    ctx.save(); ctx.globalAlpha = opacity;
    const depth = Math.min(14, width * .3), top = 10;
    ctx.fillStyle = '#303030'; ctx.strokeStyle = '#707070'; ctx.lineWidth = .8;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + depth, y - top); ctx.lineTo(x + width + depth, y - top); ctx.lineTo(x + width, y); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.moveTo(x + width, y); ctx.lineTo(x + width + depth, y - top); ctx.lineTo(x + width + depth, y + BOX - top); ctx.lineTo(x + width, y + BOX); ctx.closePath(); ctx.fill(); ctx.stroke();
    const face = ctx.createLinearGradient(x, y, x, y + BOX); face.addColorStop(0, '#242424'); face.addColorStop(1, '#090909');
    ctx.fillStyle = face; ctx.fillRect(x, y, width, BOX); ctx.strokeRect(x, y, width, BOX);
    ctx.save(); ctx.beginPath(); ctx.rect(x + 2, y + 1, Math.max(0, width - 4), BOX - 2); ctx.clip();
    ctx.strokeStyle = '#555'; ctx.beginPath(); ctx.moveTo(x, y + 5); ctx.lineTo(x + width, y + 5); ctx.stroke();
    ctx.fillStyle = '#eee'; ctx.font = '900 italic 17px Arial'; ctx.textAlign = 'center'; ctx.fillText('OVERBLACK', x + width / 2, y + 26);
    if (width > 140) {
      ctx.fillStyle = '#aaa'; ctx.fillRect(x + 8, y + 12, 16, 13); ctx.fillStyle = '#161616';
      for (let i = 0; i < 12; i += 3) ctx.fillRect(x + 10 + i, y + 14, 1, 8);
      ctx.fillStyle = '#a9a9a9'; ctx.font = '6px monospace'; ctx.textAlign = 'right'; ctx.fillText(String(level).padStart(3, '0'), x + width - 7, y + 25);
      ctx.strokeStyle = '#a9a9a9'; ctx.beginPath(); ctx.moveTo(x + width - 24, y + 12); ctx.lineTo(x + width - 11, y + 8); ctx.stroke();
    }
    ctx.restore(); ctx.restore();
  }
  // Canvas stays transparent over the reference-inspired photographic environment.
  function draw() {
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    ctx.fillStyle = '#0008'; ctx.beginPath(); ctx.ellipse(300, FLOOR + BOX + 8, 210, 18, 0, 0, Math.PI * 2); ctx.fill();
    blocks.forEach(b => { const y = yFor(b.level); if (y < HEIGHT + BOX && y > -BOX) box(b.x, y, b.width, b.level); });
    if (phase === 'ready') {
      for (let i = 1; i <= 5; i++) box(150 + (i % 2 ? 10 : -10), FLOOR - i * BOX, 300, i);
      box(150, FLOOR - 6 * BOX - 80, 300, 6);
      ctx.strokeStyle = '#ddd'; ctx.lineWidth = 1; ctx.setLineDash([5, 5]);
      ctx.beginPath(); ctx.moveTo(300, FLOOR - 6 * BOX - 4); ctx.lineTo(300, FLOOR - 5 * BOX - 28); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#fff'; ctx.font = '44px Arial'; ctx.textAlign = 'center';
      ctx.fillText('‹', 45, FLOOR - 6 * BOX - 25); ctx.fillText('›', 555, FLOOR - 6 * BOX - 25);
    } else if (moving && phase !== 'over') {
      const y = fall ? fall.y : yFor(moving.level) - 80;
      box(moving.x, y, moving.width, moving.level);
    }
    if (debris) box(debris.x + debris.age * 32, debris.y + debris.age * debris.age * 620, debris.width, height, Math.max(0, 1 - debris.age));
  }
  function frame(now) {
    raf = 0; const dt = lastFrame ? Math.min((now - lastFrame) / 1000, .04) : 0; lastFrame = now;
    if (phase !== 'paused') {
      if (debris) { debris.age += dt; if (debris.age > 1) debris = null; }
      if (popTime > 0) { popTime -= dt; if (popTime <= 0) pop('', ''); }
      if (!settlementBusy && phase === 'moving') {
        camera += (Math.max(0, height - 5) * BOX - camera) * Math.min(1, dt * 9);
        const max=WIDTH-moving.width-14;
        const age=Math.max(0,clockElapsed+(performance.now()-clockAnchor)/1000-clockDelay);
        const travel=(145*R.speed(height)*age)%(2*max);
        moving.x=travel<=max?travel:2*max-travel;
        if(height%2)moving.x=max-moving.x;
      }
      if (phase === 'falling' && fall && !settlementBusy) { fall.y = Math.min(fall.end, fall.y + dt * 550); if (fall.y >= fall.end) settle(); }
    }
    draw();
    if (visible && !document.hidden && phase !== 'paused' && (['moving', 'falling'].includes(phase) || debris || popTime > 0)) schedule();
  }
  function schedule() { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame); }
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = WIDTH * dpr; canvas.height = HEIGHT * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); draw();
  }
  $('action').addEventListener('click', action);
  $('more').addEventListener('click', () => { pause(); $('extras').open = true; $('extras').scrollIntoView({behavior:'smooth',block:'start'}); });
  $('pause').addEventListener('click', () => phase === 'paused' ? resume() : pause());
  canvas.addEventListener('click', action);
  canvas.addEventListener('keydown', e => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); if (!e.repeat) action(); } if (e.code === 'Escape') pause(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) pause(); else { updateAccount(); lastFrame = 0; schedule(); } });
  window.addEventListener('resize', resize);
  new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (!visible) pause(); else { lastFrame = 0; schedule(); }
  }, { threshold: 0 }).observe(canvas);
  new IntersectionObserver(entries => { $('quicklink').hidden = entries[0].isIntersecting; }, { threshold: 0 }).observe(document.getElementById('stack'));
  setInterval(() => { if(C.user)C.refresh().catch(()=>{}); }, 30000);
  window.addEventListener('ob:account',()=>{
    if(!C.user&&['moving','paused','falling','requesting'].includes(phase)){phase='over';moving=null;gameId=null;}
    updateAccount();
  });
  window.addEventListener('ob:dialog',()=>pause());

  updateAccount();resetTower();resize();
  C.ready.then(()=>{updateAccount();});
})();
