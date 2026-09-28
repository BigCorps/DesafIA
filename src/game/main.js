import '../shared/base.css';
import './game.css';
import { petMarkup, applyLook, COLORS, HATS, ACCS, levelOf, stageOf } from '../shared/pet.js';
import { createSupabase, supabaseReady, friendlyError } from '../lib/supabase.js';
import { createLocal } from './local.js';
import { createCloud } from './cloud.js';

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const MODE_KEY = 'desafia-mode';
const SEEN_KEY = 'desafia-seen-rewards';
const SCALE = [0.78, 0.88, 0.97, 1.05];
const TIMES = ['dia', 'tarde', 'noite'];
const PERIOD_LABEL = { manha: 'de manhã', tarde: 'à tarde', noite: 'à noite' };

// ---------- Elementos ----------
const scene = $('scene');
const pet = $('pet');
const petGrow = $('petGrow');
petGrow.innerHTML = petMarkup('game');
const petSvg = petGrow.querySelector('svg');
const mouth = petSvg.querySelector('.mouth');
const bubble = $('bubble');
const fx = $('fx');
const starPill = $('starPill');
const panel = $('panel');

// ---------- Estado ----------
let api = null;          // adaptador atual (local ou nuvem)
let snap = null;         // último retrato dos dados
let tab = 'missoes';
let parentMode = false;  // só no modo local, depois da pergunta para adultos
let unsubscribe = () => {};
const sb = createSupabase('desafia-kid-auth');

const h = new Date().getHours();
let timeIdx = h >= 6 && h < 17 ? 0 : h >= 17 && h < 19 ? 1 : 2;
scene.dataset.time = TIMES[timeIdx];

// ---------- Fala e animações ----------
let bubbleTimer, mouthTimer, awakeTimer;
function say(text, ms = 2600) {
  bubble.textContent = text;
  bubble.classList.add('show');
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(() => bubble.classList.remove('show'), ms);
}
function happy(ms = 1300) {
  mouth.setAttribute('d', 'M86 121 Q100 146 114 121 Z');
  mouth.setAttribute('fill', '#2A2350');
  clearTimeout(mouthTimer);
  mouthTimer = setTimeout(() => { mouth.setAttribute('d', 'M88 124 Q100 136 112 124'); mouth.setAttribute('fill', 'none'); }, ms);
}
function wake() {
  pet.classList.add('awake');
  clearTimeout(awakeTimer);
  awakeTimer = setTimeout(() => pet.classList.remove('awake'), 1800);
}
function jump() {
  wake(); happy();
  if (reduce) return;
  pet.classList.remove('jump'); void pet.offsetWidth; pet.classList.add('jump');
}
pet.addEventListener('animationend', () => pet.classList.remove('jump'));

