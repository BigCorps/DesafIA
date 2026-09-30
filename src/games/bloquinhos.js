// Quebra-Bloquinhos: arraste o dedo para mover a plataforma (o personagem vai
// sentado nela) e rebata a estrela. Blocos fortes precisam de dois toques.
// Fases infinitas, cada uma um pouco mais rápida. 3 corações.
import { setupCanvas, createLoop, drawPet, drawStar, drawHearts, drawLabel, createParticles, roundRect, rand, clamp, sound } from './kit.js';

const ROW_COLORS = ['#FF8FA3', '#FFB23F', '#FFD54A', '#7FD67F', '#4FC3F7', '#7B61FF', '#C77DFF', '#FF7AA8'];
const COLS = 7;

export default function mount(root, env) {
  const v = setupCanvas(root);
  const { ctx } = v;
  const fx = createParticles();
  let s;

  const padY = () => v.vh - 84;
  function buildLevel(level) {
    const rows = Math.min(8, 4 + level);
    const gap = 5, bw = (v.vw - 20 - gap * (COLS - 1)) / COLS, bh = 22;
    const bricks = [];
    const pattern = level % 3;
    for (let r = 0; r < rows; r += 1) {
      for (let c = 0; c < COLS; c += 1) {
        if (pattern === 1 && (r + c) % 4 === 3) continue;          // xadrez com buracos
        if (pattern === 2 && Math.abs(c - 3) > r + 1) continue;     // pirâmide invertida
        const strong = level >= 2 && Math.random() < Math.min(0.35, 0.1 * level);
        bricks.push({ x: 10 + c * (bw + gap), y: 90 + r * (bh + gap), w: bw, h: bh, c: ROW_COLORS[r % ROW_COLORS.length], hp: strong ? 2 : 1 });
      }
    }
    return bricks;
  }
  function resetBall() {
    s.ball = { x: s.pad.x, y: padY() - 40, vx: 0, vy: 0, r: 10, stuck: true, rot: 0 };
  }
  function reset() {
    s = { level: 1, score: 0, lives: 3, over: false, t: 0, pad: { x: v.vw / 2, w: 92, target: v.vw / 2 }, drops: [], hitFlash: 0 };
    s.bricks = buildLevel(1);
    resetBall();
  }
  reset();

  const speed = () => Math.min(560, 330 + (s.level - 1) * 28);
  function launch() {
    if (!s.ball.stuck || s.over) return;
    const a = rand(-0.5, 0.5);
    s.ball.vx = Math.sin(a) * speed();
    s.ball.vy = -Math.cos(a) * speed();
    s.ball.stuck = false;
    env.sound.play('tap');
  }
  // entrada: arrastar move a plataforma; tocar lança
  let dragging = false;
  const move = (e) => { const p = v.toLogical(e.clientX, e.clientY); s.pad.target = p.x; };
  const down = (e) => { sound.unlock(); dragging = true; move(e); launch(); };
  const upH = () => { dragging = false; };
  const mv = (e) => { if (dragging || e.pointerType === 'mouse') move(e); };
  const key = (e) => {
    if (e.key === 'ArrowLeft') s.pad.target = s.pad.x - 60;
    else if (e.key === 'ArrowRight') s.pad.target = s.pad.x + 60;
    else if (e.key === ' ') launch();
  };
  v.canvas.addEventListener('pointerdown', down);
  v.canvas.addEventListener('pointermove', mv);
  addEventListener('pointerup', upH);
  addEventListener('keydown', key);

  function loseLife() {
    s.lives -= 1;
    env.sound.play('hit');
    env.haptic([30, 40, 30]);
    s.hitFlash = 1;
    if (s.lives <= 0) {
      s.over = true;
      env.sound.play('lose');
      setTimeout(() => env.onGameOver(s.score), 800);
    } else resetBall();
  }

  function update(dt) {
    s.t += dt;
    fx.update(dt);
    s.hitFlash = Math.max(0, s.hitFlash - dt * 2);
    const p = s.pad;
    p.target = clamp(p.target, p.w / 2, v.vw - p.w / 2);
    p.x += (p.target - p.x) * Math.min(1, dt * 18);
    if (s.over) return;
    const b = s.ball;
    b.rot += dt * 4;
    if (b.stuck) { b.x = p.x; b.y = padY() - 40; return; }

    // move em passos pequenos para não atravessar blocos
    const steps = Math.ceil((Math.hypot(b.vx, b.vy) * dt) / 6);
    for (let i = 0; i < steps; i += 1) {
      b.x += (b.vx * dt) / steps;
      b.y += (b.vy * dt) / steps;
      if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx); env.sound.play('bounce'); }
      if (b.x > v.vw - b.r) { b.x = v.vw - b.r; b.vx = -Math.abs(b.vx); env.sound.play('bounce'); }
      if (b.y < 60 + b.r) { b.y = 60 + b.r; b.vy = Math.abs(b.vy); env.sound.play('bounce'); }
      // plataforma
      const py = padY();
      if (b.vy > 0 && b.y + b.r >= py - 8 && b.y + b.r <= py + 14 && b.x > p.x - p.w / 2 - b.r && b.x < p.x + p.w / 2 + b.r) {
        const rel = clamp((b.x - p.x) / (p.w / 2), -1, 1);
        const a = rel * 1.05;
        const sp = speed();
        b.vx = Math.sin(a) * sp;
        b.vy = -Math.abs(Math.cos(a) * sp);
        b.y = py - 8 - b.r;
        env.sound.play('bounce');
        env.haptic(6);
      }
      // blocos
      for (let k = s.bricks.length - 1; k >= 0; k -= 1) {
        const br = s.bricks[k];
        if (b.x + b.r < br.x || b.x - b.r > br.x + br.w || b.y + b.r < br.y || b.y - b.r > br.y + br.h) continue;
        const overlapX = Math.min(b.x + b.r - br.x, br.x + br.w - (b.x - b.r));
        const overlapY = Math.min(b.y + b.r - br.y, br.y + br.h - (b.y - b.r));
        if (overlapX < overlapY) b.vx = -b.vx; else b.vy = -b.vy;
        br.hp -= 1;
        if (br.hp <= 0) {
          s.bricks.splice(k, 1);
          s.score += 10;
          env.sound.play('pop', k % 6);
          fx.burst(br.x + br.w / 2, br.y + br.h / 2, 8, [br.c, '#fff']);
          if (Math.random() < 0.08) s.drops.push({ x: br.x + br.w / 2, y: br.y, vy: 120 });
        } else {
          s.score += 5;
          env.sound.play('tap');
        }
        break;
      }
      if (b.y > v.vh + 20) { loseLife(); return; }
    }
    // estrelas bônus caindo
    for (let i = s.drops.length - 1; i >= 0; i -= 1) {
      const d = s.drops[i];
      d.y += d.vy * dt;
      if (d.y > padY() - 12 && d.y < padY() + 16 && Math.abs(d.x - p.x) < p.w / 2 + 8) {
        s.drops.splice(i, 1); s.score += 50; env.sound.play('coin'); fx.burst(d.x, d.y, 12); continue;
      }
      if (d.y > v.vh + 20) s.drops.splice(i, 1);
    }
    if (!s.bricks.length) {
      s.level += 1;
      s.score += 100;
      env.sound.play('level');
      fx.burst(v.vw / 2, v.vh / 2, 30);
      s.bricks = buildLevel(s.level);
      resetBall();
    }
    env.onScore(s.score);
  }

  function draw() {
    const w = v.vw, h = v.vh;
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#2B2466'); g.addColorStop(1, '#5B4BC4');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    for (let i = 0; i < 30; i += 1) { ctx.beginPath(); ctx.arc((i * 97) % w, (i * 53 + 40) % h, (i % 3) * 0.6 + 0.6, 0, Math.PI * 2); ctx.fill(); }
    if (s.hitFlash) { ctx.fillStyle = `rgba(255,90,122,${s.hitFlash * 0.25})`; ctx.fillRect(0, 0, w, h); }

    for (const br of s.bricks) {
      ctx.fillStyle = br.c;
      roundRect(ctx, br.x, br.y, br.w, br.h, 6); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.35)';
      roundRect(ctx, br.x + 4, br.y + 3, br.w - 8, 5, 3); ctx.fill();
      if (br.hp > 1) {
        ctx.strokeStyle = 'rgba(42,35,80,.55)'; ctx.lineWidth = 2.5;
        roundRect(ctx, br.x + 1.5, br.y + 1.5, br.w - 3, br.h - 3, 5); ctx.stroke();
      }
    }
    for (const d of s.drops) drawStar(ctx, d.x, d.y, 11, '#FFD54A', s.t * 3);

    // plataforma (nuvem) com o personagem
    const p = s.pad, py = padY();
    ctx.fillStyle = '#fff';
    roundRect(ctx, p.x - p.w / 2, py - 8, p.w, 18, 9); ctx.fill();
    ctx.beginPath(); ctx.arc(p.x - p.w / 4, py - 6, 11, 0, Math.PI * 2); ctx.arc(p.x + p.w / 5, py - 8, 13, 0, Math.PI * 2); ctx.fill();
    drawPet(ctx, p.x, py + 30, 40, env.look, { mood: s.hitFlash > 0.3 ? 'ouch' : s.ball.stuck ? 'normal' : 'wow' });

    drawStar(ctx, s.ball.x, s.ball.y, s.ball.r + 2, '#FFD54A', s.ball.rot);
    fx.draw(ctx);

    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(0, 0, w, 56);
    drawHearts(ctx, 12, 28, s.lives);
    drawLabel(ctx, `Fase ${s.level}`, w / 2, 28, { size: 18 });
    drawLabel(ctx, `${s.score}`, w - 12, 28, { size: 22, align: 'right' });
    if (s.ball.stuck && !s.over) drawLabel(ctx, 'Toque para lançar!', w / 2, h * 0.62, { size: 20 });
  }

  const loop = createLoop((dt) => { update(dt); draw(); });
  draw();
  return {
    start() { reset(); loop.start(); },
    pause() { loop.stop(); },
    resume() { if (!s.over) loop.start(); },
    destroy() {
      loop.stop();
      v.canvas.removeEventListener('pointerdown', down);
      v.canvas.removeEventListener('pointermove', mv);
      removeEventListener('pointerup', upH);
      removeEventListener('keydown', key);
      v.destroy();
    }
  };
}
