// Torre Alta: o bloco vai e volta; toque para soltar. A parte que sobra cai.
// Acertou certinho? Bônus! Três acertos seguidos deixam o bloco mais largo.
// O personagem viaja no topo, e o céu vira espaço conforme a torre cresce.
import { setupCanvas, createLoop, drawPet, drawLabel, drawStar, createParticles, onPress, roundRect, rand } from './kit.js';

const BLOCK_H = 34;
const PALETTE = ['#FF8FA3', '#FFB23F', '#FFD54A', '#7FD67F', '#4FC3F7', '#7B61FF', '#C77DFF'];

export default function mount(root, env) {
  const v = setupCanvas(root);
  const { ctx } = v;
  const fx = createParticles();
  let s;

  function reset() {
    const w = 200;
    s = {
      stack: [{ x: (v.vw - w) / 2, w, c: '#9B6A45' }],
      cur: null, dir: 1, cam: 0, floors: 0, bonus: 0, combo: 0, over: false, t: 0,
      debris: [], land: 0,
      stars: Array.from({ length: 40 }, () => ({ x: rand(0, 360), y: rand(-4000, 0), r: rand(0.8, 2.2) }))
    };
    nextBlock();
  }
  function nextBlock() {
    const prev = s.stack[s.stack.length - 1];
    const fromLeft = s.stack.length % 2 === 0;
    s.cur = { x: fromLeft ? -prev.w : v.vw, w: prev.w, c: PALETTE[s.stack.length % PALETTE.length] };
    s.dir = fromLeft ? 1 : -1;
  }
  const baseY = () => v.vh - 70;
  const blockY = (i) => baseY() - i * BLOCK_H;
  const speed = () => Math.min(380, 150 + s.floors * 7);
  reset();

  function drop() {
    if (s.over || !s.cur) return;
    const prev = s.stack[s.stack.length - 1];
    const cur = s.cur;
    const left = Math.max(cur.x, prev.x), right = Math.min(cur.x + cur.w, prev.x + prev.w);
    const overlap = right - left;
    const y = blockY(s.stack.length);
    if (overlap <= 0) {
      s.debris.push({ x: cur.x, y, w: cur.w, c: cur.c, vy: 0, vx: s.dir * 40, rot: 0 });
      s.cur = null;
      s.over = true;
      env.sound.play('lose');
      env.haptic([40, 40, 40]);
      setTimeout(() => env.onGameOver(score()), 1100);
      return;
    }
    if (Math.abs(cur.x - prev.x) <= 7) {
      cur.x = prev.x;
      s.combo += 1;
      s.bonus += 1;
      if (s.combo >= 3) cur.w = Math.min(200, cur.w + 10);
      env.sound.play('perfect');
      env.haptic(18);
      fx.burst(cur.x + cur.w / 2, y, 16, ['#FFD54A', '#fff', cur.c]);
    } else {
      s.combo = 0;
      env.sound.play('drop');
      env.haptic(10);
      // pedaço que sobrou cai
      if (cur.x < prev.x) s.debris.push({ x: cur.x, y, w: prev.x - cur.x, c: cur.c, vy: 0, vx: -60, rot: 0 });
      if (cur.x + cur.w > prev.x + prev.w) s.debris.push({ x: prev.x + prev.w, y, w: cur.x + cur.w - (prev.x + prev.w), c: cur.c, vy: 0, vx: 60, rot: 0 });
      cur.x = left; cur.w = overlap;
    }
    s.stack.push(cur);
    s.floors += 1;
    s.land = 1;
    env.onScore(score());
    nextBlock();
  }
  const off = onPress(v.canvas, drop);
  const score = () => s.floors + s.bonus;

  function update(dt) {
    s.t += dt;
    fx.update(dt);
    s.land = Math.max(0, s.land - dt * 3);
    if (s.cur) {
      s.cur.x += s.dir * speed() * dt;
      if (s.cur.x + s.cur.w > v.vw + 10) { s.cur.x = v.vw + 10 - s.cur.w; s.dir = -1; }
      if (s.cur.x < -10) { s.cur.x = -10; s.dir = 1; }
    }
    for (let i = s.debris.length - 1; i >= 0; i -= 1) {
      const d = s.debris[i];
      d.vy += 1400 * dt; d.y += d.vy * dt; d.x += d.vx * dt; d.rot += d.vx * 0.0015 * dt * 60;
      if (d.y - s.cam > v.vh + 200) s.debris.splice(i, 1);
    }
    // câmera sobe acompanhando a torre (topo fica a ~45% da tela)
    const topY = blockY(s.stack.length);
    const target = Math.min(0, topY - v.vh * 0.45);
    s.cam += (target - s.cam) * Math.min(1, dt * 4);
  }

  function draw() {
    const w = v.vw, h = v.vh;
    // céu muda com a altura: dia → entardecer → espaço
    const k = Math.min(1, s.floors / 40);
    const g = ctx.createLinearGradient(0, 0, 0, h);
    const mix = (a, b) => a.map((x, i) => Math.round(x + (b[i] - x) * k));
    const top = mix([116, 199, 255], [24, 20, 73]), bot = mix([212, 240, 255], [85, 70, 170]);
    g.addColorStop(0, `rgb(${top})`); g.addColorStop(1, `rgb(${bot})`);
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    if (k > 0.3) {
      ctx.fillStyle = '#fff';
      ctx.globalAlpha = (k - 0.3) / 0.7;
      for (const st of s.stars) { const y = ((st.y - s.cam * 0.2) % h + h) % h; ctx.beginPath(); ctx.arc(st.x, y, st.r, 0, Math.PI * 2); ctx.fill(); }
      ctx.globalAlpha = 1;
    }
    ctx.save();
    ctx.translate(0, -s.cam);
    // chão
    ctx.fillStyle = '#5CCB8A';
    ctx.fillRect(-10, baseY() + BLOCK_H, w + 20, 400);
    ctx.fillStyle = '#4DB77A';
    ctx.fillRect(-10, baseY() + BLOCK_H, w + 20, 8);

    const drawBlock = (b, y) => {
      ctx.fillStyle = b.c;
      roundRect(ctx, b.x, y, b.w, BLOCK_H - 3, 8); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.3)';
      roundRect(ctx, b.x + 5, y + 4, Math.max(0, b.w - 10), 7, 4); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,.08)';
      ctx.fillRect(b.x + 4, y + BLOCK_H - 9, Math.max(0, b.w - 8), 4);
    };
    s.stack.forEach((b, i) => drawBlock(b, blockY(i)));
    if (s.cur) drawBlock(s.cur, blockY(s.stack.length));
    for (const d of s.debris) {
      ctx.save();
      ctx.translate(d.x + d.w / 2, d.y + BLOCK_H / 2);
      ctx.rotate(d.rot);
      ctx.translate(-(d.x + d.w / 2), -(d.y + BLOCK_H / 2));
      drawBlock(d, d.y);
      ctx.restore();
    }
    // personagem viaja em cima do bloco que está se movendo
    const ride = s.cur || s.stack[s.stack.length - 1];
    const rideY = s.cur ? blockY(s.stack.length) : blockY(s.stack.length - 1);
    const lastDebris = s.over ? s.debris[s.debris.length - 1] : null;
    const px = lastDebris ? lastDebris.x + lastDebris.w / 2 : ride.x + ride.w / 2;
    const py = (lastDebris ? lastDebris.y : rideY) - 24 - s.land * 10;
    drawPet(ctx, px, py, 48, env.look, {
      mood: s.over ? 'ouch' : s.combo >= 2 ? 'happy' : s.land > 0.5 ? 'wow' : 'normal',
      rot: lastDebris ? lastDebris.rot : 0, sx: 1 + s.land * 0.12, sy: 1 - s.land * 0.12
    });
    fx.draw(ctx);
    ctx.restore();

    drawLabel(ctx, `${score()}`, w / 2, 56, { size: 46 });
    if (s.combo >= 2 && !s.over) {
      drawStar(ctx, w / 2 - 70, 96, 10); drawLabel(ctx, `Certinho x${s.combo}!`, w / 2, 96, { size: 18, color: '#FFD54A' });
    }
    if (s.floors === 0 && !s.over) drawLabel(ctx, 'Toque para soltar!', w / 2, h * 0.3, { size: 22 });
  }

  const loop = createLoop((dt) => { update(dt); draw(); });
  draw();
  return {
    start() { reset(); loop.start(); },
    pause() { loop.stop(); },
    resume() { if (!s.over) loop.start(); },
    destroy() { loop.stop(); off(); v.destroy(); }
  };
}
