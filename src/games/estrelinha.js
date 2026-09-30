// Pega-Estrelinha: estrelas saem dos buracos no gramado. Toque nelas antes
// que se escondam! Estrela dourada vale mais. A nuvem de chuva tira pontos.
// Rodada de 40 segundos, ficando mais rápida no final.
import { el, pick } from './kit.js';
import { petMarkup, applyLook } from '../shared/pet.js';

const ROUND = 40;
const HOLES = 9;

export default function mount(root, env) {
  const wrap = el('div', 'g-whack');
  wrap.innerHTML = `
    <div class="g-whack-top"><div class="g-whack-pet">${petMarkup('wh')}</div>
      <div class="g-whack-time"><i id="whBar"></i></div><strong id="whSecs">${ROUND}s</strong></div>
    <div class="g-whack-field">${Array.from({ length: HOLES }, (_, i) =>
      `<div class="g-hole" data-h="${i}"><button class="g-pop" type="button" data-h="${i}" aria-label="pegar"></button><span class="g-mound"></span></div>`).join('')}</div>
    <p class="g-hint" id="whMsg">Toque nas estrelas ⭐ e fuja da chuva 🌧️</p>`;
  root.appendChild(wrap);
  applyLook(wrap.querySelector('svg'), env.look, 400);
  const petEl = wrap.querySelector('.g-whack-pet');
  const holes = [...wrap.querySelectorAll('.g-hole')];
  let score, left, active, timer, spawnT, running, over, combo;

  function reset() {
    score = 0; left = ROUND; active = new Map(); spawnT = 0; running = false; over = false; combo = 0;
    holes.forEach((h) => { h.classList.remove('up'); h.querySelector('.g-pop').textContent = ''; });
    env.onScore(0);
    hud();
  }
  function hud() {
    wrap.querySelector('#whSecs').textContent = `${Math.ceil(left)}s`;
    wrap.querySelector('#whBar').style.width = `${(left / ROUND) * 100}%`;
  }
  const progress = () => 1 - left / ROUND; // 0 → 1
  function spawn() {
    const free = holes.map((_, i) => i).filter((i) => !active.has(i));
    if (!free.length) return;
    const i = pick(free);
    const r = Math.random();
    const kind = r < 0.12 ? 'gold' : r < 0.32 ? 'rain' : 'star';
    const stay = (kind === 'gold' ? 0.8 : 1.35) - progress() * 0.55;
    active.set(i, { kind, ttl: stay });
    const h = holes[i];
    h.dataset.kind = kind;
    h.querySelector('.g-pop').textContent = kind === 'gold' ? '🌟' : kind === 'rain' ? '🌧️' : '⭐';
    h.classList.add('up');
  }
  function hide(i) {
    active.delete(i);
    holes[i].classList.remove('up', 'hit');
  }
  function tick(dt) {
    if (!running) return;
    left = Math.max(0, left - dt);
    hud();
    spawnT -= dt;
    const every = 0.8 - progress() * 0.42;
    const maxUp = progress() > 0.5 ? 3 : 2;
    if (spawnT <= 0 && active.size < maxUp) { spawn(); spawnT = every; }
    for (const [i, it] of active) {
      it.ttl -= dt;
      if (it.ttl <= 0) { if (it.kind !== 'rain') combo = 0; hide(i); }
    }
    if (left <= 0) {
      running = false; over = true;
      for (const i of [...active.keys()]) hide(i);
      env.sound.play('win');
      wrap.querySelector('#whMsg').textContent = 'Tempo esgotado!';
      setTimeout(() => env.onGameOver(score), 700);
    }
  }
  let last = 0;
  function frame(t) {
    if (!running) return;
    const dt = Math.min(0.05, (t - last) / 1000 || 0);
    last = t;
    tick(dt);
    timer = requestAnimationFrame(frame);
  }
  function loopStart() { running = true; last = performance.now(); timer = requestAnimationFrame(frame); }

  const hit = (e) => {
    const b = e.target.closest('.g-pop');
    if (!b || !running) return;
    e.preventDefault();
    const i = Number(b.dataset.h);
    const it = active.get(i);
    if (!it) return;
    const h = holes[i];
    h.classList.add('hit');
    active.delete(i);
    if (it.kind === 'rain') {
      score = Math.max(0, score - 10);
      combo = 0;
      env.sound.play('hit');
      env.haptic([20, 30, 20]);
      wrap.querySelector('#whMsg').textContent = 'Ops, molhou! −10';
    } else {
      combo += 1;
      const pts = (it.kind === 'gold' ? 30 : 10) + (combo >= 5 ? 5 : 0);
      score += pts;
      env.sound.play(it.kind === 'gold' ? 'coin' : 'pop', combo % 6);
      env.haptic(8);
      wrap.querySelector('#whMsg').textContent = combo >= 5 ? `Sequência de ${combo}! +${pts}` : `+${pts}`;
      if (combo % 5 === 0) { petEl.classList.remove('cheer'); void petEl.offsetWidth; petEl.classList.add('cheer'); }
    }
    env.onScore(score);
    setTimeout(() => { if (!active.has(i)) holes[i].classList.remove('up', 'hit'); }, 160);
  };
  wrap.addEventListener('pointerdown', hit);

  reset();
  return {
    start() { reset(); loopStart(); },
    pause() { running = false; cancelAnimationFrame(timer); },
    resume() { if (!over) loopStart(); },
    destroy() { running = false; cancelAnimationFrame(timer); wrap.removeEventListener('pointerdown', hit); wrap.remove(); }
  };
}
