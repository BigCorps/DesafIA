import '../shared/base.css';
import './pais.css';
import { petMarkup, applyLook, levelOf } from '../shared/pet.js';
import { createSupabase, supabaseReady, friendlyError } from '../lib/supabase.js';

const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const app = $('app');
const sb = createSupabase('desafia-pais-auth', { detectSessionInUrl: true });
const CHECKOUT_URL = import.meta.env.VITE_CHECKOUT_URL || '';
const FAMILY_KEY = 'desafia-pais-family';

const KID_AVATARS = ['🌸', '🐸', '🦁', '🐼', '🦄', '🐯', '🐙', '🦊', '🐰', '🐻', '🐧', '🦖'];
const ADULT_AVATARS = ['🦊', '🐻', '🦉', '🐨', '🦁', '🐢', '👵', '👴', '🐳', '🌻'];
const HOME_AVATARS = ['🏡', '🌻', '🚀', '⚽', '🌈', '🎈', '🐝', '🌵'];
const MISSION_ICONS = ['⭐', '🪥', '🛏️', '📚', '💧', '🧸', '✏️', '🍎', '🥦', '🧼', '🐶', '🪴', '🎹', '⚽', '🧹', '👕', '🙏', '😴', '🚿', '🎒'];
const REWARD_ICONS = ['🎁', '🍕', '🍦', '🎬', '🛝', '🏝️', '🎮', '📱', '🧁', '🎨', '📖', '🚲', '🏊', '🎟️', '🧸', '🌙'];
const TIME_LABEL = { any: 'Qualquer hora', manha: 'Manhã', tarde: 'Tarde', noite: 'Noite' };
const VIEWS = [
  ['hoje', 'Hoje'], ['criancas', 'Família'], ['missoes', 'Missões'], ['premios', 'Prêmios'],
  ['desafios', 'Desafios'], ['liga', 'Liga'], ['conta', 'Conta']
];

let session = null;
let families = [];
let fid = null;
let dash = null;
let missions = [];
let rewards = [];
let view = (location.hash || '#hoje').slice(1);
let channel = null;
let reloadTimer = null;

// ---------- Utilidades ----------
function snack(text) {
  const s = $('snack');
  s.textContent = text;
  s.classList.add('show');
  clearTimeout(snack.t);
  snack.t = setTimeout(() => s.classList.remove('show'), 2800);
}
function openModal(html) {
  $('modalCard').innerHTML = html + '<button class="btn btn-ghost" data-act="closeModal" style="width:100%;margin-top:8px">Fechar</button>';
  $('modal').classList.add('open');
  hydratePets($('modalCard'));
}
function closeModal() {
  $('modal').classList.remove('open');
  clearInterval(openModal.timer);
}
function emojiPicker(name, list, selected) {
  return `<div class="emojis" data-picker="${name}">${list.map((e) =>
    `<button type="button" data-emoji="${e}" aria-pressed="${e === selected}" aria-label="${e}">${e}</button>`).join('')}</div>` +
    `<input type="hidden" name="${name}" value="${selected}">`;
}
function hydratePets(root = document) {
  root.querySelectorAll('[data-pet]').forEach((el, i) => {
    const d = JSON.parse(el.dataset.pet);
    el.innerHTML = petMarkup('pp' + i + Math.random().toString(36).slice(2, 6));
    applyLook(el.querySelector('svg'), d.look, d.xp);
    el.removeAttribute('data-pet');
  });
}
const petAttr = (look, xp) => esc(JSON.stringify({ look, xp }));
const fmtDate = (iso) => { const [y, m, d] = String(iso).split('-'); return `${d}/${m}`; };
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const fmtCode = (c) => c.slice(0, 4) + '-' + c.slice(4);
const children = () => (dash?.players || []).filter((p) => p.kind === 'child');
const isPlus = () => !!dash?.family?.plus;

async function rpc(fn, args) {
  const { data, error } = await sb.rpc(fn, args);
  if (error) throw error;
  return data;
}
async function guard(fn) {
  try { await fn(); } catch (e) { console.warn(e); snack(friendlyError(e)); }
}

// ---------- Carregamento ----------
async function loadFamilies() {
  const { data, error } = await sb.from('family_members').select('family_id, role, families(name, plan)').eq('user_id', session.user.id);
  if (error) throw error;
  families = data || [];
  const saved = localStorage.getItem(FAMILY_KEY);
  fid = families.find((f) => f.family_id === saved)?.family_id || families[0]?.family_id || null;
}
async function loadAll() {
  const [d, m, r] = await Promise.all([
    rpc('parent_dashboard', { p_family: fid }),
    sb.from('missions').select('*').eq('family_id', fid).order('audience').order('sort').order('created_at'),
    sb.from('rewards').select('*').eq('family_id', fid).order('cost')
  ]);
  if (m.error) throw m.error;
  if (r.error) throw r.error;
  dash = d; missions = m.data; rewards = r.data;
}
async function reload() {
  await loadAll();
  render();
}
function scheduleReload() {
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => reload().catch(console.warn), 400);
}
function listen() {
  if (channel) sb.removeChannel(channel);
  channel = sb.channel('pais-' + fid)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'mission_logs' }, scheduleReload)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'reward_requests' }, scheduleReload)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'players' }, scheduleReload)
    .subscribe();
}

