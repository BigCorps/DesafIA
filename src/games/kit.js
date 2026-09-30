// Kit compartilhado dos minijogos do DesafIA.
// Sem dependências, sem rede e sem arquivos de áudio: tudo é desenhado e sintetizado aqui.
import { COLORS } from '../shared/pet.js';

export const reducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
export const rand = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = (list) => list[Math.floor(Math.random() * list.length)];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i -= 1) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
export const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
export const DISPLAY_FONT = '"Grandstander",system-ui,sans-serif';

// ---------------------------------------------------------------------------
// Canvas com largura lógica fixa (360) e altura que acompanha a tela.
// ---------------------------------------------------------------------------
export function setupCanvas(root, logicalWidth = 360) {
  const canvas = document.createElement('canvas');
  canvas.className = 'g-canvas';
  root.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  const view = { canvas, ctx, vw: logicalWidth, vh: 600, scale: 1 };
  const listeners = [];
  function resize() {
    const r = root.getBoundingClientRect();
    const w = Math.max(200, r.width || 360), h = Math.max(260, r.height || 600);
    const dpr = Math.min(2, (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1);
    view.scale = w / logicalWidth;
    view.vh = h / view.scale;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr * view.scale, 0, 0, dpr * view.scale, 0, 0);
    listeners.forEach((fn) => fn(view));
  }
  let ro = null;
  if (typeof ResizeObserver === 'function') { ro = new ResizeObserver(resize); ro.observe(root); }
  else addEventListener('resize', resize);
  resize();
  view.onResize = (fn) => listeners.push(fn);
  view.toLogical = (clientX, clientY) => {
    const r = canvas.getBoundingClientRect();
    return { x: (clientX - r.left) / view.scale, y: (clientY - r.top) / view.scale };
  };
  view.destroy = () => { if (ro) ro.disconnect(); else removeEventListener('resize', resize); canvas.remove(); };
  return view;
}

// Laço de animação com dt limitado (evita saltos ao voltar de outra aba).
export function createLoop(step) {
  let raf = 0, last = 0, running = false;
  const frame = (t) => {
    if (!running) return;
    const dt = Math.min(0.034, Math.max(0, (t - last) / 1000));
    last = t;
    step(dt);
    raf = requestAnimationFrame(frame);
  };
  return {
    start() { if (running) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); },
    stop() { running = false; cancelAnimationFrame(raf); },
    get running() { return running; }
  };
}

// ---------------------------------------------------------------------------
// Som sintetizado (Web Audio). Começa só depois do primeiro toque.
// ---------------------------------------------------------------------------
const SOUND_KEY = 'desafia-games-sound';
let audio = null;
function ac() {
  if (audio) return audio;
  const A = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!A) return null;
  try { audio = new A(); } catch { audio = null; }
  return audio;
}
function tone(freq, dur = 0.12, { type = 'sine', vol = 0.18, slide = 0, delay = 0 } = {}) {
  const a = ac();
  if (!a || sound.muted) return;
  if (a.state === 'suspended') a.resume().catch(() => {});
  const t = a.currentTime + delay;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}
const NOTES = [329.63, 392.0, 523.25, 659.25, 783.99, 880.0];
export const sound = {
  get muted() { try { return localStorage.getItem(SOUND_KEY) === 'off'; } catch { return false; } },
  set muted(v) { try { localStorage.setItem(SOUND_KEY, v ? 'off' : 'on'); } catch { /* ignora */ } },
  unlock() { const a = ac(); if (a && a.state === 'suspended') a.resume().catch(() => {}); },
  play(name, i = 0) {
    switch (name) {
      case 'jump': return tone(420, 0.16, { type: 'square', vol: 0.07, slide: 380 });
      case 'flap': return tone(520, 0.08, { type: 'triangle', vol: 0.1, slide: 260 });
      case 'coin': tone(988, 0.07, { type: 'square', vol: 0.06 }); return tone(1319, 0.14, { type: 'square', vol: 0.06, delay: 0.07 });
      case 'pop': return tone(660 + i * 60, 0.09, { type: 'triangle', vol: 0.14, slide: 300 });
      case 'tap': return tone(740, 0.05, { type: 'sine', vol: 0.12 });
      case 'drop': return tone(300, 0.12, { type: 'triangle', vol: 0.16, slide: -120 });
      case 'perfect': tone(784, 0.08, { vol: 0.14 }); tone(988, 0.08, { vol: 0.14, delay: 0.08 }); return tone(1175, 0.16, { vol: 0.14, delay: 0.16 });
      case 'hit': return tone(180, 0.22, { type: 'sawtooth', vol: 0.08, slide: -90 });
      case 'bounce': return tone(520, 0.05, { type: 'square', vol: 0.05 });
      case 'match': return tone(NOTES[Math.min(i, NOTES.length - 1)], 0.14, { type: 'triangle', vol: 0.15 });
      case 'note': return tone([329.63, 440, 554.37, 659.25][i % 4], 0.38, { type: 'triangle', vol: 0.2 });
      case 'level': [523, 659, 784, 1047].forEach((f, k) => tone(f, 0.14, { type: 'triangle', vol: 0.14, delay: k * 0.09 })); return undefined;
      case 'win': [523, 659, 784, 1047, 1319].forEach((f, k) => tone(f, 0.16, { type: 'square', vol: 0.06, delay: k * 0.1 })); return undefined;
      case 'lose': [392, 330, 262].forEach((f, k) => tone(f, 0.22, { type: 'triangle', vol: 0.14, delay: k * 0.14 })); return undefined;
      default: return undefined;
    }
  }
};

