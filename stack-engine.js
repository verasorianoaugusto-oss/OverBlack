/* Shared, dependency-free rules for OVERBLACK STACK. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.OBStackRules = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const DAILY = 5, TARGET = 5000;
  const achievements = [
    { id: 'height10', height: 10, extra: 1, title: 'Primer skyline' },
    { id: 'height25', height: 25, extra: 2, title: 'Dueño de la calle' },
    { id: 'height50', height: 50, extra: 3, title: 'Por encima de todo' }
  ];
  const int = n => Number.isSafeInteger(n) && n >= 0;
  function day(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
    const p = type => parts.find(x => x.type === type).value;
    return `${p('year')}-${p('month')}-${p('day')}`;
  }
  function fresh(today = day()) {
    return { version: 1, day: today, used: 0, extra: 0, points: 0, best: 0, bestScore: 0, claims: [], vouchers: [] };
  }
  function validate(s) {
    return s && s.version === 1 && /^\d{4}-\d{2}-\d{2}$/.test(s.day) &&
      ['used', 'extra', 'points', 'best', 'bestScore'].every(k => int(s[k])) && s.used <= DAILY &&
      Array.isArray(s.claims) && s.claims.every(x => achievements.some(a => a.id === x)) &&
      Array.isArray(s.vouchers) && s.vouchers.every(x => typeof x === 'string');
  }
  function rollover(s, today = day()) {
    // Going backwards in the device clock never replenishes today's attempts.
    if (today > s.day) { s.day = today; s.used = 0; }
    return s;
  }
  function remaining(s) { return DAILY - s.used + s.extra; }
  function consume(s, today = day()) {
    rollover(s, today);
    if (s.used < DAILY) { s.used++; return true; }
    if (s.extra > 0) { s.extra--; return true; }
    return false;
  }
  function speed(height) { return 1 + height * 0.055; }
  function placement(previous, moving) {
    const delta = moving.x - previous.x;
    const perfect = Math.abs(delta) <= Math.min(6, previous.width * 0.12);
    if (perfect) return { hit: true, perfect: true, x: previous.x, width: previous.width, points: 5 };
    const left = Math.max(previous.x, moving.x);
    const right = Math.min(previous.x + previous.width, moving.x + moving.width);
    const width = right - left;
    return { hit: width > 0, perfect: false, x: left, width: Math.max(0, width), points: width > 0 ? 2 : 0 };
  }
  function award(s, points, height, score) {
    s.points += points;
    s.best = Math.max(s.best, height);
    s.bestScore = Math.max(s.bestScore, score);
    const earned = achievements.filter(a => height >= a.height && !s.claims.includes(a.id));
    earned.forEach(a => { s.claims.push(a.id); s.extra += a.extra; });
    return earned;
  }
  return { DAILY, TARGET, achievements, day, fresh, validate, rollover, remaining, consume, speed, placement, award };
});