async function route() {
  if (!session) { renderLogin(); return; }
  app.innerHTML = '<div class="spinner" aria-label="Carregando"></div>';
  try {
    await loadFamilies();
    if (!fid) { renderOnboarding(); return; }
    await loadAll();
    listen();
    render();
  } catch (e) {
    console.warn(e);
    app.innerHTML = `<div class="hero"><h1>Ops</h1><p>${esc(friendlyError(e))}</p><button class="btn btn-main" data-act="retry">Tentar de novo</button></div>`;
  }
}

// ---------- Telas sem família ----------
function renderConfigMissing() {
  app.innerHTML = `<div class="hero"><h1>Falta configurar</h1><p>Defina <code>VITE_SUPABASE_URL</code> e <code>VITE_SUPABASE_ANON_KEY</code> (veja o README) e publique de novo.</p></div>`;
}

function renderLogin(sentTo) {
  app.innerHTML = `
  <div class="wrap"><div class="hero">
    <div class="mini-pet" data-pet="${petAttr({ color: 'rosa', hat: 'coroa', acc: 'none' }, 250)}"></div>
    <h1>Portal dos pais</h1>
    <p>Aprove as missões, combine os prêmios e crie desafios para a família.</p>
    <div class="card">
      ${sentTo
        ? `<h2>Confira seu e-mail</h2><p>Enviamos um link de acesso para <b>${esc(sentTo)}</b>. Abra o link neste mesmo aparelho.</p>
           <button class="btn btn-soft" data-act="backLogin" style="width:100%">Usar outro e-mail</button>`
        : `<form class="form" data-form="login">
             <label>Seu e-mail<input class="input" type="email" name="email" required autocomplete="email" placeholder="voce@email.com"></label>
             <button class="btn btn-main">Receber link de acesso</button>
             <p class="muted" style="font-size:13px;margin:0">Sem senha: você entra pelo link que chega no e-mail.</p>
           </form>`}
    </div>
    <div class="links"><a href="/privacidade/">Privacidade</a><a href="/termos/">Termos</a></div>
  </div></div>`;
  hydratePets();
}

function renderOnboarding() {
  app.innerHTML = `
  <div class="wrap"><div class="hero">
    <div class="mini-pet" data-pet="${petAttr({ color: 'amarelo', hat: 'festa', acc: 'none' }, 0)}"></div>
    <h1>Bem-vindo!</h1>
    <p>Crie a família para começar, ou entre com o convite de outro responsável.</p>
    <div class="card">
      <h2>Criar minha família</h2>
      <form class="form" data-form="createFamily">
        <label>Nome da família<input class="input" name="name" required maxlength="60" placeholder="Família Silva"></label>
        <label>Como as crianças chamam você<input class="input" name="display" required maxlength="30" placeholder="Mamãe, Papai, Vovó…"></label>
        <label>Seu avatar</label>${emojiPicker('avatar', ADULT_AVATARS, '🦊')}
        <button class="btn btn-main">Criar família</button>
      </form>
    </div>
    <div class="card">
      <h2>Tenho um convite</h2>
      <form class="form" data-form="acceptInvite">
        <label>Código do convite<input class="input code-input" name="code" required maxlength="9" placeholder="ABCD-2345"></label>
        <label>Como as crianças chamam você<input class="input" name="display" required maxlength="30" placeholder="Papai"></label>
        <input type="hidden" name="avatar" value="🐻">
        <button class="btn btn-soft">Entrar na família</button>
      </form>
    </div>
    <button class="btn btn-ghost" data-act="logout">Sair</button>
  </div></div>`;
  hydratePets();
}

// ---------- App ----------
function render() {
  if (!dash) return;
  if (!VIEWS.some(([v]) => v === view)) view = 'hoje';
  const pend = dash.pending_missions.length + dash.pending_rewards.length;
  const famSelect = families.length > 1
    ? `<select class="fam-select" data-act="switchFamily" aria-label="Família">${families.map((f) =>
      `<option value="${f.family_id}" ${f.family_id === fid ? 'selected' : ''}>${esc(f.families?.name)}</option>`).join('')}</select>`
    : '';
  app.innerHTML = `
  <div class="wrap">
    <header class="topbar">
      <a class="brand" href="#hoje" data-view="hoje">
        <span class="mini-pet" data-pet="${petAttr({ color: 'rosa', hat: 'none', acc: 'none' }, 150)}"></span>
        <span><b>Desafia</b><small>${esc(dash.family.name)}</small></span>
      </a>
      <div style="display:flex;gap:8px;align-items:center">${famSelect}<span class="plan ${isPlus() ? 'on' : ''}">${isPlus() ? 'Plus' : 'Grátis'}</span></div>
    </header>
    <nav class="nav" aria-label="Seções">
      ${VIEWS.map(([v, label]) => `<button data-view="${v}" ${view === v ? 'aria-current="page"' : ''}>${label}${v === 'hoje' && pend ? `<span class="count-dot">${pend}</span>` : ''}</button>`).join('')}
    </nav>
    <main id="view">${renderView()}</main>
  </div>`;
  hydratePets();
}