function petCenter() {
  const s = scene.getBoundingClientRect(), p = pet.getBoundingClientRect();
  return { x: p.left - s.left + p.width / 2, y: p.top - s.top + p.height * 0.45 };
}
function burst(x, y, chars, n) {
  n = reduce ? Math.min(n, 3) : n;
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span');
    s.className = 'p'; s.textContent = chars[i % chars.length];
    s.style.left = x + 'px'; s.style.top = y + 'px';
    fx.appendChild(s);
    const a = Math.random() * Math.PI * 2, d = 60 + Math.random() * 90;
    const dx = Math.cos(a) * d, dy = Math.sin(a) * d - 50;
    s.animate([
      { transform: 'translate(-50%,-50%) scale(.3)', opacity: 1 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(1.15)`, opacity: 1, offset: 0.65 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy + 36}px)) scale(.8)`, opacity: 0 }
    ], { duration: 950 + Math.random() * 450, easing: 'cubic-bezier(.2,.8,.3,1)' }).onfinish = () => s.remove();
  }
}
function fly(from, to, done) {
  const x = from.left + from.width / 2, y = from.top + from.height / 2;
  const dx = to.left + to.width / 2 - x, dy = to.top + to.height / 2 - y;
  const s = document.createElement('span');
  s.className = 'fly'; s.textContent = '⭐';
  s.style.left = x + 'px'; s.style.top = y + 'px';
  document.body.appendChild(s);
  s.animate([
    { transform: 'translate(-50%,-50%) scale(1)' },
    { transform: `translate(calc(-50% + ${dx * 0.45}px), calc(-50% + ${dy * 0.45 - 70}px)) scale(1.7)` },
    { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.7)` }
  ], { duration: reduce ? 10 : 850, easing: 'ease-in-out' }).onfinish = () => {
    s.remove();
    if (!reduce) starPill.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.22)' }, { transform: 'scale(1)' }], { duration: 320 });
    done && done();
  };
}
function toast(title, text) {
  $('toastTitle').textContent = title;
  $('toastText').textContent = text;
  const t = $('toast');
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2400);
}

// ---------- Desenho ----------
function renderStats(s = snap) {
  if (!s) return;
  $('starCount').textContent = s.wallet;
  const pct = s.xp % 100;
  $('barFill').style.width = pct + '%';
  $('bar').setAttribute('aria-valuenow', String(pct));
  $('lvlText').textContent = 'Nível ' + levelOf(s.xp);
  $('petNameTitle').textContent = s.petName;
  pet.setAttribute('aria-label', 'Fazer carinho no ' + s.petName);
  applyLook(petSvg, s.look, s.xp);
  petGrow.style.transform = 'scale(' + SCALE[stageOf(s.xp) - 1] + ')';
}

function parentBanner() {
  return parentMode ? '<div class="parent-banner">Modo adulto ligado<button data-act="exitParent">Sair</button></div>' : '';
}

function missionRow(m) {
  const period = PERIOD_LABEL[m.time_of_day] ? ' · ' + PERIOD_LABEL[m.time_of_day] : '';
  let act, sub = `+${m.points} estrelas${period}`;
  if (m.status === 'pending') {
    act = parentMode
      ? `<div class="acts"><button class="btn btn-ghost" data-act="reject" data-id="${m.id}">Ainda não</button><button class="btn btn-ok" data-act="approve" data-id="${m.id}">Confirmar</button></div>`
      : '<span class="badge badge-pending">Esperando um adulto</span>';
  } else if (m.status === 'done') {
    act = '<span class="badge badge-done">Feito ✓</span>';
  } else {
    if (m.status === 'rejected') sub = 'Um adulto pediu para tentar de novo';
    act = `<button class="btn btn-main" data-act="done" data-id="${m.id}">Fiz!</button>`;
  }
  return `<li class="item is-${m.status}" data-mission-row="${m.id}"><span class="icon" aria-hidden="true">${esc(m.icon)}</span>` +
    `<span class="m-body"><span class="m-text">${esc(m.title)}</span><span class="m-sub">${esc(sub)}</span></span>${act}</li>`;
}

function missionsHTML(s) {
  const done = s.missions.filter((m) => m.status === 'done').length;
  const hint = parentMode
    ? 'Confirme o que a criança fez.'
    : 'Toque em “Fiz!” quando terminar uma missão. Um adulto confirma.';
  const list = s.missions.length
    ? `<ul class="list">${s.missions.map(missionRow).join('')}</ul>`
    : '<div class="empty">Nenhuma missão por aqui ainda. Peça para um adulto escolher as missões no portal dos pais.</div>';
  return `${parentBanner()}<div class="sheet-head"><h2>Missões de hoje</h2><span class="count">${done} de ${s.missions.length}</span></div>` +
    `<p class="hint">${hint}</p>${list}`;
}

function rewardRow(r, s) {
  const can = s.wallet >= r.cost;
  let act, sub;
  if (r.pending) {
    act = parentMode
      ? `<div class="acts"><button class="btn btn-ghost" data-act="deny" data-id="${r.id}">Agora não</button><button class="btn btn-ok" data-act="deliver" data-id="${r.id}">Entregar</button></div>`
      : '<span class="badge badge-pending">Esperando um adulto</span>';
    sub = '<span class="m-sub">Pedido feito</span>';
  } else if (can && !parentMode) {
    act = `<button class="btn btn-gold" data-act="redeem" data-id="${r.id}">Trocar</button>`;
    sub = `<span class="m-sub">${r.cost} estrelas</span>`;
  } else {
    act = `<span class="badge badge-todo">${r.cost} ⭐</span>`;
    const pct = Math.min(100, Math.round((s.wallet / r.cost) * 100));
    sub = can
      ? '<span class="m-sub">Já dá para trocar</span>'
      : `<span class="m-sub">Faltam ${r.cost - s.wallet} estrelas</span><span class="mini"><span style="width:${pct}%"></span></span>`;
  }
  return `<li class="item"><span class="icon" aria-hidden="true">${esc(r.icon)}</span><span class="m-body"><span class="m-text">${esc(r.title)}</span>${sub}</span>${act}</li>`;
}

function rewardsHTML(s) {
  const hint = parentMode
    ? 'Entregue o prêmio quando for a hora. As estrelas já foram guardadas.'
    : 'Troque suas estrelas por um prêmio combinado com os adultos.';
  const list = s.rewards.length
    ? `<ul class="list">${s.rewards.map((r) => rewardRow(r, s)).join('')}</ul>`
    : '<div class="empty">Ainda não há prêmios. Os adultos escolhem no portal dos pais.</div>';
  return `${parentBanner()}<div class="sheet-head"><h2>Prêmios</h2><span class="count">${s.wallet} ⭐ para trocar</span></div><p class="hint">${hint}</p>${list}`;
}

function rankRows(items, nameKey) {
  const max = Math.max(1, ...items.map((i) => i.points));
  return items.map((it, i) =>
    `<li class="${it.me || it.mine ? 'me' : ''}"><span class="pos">${i + 1}</span><span class="av" aria-hidden="true">${esc(it.avatar)}</span>` +
    `<span><span class="r-name">${esc(it[nameKey])}</span><span class="r-bar"><span style="width:${Math.round((it.points / max) * 100)}%"></span></span></span>` +
    `<span class="r-pts">${it.points} ⭐</span></li>`).join('');
}

function placarHTML(s) {
  let html = `<div class="sheet-head"><h2>Placar da semana</h2><span class="count">zera na segunda</span></div>`;
  if (!s.connected) {
    return html + `<p class="hint">Você ganhou <strong>${s.weekPoints} estrelas</strong> nesta semana.</p>` +
      '<div class="empty">Conectando com a família, aparecem aqui os desafios dos adultos e o placar com irmãos, pais e famílias amigas.</div>';
  }
  html += '<p class="hint">Crianças e adultos juntos. Quem cumpre mais missões na semana ganha.</p>';
  for (const c of s.challenges) {
    const dots = Array.from({ length: Math.min(c.target_days, 14) }, (_, i) => `<i class="${i < c.done ? 'on' : ''}"></i>`).join('');
    const doneText = c.done >= c.target_days ? 'Desafio completo! 🎉' : `${c.done} de ${c.target_days} dias`;
    html += `<div class="challenge"><span class="who-set">Desafio da família</span><strong>${esc(c.icon)} ${esc(c.title)}</strong>` +
      `<div class="dots">${dots}</div><span class="prize">${doneText}${c.prize ? '. Prêmio: ' + esc(c.prize) : ''}</span></div>`;
  }
  html += `<h3>${esc(s.familyName || 'Família')}</h3><ul class="rank">${rankRows(s.ranking, 'nickname')}</ul>`;
  for (const lg of s.leagues) {
    html += `<h3>${esc(lg.name)}</h3><ul class="rank">${rankRows(lg.families || [], 'nickname')}</ul>`;
  }
  return html;
}

function visualHTML(s) {
  const lvl = levelOf(s.xp);
  const sw = Object.keys(COLORS).map((k) =>
    `<button class="swatch" data-act="color" data-id="${k}" aria-pressed="${s.look.color === k}" aria-label="${COLORS[k].name}" style="background:linear-gradient(135deg,${COLORS[k].g[0]},${COLORS[k].g[2]})"></button>`).join('');
  const hats = HATS.map((hh) => {
    const locked = lvl < hh.lvl;
    return `<button class="choice${locked ? ' locked' : ''}" data-act="hat" data-id="${hh.id}" aria-pressed="${s.look.hat === hh.id}"${locked ? ' aria-disabled="true"' : ''}>` +
      `<span class="em" aria-hidden="true">${locked ? '🔒' : hh.em}</span>${hh.name}${locked ? `<small>Nível ${hh.lvl}</small>` : ''}</button>`;
  }).join('');
  const accs = ACCS.map((a) =>
    `<button class="choice" data-act="acc" data-id="${a.id}" aria-pressed="${s.look.acc === a.id}"><span class="em" aria-hidden="true">${a.em}</span>${a.name}</button>`).join('');
  return `<div class="sheet-head"><h2>Meu bichinho</h2><span class="count">Nível ${lvl}</span></div>` +
    '<p class="hint">Deixe do seu jeito. Novas peças aparecem quando ele cresce.</p>' +
    `<label class="field" for="petName">Nome</label><input class="input name-input" id="petName" maxlength="12" value="${esc(s.petName)}" autocomplete="off">` +
    `<h3>Cor</h3><div class="swatches">${sw}</div><h3>Chapéu</h3><div class="choices">${hats}</div><h3>Acessório</h3><div class="choices">${accs}</div>`;
}

function renderSheet() {
  if (!snap) return;
  ['missoes', 'premios', 'placar', 'visual'].forEach((t) => $('t-' + t).setAttribute('aria-selected', String(tab === t)));
  if (tab === 'visual' && document.activeElement && document.activeElement.id === 'petName') return; // não atrapalha quem está digitando
  panel.innerHTML = tab === 'missoes' ? missionsHTML(snap)
    : tab === 'premios' ? rewardsHTML(snap)
    : tab === 'placar' ? placarHTML(snap)
    : visualHTML(snap);
}

// ---------- Atualização com animações ----------
function seenRewards() {
  try { return JSON.parse(localStorage.getItem(SEEN_KEY)) || []; } catch (e) { return []; }
}
function markSeen(ids) {
  const all = [...new Set([...seenRewards(), ...ids])].slice(-60);
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(all)); } catch (e) { /* ignora */ }
}

function apply(next) {
  const prev = snap;
  const rects = {};
  document.querySelectorAll('[data-mission-row]').forEach((el) => { rects[el.dataset.missionRow] = el.getBoundingClientRect(); });
  snap = next;
  if (api && api.kind === 'cloud') saveCache(next);
  renderSheet();

  // Prêmios decididos pelos adultos
  const seen = new Set(seenRewards());
  const fresh = (next.recentRewards || []).filter((r) => !seen.has(r.id));
  if (fresh.length) {
    markSeen(fresh.map((r) => r.id));
    const r = fresh[fresh.length - 1];
    if (r.status === 'delivered') {
      const c = petCenter();
      burst(c.x, c.y, ['🎉', '💖', '✨', r.icon], 18); jump();
      toast('Prêmio entregue!', r.title);
      say('Obaaa! Obrigado!', 2400);
    } else {
      say('Esse prêmio ficou para depois. Suas estrelas voltaram!', 2800);
    }
  }

  if (!prev) { renderStats(); return; }

  const was = Object.fromEntries(prev.missions.map((m) => [m.id, m.status]));
  const approved = next.missions.filter((m) => m.status === 'done' && was[m.id] === 'pending');
  const rejected = next.missions.filter((m) => m.status === 'rejected' && was[m.id] === 'pending');
  if (rejected.length) say('Um adulto pediu para tentar de novo. Você consegue!', 2600);

  if (approved.length) {
    const from = rects[approved[0].id] || starPill.getBoundingClientRect();
    const before = levelOf(prev.xp);
    renderStats({ ...next, xp: prev.xp, wallet: prev.wallet });
    fly(from, starPill.getBoundingClientRect(), () => {
      renderStats(next);
      const allDone = next.missions.length && next.missions.every((m) => m.status === 'done');
      if (levelOf(next.xp) > before) {
        setTimeout(() => {
          const c = petCenter();
          toast(next.petName + ' cresceu!', 'Agora está no nível ' + levelOf(next.xp));
          burst(c.x, c.y, ['🎉', '⭐', '💖', '✨', '🌟'], 22); jump();
        }, 150);
        say('Uau, eu cresci!', 2400);
      } else if (allDone) {
        const c = petCenter();
        burst(c.x, c.y, ['🎉', '⭐', '✨'], 16); jump();
        say('Dia completo! Você é demais!', 3000);
      } else {
        jump(); say('Ganhei estrelinhas! ✨', 1800);
      }
    });
  } else {
    renderStats(next);
  }
}

async function refresh() {
  if (!api) return;
  try {
    const next = await api.snapshot();
    if (next) apply(next);
    else if (api.kind === 'cloud') openConnect(); // aparelho foi desconectado pelos pais
  } catch (e) {
    console.warn(e);
  }
}

// ---------- Início ----------
const CACHE_KEY = 'desafia-cloud-cache';
function saveCache(s) { try { localStorage.setItem(CACHE_KEY, JSON.stringify(s)); } catch (e) { /* ignora */ } }
function loadCache() { try { return JSON.parse(localStorage.getItem(CACHE_KEY)); } catch (e) { return null; } }

async function connectedStart(s) {
  apply(s);
  unsubscribe = api.subscribe(refresh);
}

async function start() {
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
  const mode = localStorage.getItem(MODE_KEY);
  if (supabaseReady && mode !== 'local') {
    api = createCloud(sb);
    try {
      const s = await api.snapshot();
      if (s) { await connectedStart(s); greet(); return; }
    } catch (e) {
      console.warn(e);
      if (mode === 'cloud') {
        // Aparelho conectado, mas sem internet: mostra o último retrato e tenta de novo.
        const cached = loadCache();
        if (cached) apply(cached);
        say('Sem internet agora. Vou tentar de novo sozinho.', 3200);
        const retry = setInterval(async () => {
          try {
            const s = await api.snapshot();
            if (s) { clearInterval(retry); await connectedStart(s); }
          } catch (err) { /* continua tentando */ }
        }, 15000);
        return;
      }
    }
    // Ainda não conectado: mostra o jogo local por baixo e oferece conectar.
    await useLocal(false);
    openConnect();
    return;
  }
  await useLocal(true);
  greet();
}

async function useLocal(persist) {
  unsubscribe();
  api = createLocal();
  if (persist) localStorage.setItem(MODE_KEY, 'local');
  snap = null;
  apply(await api.snapshot());
}

function greet() {
  const lines = ['Bom dia! Vamos cuidar de mim?', 'Boa tarde! Vamos às missões?', 'Boa noite… ainda dá tempo de uma missão?'];
  setTimeout(() => say(lines[timeIdx], 3200), 500);
}

// ---------- Conectar ----------
function openConnect() {
  $('codeError').textContent = '';
  $('connectModal').classList.add('open');
  setTimeout(() => $('codeInput').focus(), 50);
}
$('codeInput').addEventListener('input', (e) => {
  const raw = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  e.target.value = raw.length > 4 ? raw.slice(0, 4) + '-' + raw.slice(4) : raw;
});
$('codeBtn').addEventListener('click', async () => {
  const code = $('codeInput').value;
  if (code.replace(/-/g, '').length !== 8) { $('codeError').textContent = 'O código tem 8 letras e números.'; return; }
  const btn = $('codeBtn');
  btn.disabled = true; btn.textContent = 'Conectando…';
  try {
    const cloud = createCloud(sb);
    await cloud.pair(code);
    localStorage.setItem(MODE_KEY, 'cloud');
    api = cloud;
    snap = null;
    const s = await api.snapshot();
    apply(s);
    unsubscribe = api.subscribe(refresh);
    $('connectModal').classList.remove('open');
    $('codeInput').value = '';
    const c = petCenter();
    burst(c.x, c.y, ['💖', '✨', '🏡'], 14); jump();
    say(`Oi, ${s.nickname}! Agora estamos conectados.`, 3000);
  } catch (e) {
    $('codeError').textContent = friendlyError(e);
  } finally {
    btn.disabled = false; btn.textContent = 'Conectar';
  }
});
$('localBtn').addEventListener('click', async () => {
  $('connectModal').classList.remove('open');
  if (!api || api.kind !== 'local') await useLocal(true);
  else localStorage.setItem(MODE_KEY, 'local');
  greet();
});

// ---------- Pergunta para adultos ----------
let gateAnswer = 0, gateNext = null;
function openGate(next) {
  const a = 6 + Math.floor(Math.random() * 4), b = 6 + Math.floor(Math.random() * 4);
  gateAnswer = a * b; gateNext = next;
  $('gateQ').textContent = `${a} × ${b} = ?`;
  $('gateInput').value = ''; $('gateError').textContent = '';
  $('gateModal').classList.add('open');
  setTimeout(() => $('gateInput').focus(), 50);
}
function gateOk() {
  if (Number($('gateInput').value) === gateAnswer) {
    $('gateModal').classList.remove('open');
    gateNext && gateNext();
  } else {
    $('gateError').textContent = 'Resposta errada. Chame um adulto.';
    openGate(gateNext);
    $('gateError').textContent = 'Resposta errada. Chame um adulto.';
  }
}
$('gateOk').addEventListener('click', gateOk);
$('gateInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') gateOk(); });
$('gateCancel').addEventListener('click', () => $('gateModal').classList.remove('open'));

// ---------- Área dos adultos ----------
function openAdults() {
  const body = $('adultsBody');
  if (api.kind === 'cloud' && snap && snap.connected) {
    body.innerHTML =
      `<div class="row-opt"><div><strong>Conectado</strong><span>${esc(snap.nickname)} na família ${esc(snap.familyName)}</span></div></div>` +
      '<p class="muted">As missões e os prêmios são aprovados no portal dos pais, no celular ou computador de um adulto.</p>' +
      '<button class="btn btn-danger" data-adult="unpair">Desconectar este aparelho</button>';
  } else {
    body.innerHTML =
      `<div class="row-opt"><div><strong>Modo adulto</strong><span>Confirmar missões e entregar prêmios neste aparelho</span></div>` +
      `<button class="btn ${parentMode ? 'btn-soft' : 'btn-main'}" data-adult="parent">${parentMode ? 'Desligar' : 'Ligar'}</button></div>` +
      (supabaseReady ? '<button class="btn btn-main" data-adult="connect">Conectar com a família</button>' : '') +
      '<button class="btn btn-danger" data-adult="reset">Apagar o progresso deste aparelho</button>';
  }
  $('adultsModal').classList.add('open');
}
$('adultsBtn').addEventListener('click', () => openGate(openAdults));
$('adultsClose').addEventListener('click', () => $('adultsModal').classList.remove('open'));
$('adultsBody').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-adult]');
  if (!b) return;
  const act = b.dataset.adult;
  if (act === 'parent') {
    parentMode = !parentMode;
    $('adultsModal').classList.remove('open');
    tab = 'missoes'; renderSheet();
    say(parentMode ? 'Modo adulto ligado.' : 'Voltei a ser só meu!', 1800);
  } else if (act === 'connect') {
    $('adultsModal').classList.remove('open');
    parentMode = false;
    openConnect();
  } else if (act === 'reset') {
    if (!confirm('Apagar estrelas, nível e visual deste aparelho?')) return;
    api.reset(); snap = null; apply(await api.snapshot());
    $('adultsModal').classList.remove('open');
    say('Oi de novo! Vamos começar?', 2200);
  } else if (act === 'unpair') {
    if (!confirm('Desconectar este aparelho da família?')) return;
    try { await api.unpair(); } catch (err) { console.warn(err); }
    localStorage.removeItem(MODE_KEY);
    $('adultsModal').classList.remove('open');
    await useLocal(false);
    openConnect();
  }
});

// ---------- Interações do jogo ----------
const PET_LINES = {
  dia: ['Hihi, cócegas!', 'Vamos fazer as missões?', 'Eu gosto muito de você!', 'Cada missão me deixa mais forte!'],
  tarde: ['Que tarde gostosa!', 'Ainda tem missão para hoje?', 'Mais um carinho!'],
  noite: ['Hmm… tô com soninho…', 'Escovou os dentes antes de dormir?', 'Boa noite… zzz']
};
let lineIdx = 0;
pet.addEventListener('click', () => {
  const lines = PET_LINES[TIMES[timeIdx]];
  jump(); say(lines[lineIdx++ % lines.length], 2000);
  const c = petCenter(); burst(c.x, c.y - 40, ['💖', '💕'], 4);
});
$('skyBtn').addEventListener('click', () => {
  timeIdx = (timeIdx + 1) % 3;
  scene.dataset.time = TIMES[timeIdx];
  say(['Bom dia! Que sol lindo!', 'Olha o pôr do sol!', 'Hora de dormir… zzz'][timeIdx], 1800);
});
document.querySelector('.tabs').addEventListener('click', (e) => {
  const t = e.target.closest('.tab');
  if (!t) return;
  tab = t.dataset.tab;
  renderSheet();
});

let saveTimer;
function savePet() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => api.savePet(snap.petName, snap.look).catch((e) => say(friendlyError(e))), 400);
}

panel.addEventListener('input', (e) => {
  if (e.target.id !== 'petName') return;
  snap.petName = e.target.value.trim() || 'Pipo';
  $('petNameTitle').textContent = snap.petName;
  savePet();
});

panel.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-act]');
  if (!btn || !snap) return;
  const { act, id } = btn.dataset;
  try {
    if (act === 'exitParent') { parentMode = false; renderSheet(); return; }
    if (act === 'color' || act === 'acc') {
      snap.look = { ...snap.look, [act === 'color' ? 'color' : 'acc']: id };
      renderStats(); renderSheet(); jump();
      say(act === 'color' ? 'Adorei essa cor!' : id === 'none' ? 'Simples e fofo!' : 'Estou muito estiloso!', 1600);
      savePet(); return;
    }
    if (act === 'hat') {
      const hh = HATS.find((x) => x.id === id);
      if (levelOf(snap.xp) < hh.lvl) { say(`Esse libera no nível ${hh.lvl}. Bora fazer missões!`, 2400); return; }
      snap.look = { ...snap.look, hat: id };
      renderStats(); renderSheet(); jump();
      say(id === 'none' ? 'Sem chapéu, cabelo ao vento!' : 'Ficou lindo!', 1600);
      savePet(); return;
    }
    btn.disabled = true;
    if (act === 'done') {
      await api.markDone(id);
      await refresh(); jump();
      say('Oba! Agora um adulto confirma.');
    } else if (act === 'redeem') {
      const r = snap.rewards.find((x) => x.id === id);
      const from = starPill.getBoundingClientRect(), to = btn.getBoundingClientRect();
      await api.requestReward(id);
      await refresh();
      fly(from, to); jump();
      say(`Pedi: ${r.title.toLowerCase()}! Agora um adulto entrega.`, 2800);
    } else if (parentMode && api.kind === 'local') {
      if (act === 'approve') await api.approve(id);
      if (act === 'reject') await api.reject(id);
      if (act === 'deliver') await api.deliver(id);
      if (act === 'deny') await api.deny(id);
      await refresh();
    }
  } catch (err) {
    say(friendlyError(err), 2600);
    btn.disabled = false;
  }
});

document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });

start();
