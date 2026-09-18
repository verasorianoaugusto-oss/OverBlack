(() => {
  const game = document.getElementById('stack');
  const button = document.getElementById('ob-fullscreen');
  let previousFocus, previousScroll = 0;
  function sync(active) {
    game.classList.toggle('ob-expanded', active);
    document.body.classList.toggle('ob-game-expanded', active);
    button.textContent = active ? '✕ Volver a la tienda' : '⛶ Pantalla completa';
    button.setAttribute('aria-pressed', String(active));
    window.dispatchEvent(new Event('resize'));
    if (!active) { window.scrollTo({top:previousScroll,behavior:'instant'}); previousFocus?.focus({preventScroll:true}); }
  }
  function enter() {
    if (game.classList.contains('ob-expanded')) return;
    previousFocus = document.activeElement; previousScroll = window.scrollY;
    sync(true);
    // Some mobile browsers do not support element fullscreen; the fixed layout remains usable.
    if (game.requestFullscreen) game.requestFullscreen().catch(() => {});
    button.focus({preventScroll:true});
  }
  function leave() {
    if (document.fullscreenElement === game) document.exitFullscreen().catch(() => sync(false));
    else sync(false);
  }
  button.addEventListener('click', () => game.classList.contains('ob-expanded') ? leave() : enter());
  document.addEventListener('fullscreenchange', () => sync(document.fullscreenElement === game));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && game.classList.contains('ob-expanded') && !document.fullscreenElement) leave(); });
})();