function renderView() {
  switch (view) {
    case 'criancas': return viewFamily();
    case 'missoes': return viewMissions();
    case 'premios': return viewRewards();
    case 'desafios': return viewChallenges();
    case 'liga': return viewLeague();
    case 'conta': return viewAccount();
    default: return viewToday();
  }
}

function lockCard(title, text) {
  return `<div class="lock"><h2>${title}</h2><p>${text}</p><button class="btn" data-view="conta">Conhecer o Plus</button></div>`;
}

function rankHTML(items) {
  const max = Math.max(1, ...items.map((i) => i.week_points ?? i.points));
  return `<ul class="rank">${items.map((p, i) => {
    const pts = p.week_points ?? p.points;
    return `<li class="${p.is_me || p.mine ? 'me' : ''}"><span class="pos">${i + 1}</span><span class="av">${esc(p.avatar)}</span>
      <span><b>${esc(p.nickname)}</b><div class="progress"><span style="width:${Math.round((pts / max) * 100)}%;background:var(--accent)"></span></div></span>
      <span class="pts">${pts} ⭐</span></li>`;
  }).join('')}</ul>`;
}

function viewToday() {
  const kids = children();
  let html = '';
  if (!kids.length) {
    html += `<div class="card"><h2>Comece por aqui</h2><p>Adicione sua criança e conecte o aparelho dela ao Desafia.</p>
      <button class="btn btn-main" data-view="criancas">Adicionar criança</button></div>`;
  }
  const pm = dash.pending_missions, pr = dash.pending_rewards;
  html += `<div class="card"><h2>Para aprovar</h2>`;
  if (!pm.length && !pr.length) {
    html += '<p class="lead">Tudo em dia! Quando a criança tocar em “Fiz!”, a missão aparece aqui.</p>';
  }
  if (pm.length) {
    html += `<ul class="rows">${pm.map((l) => `
      <li class="r"><span class="ic">${esc(l.icon)}</span>
        <span><div class="t">${esc(l.avatar)} ${esc(l.nickname)}: ${esc(l.title)}</div><div class="s">+${l.points} estrelas${l.day !== dash.today ? ', dia ' + fmtDate(l.day) : ''}</div></span>
        <span class="a"><button class="btn btn-soft btn-sm" data-act="decideMission" data-id="${l.id}" data-ok="0">Ainda não</button>
        <button class="btn btn-ok btn-sm" data-act="decideMission" data-id="${l.id}" data-ok="1">Aprovar</button></span></li>`).join('')}</ul>`;
  }
  if (pr.length) {
    html += `<h3>Pedidos de prêmio</h3><ul class="rows">${pr.map((q) => `
      <li class="r"><span class="ic">${esc(q.icon)}</span>
        <span><div class="t">${esc(q.avatar)} ${esc(q.nickname)}: ${esc(q.title)}</div><div class="s">${q.cost} estrelas já guardadas</div></span>
        <span class="a"><button class="btn btn-soft btn-sm" data-act="decideReward" data-id="${q.id}" data-ok="0">Agora não</button>
        <button class="btn btn-ok btn-sm" data-act="decideReward" data-id="${q.id}" data-ok="1">Entregue</button></span></li>`).join('')}</ul>`;
  }
  html += '</div>';

  if (dash.my_missions.length) {
    html += `<div class="card"><h2>Suas missões de hoje</h2><p class="lead">Os adultos também jogam e somam estrelas no placar da família.</p>
      <ul class="rows">${dash.my_missions.map((m) => `
      <li class="r"><span class="ic">${esc(m.icon)}</span><span><div class="t">${esc(m.title)}</div><div class="s">+${m.points} estrelas</div></span>
        <span class="a">${m.done ? '<span class="badge badge-done">Feito ✓</span>' : `<button class="btn btn-main btn-sm" data-act="markMine" data-id="${m.id}">Fiz!</button>`}</span></li>`).join('')}</ul></div>`;
  }
  const ranking = [...dash.players].sort((a, b) => b.week_points - a.week_points);
  html += `<div class="card"><h2>Placar da semana</h2><p class="lead">Desde ${fmtDate(dash.week_start)}. Zera toda segunda.</p>${rankHTML(ranking)}</div>`;
  return html;
}