export function haptic(pattern = 12) {
  try { if (!reducedMotion() && navigator.vibrate) navigator.vibrate(pattern); } catch { /* ignora */ }
}

// ---------------------------------------------------------------------------
// Desenho
// ---------------------------------------------------------------------------
export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function drawStar(ctx, x, y, r, fill = '#FFD54A', rot = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 ? r * 0.48 : r;
    ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = r * 0.12;
  ctx.strokeStyle = 'rgba(160,100,0,.35)';
  ctx.stroke();
  ctx.restore();
}

export function drawCloud(ctx, x, y, s = 1, alpha = 0.9) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x, y, 18 * s, 0, Math.PI * 2);
  ctx.arc(x + 20 * s, y - 10 * s, 22 * s, 0, Math.PI * 2);
  ctx.arc(x + 44 * s, y, 18 * s, 0, Math.PI * 2);
  ctx.rect(x, y - 2 * s, 44 * s, 20 * s);
  ctx.fill();
  ctx.restore();
}

export function drawEmoji(ctx, char, x, y, size) {
  ctx.save();
  ctx.font = `${size}px ${EMOJI_FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(char, x, y);
  ctx.restore();
}

export function skyGradient(ctx, w, h, top = '#74C7FF', bottom = '#D4F0FF') {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/**
 * O personagem, desenhado no canvas (mesmas formas do SVG do jogo).
 * (x, y) é o centro do corpo; size é a altura aproximada.
 * mood: 'normal' | 'happy' | 'ouch' | 'wow'
 */
export function drawPet(ctx, x, y, size, look = {}, { mood = 'normal', sx = 1, sy = 1, rot = 0, blink = false, alpha = 1 } = {}) {
  const c = COLORS[look.color] || COLORS.rosa;
  const k = size / 170;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(k * sx, k * sy);
  ctx.translate(-100, -113);
  // broto
  ctx.strokeStyle = '#3FA86E';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(100, 48); ctx.bezierCurveTo(98, 36, 102, 28, 100, 16); ctx.stroke();
  ctx.fillStyle = '#5CCB8A';
  ctx.beginPath(); ctx.moveTo(100, 32); ctx.bezierCurveTo(88, 21, 75, 24, 70, 31); ctx.bezierCurveTo(79, 40, 92, 40, 100, 32); ctx.fill();
  ctx.fillStyle = '#76DDA0';
  ctx.beginPath(); ctx.moveTo(100, 25); ctx.bezierCurveTo(112, 13, 126, 16, 131, 23); ctx.bezierCurveTo(123, 33, 108, 33, 100, 25); ctx.fill();
  // pés e braços
  ctx.fillStyle = c.foot;
  ctx.beginPath(); ctx.ellipse(72, 179, 17, 9, 0, 0, Math.PI * 2); ctx.ellipse(128, 179, 17, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = c.limb;
  const armUp = mood === 'happy' || mood === 'wow' ? -1 : 1;
  ctx.beginPath(); ctx.ellipse(29, 134 - (armUp < 0 ? 22 : 0), 10, 17, armUp < 0 ? -0.9 : 0.38, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(171, 134 - (armUp < 0 ? 22 : 0), 10, 17, armUp < 0 ? 0.9 : -0.38, 0, Math.PI * 2); ctx.fill();
  // corpo
  const g = ctx.createRadialGradient(72, 70, 8, 100, 115, 105);
  g.addColorStop(0, c.g[0]); g.addColorStop(0.58, c.g[1]); g.addColorStop(1, c.g[2]);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(100, 44);
  ctx.bezierCurveTo(150, 44, 176, 84, 176, 124);
  ctx.bezierCurveTo(176, 162, 146, 182, 100, 182);
  ctx.bezierCurveTo(54, 182, 24, 162, 24, 124);
  ctx.bezierCurveTo(24, 84, 50, 44, 100, 44);
  ctx.fill();
  ctx.fillStyle = c.belly;
  ctx.beginPath(); ctx.ellipse(100, 148, 46, 30, 0, 0, Math.PI * 2); ctx.fill();
  // olhos
  ctx.fillStyle = '#2A2350';
  ctx.strokeStyle = '#2A2350';
  if (blink || mood === 'ouch') {
    ctx.lineWidth = 5;
    ctx.beginPath();
    if (mood === 'ouch') { ctx.moveTo(66, 98); ctx.lineTo(84, 110); ctx.moveTo(66, 110); ctx.lineTo(84, 98); ctx.moveTo(116, 98); ctx.lineTo(134, 110); ctx.moveTo(116, 110); ctx.lineTo(134, 98); }
    else { ctx.moveTo(65, 106); ctx.quadraticCurveTo(76, 116, 87, 106); ctx.moveTo(113, 106); ctx.quadraticCurveTo(124, 116, 135, 106); }
    ctx.stroke();
  } else {
    const ey = mood === 'wow' ? 15 : 13;
    ctx.beginPath(); ctx.ellipse(76, 106, 10, ey, 0, 0, Math.PI * 2); ctx.ellipse(124, 106, 10, ey, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(79.5, 101, 4.2, 0, Math.PI * 2); ctx.arc(127.5, 101, 4.2, 0, Math.PI * 2); ctx.fill();
  }
  // bochechas
  ctx.fillStyle = c.cheek;
  ctx.globalAlpha = alpha * 0.45;
  ctx.beginPath(); ctx.ellipse(59, 127, 10, 6, 0, 0, Math.PI * 2); ctx.ellipse(141, 127, 10, 6, 0, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = alpha;
  // boca
  ctx.fillStyle = '#2A2350';
  ctx.strokeStyle = '#2A2350';
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  if (mood === 'happy') { ctx.moveTo(86, 121); ctx.quadraticCurveTo(100, 146, 114, 121); ctx.closePath(); ctx.fill(); }
  else if (mood === 'wow') { ctx.ellipse(100, 128, 7, 9, 0, 0, Math.PI * 2); ctx.fill(); }
  else if (mood === 'ouch') { ctx.moveTo(88, 132); ctx.quadraticCurveTo(100, 122, 112, 132); ctx.stroke(); }
  else { ctx.moveTo(88, 124); ctx.quadraticCurveTo(100, 136, 112, 124); ctx.stroke(); }
  ctx.restore();
}

export function drawHearts(ctx, x, y, lives, max = 3, size = 18) {
  ctx.save();
  ctx.font = `${size}px ${EMOJI_FONT}`;
  ctx.textBaseline = 'middle';
  for (let i = 0; i < max; i += 1) {
    ctx.globalAlpha = i < lives ? 1 : 0.25;
    ctx.fillText(i < lives ? '❤️' : '🤍', x + i * (size + 4), y);
  }
  ctx.restore();
}

export function drawLabel(ctx, text, x, y, { size = 22, color = '#fff', stroke = 'rgba(42,35,80,.55)', align = 'center' } = {}) {
  ctx.save();
  ctx.font = `800 ${size}px ${DISPLAY_FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = size * 0.22;
  ctx.strokeStyle = stroke;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

// Partículas simples (estrelinhas, confete).
export function createParticles() {
  const list = [];
  return {
    burst(x, y, n = 10, colors = ['#FFD54A', '#FF8FA3', '#7B61FF', '#5CCB8A']) {
      for (let i = 0; i < n; i += 1) {
        const a = rand(0, Math.PI * 2), s = rand(60, 220);
        list.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 80, life: rand(0.5, 0.9), t: 0, r: rand(2.5, 5), c: pick(colors) });
      }
    },
    update(dt) {
      for (let i = list.length - 1; i >= 0; i -= 1) {
        const p = list[i];
        p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 420 * dt;
        if (p.t > p.life) list.splice(i, 1);
      }
    },
    draw(ctx) {
      for (const p of list) {
        ctx.globalAlpha = Math.max(0, 1 - p.t / p.life);
        ctx.fillStyle = p.c;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
    clear() { list.length = 0; }
  };
}

// ---------------------------------------------------------------------------
// Entrada
// ---------------------------------------------------------------------------
/** Toque/clique/tecla de ação. Retorna função para remover. */
export function onPress(el, fn, keys = [' ', 'ArrowUp', 'Enter']) {
  const down = (e) => { if (e.button !== undefined && e.button > 0) return; e.preventDefault(); sound.unlock(); fn(e); };
  const key = (e) => { if (keys.includes(e.key)) { e.preventDefault(); fn(e); } };
  el.addEventListener('pointerdown', down);
  addEventListener('keydown', key);
  return () => { el.removeEventListener('pointerdown', down); removeEventListener('keydown', key); };
}

/** Deslizar o dedo (e setas do teclado). cb('up'|'down'|'left'|'right'). */
export function onSwipe(el, cb, min = 24) {
  let sx = 0, sy = 0, active = false;
  const down = (e) => { active = true; sx = e.clientX; sy = e.clientY; sound.unlock(); };
  const up = (e) => {
    if (!active) return;
    active = false;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < min) return;
    cb(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  };
  const move = (e) => {
    if (!active) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) >= min * 1.6) { up(e); }
  };
  const key = (e) => {
    const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
    if (map[e.key]) { e.preventDefault(); cb(map[e.key]); }
  };
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  addEventListener('pointerup', up);
  addEventListener('keydown', key);
  return () => {
    el.removeEventListener('pointerdown', down);
    el.removeEventListener('pointermove', move);
    removeEventListener('pointerup', up);
    removeEventListener('keydown', key);
  };
}

/** Utilitário para jogos em DOM: cria elemento com classe e HTML. */
export function el(tag, cls, html = '') {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
}
