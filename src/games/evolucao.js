// Evolução: deslize para juntar peças iguais (estilo 2048).
// Semente → broto → trevo → tulipa → girassol → maçã → árvore → estrela → arco-íris → coroa → diamante.
import { el, onSwipe, randInt } from './kit.js';
import { petMarkup, applyLook } from '../shared/pet.js';

const STAGES = ['🌱', '🌿', '🍀', '🌷', '🌻', '🍎', '🌳', '⭐', '🌈', '👑', '💎', '🚀', '🪐'];
const TINTS = ['#EAF8E6', '#D6F3CF', '#BDEBB4', '#FFD9E3', '#FFE9A8', '#FFC9C2', '#B9E7C2', '#FFE27A', '#D9CCFF', '#FFD166', '#BDE6FF', '#FFB4D0', '#E0D6FF'];
const N = 4;

export default function mount(root, env) {
  const wrap = el('div', 'g-evo');
  wrap.innerHTML = `
    <div class="g-evo-top"><div class="g-evo-pet">${petMarkup('evo')}</div><div class="g-evo-next"><small>Maior conquista</small><strong id="evoBest">🌱</strong></div></div>
    <div class="g-evo-board"><div class="g-evo-cells">${'<i></i>'.repeat(N * N)}</div><div class="g-evo-tiles"></div></div>
    <p class="g-hint">Deslize para cima, baixo, esquerda ou direita</p>`;
  root.appendChild(wrap);
  applyLook(wrap.querySelector('svg'), env.look, 400);
  const tilesEl = wrap.querySelector('.g-evo-tiles');
  const board = wrap.querySelector('.g-evo-board');
  const petEl = wrap.querySelector('.g-evo-pet');
  let grid, score, best, over, busy, idc;

  const pos = (t) => {
    t.el.style.setProperty('--r', t.r);
    t.el.style.setProperty('--c', t.c);
  };
  function paint(t) {
    t.el.textContent = '';
    t.el.style.background = TINTS[Math.min(t.lvl, TINTS.length - 1)];
    t.el.innerHTML = `<span class="em">${STAGES[Math.min(t.lvl, STAGES.length - 1)]}</span><small>${2 ** (t.lvl + 1)}</small>`;
  }
  function newTile(r, c, lvl) {
    const t = { id: idc += 1, r, c, lvl, el: el('div', 'g-evo-tile is-new') };
    paint(t); pos(t);
    tilesEl.appendChild(t.el);
    setTimeout(() => t.el.classList.remove('is-new'), 200);
    grid[r][c] = t;
    return t;
  }
  function empties() {
    const list = [];
    for (let r = 0; r < N; r += 1) for (let c = 0; c < N; c += 1) if (!grid[r][c]) list.push([r, c]);
    return list;
  }
  function addRandom() {
    const e = empties();
    if (!e.length) return;
    const [r, c] = e[randInt(0, e.length - 1)];
    newTile(r, c, Math.random() < 0.9 ? 0 : 1);
  }
  function reset() {
    tilesEl.innerHTML = '';
    grid = Array.from({ length: N }, () => Array(N).fill(null));
    score = 0; best = 0; over = false; busy = false; idc = 0;
    addRandom(); addRandom();
    wrap.querySelector('#evoBest').textContent = STAGES[0];
    env.onScore(0);
  }

  function canMove() {
    if (empties().length) return true;
    for (let r = 0; r < N; r += 1) for (let c = 0; c < N; c += 1) {
      const v = grid[r][c].lvl;
      if ((c < N - 1 && grid[r][c + 1].lvl === v) || (r < N - 1 && grid[r + 1][c].lvl === v)) return true;
    }
    return false;
  }

  function move(dir) {
    if (over || busy) return;
    const [dr, dc] = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] }[dir];
    const rows = dr === 1 ? [3, 2, 1, 0] : [0, 1, 2, 3];
    const cols = dc === 1 ? [3, 2, 1, 0] : [0, 1, 2, 3];
    const mergedInto = new Set();
    const removed = [];
    let moved = false, gained = 0, topLvl = -1;
    for (const r of rows) for (const c of cols) {
      const t = grid[r][c];
      if (!t) continue;
      let nr = r, nc = c;
      for (;;) {
        const tr = nr + dr, tc = nc + dc;
        if (tr < 0 || tr >= N || tc < 0 || tc >= N) break;
        const o = grid[tr][tc];
        if (!o) { nr = tr; nc = tc; continue; }
        if (o.lvl === t.lvl && !mergedInto.has(o)) {
          // funde t em o
          grid[r][c] = null;
          t.r = tr; t.c = tc; pos(t);
          removed.push(t);
          o.lvl += 1;
          mergedInto.add(o);
          gained += 2 ** (o.lvl + 1);
          topLvl = Math.max(topLvl, o.lvl);
          moved = true;
          nr = null;
        }
        break;
      }
      if (nr !== null && (nr !== r || nc !== c)) {
        grid[r][c] = null; grid[nr][nc] = t; t.r = nr; t.c = nc; pos(t); moved = true;
      }
    }
    if (!moved) { board.animate?.([{ transform: 'translateX(0)' }, { transform: 'translateX(4px)' }, { transform: 'translateX(0)' }], { duration: 120 }); return; }
    busy = true;
    env.sound.play(gained ? 'pop' : 'tap', Math.min(5, topLvl));
    setTimeout(() => {
      removed.forEach((t) => t.el.remove());
      mergedInto.forEach((o) => { paint(o); o.el.classList.add('is-merged'); setTimeout(() => o.el.classList.remove('is-merged'), 220); });
      score += gained;
      env.onScore(score);
      if (topLvl > best) {
        best = topLvl;
        wrap.querySelector('#evoBest').textContent = STAGES[Math.min(best, STAGES.length - 1)];
        if (best >= 4) {
          env.sound.play(best >= 10 ? 'win' : 'level');
          env.haptic(20);
          petEl.classList.remove('cheer'); void petEl.offsetWidth; petEl.classList.add('cheer');
        }
      }
      addRandom();
      busy = false;
      if (!canMove()) {
        over = true;
        env.sound.play('lose');
        setTimeout(() => env.onGameOver(score), 900);
      }
    }, 120);
  }
  const off = onSwipe(wrap, move, 20);

  reset();
  return {
    start() { reset(); },
    pause() { busy = true; },
    resume() { busy = false; },
    destroy() { off(); wrap.remove(); }
  };
}