function viewFamily() {
  const kids = children();
  const adults = dash.players.filter((p) => p.kind === 'adult');
  const canAdd = isPlus() || kids.length === 0;
  let html = `<div class="card"><h2>Crianças</h2>`;
  if (!kids.length) html += '<p class="lead">Nenhuma criança ainda.</p>';
  html += kids.map((k) => `
    <div class="kid">
      <div class="thumb" data-pet="${petAttr(k.look, k.xp)}"></div>
      <div>
        <div class="name">${esc(k.avatar)} ${esc(k.nickname)}</div>
        <div class="meta">Bichinho ${esc(k.pet_name)}, nível ${levelOf(k.xp)}. ${k.wallet} ⭐ para trocar, ${k.week_points} nesta semana.
          ${k.devices ? `${k.devices} aparelho${k.devices > 1 ? 's' : ''} conectado${k.devices > 1 ? 's' : ''}.` : 'Nenhum aparelho conectado.'}</div>
        <div class="a">
          <button class="btn btn-main btn-sm" data-act="pair" data-id="${k.id}">Conectar aparelho</button>
          <button class="btn btn-soft btn-sm" data-act="markForKid" data-id="${k.id}">Marcar missão feita</button>
          ${k.devices ? `<button class="btn btn-soft btn-sm" data-act="unpairKid" data-id="${k.id}">Desconectar aparelhos</button>` : ''}
          <button class="btn btn-danger btn-sm" data-act="removeKid" data-id="${k.id}" data-name="${esc(k.nickname)}">Remover</button>
        </div>
      </div>
    </div>`).join('');
  if (canAdd) {
    html += `<h3>Adicionar criança</h3>
      <form class="form" data-form="addKid">
        <label>Apelido<input class="input" name="nickname" required maxlength="30" placeholder="Como ela gosta de ser chamada"></label>
        <label>Avatar</label>${emojiPicker('avatar', KID_AVATARS, '🌸')}
        <button class="btn btn-main">Adicionar</button>
        <p class="muted" style="font-size:13px;margin:0">Use só um apelido. Não pedimos nome completo, foto nem data de nascimento.</p>
      </form>`;
  }
  html += '</div>';
  if (!canAdd) html += lockCard('Mais de uma criança', 'Com o Plus, irmãos jogam juntos, cada um com seu bichinho, e disputam o placar da família.');

  html += `<div class="card"><h2>Adultos</h2><ul class="rows">${adults.map((a) => `
    <li class="r"><span class="ic">${esc(a.avatar)}</span><span><div class="t">${esc(a.nickname)}${a.is_me ? ' (você)' : ''}</div><div class="s">${a.week_points} estrelas nesta semana</div></span><span></span></li>`).join('')}</ul>
    <button class="btn btn-soft" data-act="invite" style="margin-top:12px">Convidar outro responsável</button></div>`;
  return html;
}

function itemRow(it, kind) {
  const isM = kind === 'mission';
  const value = isM ? it.points : it.cost;
  const step = isM ? 5 : 10;
  const sub = isM ? `${TIME_LABEL[it.time_of_day]}${it.is_custom ? ', personalizada' : ''}` : (it.is_custom ? 'Personalizado' : 'Padrão');
  return `<li class="r ${it.active ? '' : 'off'}"><span class="ic">${esc(it.icon)}</span>
    <span><div class="t">${esc(it.title)}</div><div class="s">${sub}</div></span>
    <span class="a">
      <span class="stepper"><button data-act="step" data-kind="${kind}" data-id="${it.id}" data-d="-${step}" aria-label="Menos">−</button><span>${value} ⭐</span><button data-act="step" data-kind="${kind}" data-id="${it.id}" data-d="${step}" aria-label="Mais">+</button></span>
      <button class="switch" role="switch" aria-checked="${it.active}" aria-label="Ativo" data-act="toggle" data-kind="${kind}" data-id="${it.id}"></button>
      ${it.is_custom ? `<button class="btn btn-danger btn-sm" data-act="delItem" data-kind="${kind}" data-id="${it.id}">Apagar</button>` : ''}
    </span></li>`;
}

function viewMissions() {
  const kidM = missions.filter((m) => m.audience === 'child');
  const adultM = missions.filter((m) => m.audience === 'adult');
  let html = `<div class="card"><h2>Missões das crianças</h2><p class="lead">Ligue as que fazem sentido para sua rotina e ajuste as estrelas.</p>
    <ul class="rows">${kidM.map((m) => itemRow(m, 'mission')).join('')}</ul>
    <h3>Missões dos adultos</h3><ul class="rows">${adultM.map((m) => itemRow(m, 'mission')).join('')}</ul></div>`;
  if (isPlus()) {
    html += `<div class="card"><h2>Nova missão</h2><form class="form" data-form="addMission">
      <label>Nome<input class="input" name="title" required maxlength="60" placeholder="Regar a planta"></label>
      <label>Ícone</label>${emojiPicker('icon', MISSION_ICONS, '⭐')}
      <div class="two">
        <label>Para quem<select class="input" name="audience"><option value="child">Crianças</option><option value="adult">Adultos</option></select></label>
        <label>Quando<select class="input" name="time_of_day">${Object.entries(TIME_LABEL).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
      </div>
      <label>Estrelas<input class="input" type="number" name="points" min="5" max="500" step="5" value="20"></label>
      <button class="btn btn-main">Criar missão</button></form></div>`;
  } else {
    html += lockCard('Missões da sua família', 'Com o Plus você cria missões próprias, como “regar a planta” ou “treino de piano”.');
  }
  return html;
}

