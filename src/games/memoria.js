// Memória: vire duas cartas por vez e encontre os pares. 5 fases com cada vez
// mais cartas. No começo de cada fase as cartas aparecem por um instante.
import { el, shuffle, sleep } from './kit.js';
import { petMarkup, applyLook } from '../shared/pet.js';

const ICONS = ['🍎', '🍌', '🍓', '⭐', '🌈', '🎈', '🧸', '🚀', '🐶', '🐱', '🦊', '🐸', '🌻', '🍦', '🎨', '⚽', '🐢', '🦋'];
const LEVELS = [
  { pairs: 6, cols: 3, peek: 1600 },
  { pairs: 8, cols: 4, peek: 1400 },
  { pairs: 10, cols: 4, peek: 1200 },
  { pairs: 10, cols: 4, peek: 900 },
  { pairs: 12, cols: 4, peek: 800 }
];

export default function mount(root, env) {
  const wrap = el('div', 'g-mem');
  wrap.innerHTML = `
    <div class="g-mem-top"><div class="g-mem-pet">${petMarkup('mem')}</div>
      <div><small>Fase</small><strong id="memLevel">1 de ${LEVELS.length}</strong></div>
      <div><small>Pares</small><strong id="memPairs">0</strong></div></div>
    <div class="g-mem-board"></div>
    <p class="g-hint" id="memMsg">Memorize as cartas!</p>`;
  root.appendChild(wrap);
  applyLook(wrap.querySelector('svg'), env.look, 400);
  const boardEl = wrap.querySelector('.g-mem-board');
  const petEl = wrap.querySelector('.g-mem-pet');
  let level = 0, score = 0, open = [], found = 0, misses = 0, locked = true, over = false, alive = true, paused = false, gen = 0;

  const cheer = () => { petEl.classList.remove('cheer'); void petEl.offsetWidth; petEl.classList.add('cheer'); };
  async function startLevel() {
    const g = ++gen;
    const L = LEVELS[level];
    found = 0; misses = 0; open = []; locked = true;
    wrap.querySelector('#memLevel').textContent = `${level + 1} de ${LEVELS.length}`;
    wrap.querySelector('#memPairs').textContent = `0/${L.pairs}`;
    wrap.querySelector('#memMsg').textContent = 'Memorize as cartas!';
    const icons = shuffle(ICONS).slice(0, L.pairs);
    const deck = shuffle([...icons, ...icons]);
    boardEl.style.setProperty('--cols', L.cols);
    boardEl.style.setProperty('--rows', Math.ceil((L.pairs * 2) / L.cols));
    boardEl.innerHTML = deck.map((icon, i) => `
      <button class="g-card is-up" type="button" data-i="${i}" data-icon="${icon}" aria-label="carta">
        <span class="g-card-in"><span class="g-card-back">?</span><span class="g-card-face">${icon}</span></span>
      </button>`).join('');
    await sleep(L.peek);
    if (!alive || g !== gen) return;
    boardEl.querySelectorAll('.g-card').forEach((c) => c.classList.remove('is-up'));
    wrap.querySelector('#memMsg').textContent = 'Encontre os pares!';
    await sleep(350);
    if (g === gen) locked = false;
  }
  function reset() {
    level = 0; score = 0; over = false;
    env.onScore(0);
    startLevel();
  }

  async function flip(card) {
    if (locked || over || paused || card.classList.contains('is-up') || card.classList.contains('is-done')) return;
    card.classList.add('is-up');
    env.sound.play('tap');
    open.push(card);
    if (open.length < 2) return;
    locked = true;
    const g = gen;
    const [a, b] = open;
    open = [];
    await sleep(450);
    if (!alive || g !== gen) return;
    if (a.dataset.icon === b.dataset.icon) {
      a.classList.add('is-done'); b.classList.add('is-done');
      found += 1;
      score += 20;
      env.sound.play('match', Math.min(5, found));
      env.haptic(12);
      cheer();
      env.onScore(score);
      const L = LEVELS[level];
      wrap.querySelector('#memPairs').textContent = `${found}/${L.pairs}`;
      if (found === L.pairs) {
        const bonus = Math.max(0, L.pairs * 10 - misses * 5);
        score += bonus;
        env.onScore(score);
        env.sound.play('level');
        wrap.querySelector('#memMsg').textContent = bonus ? `Fase completa! Bônus +${bonus}` : 'Fase completa!';
        await sleep(1300);
        if (!alive || g !== gen) return;
        level += 1;
        if (level >= LEVELS.length) {
          over = true;
          env.sound.play('win');
          env.onGameOver(score);
          return;
        }
        startLevel();
        return;
      }
    } else {
      misses += 1;
      a.classList.add('is-miss'); b.classList.add('is-miss');
      await sleep(500);
      a.classList.remove('is-up', 'is-miss'); b.classList.remove('is-up', 'is-miss');
    }
    locked = false;
  }
  const click = (e) => { const c = e.target.closest('.g-card'); if (c) flip(c); };
  boardEl.addEventListener('click', click);

  return {
    start() { reset(); },
    pause() { paused = true; },
    resume() { paused = false; },
    destroy() { alive = false; boardEl.removeEventListener('click', click); wrap.remove(); }
  };
}
