// Pula-Pula: corrida infinita. Toque para pular (pulo duplo no ar), desvie dos
// obstáculos e pegue estrelas. 3 corações; a velocidade aumenta aos poucos.
import { setupCanvas, createLoop, drawPet, drawStar, drawCloud, drawHearts, drawLabel, createParticles, onPress, rand, pick, skyGradient, roundRect } from './kit.js';

export default function mount(root, env) {
  const v = setupCanvas(root);
  const { ctx } = v;
  const fx = createParticles();
  const G = 2300, JUMP = -800, JUMP2 = -680;
  let s;

  function reset() {
    s = {
      t: 0, speed: 240, dist: 0, stars: 0, lives: 3, hurt: 0, over: false,
      y: 0, vy: 0, jumps: 0, squash: 1,
      obs: [], items: [], nextObs: 1.2, nextItem: 0.6,
      clouds: Array.from({ length: 4 }, (_, i) => ({ x: i * 110 + rand(0, 60), y: rand(40, 150), s: rand(0.7, 1.2) })),
      hills: 0
    };
  }
  reset();

  const ground = () => v.vh * 0.8;
  const PX = 78, SIZE = 58;

  function jump() {
    if (s.over) return;
    if (s.jumps < 2) {
      s.vy = s.jumps === 0 ? JUMP : JUMP2;
      s.jumps += 1;
      s.squash = 0.75;
      env.sound.play('jump');
    }
  }
  const offPress = onPress(v.canvas, jump);

  function spawnObstacle() {
    const kind = pick(['toco', 'pedra', 'arbusto', s.speed > 330 ? 'duplo' : 'toco']);
    const size = { toco: [34, 44], pedra: [46, 30], arbusto: [40, 36], duplo: [70, 40] }[kind];
    s.obs.push({ kind, x: v.vw + 20, w: size[0], h: size[1] });
    const gap = rand(0.9, 1.7) * (300 / s.speed) + 0.45;
    s.nextObs = gap;
  }
  function spawnItem() {
    const high = Math.random() < 0.55;
    const n = Math.random() < 0.3 ? 3 : 1;
    for (let i = 0; i < n; i += 1) s.items.push({ x: v.vw + 20 + i * 34, y: ground() - (high ? rand(120, 170) : 40), r: 13, rot: 0 });
    s.nextItem = rand(1.1, 2.4);
  }

  function hit() {
    if (s.hurt > 0) return;
    s.lives -= 1;
    s.hurt = 1.3;
    env.sound.play('hit');
    env.haptic([30, 40, 30]);
    fx.burst(PX, ground() - SIZE / 2 + s.y, 12, ['#FF5A7A', '#fff']);
    if (s.lives <= 0) {
      s.over = true;
      env.sound.play('lose');
      setTimeout(() => env.onGameOver(score()), 700);
    }
  }
  const score = () => Math.floor(s.dist / 12) + s.stars * 10;

  function update(dt) {
    fx.update(dt);
    if (s.over) { s.vy += G * dt; s.y = Math.min(0, s.y + s.vy * dt); return; }
    s.t += dt;
    s.speed = Math.min(560, 240 + s.t * 5.5);
    const dx = s.speed * dt;
    s.dist += dx;
    s.hills = (s.hills + dx * 0.3) % 400;
    for (const c of s.clouds) { c.x -= dx * 0.15; if (c.x < -80) { c.x = v.vw + rand(10, 80); c.y = rand(40, 150); } }

    // física do personagem
    s.vy += G * dt;
    s.y += s.vy * dt;
    if (s.y >= 0) { if (s.jumps) s.squash = 1.25; s.y = 0; s.vy = 0; s.jumps = 0; }
    s.squash += (1 - s.squash) * Math.min(1, dt * 10);
    if (s.hurt > 0) s.hurt -= dt;

    // obstáculos
    s.nextObs -= dt;
    if (s.nextObs <= 0) spawnObstacle();
    const gy = ground();
    const px1 = PX - SIZE * 0.32, px2 = PX + SIZE * 0.32, py2 = gy + s.y, py1 = py2 - SIZE * 0.72;
    for (let i = s.obs.length - 1; i >= 0; i -= 1) {
      const o = s.obs[i];
      o.x -= dx;
      if (o.x + o.w < -20) { s.obs.splice(i, 1); continue; }
      const ox1 = o.x + 5, ox2 = o.x + o.w - 5, oy1 = gy - o.h + 4;
      if (px2 > ox1 && px1 < ox2 && py2 > oy1 && py1 < gy) hit();
    }
    // estrelas
    s.nextItem -= dt;
    if (s.nextItem <= 0) spawnItem();
    for (let i = s.items.length - 1; i >= 0; i -= 1) {
      const it = s.items[i];
      it.x -= dx; it.rot += dt * 3;
      if (it.x < -30) { s.items.splice(i, 1); continue; }
      const cx = PX, cy = gy + s.y - SIZE * 0.4;
      if (Math.hypot(it.x - cx, it.y - cy) < it.r + SIZE * 0.42) {
        s.items.splice(i, 1);
        s.stars += 1;
        env.sound.play('coin');
        fx.burst(it.x, it.y, 8);
      }
    }
    env.onScore(score());
  }

  function drawObstacle(o, gy) {
    const x = o.x, y = gy - o.h;
    if (o.kind === 'toco' || o.kind === 'duplo') {
      const draw = (xx, w, h) => {
        ctx.fillStyle = '#8B5A3C'; roundRect(ctx, xx, gy - h, w, h, 8); ctx.fill();
        ctx.fillStyle = '#C48A5E'; ctx.beginPath(); ctx.ellipse(xx + w / 2, gy - h + 3, w / 2, 7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#8B5A3C'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(xx + w / 2, gy - h + 3, w / 4, 3, 0, 0, Math.PI * 2); ctx.stroke();
      };
      if (o.kind === 'duplo') { draw(x, 32, 40); draw(x + 38, 32, 30); } else draw(x, o.w, o.h);
    } else if (o.kind === 'pedra') {
      ctx.fillStyle = '#9AA3B5'; ctx.beginPath(); ctx.ellipse(x + o.w / 2, gy - o.h / 2 + 2, o.w / 2, o.h / 2 + 2, 0, Math.PI, 0); ctx.lineTo(x + o.w, gy); ctx.lineTo(x, gy); ctx.fill();
      ctx.fillStyle = '#C3CAD8'; ctx.beginPath(); ctx.ellipse(x + o.w * 0.38, y + 10, 9, 5, -0.4, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = '#3FA86E';
      ctx.beginPath(); ctx.arc(x + 12, gy - 14, 14, 0, Math.PI * 2); ctx.arc(x + 28, gy - 20, 17, 0, Math.PI * 2); ctx.arc(x + o.w - 8, gy - 12, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#FF7A95'; [[x + 14, gy - 22], [x + 30, gy - 30], [x + 34, gy - 12]].forEach(([a, b]) => { ctx.beginPath(); ctx.arc(a, b, 3.5, 0, Math.PI * 2); ctx.fill(); });
    }
  }

  function draw() {
    const w = v.vw, h = v.vh, gy = ground();
    skyGradient(ctx, w, h, '#74C7FF', '#D9F2FF');
    ctx.fillStyle = '#FFE27A'; ctx.beginPath(); ctx.arc(w - 60, 70, 28, 0, Math.PI * 2); ctx.fill();
    for (const c of s.clouds) drawCloud(ctx, c.x, c.y, c.s);
    // colinas ao fundo
    ctx.fillStyle = '#9BE3B2';
    for (let i = -1; i < 3; i += 1) { ctx.beginPath(); ctx.ellipse(i * 400 - s.hills + 200, gy + 10, 240, 90, 0, Math.PI, 0); ctx.fill(); }
    // chão
    ctx.fillStyle = '#5CCB8A'; ctx.fillRect(0, gy, w, h - gy);
    ctx.fillStyle = '#4DB77A'; ctx.fillRect(0, gy, w, 8);
    ctx.fillStyle = '#6FD69A';
    for (let x = -((s.dist * 1) % 40); x < w; x += 40) { ctx.beginPath(); ctx.ellipse(x, gy + 26, 10, 3, 0, 0, Math.PI * 2); ctx.fill(); }

    for (const it of s.items) drawStar(ctx, it.x, it.y, it.r, '#FFD54A', it.rot * 0.3);
    for (const o of s.obs) drawObstacle(o, gy);

    // sombra e personagem
    ctx.fillStyle = 'rgba(0,0,0,.14)';
    ctx.beginPath(); ctx.ellipse(PX, gy + 2, 26 * (1 + s.y / 400), 6, 0, 0, Math.PI * 2); ctx.fill();
    const blinkHurt = s.hurt > 0 && Math.floor(s.hurt * 10) % 2 === 0;
    const run = s.y === 0 && !s.over ? Math.sin(s.t * 18) * 0.05 : 0;
    drawPet(ctx, PX, gy + s.y - SIZE / 2 + 4, SIZE, env.look, {
      mood: s.over ? 'ouch' : s.hurt > 0 ? 'ouch' : s.y < -30 ? 'happy' : 'normal',
      sx: 1 / s.squash, sy: s.squash, rot: run + (s.jumps === 2 ? s.t * 12 % (Math.PI * 2) * 0 : 0), alpha: blinkHurt ? 0.4 : 1
    });
    fx.draw(ctx);

    drawHearts(ctx, 14, 24, s.lives);
    drawLabel(ctx, `${score()}`, w - 16, 26, { size: 24, align: 'right' });
    if (s.t < 2.2 && !s.over) drawLabel(ctx, 'Toque para pular!', w / 2, h * 0.34, { size: 22 });
  }

  const loop = createLoop((dt) => { update(dt); draw(); });
  draw();
  return {
    start() { reset(); loop.start(); },
    pause() { loop.stop(); },
    resume() { if (!s.over) loop.start(); },
    destroy() { loop.stop(); offPress(); v.destroy(); }
  };
}