function viewRewards() {
  let html = `<div class="card"><h2>Prêmios</h2><p class="lead">Os prêmios são combinados entre vocês. Nada é comprado dentro do app.</p>
    <ul class="rows">${rewards.map((r) => itemRow(r, 'reward')).join('')}</ul></div>`;
  if (isPlus()) {
    html += `<div class="card"><h2>Novo prêmio</h2><form class="form" data-form="addReward">
      <label>Nome<input class="input" name="title" required maxlength="60" placeholder="Dormir 30 min mais tarde"></label>
      <label>Ícone</label>${emojiPicker('icon', REWARD_ICONS, '🎁')}
      <label>Custo em estrelas<input class="input" type="number" name="cost" min="10" max="10000" step="10" value="100"></label>
      <button class="btn btn-main">Criar prêmio</button></form></div>`;
  } else {
    html += lockCard('Prêmios da sua família', 'Com o Plus você cria prêmios do jeito da sua casa, com o preço em estrelas que quiser.');
  }
  return html;
}

function viewChallenges() {
  if (!isPlus()) {
    return lockCard('Desafios da família', 'Proponha desafios como “7 dias escovando os dentes sem ninguém lembrar”, com um prêmio especial no final.') +
      '<div class="card"><h2>Como funciona</h2><p>Você escolhe uma missão, quantos dias ela precisa ser cumprida e o prêmio. A criança acompanha o progresso no placar do jogo.</p></div>';
  }
  const kidMissions = missions.filter((m) => m.audience === 'child' && m.active);
  let html = `<div class="card"><h2>Novo desafio</h2><form class="form" data-form="addChallenge">
    <label>Nome do desafio<input class="input" name="title" required maxlength="60" placeholder="7 dias escovando os dentes"></label>
    <div class="two">
      <label>Missão<select class="input" name="mission_id" required>${kidMissions.map((m) => `<option value="${m.id}">${esc(m.icon)} ${esc(m.title)}</option>`).join('')}</select></label>
      <label>Para quem<select class="input" name="player_id"><option value="">Todas as crianças</option>${children().map((k) => `<option value="${k.id}">${esc(k.nickname)}</option>`).join('')}</select></label>
    </div>
    <div class="two">
      <label>Dias cumpridos<input class="input" type="number" name="target_days" min="1" max="60" value="7"></label>
      <label>Duração<select class="input" name="duration"><option value="7">1 semana</option><option value="14">2 semanas</option><option value="21">3 semanas</option><option value="30">1 mês</option></select></label>
    </div>
    <label>Prêmio<input class="input" name="prize" maxlength="80" placeholder="Tarde no parque"></label>
    <button class="btn btn-main">Criar desafio</button></form></div>`;
  html += `<div class="card"><h2>Desafios</h2>${dash.challenges.length ? '' : '<p class="lead">Nenhum desafio ainda.</p>'}
    <ul class="rows">${dash.challenges.map((c) => `
      <li class="r"><span class="ic">${esc(c.mission_icon)}</span>
        <span><div class="t">${esc(c.title)}</div>
          <div class="s">${fmtDate(c.starts_on)} a ${fmtDate(c.ends_on)}${c.prize ? '. Prêmio: ' + esc(c.prize) : ''}</div>
          ${c.progress.map((p) => `<div class="s" style="margin-top:6px">${esc(p.avatar)} ${esc(p.nickname)}: ${p.done} de ${c.target_days} dias</div>
            <div class="progress"><span style="width:${Math.min(100, Math.round((p.done / c.target_days) * 100))}%"></span></div>`).join('')}
        </span>
        <span class="a"><button class="btn btn-danger btn-sm" data-act="delChallenge" data-id="${c.id}">Apagar</button></span></li>`).join('')}</ul></div>`;
  return html;
}

