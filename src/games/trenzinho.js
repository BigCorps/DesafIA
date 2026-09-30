// Trenzinho de Frutas: o personagem puxa um trenzinho. Cada fruta vira um
// vagão novo. As bordas atravessam para o outro lado (sem bater na parede);
// só termina se o trem bater nele mesmo. Controles: deslizar, setas da tela ou teclado.
import { setupCanvas, createLoop, drawPet, drawLabel, drawStar, createParticles, onSwipe, roundRect, randInt } from './kit.js';

const COLS = 12;
const FRUITS = [
  { c: '#FF5A5F', leaf: true },  // maçã
  { c: '#FFA53B', leaf: true },  // laranja
  { c: '#FFD54A', leaf: false }, // limão
  { c: '#8E5CE6', leaf: false }, // uva
  { c: '#FF7AA8', leaf: true }   // pêssego
];
const WAGONS = ['#7B61FF', '#FF8FA3', '#5CCB8A', '#FFB23F', '#4FC3F7'];
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

export default function mount(root, env) {
  const v = setupCanvas(root);
  const { ctx } = v;
  const fx = createParticles();
  let s, layout;

  function computeLayout() {
    const cell = v.vw / COLS;
    const pad = 150; // espaço para as setas
    const rows = Math.max(10, Math.floor((v.vh - 64 - pad) / cell));
    layout = { cell, rows, top: 56, padTop: 56 + rows * cell + 10 };
  }
  computeLayout();
  v.onResize(computeLayout);

  function reset() {
    const r = Math.floor(layout.rows / 2);
    s = {
      body: [{ x: 4, y: r }, { x: 3, y: r }, { x: 2, y: r }],
      dir: 'right', queue: [], acc: 0, fruits: 0, stars: 0, over: false, t: 0,
      fruit: null, star: null, grow: 0, bump: 0
    };
    placeFruit();
  }
  const occupied = (x, y) => s.body.some((b) => b.x === x && b.y === y);
  function freeCell() {
    for (let i = 0; i < 200; i += 1) {
      const x = randInt(0, COLS - 1), y = randInt(0, layout.rows - 1);
      if (!occupied(x, y) && !(s.fruit && s.fruit.x === x && s.fruit.y === y)) return { x, y };
    }
    return { x: 0, y: 0 };
  }
  function placeFruit() { s.fruit = { ...freeCell(), k: randInt(0, FRUITS.length - 1) }; }
  reset();

  function turn(d) {
    if (s.over || !DIRS[d]) return;
    const last = s.queue.length ? s.queue[s.queue.length - 1] : s.dir;
    const [lx, ly] = DIRS[last], [nx, ny] = DIRS[d];
    if (lx + nx === 0 && ly + ny === 0) return; // não volta para trás
    if (d === last) return;
    if (s.queue.length < 2) s.queue.push(d);
    env.sound.play('tap');
  }
  const offSwipe = onSwipe(v.canvas, turn, 18);

  // setas desenhadas no canvas
  function padButtons() {
    const cx = v.vw / 2, cy = layout.padTop + 64, d = 50, r = 28;
    return [
      { d: 'up', x: cx, y: cy - d, r }, { d: 'down', x: cx, y: cy + d, r },
      { d: 'left', x: cx - d * 1.25, y: cy, r }, { d: 'right', x: cx + d * 1.25, y: cy, r }
    ];
  }
  const onDown = (e) => {
    const p = v.toLogical(e.clientX, e.clientY);
    const b = padButtons().find((q) => Math.hypot(q.x - p.x, q.y - p.y) < q.r + 12);
    if (b) { turn(b.d); b.flash = 0.2; pressed = b.d; pressedT = 0.15; }
  };
  let pressed = null, pressedT = 0;
  v.canvas.addEventListener('pointerdown', onDown);

  function step() {
    if (s.queue.length) s.dir = s.queue.shift();
    const [dx, dy] = DIRS[s.dir];
    const head = s.body[0];
    const nx = (head.x + dx + COLS) % COLS, ny = (head.y + dy + layout.rows) % layout.rows;
    const willGrow = s.grow > 0;
    const bodyToCheck = willGrow ? s.body : s.body.slice(0, -1);
    if (bodyToCheck.some((b) => b.x === nx && b.y === ny)) {
      s.over = true;
      env.sound.play('lose');
      env.haptic([40, 40, 40]);
      setTimeout(() => env.onGameOver(score()), 800);
      return;
    }
    s.body.unshift({ x: nx, y: ny });
    if (willGrow) s.grow -= 1; else s.body.pop();
    const cx = (nx + 0.5) * layout.cell, cy = layout.top + (ny + 0.5) * layout.cell;
    if (s.fruit && nx === s.fruit.x && ny === s.fruit.y) {
      s.fruits += 1; s.grow += 1; s.bump = 1;
      env.sound.play('pop', s.fruits % 6);
      fx.burst(cx, cy, 8, [FRUITS[s.fruit.k].c, '#fff']);
      placeFruit();
      if (s.fruits % 5 === 0) s.star = { ...freeCell(), life: 7 };
    }
    if (s.star && nx === s.star.x && ny === s.star.y) {
      s.stars += 1; s.bump = 1;
      env.sound.play('coin');
      fx.burst(cx, cy, 14);
      s.star = null;
    }
    env.onScore(score());
  }
  const score = () => s.fruits * 10 + s.stars * 30;
  const interval = () => Math.max(0.085, 0.2 - s.fruits * 0.004);

  function update(dt) {
    fx.update(dt);
    s.t += dt;
    s.bump = Math.max(0, s.bump - dt * 3);
    if (pressedT > 0) pressedT -= dt;
    if (s.over) return;
    if (s.star) { s.star.life -= dt; if (s.star.life <= 0) s.star = null; }
    s.acc += dt;
    while (s.acc >= interval() && !s.over) { s.acc -= interval(); step(); }
  }

  function drawFruit(f, x, y, r) {
    const fr = FRUITS[f.k];
    if (fr === FRUITS[3]) {
      ctx.fillStyle = fr.c;
      [[-5, -3], [5, -3], [0, 4], [-5, 8], [5, 8], [0, -9]].forEach(([a, b]) => { ctx.beginPath(); ctx.arc(x + a * r / 12, y + b * r / 12, r * 0.38, 0, Math.PI * 2); ctx.fill(); });
      return;
    }
    ctx.fillStyle = fr.c;
    ctx.beginPath(); ctx.arc(x, y + 1, r * 0.78, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.45)';
    ctx.beginPath(); ctx.arc(x - r * 0.28, y - r * 0.2, r * 0.2, 0, Math.PI * 2); ctx.fill();
    if (fr.leaf) {
      ctx.fillStyle = '#3FA86E';
      ctx.beginPath(); ctx.ellipse(x + r * 0.25, y - r * 0.8, r * 0.34, r * 0.16, -0.5, 0, Math.PI * 2); ctx.fill();
    }
  }

  function draw() {
    const { cell, rows, top } = layout;
    ctx.fillStyle = '#E9F9EF'; ctx.fillRect(0, 0, v.vw, v.vh);
    // tabuleiro quadriculado
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        ctx.fillStyle = (x + y) % 2 ? '#8EDFA8' : '#9BE6B3';
        ctx.fillRect(x * cell, top + y * cell, cell, cell);
      }
    }
    if (s.fruit) {
      const pulse = 1 + Math.sin(s.t * 6) * 0.06;
      drawFruit(s.fruit, (s.fruit.x + 0.5) * cell, top + (s.fruit.y + 0.5) * cell, cell * 0.5 * pulse);
    }
    if (s.star) drawStar(ctx, (s.star.x + 0.5) * cell, top + (s.star.y + 0.5) * cell, cell * 0.5, '#FFD54A', s.t * 2);
    // vagões (de trás para frente)
    for (let i = s.body.length - 1; i >= 1; i -= 1) {
      const b = s.body[i];
      const x = b.x * cell, y = top + b.y * cell;
      ctx.fillStyle = WAGONS[i % WAGONS.length];
      roundRect(ctx, x + 3, y + 4, cell - 6, cell - 10, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      roundRect(ctx, x + 7, y + 7, cell - 14, 6, 3); ctx.fill();
      ctx.fillStyle = '#2A2350';
      ctx.beginPath(); ctx.arc(x + cell * 0.3, y + cell - 5, 3.5, 0, Math.PI * 2); ctx.arc(x + cell * 0.7, y + cell - 5, 3.5, 0, Math.PI * 2); ctx.fill();
    }
    const h = s.body[0];
    drawPet(ctx, (h.x + 0.5) * cell, top + (h.y + 0.45) * cell, cell * 1.35 * (1 + s.bump * 0.15), env.look, { mood: s.over ? 'ouch' : s.bump > 0.2 ? 'happy' : 'normal' });
    fx.draw(ctx);

    // setas
    ctx.fillStyle = '#E9F9EF';
    ctx.fillRect(0, layout.padTop - 10, v.vw, v.vh - layout.padTop + 10);
    for (const b of padButtons()) {
      const on = pressed === b.d && pressedT > 0;
      ctx.fillStyle = on ? '#6849E9' : '#fff';
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#CFC5FF'; ctx.lineWidth = 3; ctx.stroke();
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate({ up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 }[b.d]);
      ctx.fillStyle = on ? '#fff' : '#7B61FF';
      ctx.beginPath(); ctx.moveTo(0, -11); ctx.lineTo(11, 7); ctx.lineTo(-11, 7); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    drawLabel(ctx, `${score()}`, v.vw - 14, 28, { size: 24, align: 'right', color: '#fff', stroke: '#3FA86E' });
    drawLabel(ctx, `🍎 ${s.fruits}`, 14, 28, { size: 20, align: 'left', color: '#fff', stroke: '#3FA86E' });
  }

  const loop = createLoop((dt) => { update(dt); draw(); });
  draw();
  return {
    start() { reset(); loop.start(); },
    pause() { loop.stop(); },
    resume() { if (!s.over) loop.start(); },
    destroy() { loop.stop(); offSwipe(); v.canvas.removeEventListener('pointerdown', onDown); v.destroy(); }
  };
}
