// Voa Alto: toque para bater as asinhas e passar entre as árvores.
// Versão gentil: 3 corações, o chão e o teto só empurram de volta, e as
// aberturas começam largas e vão fechando devagar.
import { setupCanvas, createLoop, drawPet, drawCloud, drawHearts, drawLabel, createParticles, onPress, rand, skyGradient, roundRect, drawStar } from './kit.js';

export default function mount(root, env) {
  const v = setupCanvas(root);
  const { ctx } = v;
  const fx = createParticles();
  const GRAV = 1250, FLAP = -410, PX = 110, SIZE = 50;
  let s;

  function reset() {
    s = {
      t: 0, y: v.vh * 0.42, vy: 0, score: 0, lives: 3, hurt: 0, over: false, started: false,
      pipes: [], spawn: 0, speed: 150, wing: 0,
      clouds: Array.from({ length: 5 }, (_, i) => ({ x: i * 90, y: rand(30, v.vh * 0.6), s: rand(0.6, 1.1) }))
    };
  }
  reset();

  const gap = () => Math.max(150, 220 - s.score * 2.5);
  const floorY = () => v.vh - 46;

  function flap() {
    if (s.over) return;
    s.started = true;
    s.vy = FLAP;
    s.wing = 1;
    env.sound.play('flap');
  }
  const off = onPress(v.canvas, flap);

  function spawn() {
    const g = gap(), margin = 70;
    const top = rand(margin, floorY() - margin - g);
    s.pipes.push({ x: v.vw + 30, top, g, w: 62, passed: false, star: Math.random() < 0.35 });
  }

  function hurt() {
    if (s.hurt > 0 || s.over) return;
    s.lives -= 1;
    s.hurt = 1.6;
    env.sound.play('hit');
    env.haptic([30, 40, 30]);
    fx.burst(PX, s.y, 12, ['#FF5A7A', '#fff']);
    if (s.lives <= 0) {
      s.over = true;
      env.sound.play('lose');
      setTimeout(() => env.onGameOver(s.score), 800);
      return;
    }
    // abre espaço: empurra os canos próximos para longe e centraliza no próximo buraco
    const next = s.pipes.find((p) => p.x + p.w > PX - 20);
    if (next) s.y = next.top + next.g / 2;
    s.vy = -120;
  }

  function update(dt) {
    fx.update(dt);
    s.wing = Math.max(0, s.wing - dt * 4);
    if (!s.started) { s.t += dt; s.y = v.vh * 0.42 + Math.sin(s.t * 3) * 10; return; }
    if (s.over) { s.vy += GRAV * dt; s.y = Math.min(floorY() - SIZE / 2, s.y + s.vy * dt); return; }
    s.t += dt;
    s.speed = Math.min(230, 150 + s.score * 2);
    s.vy = Math.min(560, s.vy + GRAV * dt);
    s.y += s.vy * dt;
    if (s.hurt > 0) s.hurt -= dt;
    // teto e chão: quicam
    if (s.y < SIZE / 2) { s.y = SIZE / 2; s.vy = 60; }
    if (s.y > floorY() - SIZE / 2) { s.y = floorY() - SIZE / 2; s.vy = FLAP * 0.8; env.sound.play('bounce'); hurt(); }

    const dx = s.speed * dt;
    for (const c of s.clouds) { c.x -= dx * 0.25; if (c.x < -90) { c.x = v.vw + rand(0, 60); c.y = rand(30, v.vh * 0.6); } }
    s.spawn -= dt;
    if (s.spawn <= 0) { spawn(); s.spawn = 210 / s.speed; }
    for (let i = s.pipes.length - 1; i >= 0; i -= 1) {
      const p = s.pipes[i];
      p.x -= dx;
      if (p.x + p.w < -10) { s.pipes.splice(i, 1); continue; }
      if (!p.passed && p.x + p.w < PX - SIZE / 2) {
        p.passed = true;
        s.score += p.star ? 2 : 1;
        env.sound.play(p.star ? 'coin' : 'pop');
        if (p.star) fx.burst(PX, s.y, 10);
      }
      const r = SIZE * 0.36;
      const inX = PX + r > p.x + 6 && PX - r < p.x + p.w - 6;
      if (inX && (s.y - r < p.top || s.y + r > p.top + p.g)) hurt();
    }
    env.onScore(s.score);
  }

  function drawTree(p) {
    const fy = floorY();
    // tronco de cima (galho pendurado) e de baixo
    const trunk = (y1, y2) => {
      ctx.fillStyle = '#9B6A45'; roundRect(ctx, p.x + 12, y1, p.w - 24, y2 - y1, 10); ctx.fill();
      ctx.fillStyle = '#B98056'; ctx.fillRect(p.x + 18, y1, 6, y2 - y1);
    };
    trunk(-10, p.top - 16);
    trunk(p.top + p.g + 16, fy + 4);
    // copas
    ctx.fillStyle = '#4DB77A';
    ctx.beginPath(); ctx.ellipse(p.x + p.w / 2, p.top - 10, p.w * 0.72, 26, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(p.x + p.w / 2, p.top + p.g + 12, p.w * 0.72, 26, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#6FD69A';
    ctx.beginPath(); ctx.ellipse(p.x + p.w / 2 - 10, p.top - 16, p.w * 0.35, 12, 0, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(p.x + p.w / 2 - 10, p.top + p.g + 6, p.w * 0.35, 12, 0, 0, Math.PI * 2); ctx.fill();
    if (p.star && !p.passed) drawStar(ctx, p.x + p.w / 2, p.top + p.g / 2, 12, '#FFD54A', s.t);
  }

  function draw() {
    const w = v.vw, h = v.vh, fy = floorY();
    skyGradient(ctx, w, h, '#8FD3FF', '#E4F6FF');
    for (const c of s.clouds) drawCloud(ctx, c.x, c.y, c.s, 0.85);
    for (const p of s.pipes) drawTree(p);
    ctx.fillStyle = '#5CCB8A'; ctx.fillRect(0, fy, w, h - fy);
    ctx.fillStyle = '#4DB77A'; ctx.fillRect(0, fy, w, 7);

    // asinhas
    const flapA = s.wing > 0 ? -0.9 * s.wing : Math.sin(s.t * 10) * 0.2;
    const tilt = Math.max(-0.4, Math.min(0.6, s.vy / 900));
    const alpha = s.hurt > 0 && Math.floor(s.hurt * 10) % 2 === 0 ? 0.35 : 1;
    ctx.save();
    ctx.translate(PX, s.y);
    ctx.rotate(tilt);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = 'rgba(42,35,80,.25)';
    ctx.lineWidth = 2;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(side * SIZE * 0.42, -4);
      ctx.rotate(side * (0.5 + flapA));
      ctx.beginPath(); ctx.ellipse(side * 10, -6, 14, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    drawPet(ctx, PX, s.y, SIZE, env.look, { mood: s.hurt > 0 || s.over ? 'ouch' : s.wing > 0.5 ? 'happy' : 'normal', rot: tilt, alpha });
    fx.draw(ctx);

    drawHearts(ctx, 14, 24, s.lives);
    drawLabel(ctx, `${s.score}`, w / 2, 58, { size: 44 });
    if (!s.started) drawLabel(ctx, 'Toque para voar!', w / 2, h * 0.62, { size: 24 });
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