function viewLeague() {
  if (!isPlus()) {
    return lockCard('Liga entre famílias', 'Dispute o placar da semana com famílias amigas. Cada família aparece só com um apelido, sem nomes das crianças.');
  }
  let html = dash.leagues.map((lg) => `
    <div class="card"><h2>${esc(lg.name)}</h2>
      ${lg.code ? `<p class="lead">Código para convidar: <b>${fmtCode(lg.code)}</b></p>` : ''}
      ${rankHTML(lg.families)}
      <button class="btn btn-soft btn-sm" data-act="leaveLeague" data-id="${lg.id}" style="margin-top:12px">Sair da liga</button>
    </div>`).join('');
  html += `<div class="card"><h2>Criar liga</h2><form class="form" data-form="createLeague">
      <label>Nome da liga<input class="input" name="name" required maxlength="40" placeholder="Amigos da escola"></label>
      <label>Apelido da sua família<input class="input" name="nickname" required maxlength="30" placeholder="Família Foguete"></label>
      <label>Símbolo</label>${emojiPicker('avatar', HOME_AVATARS, '🏡')}
      <button class="btn btn-main">Criar liga</button></form>
    <h3>Entrar numa liga</h3><form class="form" data-form="joinLeague">
      <label>Código<input class="input code-input" name="code" required maxlength="9" placeholder="ABCD-2345"></label>
      <label>Apelido da sua família<input class="input" name="nickname" required maxlength="30" placeholder="Família Girassol"></label>
      <input type="hidden" name="avatar" value="🌻">
      <button class="btn btn-soft">Entrar</button></form></div>`;
  return html;
}

function viewAccount() {
  const f = dash.family;
  let html = `<div class="card"><h2>Família</h2><form class="form" data-form="renameFamily">
      <label>Nome<input class="input" name="name" required maxlength="60" value="${esc(f.name)}"></label>
      <button class="btn btn-soft">Salvar</button></form></div>`;
  html += `<div class="card"><h2>Plano ${f.plus ? 'Plus' : 'Grátis'}</h2>`;
  if (f.plus) {
    html += `<p>Obrigado por apoiar o Desafia!${f.plan_expires_at ? ' Ativo até ' + new Date(f.plan_expires_at).toLocaleDateString('pt-BR') + '.' : ''}</p>`;
  } else {
    html += `<p>O jogo é grátis para sempre. O Plus libera recursos para os adultos:</p>
      <ul class="benefits"><li>Várias crianças, cada uma com seu bichinho</li><li>Missões e prêmios personalizados</li><li>Desafios com prêmio especial</li><li>Liga entre famílias amigas</li></ul>
      <button class="btn btn-main" data-act="checkout">Assinar o Plus</button>`;
  }
  html += `</div><div class="card"><h2>Conta</h2><p class="lead">Entrou como ${esc(session.user.email)}</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <a class="btn btn-soft" href="/privacidade/">Privacidade</a><a class="btn btn-soft" href="/termos/">Termos</a>
      <button class="btn btn-soft" data-act="logout">Sair</button>
    </div>
    ${f.is_owner ? '<h3>Apagar família</h3><p class="lead">Apaga crianças, progresso, missões e prêmios. Não dá para desfazer.</p><button class="btn btn-danger" data-act="deleteFamily">Apagar família e dados</button>' : ''}
  </div>`;
  return html;
}

// ---------- Ações ----------
async function showPairCode(playerId) {
  const kid = children().find((k) => k.id === playerId);
  const res = await rpc('create_pairing_code', { p_player: playerId });
  const exp = new Date(res.expires_at).getTime();
  openModal(`<h2>Conectar aparelho de ${esc(kid.nickname)}</h2>
    <p>No celular ou tablet da criança, abra o Desafia e digite:</p>
    <div class="big-code">${fmtCode(res.code)}</div>
    <p class="center muted" id="codeTimer"></p>
    <button class="btn btn-soft" data-act="pair" data-id="${playerId}" style="width:100%">Gerar outro código</button>`);
  const tick = () => {
    const left = Math.max(0, exp - Date.now());
    const el = $('codeTimer');
    if (!el) return;
    el.textContent = left ? `Vale por ${Math.floor(left / 60000)}:${String(Math.floor((left % 60000) / 1000)).padStart(2, '0')}` : 'Código vencido. Gere outro.';
  };
  tick();
  clearInterval(openModal.timer);
  openModal.timer = setInterval(tick, 1000);
}

function showMarkForKid(playerId) {
  const kid = children().find((k) => k.id === playerId);
  const list = missions.filter((m) => m.audience === 'child' && m.active);
  openModal(`<h2>Missão feita por ${esc(kid.nickname)}</h2><p>Use quando a criança não estiver com o aparelho. As estrelas entram na hora.</p>
    <ul class="rows">${list.map((m) => `<li class="r"><span class="ic">${esc(m.icon)}</span><span><div class="t">${esc(m.title)}</div><div class="s">+${m.points} estrelas</div></span>
      <span class="a"><button class="btn btn-ok btn-sm" data-act="markKidMission" data-player="${playerId}" data-id="${m.id}">Feita</button></span></li>`).join('')}</ul>`);
}

