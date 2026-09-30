// Siga as Cores: o personagem mostra uma sequência de cores com sons.
// Repita na mesma ordem. A cada rodada, uma cor a mais.
// Errou? Uma segunda chance por partida para ver a sequência de novo.
import { el, sleep, randInt } from './kit.js';
import { petMarkup, applyLook } from '../shared/pet.js';

const PADS = [
  { name: 'vermelho', icon: '🍓' },
  { name: 'amarelo', icon: '🍋' },
  { name: 'verde', icon: '🍀' },
  { name: 'azul', icon: '💧' }
];

export default function mount(root, env) {
  const wrap = el('div', 'g-simon');
  wrap.innerHTML = `
    <p class="g-simon-status" id="siStatus">Olhe e escute…</p>
    <div class="g-simon-board">
      ${PADS.map((p, i) => `<button class="g-pad g-pad-${i}" type="button" data-p="${i}" aria-label="${p.name}"><span>${p.icon}</span></button>`).join('')}
      <div class="g-simon-pet">${petMarkup('si')}</div>
    </div>
    <div class="g-simon-info"><span>Rodada <strong id="siRound">1</strong></span><span id="siChance">💖 1 segunda chance</span></div>`;
  root.appendChild(wrap);
  applyLook(wrap.querySelector('svg'), env.look, 400);
  const pads = [...wrap.querySelectorAll('.g-pad')];
  const petEl = wrap.querySelector('.g-simon-pet');
  let seq = [], idx = 0, accepting = false, chance = true, over = false, alive = true, gen = 0, paused = false;

  const status = (t) => { wrap.querySelector('#siStatus').textContent = t; };
  const speed = () => Math.max(260, 620 - seq.length * 28);

  async function light(i, ms) {
    pads[i].classList.add('on');
    env.sound.play('note', i);
    await sleep(ms);
    pads[i].classList.remove('on');
  }
  async function playback() {
    const g = ++gen;
    accepting = false;
    status('Olhe e escute…');
    wrap.classList.add('watching');
    await sleep(600);
    for (const i of seq) {
      if (!alive || g !== gen) return;
      while (paused) { await sleep(200); if (!alive || g !== gen) return; }
      await light(i, speed());
      await sleep(speed() * 0.35);
    }
    if (!alive || g !== gen) return;
    wrap.classList.remove('watching');
    idx = 0;
    accepting = true;
    status('Sua vez!');
  }
  function nextRound() {
    seq.push(randInt(0, 3));
    wrap.querySelector('#siRound').textContent = seq.length;
    playback();
  }
  function reset() {
    gen += 1;
    seq = []; idx = 0; accepting = false; chance = true; over = false;
    wrap.querySelector('#siChance').textContent = '💖 1 segunda chance';
    env.onScore(0);
  }

  async function press(i) {
    if (!accepting || over || paused) return;
    light(i, 180);
    if (i === seq[idx]) {
      idx += 1;
      if (idx === seq.length) {
        accepting = false;
        env.onScore(seq.length);
        status(seq.length % 5 === 0 ? 'Uau! Que memória!' : 'Isso!');
        if (seq.length % 5 === 0) { env.sound.play('level'); petEl.classList.remove('cheer'); void petEl.offsetWidth; petEl.classList.add('cheer'); }
        await sleep(700);
        if (alive && !over) nextRound();
      }
      return;
    }
    accepting = false;
    env.haptic([30, 40, 30]);
    if (chance) {
      chance = false;
      wrap.querySelector('#siChance').textContent = '💖 segunda chance usada';
      env.sound.play('hit');
      status('Quase! Olhe de novo…');
      await sleep(900);
      if (alive && !over) playback();
      return;
    }
    over = true;
    env.sound.play('lose');
    status(`Você lembrou ${seq.length - 1} cores!`);
    setTimeout(() => env.onGameOver(Math.max(0, seq.length - 1)), 900);
  }
  const down = (e) => { const b = e.target.closest('.g-pad'); if (!b) return; e.preventDefault(); press(Number(b.dataset.p)); };
  const key = (e) => { const k = { 1: 0, 2: 1, 3: 2, 4: 3 }[e.key]; if (k !== undefined) press(k); };
  wrap.addEventListener('pointerdown', down);
  addEventListener('keydown', key);

  return {
    start() { reset(); nextRound(); },
    pause() { paused = true; },
    resume() { paused = false; },
    destroy() { alive = false; gen += 1; wrap.removeEventListener('pointerdown', down); removeEventListener('keydown', key); wrap.remove(); }
  };
}
