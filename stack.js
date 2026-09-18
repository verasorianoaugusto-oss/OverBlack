(function () {
  'use strict';
  const R = window.OBStackRules;
  const $ = id => document.getElementById('ob-' + id);
  if (!R || !$('canvas')) return;
  const canvas = $('canvas'), ctx = canvas.getContext('2d');
  if (!ctx) { $('error').hidden = false; $('error').textContent = 'Este navegador no puede mostrar el juego. Prueba con un navegador actualizado.'; return; }
  const KEY = 'overblack.stack.v1';
  let memory = R.fresh(), storageOK = true, transactionBusy = false;
  let phase = 'ready', resumePhase = 'moving', score = 0, height = 0, blocks = [], moving, fall = null, debris = null;
  let lastFrame = 0, raf = 0, visible = false, direction = 1, camera = 0, popTime = 0, settlementBusy = false;
  const WIDTH = 600, HEIGHT = 780, BOX = 75, FLOOR = 650;
  const sprite = document.createElement('img');
  let spriteReady = false;
  sprite.onload = () => { spriteReady = true; draw(); };
  sprite.src = 'stack-box.png';
  const fmt = n => n.toLocaleString('en-US');
  function warn(message) { $('error').textContent = message; $('error').hidden = false; }
  function read() {
    if (!storageOK) return structuredClone(memory);
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return R.fresh();
      const state = JSON.parse(raw);
      if (!R.validate(state)) throw new Error('invalid');
      return R.rollover(state);
    } catch (e) {
      storageOK = false;
      warn('No pudimos leer el progreso guardado. Puedes jugar en esta sesión, pero el avance no se conservará al cerrar. No se han sobrescrito los datos anteriores.');
      return structuredClone(memory);
    }
  }
  function write(state) {
    memory = structuredClone(state);
    if (storageOK) try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch (e) { storageOK = false; warn('El navegador no permite guardar tu avance. Esta partida funciona, pero el progreso solo durará durante esta sesión.'); }
  }
  async function transact(fn) {
    const run = async () => { const s = read(); const result = await fn(s); write(s); updateAccount(s); return result; };
    // Serialize account mutations across tabs, including voucher and achievement claims.
    if (navigator.locks) return navigator.locks.request(KEY, run);
    if (transactionBusy) return null;
    transactionBusy = true;
    try { return await run(); } finally { transactionBusy = false; }
  }
  function updateAccount(s = read()) {
    $('balance').textContent = fmt(s.points); $('best').textContent = fmt(s.best); $('best-score').textContent = fmt(s.bestScore);
    $('remaining').textContent = R.remaining(s); $('free').textContent = 5 - s.used; $('extra').textContent = s.extra;
    [...$('attempt-dots').children].forEach((dot, i) => dot.classList.toggle('spent', i < s.used));
    $('progress').value = Math.min(R.TARGET, s.points);
    $('progress-text').textContent = `${fmt(s.points)} / 5,000 pts`;
    $('percent').textContent = Math.min(100, Math.floor(s.points / R.TARGET * 100)) + '%';
    const unlocked = s.points >= R.TARGET;
    $('unlocked').hidden = !unlocked; $('claim').hidden = !unlocked;
    $('reward-copy').textContent = unlocked ? 'Lo conseguiste. Solicita la validación de tu premio a la tienda.' : `Te faltan ${fmt(R.TARGET - s.points)} puntos para desbloquear tu premio.`;
    $('claim').href = 'https://wa.me/51981947363?text=' + encodeURIComponent(`Hola, OverBlack. Alcancé ${s.points} puntos en la primera versión de STACK (guardados en mi navegador). Quiero solicitar la validación del 10% de descuento. Mi récord es de ${s.best} cajas.`);
    $('achievements').innerHTML = R.achievements.map(a => `<div class="ob-achievement ${s.claims.includes(a.id) ? 'is-earned' : ''}"><span>${a.title}<small>${a.height} cajas de altura</small></span><b>${s.claims.includes(a.id) ? '✓ CONSEGUIDO' : '+' + a.extra + ' INTENTO' + (a.extra > 1 ? 'S' : '')}</b></div>`).join('');
    if (phase === 'ready' || phase === 'over') {
      $('action').disabled = !R.remaining(s);
      $('action').textContent = R.remaining(s) ? (phase === 'ready' ? 'EMPEZAR PARTIDA ↗' : 'VOLVER A JUGAR ↗') : 'SIN INTENTOS · VUELVE MAÑANA';
    }
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
    if (phase !== 'ready' && phase !== 'over') return;
    phase = 'starting'; $('action').disabled = true;
    const consumed = await transact(s => R.consume(s));
    if (!consumed) { phase = 'over'; overlay('POR HOY, HASTA AQUÍ', 'Tu próxima altura te espera.', 'Vuelve a las 00:00 de Perú o activa un código de intentos extra.'); updateAccount(); return; }
    score = 0; height = 0; resetTower(); updateGame(); pop('', '');
    phase = 'moving'; $('overlay').hidden = true; $('pause').disabled = false; $('pause').textContent = 'PAUSA'; $('action').disabled = false; $('action').textContent = 'SOLTAR CAJA ↓';
    canvas.focus({ preventScroll: true }); lastFrame = 0;
    if (document.hidden || !visible || document.getElementById('modal').classList.contains('show')) pause();
    schedule();
  }
  function drop() {
    if (phase !== 'moving' || settlementBusy) return;
    phase = 'falling'; fall = { start: yFor(moving.level) - 80, y: yFor(moving.level) - 80, end: yFor(moving.level) };
    $('action').disabled = true;
  }
  function action() {
    if (phase === 'paused') { resume(); return; }
    if (phase === 'ready' || phase === 'over') { start(); return; }
    drop();
  }
  function pop(title, text) { $('perfect').textContent = title; $('points-pop').textContent = text; popTime = title ? 1.25 : 0; }
  async function settle() {
    settlementBusy = true;
    const previous = blocks[blocks.length - 1];
    const result = R.placement(previous, moving);
    fall = null;
    if (!result.hit) {
      debris = { x: moving.x, width: moving.width, y: yFor(moving.level), age: 0 };
      moving = null; phase = 'over'; $('pause').disabled = true;
      overlay('PARTIDA TERMINADA', height ? `${height} cajas. Sigue subiendo.` : 'Encuentra tu ritmo.', `${fmt(score)} puntos sumados a tu saldo. ${height ? 'Tu próxima torre puede llegar más alto.' : 'Espera a que la caja quede sobre la base antes de soltar.'}`);
      pop('', ''); updateAccount(); settlementBusy = false; return;
    }
    if (!result.perfect) {
      const cutLeft = moving.x < result.x;
      debris = { x: cutLeft ? moving.x : result.x + result.width, width: moving.width - result.width, y: yFor(moving.level), age: 0 };
    }
    height++; score += result.points;
    blocks.push({ x: result.x, width: result.width, level: height });
    if (blocks.length > 18) blocks.shift();
    const earned = await transact(s => R.award(s, result.points, height, score));
    pop(result.perfect ? 'PERFECT' : 'BIEN COLOCADA', `+${result.points} PTS${earned?.length ? ' · LOGRO: +' + earned.reduce((n, a) => n + a.extra, 0) + ' INTENTOS' : ''}`);
    updateGame(); makeMoving();
    if (phase === 'paused') resumePhase = 'moving'; else phase = 'moving';
    $('action').disabled = false; settlementBusy = false;
  }
  function pause() {
    if (!['moving', 'falling'].includes(phase)) return;
    resumePhase = phase; phase = 'paused';
    overlay('TÓMATE UN RESPIRO', 'Tu torre te espera.', 'Continúa cuando estés listo. No se consume otro intento.');
    $('action').textContent = 'CONTINUAR PARTIDA →'; $('action').disabled = false; $('pause').textContent = 'CONTINUAR';
  }
  function resume() {
    if (phase !== 'paused' || document.hidden || document.getElementById('modal').classList.contains('show')) return;
    phase = resumePhase; $('overlay').hidden = true; $('action').textContent = 'SOLTAR CAJA ↓'; $('action').disabled = phase === 'falling'; $('pause').textContent = 'PAUSA'; lastFrame = 0; schedule();
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
  const backdrop = document.createElement('canvas'); backdrop.width = WIDTH; backdrop.height = HEIGHT;
  const bg = backdrop.getContext('2d');
  const light = bg.createRadialGradient(310, 215, 10, 310, 265, 430); light.addColorStop(0, '#292929'); light.addColorStop(.65, '#121212'); light.addColorStop(1, '#080808'); bg.fillStyle = light; bg.fillRect(0, 0, WIDTH, HEIGHT);
  let seed = 816; const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < 9000; i++) { bg.fillStyle = `rgba(255,255,255,${random() * .05})`; bg.fillRect(random() * WIDTH, random() * HEIGHT, 1, 1); }
  bg.strokeStyle = '#ffffff07'; bg.lineWidth = 1;
  for (let y = 100; y < 490; y += 46) { bg.beginPath(); bg.moveTo(0, y); bg.lineTo(WIDTH, y); bg.stroke(); for (let x = (y / 46 % 2) * 60; x < WIDTH; x += 120) { bg.beginPath(); bg.moveTo(x, y); bg.lineTo(x, y + 46); bg.stroke(); } }
  bg.save(); bg.translate(310, 280); bg.rotate(-.13); bg.fillStyle = '#ffffff05'; bg.textAlign = 'center'; bg.font = '900 italic 138px Arial'; bg.fillText('OVER', 0, 0); bg.fillText('BLACK', 0, 116); bg.restore();
  bg.strokeStyle = '#ffffff10'; bg.beginPath(); bg.moveTo(24, 480); bg.lineTo(576, 480); bg.stroke();
  for (let x = -300; x <= 900; x += 120) { bg.beginPath(); bg.moveTo(300 + (x - 300) * .3, 480); bg.lineTo(x, 560); bg.stroke(); }
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
        moving.x += direction * 145 * R.speed(height) * dt;
        const max = WIDTH - moving.width - 14;
        // Reflect overshoot, preserving speed even at high tower heights.
        while (moving.x < 0 || moving.x > max) { if (moving.x > max) { moving.x = 2 * max - moving.x; direction = -1; } if (moving.x < 0) { moving.x = -moving.x; direction = 1; } }
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
  window.addEventListener('storage', e => { if (e.key === KEY) updateAccount(); });
  window.addEventListener('resize', resize);
  new MutationObserver(() => { if (document.getElementById('modal').classList.contains('show')) pause(); }).observe(document.getElementById('modal'), { attributes: true, attributeFilter: ['class'] });
  new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (!visible) pause(); else { lastFrame = 0; schedule(); }
  }, { threshold: 0 }).observe(canvas);
  new IntersectionObserver(entries => { $('quicklink').hidden = entries[0].isIntersecting; }, { threshold: 0 }).observe(document.getElementById('stack'));
  setInterval(() => { updateAccount(); }, 30000);
  function decode64(text) { const normalized = text.replace(/-/g, '+').replace(/_/g, '/'); return Uint8Array.from(atob(normalized), c => c.charCodeAt(0)); }
  $('promo-form').addEventListener('submit', async e => {
    e.preventDefault(); const button = e.target.querySelector('button'); button.disabled = true;
    const status = $('promo-status'); status.textContent = 'Verificando código…';
    try {
      const publicKey = window.OBStackConfig?.voucherPublicKey;
      if (!publicKey) throw new Error('La tienda aún no ha activado los códigos por compras y promociones. Los logros ya están disponibles.');
      if (!storageOK) throw new Error('Activa el almacenamiento del navegador antes de canjear un código.');
      if (!navigator.locks) throw new Error('Para activar códigos, abre el juego en un navegador actualizado mediante HTTPS o localhost.');
      const parts = $('promo-code').value.trim().split('.');
      if (parts.length !== 2) throw new Error('Código no válido. Pega el código completo entregado por OverBlack.');
      const data = decode64(parts[0]), signature = decode64(parts[1]);
      const key = await crypto.subtle.importKey('jwk', publicKey, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
      if (!await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, signature, data)) throw new Error('La firma del código no es válida. Revisa que lo hayas copiado completo.');
      const voucher = JSON.parse(new TextDecoder().decode(data));
      if (voucher.v !== 1 || !/^[a-zA-Z0-9-]{8,80}$/.test(voucher.id) || !Number.isInteger(voucher.attempts) || voucher.attempts < 1 || voucher.attempts > 100 || !Number.isSafeInteger(voucher.expires)) throw new Error('Código no válido.');
      if (Date.now() >= voucher.expires) throw new Error('Este código ha caducado. Consulta con OverBlack.');
      await transact(s => {
        if (s.vouchers.includes(voucher.id)) throw new Error('Este código ya se activó en este navegador.');
        s.vouchers.push(voucher.id); s.extra += voucher.attempts;
      });
      $('promo-code').value = ''; status.textContent = `Listo. Sumaste ${voucher.attempts} intento${voucher.attempts > 1 ? 's' : ''} extra.`;
    } catch (error) { status.textContent = error instanceof Error && !['SyntaxError', 'InvalidCharacterError', 'DataError'].includes(error.name) ? error.message : 'No se pudo leer el código. Revisa que esté completo.'; }
    finally { button.disabled = false; }
  });
  memory = read(); write(memory); updateAccount(memory); resetTower(); resize();
})();