const handlers = {
  retry: () => route(),
  backLogin: () => renderLogin(),
  closeModal: () => closeModal(),
  logout: async () => { await sb.auth.signOut(); localStorage.removeItem(FAMILY_KEY); },
  decideMission: (b) => guard(async () => { await rpc('decide_mission', { p_log: b.dataset.id, p_approve: b.dataset.ok === '1' }); snack(b.dataset.ok === '1' ? 'Aprovado! Estrelas enviadas.' : 'Combinado, a criança pode tentar de novo.'); await reload(); }),
  decideReward: (b) => guard(async () => { await rpc('decide_reward', { p_request: b.dataset.id, p_deliver: b.dataset.ok === '1' }); snack(b.dataset.ok === '1' ? 'Prêmio entregue!' : 'Pedido recusado. As estrelas voltaram.'); await reload(); }),
  markMine: (b) => guard(async () => { await rpc('parent_mark_done', { p_player: dash.me, p_mission: b.dataset.id }); snack('Boa! Estrelas para você.'); await reload(); }),
  pair: (b) => guard(() => showPairCode(b.dataset.id)),
  markForKid: (b) => showMarkForKid(b.dataset.id),
  markKidMission: (b) => guard(async () => { await rpc('parent_mark_done', { p_player: b.dataset.player, p_mission: b.dataset.id }); b.outerHTML = '<span class="badge badge-done">Feito ✓</span>'; await loadAll(); }),
  unpairKid: (b) => guard(async () => {
    if (!confirm('Desconectar todos os aparelhos desta criança?')) return;
    const { error } = await sb.from('devices').delete().eq('player_id', b.dataset.id);
    if (error) throw error;
    snack('Aparelhos desconectados.'); await reload();
  }),
  removeKid: (b) => guard(async () => {
    if (!confirm(`Remover ${b.dataset.name}? O progresso dela será apagado.`)) return;
    const { error } = await sb.from('players').delete().eq('id', b.dataset.id);
    if (error) throw error;
    snack('Criança removida.'); await reload();
  }),
  invite: () => guard(async () => {
    const res = await rpc('create_parent_invite', { p_family: fid });
    openModal(`<h2>Convidar responsável</h2><p>Envie este código. A pessoa entra no portal com o e-mail dela e escolhe “Tenho um convite”. Vale por 2 dias.</p>
      <div class="big-code">${fmtCode(res.code)}</div>`);
  }),
  step: (b) => guard(async () => {
    const isM = b.dataset.kind === 'mission';
    const list = isM ? missions : rewards;
    const it = list.find((x) => x.id === b.dataset.id);
    const key = isM ? 'points' : 'cost';
    const min = isM ? 5 : 10, max = isM ? 500 : 10000;
    const v = Math.min(max, Math.max(min, it[key] + Number(b.dataset.d)));
    if (v === it[key]) return;
    const { error } = await sb.from(isM ? 'missions' : 'rewards').update({ [key]: v }).eq('id', it.id);
    if (error) throw error;
    it[key] = v; render();
  }),
  toggle: (b) => guard(async () => {
    const isM = b.dataset.kind === 'mission';
    const it = (isM ? missions : rewards).find((x) => x.id === b.dataset.id);
    const { error } = await sb.from(isM ? 'missions' : 'rewards').update({ active: !it.active }).eq('id', it.id);
    if (error) throw error;
    it.active = !it.active; render();
  }),
  delItem: (b) => guard(async () => {
    if (!confirm('Apagar este item?')) return;
    const { error } = await sb.from(b.dataset.kind === 'mission' ? 'missions' : 'rewards').delete().eq('id', b.dataset.id);
    if (error) throw error;
    await reload();
  }),
  delChallenge: (b) => guard(async () => {
    if (!confirm('Apagar este desafio?')) return;
    const { error } = await sb.from('challenges').delete().eq('id', b.dataset.id);
    if (error) throw error;
    await reload();
  }),
  leaveLeague: (b) => guard(async () => {
    if (!confirm('Sair desta liga?')) return;
    const { error } = await sb.from('league_families').delete().eq('league_id', b.dataset.id).eq('family_id', fid);
    if (error) throw error;
    await reload();
  }),
  checkout: () => {
    if (!CHECKOUT_URL) { snack('O pagamento ainda não foi configurado (VITE_CHECKOUT_URL).'); return; }
    const u = new URL(CHECKOUT_URL);
    u.searchParams.set('family', fid);
    u.searchParams.set('email', session.user.email || '');
    location.href = u.toString();
  },
  deleteFamily: () => guard(async () => {
    const typed = prompt(`Para confirmar, digite o nome da família: ${dash.family.name}`);
    if (typed === null) return;
    if (typed.trim() !== dash.family.name) { snack('O nome não confere. Nada foi apagado.'); return; }
    const { error } = await sb.from('families').delete().eq('id', fid);
    if (error) throw error;
    localStorage.removeItem(FAMILY_KEY);
    snack('Família apagada.');
    await route();
  })
};

