// Combina Frutas: troque duas frutas vizinhas para formar linhas de 3 ou mais.
// Reações em cadeia multiplicam os pontos. Linhas de 4 dão +1 jogada, de 5 dão +2.
import { el, sleep, randInt } from './kit.js';
import { petMarkup, applyLook } from '../shared/pet.js';

const TYPES = ['🍎', '🍊', '🍋', '🍇', '🍉', '🍓'];
const N = 7;
const START_MOVES = 25;

export default function mount(root, env) {
  const wrap = el('div', 'g-fruit');
  wrap.innerHTML = `
    <div class="g-fruit-top">
      <div class="g-fruit-pet">${petMarkup('fruit')}</div>
      <div class="g-fruit-moves"><small>Jogadas</small><strong id="frMoves">${START_MOVES}</strong></div>
      <div class="g-fruit-combo" id="frCombo"></div>
    </div>
    <div class="g-fruit-board"></div>
    <p class="g-hint">Arraste uma fruta até a vizinha (ou toque em duas)</p>`;
  root.appendChild(wrap);
  applyLook(wrap.querySelector('svg'), env.look, 400);
  const boardEl = wrap.querySelector('.g-fruit-board');
  const petEl = wrap.querySelector('.g-fruit-pet');
  let board, score, moves, busy, over, selected, idc, paused;

  const setPos = (t) => { t.el.style.setProperty('--r', t.r); t.el.style.setProperty('--c', t.c); };
  function makeTile(r, c, type, fromRow = r) {
    const t = { id: idc += 1, r: fromRow, c, type, el: el('button', 'g-fruit-tile', TYPES[type]) };
    t.el.type = 'button';
    t.el.dataset.id = t.id;
    t.el.setAttribute('aria-label', 'fruta');
    setPos(t);
    boardEl.appendChild(t.el);
    if (fromRow !== r) requestAnimationFrame(() => requestAnimationFrame(() => { t.r = r; setPos(t); }));
    else t.r = r;
    return t;
  }
  function randomTypeAvoiding(r, c) {
    for (let i = 0; i < 20; i += 1) {
      const t = randInt(0, TYPES.length - 1);
      const left = c >= 2 && board[r][c - 1]?.type === t && board[r][c - 2]?.type === t;
      const up = r >= 2 && board[r - 1][c]?.type === t && board[r - 2][c]?.type === t;
      if (!left && !up) return t;
    }
    return randInt(0, TYPES.length - 1);
  }
  function build() {
    boardEl.innerHTML = '';
    board = Array.from({ length: N }, () => Array(N).fill(null));
    for (let r = 0; r < N; r += 1) for (let c = 0; c < N; c += 1) board[r][c] = makeTile(r, c, randomTypeAvoiding(r, c));
    if (!hasMove()) build();
  }
  function reset() {
    score = 0; moves = START_MOVES; busy = false; over = false; selected = null; idc = 0; paused = false;
    build();
    updateHud();
    env.onScore(0);
  }
  function updateHud(combo = 0) {
    wrap.querySelector('#frMoves').textContent = moves;
    wrap.querySelector('#frCombo').textContent = combo > 1 ? `Combo x${combo}!` : '';
  }

  // Encontra todas as frutas em linhas de 3+.
  function findMatches(types = board.map((row) => row.map((t) => t?.type))) {
    const hit = new Set();
    const runs = [];
    for (let r = 0; r < N; r += 1) {
      let len = 1;
      for (let c = 1; c <= N; c += 1) {
        if (c < N && types[r][c] !== undefined && types[r][c] === types[r][c - 1]) len += 1;
        else { if (len >= 3) { runs.push(len); for (let k = c - len; k < c; k += 1) hit.add(`${r},${k}`); } len = 1; }
      }
    }
    for (let c = 0; c < N; c += 1) {
      let len = 1;
      for (let r = 1; r <= N; r += 1) {
        if (r < N && types[r][c] !== undefined && types[r][c] === types[r - 1][c]) len += 1;
        else { if (len >= 3) { runs.push(len); for (let k = r - len; k < r; k += 1) hit.add(`${k},${c}`); } len = 1; }
      }
    }
    return { hit, runs };
  }
  function hasMove() {
    const types = board.map((row) => row.map((t) => t.type));
    for (let r = 0; r < N; r += 1) for (let c = 0; c < N; c += 1) {
      for (const [dr, dc] of [[0, 1], [1, 0]]) {
        const r2 = r + dr, c2 = c + dc;
        if (r2 >= N || c2 >= N) continue;
        [types[r][c], types[r2][c2]] = [types[r2][c2], types[r][c]];
        const ok = findMatches(types).hit.size > 0;
        [types[r][c], types[r2][c2]] = [types[r2][c2], types[r][c]];
        if (ok) return true;
      }
    }
    return false;
  }
  function swapCells(a, b) {
    board[a.r][a.c] = b; board[b.r][b.c] = a;
    [a.r, b.r] = [b.r, a.r]; [a.c, b.c] = [b.c, a.c];
    setPos(a); setPos(b);
  }

  async function resolve() {
    let combo = 1;
    for (;;) {
      const { hit, runs } = findMatches();
      if (!hit.size) break;
      updateHud(combo);
      env.sound.play('match', combo - 1);
      if (combo >= 3) { petEl.classList.remove('cheer'); void petEl.offsetWidth; petEl.classList.add('cheer'); env.haptic(15); }
      const bonus = runs.reduce((acc, len) => acc + (len >= 5 ? 2 : len === 4 ? 1 : 0), 0);
      if (bonus) { moves += bonus; env.sound.play('coin'); }
      score += hit.size * 10 * combo;
      env.onScore(score);
      hit.forEach((key) => { const [r, c] = key.split(',').map(Number); board[r][c].el.classList.add('is-pop'); });
      await sleep(200);
      hit.forEach((key) => { const [r, c] = key.split(',').map(Number); board[r][c].el.remove(); board[r][c] = null; });
      // gravidade: cada coluna desce e novas frutas entram por cima
      for (let c = 0; c < N; c += 1) {
        let write = N - 1;
        for (let r = N - 1; r >= 0; r -= 1) {
          const t = board[r][c];
          if (!t) continue;
          if (write !== r) { board[write][c] = t; board[r][c] = null; t.r = write; setPos(t); }
          write -= 1;
        }
        let spawn = -1;
        for (let r = write; r >= 0; r -= 1) { board[r][c] = makeTile(r, c, randInt(0, TYPES.length - 1), spawn); spawn -= 1; }
      }
      await sleep(260);
      combo += 1;
    }
    updateHud();
  }

  async function attempt(a, b) {
    if (busy || over || paused) return;
    if (Math.abs(a.r - b.r) + Math.abs(a.c - b.c) !== 1) return;
    busy = true;
    clearSelection();
    swapCells(a, b);
    env.sound.play('tap');
    await sleep(170);
    if (!findMatches().hit.size) {
      swapCells(a, b);
      env.sound.play('bounce');
      await sleep(170);
      busy = false;
      return;
    }
    moves -= 1;
    updateHud();
    await resolve();
    if (!hasMove()) {
      // embaralha sem gastar jogada
      const types = board.flat().map((t) => t.type).sort(() => Math.random() - 0.5);
      board.flat().forEach((t, i) => { t.type = types[i]; t.el.textContent = TYPES[t.type]; });
      await resolve();
    }
    if (moves <= 0) {
      over = true;
      env.sound.play('win');
      setTimeout(() => env.onGameOver(score), 700);
    }
    busy = false;
  }

  function clearSelection() { if (selected) selected.el.classList.remove('is-selected'); selected = null; }
  const tileOf = (target) => {
    const b = target.closest?.('.g-fruit-tile');
    if (!b) return null;
    const id = Number(b.dataset.id);
    return board.flat().find((t) => t && t.id === id) || null;
  };
  let drag = null;
  const down = (e) => {
    const t = tileOf(e.target);
    if (!t || busy || over) return;
    e.preventDefault();
    drag = { t, x: e.clientX, y: e.clientY, used: false };
  };
  const moveH = (e) => {
    if (!drag || drag.used) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
    drag.used = true;
    const [dr, dc] = Math.abs(dx) > Math.abs(dy) ? [0, Math.sign(dx)] : [Math.sign(dy), 0];
    const r2 = drag.t.r + dr, c2 = drag.t.c + dc;
    if (r2 >= 0 && r2 < N && c2 >= 0 && c2 < N) attempt(drag.t, board[r2][c2]);
  };
  const up = () => {
    if (!drag) return;
    const { t, used } = drag;
    drag = null;
    if (used) return;
    if (selected && selected !== t && Math.abs(selected.r - t.r) + Math.abs(selected.c - t.c) === 1) { attempt(selected, t); return; }
    clearSelection();
    selected = t;
    t.el.classList.add('is-selected');
    env.sound.play('tap');
  };
  boardEl.addEventListener('pointerdown', down);
  addEventListener('pointermove', moveH);
  addEventListener('pointerup', up);

  reset();
  return {
    start() { reset(); },
    pause() { paused = true; },
    resume() { paused = false; },
    destroy() {
      boardEl.removeEventListener('pointerdown', down);
      removeEventListener('pointermove', moveH);
      removeEventListener('pointerup', up);
      wrap.remove();
    }
  };
}