const forms = {
  login: async (fd) => {
    const email = fd.get('email').trim();
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + '/pais/' } });
    if (error) throw error;
    renderLogin(email);
  },
  createFamily: async (fd) => {
    const id = await rpc('create_family', { p_name: fd.get('name'), p_display_name: fd.get('display'), p_avatar: fd.get('avatar') });
    localStorage.setItem(FAMILY_KEY, id);
    view = 'criancas'; location.hash = 'criancas';
    await route();
  },
  acceptInvite: async (fd) => {
    const id = await rpc('accept_parent_invite', { p_code: fd.get('code'), p_display_name: fd.get('display'), p_avatar: fd.get('avatar') });
    localStorage.setItem(FAMILY_KEY, id);
    await route();
  },
  addKid: async (fd) => {
    await rpc('create_child', { p_family: fid, p_nickname: fd.get('nickname'), p_avatar: fd.get('avatar') });
    snack('Criança adicionada! Agora conecte o aparelho dela.');
    await reload();
  },
  addMission: async (fd) => {
    const { error } = await sb.from('missions').insert({
      family_id: fid, title: fd.get('title').trim(), icon: fd.get('icon'), audience: fd.get('audience'),
      time_of_day: fd.get('time_of_day'), points: Number(fd.get('points')) || 20, is_custom: true, sort: 100
    });
    if (error) throw error;
    snack('Missão criada.'); await reload();
  },
  addReward: async (fd) => {
    const { error } = await sb.from('rewards').insert({
      family_id: fid, title: fd.get('title').trim(), icon: fd.get('icon'), cost: Number(fd.get('cost')) || 100, is_custom: true
    });
    if (error) throw error;
    snack('Prêmio criado.'); await reload();
  },
  addChallenge: async (fd) => {
    const duration = Number(fd.get('duration'));
    const target = Math.min(Number(fd.get('target_days')) || 1, duration);
    const { error } = await sb.from('challenges').insert({
      family_id: fid, title: fd.get('title').trim(), mission_id: fd.get('mission_id'), player_id: fd.get('player_id') || null,
      target_days: target, prize: fd.get('prize').trim() || null,
      starts_on: dash.today, ends_on: addDays(dash.today, duration - 1), created_by: session.user.id
    });
    if (error) throw error;
    snack('Desafio criado! Ele já aparece no jogo.'); await reload();
  },
  createLeague: async (fd) => {
    const res = await rpc('create_league', { p_family: fid, p_name: fd.get('name'), p_nickname: fd.get('nickname'), p_avatar: fd.get('avatar') });
    await reload();
    openModal(`<h2>Liga criada!</h2><p>Envie este código para as famílias amigas:</p><div class="big-code">${fmtCode(res.code)}</div>`);
  },
  joinLeague: async (fd) => {
    await rpc('join_league', { p_family: fid, p_code: fd.get('code'), p_nickname: fd.get('nickname'), p_avatar: fd.get('avatar') });
    snack('Você entrou na liga!'); await reload();
  },
  renameFamily: async (fd) => {
    const { error } = await sb.from('families').update({ name: fd.get('name').trim() }).eq('id', fid);
    if (error) throw error;
    snack('Nome salvo.'); await loadFamilies(); await reload();
  }
};

// ---------- Eventos ----------
document.addEventListener('click', (e) => {
  const pick = e.target.closest('[data-emoji]');
  if (pick) {
    const box = pick.closest('[data-picker]');
    box.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b === pick)));
    box.nextElementSibling.value = pick.dataset.emoji;
    return;
  }
  const nav = e.target.closest('[data-view]');
  if (nav) {
    e.preventDefault();
    view = nav.dataset.view;
    history.replaceState(null, '', '#' + view);
    closeModal();
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  const b = e.target.closest('[data-act]');
  if (b && b.tagName !== 'SELECT' && handlers[b.dataset.act]) handlers[b.dataset.act](b);
});
document.addEventListener('change', async (e) => {
  if (e.target.dataset.act === 'switchFamily') {
    localStorage.setItem(FAMILY_KEY, e.target.value);
    await route();
  }
});
document.addEventListener('input', (e) => {
  if (!e.target.classList.contains('code-input')) return;
  const raw = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  e.target.value = raw.length > 4 ? raw.slice(0, 4) + '-' + raw.slice(4) : raw;
});
document.addEventListener('submit', async (e) => {
  const form = e.target.closest('[data-form]');
  if (!form) return;
  e.preventDefault();
  const btn = form.querySelector('button:not([type="button"])');
  if (btn) btn.disabled = true;
  try {
    await forms[form.dataset.form](new FormData(form));
  } catch (err) {
    console.warn(err);
    snack(friendlyError(err));
  } finally {
    if (btn && btn.isConnected) btn.disabled = false;
  }
});
$('modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

// ---------- Início ----------
if (!supabaseReady) {
  renderConfigMissing();
} else {
  // INITIAL_SESSION chega logo no início; depois só recarrega quando o usuário muda.
  sb.auth.onAuthStateChange((event, s) => {
    const prev = session?.user?.id || null;
    session = s;
    if (event === 'INITIAL_SESSION' || (s?.user?.id || null) !== prev) setTimeout(route, 0);
  });
}
