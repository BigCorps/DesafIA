// Parque de jogos do DesafIA.
// - Abre quando todas as missões do dia estão concluídas.
// - A cada dia completo sorteia um jogo novo para o álbum da criança.
// - Conta o tempo que os pais liberaram (o servidor tem a palavra final).
import './games.css';
import { GAMES, gameById, medalOf, MEDAL_ICON } from './registry.js';
import { sound, haptic, reducedMotion, sleep } from './kit.js';
import { petMarkup, applyLook } from '../shared/pet.js';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (sec) => { const s = Math.max(0, Math.round(sec)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
const TICK_EVERY = 15;

function normalize(raw) {
  if (!raw) return null;
  const m = raw.missions || {};
  return {
    enabled: Boolean(raw.enabled),
    minutes: Number(raw.minutes || 0),
    allowed: Number(raw.allowed_seconds || 0),
    remaining: Number(raw.remaining_seconds || 0),
    started: Boolean(raw.started),
    missionsOk: Boolean(m.ok),
    missionsDone: Number(m.done || 0) + (m.requires_approval ? 0 : Number(m.waiting || 0)),
    missionsWaiting: Number(m.waiting || 0),
    missionsTotal: Number(m.total || 0),
    requiresApproval: m.requires_approval !== false,
    unlocked: Array.isArray(raw.unlocked) ? raw.unlocked : [],
    newGames: Array.isArray(raw.new_games) ? raw.new_games : [],
    featured: raw.featured || null,
    disabled: Array.isArray(raw.disabled) ? raw.disabled : [],
    best: raw.best || {},
    plus: Boolean(raw.plus),
    catalog: Array.isArray(raw.catalog) ? raw.catalog : GAMES.filter((g)=>g.tier!=='plus').map((g)=>g.id)
  };
}

export function createArcade({ getApi, getSnap, say, toast, onChange }) {
  let status = null;
  let loading = false;
  let wasOk = null;
  let player = null;

  const api = () => getApi();
  const petName = () => getSnap()?.petName || 'Pipo';
  const look = () => getSnap()?.look || {};
  const available = () => GAMES.filter((g) => status?.unlocked.includes(g.id) && status?.catalog.includes(g.id) && !status.disabled.includes(g.id));

  // ---------- estado ----------
  async function refresh() {
    const a = api();
    if (!a?.playStatus || loading) return status;
    loading = true;
    try { status = normalize(await a.playStatus()); }
    catch (e) { console.warn('play_status', e); }
    finally { loading = false; }
    const ok = Boolean(status?.enabled && status.missionsOk && (status.remaining > 0 || !status.started));
    if (wasOk === false && ok) {
      say?.(`Tudo feito! O parque de jogos abriu 🎡`, 3200);
      haptic([20, 40, 20]);
    }
    wasOk = ok;
    updateFloat();
    onChange?.();
    return status;
  }
  let lastSig = null;
  function onSnapshot(prev, next) {
    if (!next) return;
    // guarda a própria assinatura: no modo local o retrato anterior e o novo
    // podem compartilhar os mesmos objetos de missão
    const sig = (next.missions || []).map((m) => `${m.id}:${m.status}`).join(',');
    if (sig !== lastSig || !status) { lastSig = sig; refresh(); }
  }
  function updateFloat() {
    const b = document.getElementById('arcadeBtn');
    if (!b) return;
    const show = Boolean(status?.enabled && status.missionsOk && (!status.started || status.remaining > 0) && !player);
    b.classList.toggle('show', show);
    b.innerHTML = status?.started ? `🎮 Jogos <small>${fmt(status.remaining)}</small>` : '🎡 Parque aberto!';
  }

  // ---------- aba ----------
  function album() {
    const eligibleCount=status?.catalog?.length||GAMES.filter((g)=>g.tier!=='plus').length;
    const unlockedEligible=(status?.unlocked||[]).filter((id)=>status?.catalog?.includes(id)).length;
    return `<h3>Álbum de jogos <small class="badge badge-soft">${unlockedEligible}/${eligibleCount}</small></h3><div class="arc-grid">${GAMES.map((g) => {
      const plusLocked=g.tier==='plus'&&!status?.plus;
      const has = status?.unlocked.includes(g.id) && !plusLocked;
      const off = status?.disabled.includes(g.id);
      if(plusLocked)return `<div class="arc-card locked plus-game" style="--gc:${g.color}"><span class="plus-mark">Plus ✦</span><span class="ic">${g.icon}</span><b>${esc(g.title)}</b><small>Mais variedade no DesafIA Plus</small></div>`;
      if (!has) return `<div class="arc-card locked"><span class="ic">?</span><b>Jogo surpresa</b><small>Complete um dia para descobrir</small></div>`;
      const best = Number(status.best[g.id] || 0);
      const medal = MEDAL_ICON[medalOf(g, best)];
      const canPlay = status.missionsOk && status.started && status.remaining > 0 && !off;
      return `<button class="arc-card ${status.featured === g.id ? 'featured' : ''}" style="--gc:${g.color}" data-arc="play" data-id="${g.id}" ${canPlay ? '' : 'disabled'}>
        ${g.tier==='plus'?'<span class="plus-mark">Plus ✦</span>':''}
        ${status.newGames.includes(g.id) ? '<span class="new">Novo!</span>' : medal ? `<span class="medal">${medal}</span>` : ''}
        <span class="ic">${g.icon}</span><b>${esc(g.title)}</b><small>${off ? 'Desligado pelos adultos' : best ? `Recorde: ${best}` : 'Novo no seu álbum'}</small></button>`;
    }).join('')}</div>`;
  }
  function view() {
    const title = `<div class="panel-title"><h2>Parque de jogos</h2><span class="badge badge-soft">${status?.started ? `⏱ ${fmt(status.remaining)}` : '🎡'}</span></div>`;
    if (!api()?.playStatus) return `${title}<p class="hint">Os jogos aparecem aqui.</p>`;
    if (!status) { refresh(); return `${title}<p class="hint">Carregando…</p>`; }
    if (!status.enabled) {
      return `${title}<div class="arc-hero locked"><small>Hoje não</small><strong>Os adultos deixaram os jogos desligados por enquanto.</strong></div>${album()}`;
    }
    if (!status.missionsOk) {
      const pct = status.missionsTotal ? Math.round((status.missionsDone / status.missionsTotal) * 100) : 0;
      const waiting = status.requiresApproval && status.missionsWaiting ? `<small>${status.missionsWaiting} esperando um adulto confirmar</small>` : '';
      return `${title}<div class="arc-hero locked"><small>O parque abre quando o dia estiver completo</small>
        <strong>Faltam ${Math.max(0, status.missionsTotal - status.missionsDone)} missões</strong>
        <div class="arc-steps"><i style="width:${pct}%"></i></div>${waiting}
        <button class="btn btn-gold" data-tab-go="missoes">Ver missões</button></div>
        <p class="hint">Cada dia completo libera um jogo surpresa no álbum. Os adultos escolhem quanto tempo dá para jogar.</p>${album()}`;
    }
    if (!status.started) {
      return `${title}<div class="arc-hero"><small>Dia completo! 🎉</small><strong>${esc(petName())} tem uma surpresa para você</strong>
        <span class="arc-time">⏱ ${status.minutes} minutos de jogo hoje</span><br><br>
        <button class="btn btn-gold" data-arc="open">Abrir o parque</button></div>${album()}`;
    }
    if (status.remaining <= 0) {
      return `${title}<div class="arc-hero done"><small>Por hoje é só</small><strong>Hora de descansar os olhos. Amanhã tem mais!</strong></div>${album()}`;
    }
    const feat = gameById(status.featured);
    return `${title}<div class="arc-hero"><small>Tempo de jogo</small><strong>${feat ? `Destaque de hoje: ${feat.icon} ${esc(feat.title)}` : 'Escolha um jogo!'}</strong>
      <span class="arc-time">⏱ ${fmt(status.remaining)} restantes</span>${feat ? `<br><br><button class="btn btn-gold" data-arc="play" data-id="${feat.id}">Jogar ${esc(feat.title)}</button>` : ''}</div>${album()}`;
  }

  // ---------- abrir o parque (roleta) ----------
  async function openPark(btn) {
    const a = api();
    if (!a?.playStart) return;
    if (btn) btn.disabled = true;
    try {
      const raw = await a.playStart();
      status = normalize(raw);
      wasOk = true;
      updateFloat();
      onChange?.();
      if (status.newGames.length) await reveal(status.newGames.map(gameById).filter(Boolean));
    } catch (e) {
      toast?.('Ops', /MISSIONS_PENDING/.test(e?.message) ? 'Ainda faltam missões para hoje.' : /PLAY_OFF/.test(e?.message) ? 'Os jogos estão desligados hoje.' : 'Não foi possível abrir agora.');
    } finally { if (btn) btn.disabled = false; }
  }

  function ensurePlayer() {
    if (player) return player;
    const root = document.createElement('div');
    root.className = 'arcade-player';
    root.hidden = true;
    root.innerHTML = `
      <header class="ap-bar">
        <button class="ap-btn" data-ap="close" aria-label="Sair do jogo">✕</button>
        <div class="ap-title"><span id="apIcon"></span><b id="apTitle"></b></div>
        <span class="ap-chip" aria-label="Pontos">⭐ <b id="apScore">0</b></span>
        <span class="ap-chip time" id="apTimeChip" aria-label="Tempo restante">⏱ <b id="apTime">0:00</b></span>
        <button class="ap-btn" data-ap="sound" id="apSound" aria-label="Som"></button>
      </header>
      <div class="ap-stage" id="apStage"></div>
      <div class="ap-screen" id="apScreen"><div class="ap-card" id="apCard"></div></div>`;
    document.body.appendChild(root);
    player = { root, game: null, inst: null, phase: 'closed', remaining: 0, pending: 0, timer: 0, score: 0 };
    root.addEventListener('click', onPlayerClick);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onOnline);
    return player;
  }
  const $p = (id) => player.root.querySelector(`#${id}`);
  function soundIcon() { $p('apSound').textContent = sound.muted ? '🔇' : '🔊'; }
  function screen(html) {
    $p('apCard').innerHTML = html;
    $p('apScreen').classList.add('show');
    player.root.querySelectorAll('.ap-card [data-pet]').forEach((elx) => {
      elx.innerHTML = petMarkup(`ap${Math.random().toString(36).slice(2, 7)}`);
      applyLook(elx.querySelector('svg'), look(), getSnap()?.xp || 0);
    });
  }
  const hideScreen = () => $p('apScreen').classList.remove('show');

  async function reveal(games) {
    const p = ensurePlayer();
    p.root.hidden = false;
    $p('apIcon').textContent = '🎡';
    $p('apTitle').textContent = 'Jogo surpresa';
    $p('apScore').textContent = '0';
    $p('apTime').textContent = fmt(status.remaining);
    soundIcon();
    p.phase = 'reveal';
    updateFloat();
    for (const g of games) {
      screen(`<div class="arc-roulette spin" id="apRoulette">❔</div><h2>Sorteando…</h2><p>Qual será o jogo novo?</p>`);
      const icons = GAMES.map((x) => x.icon);
      const total = reducedMotion() ? 1 : 16;
      for (let i = 0; i < total; i += 1) {
        $p('apRoulette').textContent = icons[i % icons.length];
        sound.play('tap');
        await sleep(60 + i * 9);
      }
      const r = $p('apRoulette');
      r.classList.remove('spin');
      r.textContent = g.icon;
      r.classList.add('land');
      sound.play('win');
      haptic([20, 40, 20]);
      screen(`<div class="arc-roulette land">${g.icon}</div><h2>${esc(g.title)}!</h2><p>Novo jogo no seu álbum.</p>
        <div class="stack"><button class="btn btn-gold btn-block" data-ap="choose" data-id="${g.id}">Jogar agora</button>
        ${games.length > 1 && g !== games[games.length - 1] ? '<button class="btn btn-soft btn-block" data-ap="nextReveal">Ver o próximo</button>' : '<button class="btn btn-soft btn-block" data-ap="close">Depois</button>'}</div>`);
      if (games.length > 1 && g !== games[games.length - 1]) {
        await new Promise((res) => { player.nextReveal = res; });
      }
    }
  }

  // ---------- jogar ----------
  function startTimer() {
    clearInterval(player.timer);
    player.timer = setInterval(() => {
      if (player.phase === 'closed' || player.phase === 'paused' || player.phase === 'timeup') return;
      if (document.visibilityState === 'hidden') return;
      player.remaining -= 1;
      player.pending += 1;
      $p('apTime').textContent = fmt(player.remaining);
      $p('apTimeChip').classList.toggle('low', player.remaining <= 60);
      if (player.pending >= TICK_EVERY) flush();
      if (player.remaining <= 0) timeUp();
    }, 1000);
  }
  async function flush() {
    const n = player?.pending || 0;
    if (!n) return;
    player.pending = 0;
    try {
      const r = await api().playTick(n);
      if (r && typeof r.remaining_seconds === 'number') player.remaining = Math.min(player.remaining, r.remaining_seconds);
    } catch (e) {
      player.pending += n; // sem internet: guarda e tenta depois
    }
  }

  async function choose(id) {
    const g = gameById(id);
    if (!g) return;
    if (g.tier==='plus'&&!status?.plus) { toast?.('Jogo Plus','Este jogo faz parte da expansão Plus.'); return; }
    if (!status?.catalog?.includes(g.id)) { toast?.('Jogo indisponível','Este jogo não está disponível no seu plano atual.'); return; }
    const p = ensurePlayer();
    p.root.hidden = false;
    p.game = g;
    p.remaining = status?.remaining ?? 0;
    $p('apIcon').textContent = g.icon;
    $p('apTitle').textContent = g.title;
    $p('apScore').textContent = '0';
    $p('apTime').textContent = fmt(p.remaining);
    soundIcon();
    updateFloat();
    if (p.remaining <= 0) { timeUp(); return; }
    p.phase = 'intro';
    startTimer();
    const best = Number(status?.best?.[g.id] || 0);
    screen(`<div class="ap-pet" data-pet></div><h2>${g.icon} ${esc(g.title)}</h2><p>${esc(g.how)}</p>
      ${best ? `<span class="record">Seu recorde: ${best}</span>` : ''}
      <div class="medals">${g.medals.map((m, i) => `<span class="${best >= m ? 'on' : ''}" title="${m} pontos">${MEDAL_ICON[i + 1]}</span>`).join('')}</div>
      <div class="stack"><button class="btn btn-main btn-block" data-ap="start">Jogar!</button></div>`);
    // carrega o módulo enquanto a criança lê as instruções
    try { p.module = (await g.load()).default; } catch (e) { console.warn(e); p.module = null; }
  }

  async function startRound() {
    const p = player;
    if (!p.module) { try { p.module = (await p.game.load()).default; } catch { toast?.('Ops', 'Não foi possível abrir o jogo.'); return; } }
    if (p.inst) { try { p.inst.destroy(); } catch { /* ignora */ } p.inst = null; }
    $p('apStage').innerHTML = '';
    p.score = 0;
    $p('apScore').textContent = '0';
    hideScreen();
    sound.unlock();
    p.phase = 'playing';
    p.inst = p.module($p('apStage'), {
      look: look(),
      petName: petName(),
      sound,
      haptic,
      reduced: reducedMotion(),
      onScore: (n) => { p.score = n; $p('apScore').textContent = n; },
      onGameOver: (n) => gameOver(n)
    });
    p.inst.start();
  }

  async function gameOver(score) {
    const p = player;
    if (p.phase !== 'playing') return;
    p.phase = 'over';
    const g = p.game;
    let record = false;
    let best = Number(status?.best?.[g.id] || 0);
    try {
      const r = await api().gameScore(g.id, score);
      if (r) { record = Boolean(r.record); best = Number(r.best || best); }
    } catch { record = score > best; best = Math.max(best, score); }
    if (status) status.best = { ...status.best, [g.id]: best };
    const medal = medalOf(g, score);
    if (record) { sound.play('win'); haptic([20, 40, 20, 40]); }
    const cheer = record ? 'Novo recorde! 🎉' : medal === 3 ? 'Medalha de ouro!' : medal ? 'Muito bem!' : 'Boa tentativa!';
    screen(`<div class="ap-pet" data-pet></div><h2>${cheer}</h2><div class="score">${score}</div>
      <div class="medals">${g.medals.map((m, i) => `<span class="${score >= m ? 'on' : ''}">${MEDAL_ICON[i + 1]}</span>`).join('')}</div>
      <p>Recorde: ${best}</p>
      <div class="stack">${p.remaining > 0 ? '<button class="btn btn-main btn-block" data-ap="start">Jogar de novo</button>' : ''}
      <button class="btn btn-soft btn-block" data-ap="close">Outros jogos</button></div>`);
  }

  function timeUp() {
    const p = player;
    if (p.phase === 'timeup') return;
    p.phase = 'timeup';
    try { p.inst?.pause(); } catch { /* ignora */ }
    flush();
    sound.play('level');
    screen(`<div class="ap-pet sleepy" data-pet></div><h2>Hora de descansar os olhos</h2>
      <p>O tempo de jogo de hoje acabou. ${esc(petName())} adorou brincar com você! Amanhã tem mais.</p>
      <div class="stack"><button class="btn btn-main btn-block" data-ap="close">Voltar para ${esc(petName())}</button></div>`);
  }

  async function close() {
    const p = player;
    if (!p) return;
    p.phase = 'closed';
    clearInterval(p.timer);
    await flush();
    try { p.inst?.destroy(); } catch { /* ignora */ }
    p.inst = null;
    p.module = null;
    $p('apStage').innerHTML = '';
    hideScreen();
    p.root.hidden = true;
    await refresh();
    if (status?.remaining <= 0 && status?.started) say?.('Foi muito divertido! Agora vamos descansar um pouco? 😴', 3000);
  }

  function onOnline() {
    if (player?.pending > 0) flush();
  }

  function onVisibility() {
    if (!player || player.phase !== 'playing') return;
    if (document.visibilityState === 'hidden') {
      try { player.inst?.pause(); } catch { /* ignora */ }
      player.phase = 'paused';
      flush();
      screen(`<div class="ap-pet" data-pet></div><h2>Pausado</h2><p>Toque para continuar de onde parou.</p>
        <div class="stack"><button class="btn btn-main btn-block" data-ap="resume">Continuar</button>
        <button class="btn btn-soft btn-block" data-ap="close">Sair</button></div>`);
    }
  }

  function onPlayerClick(e) {
    const b = e.target.closest('[data-ap]');
    if (!b) return;
    const act = b.dataset.ap;
    if (act === 'close') close();
    else if (act === 'sound') { sound.muted = !sound.muted; soundIcon(); if (!sound.muted) sound.play('tap'); }
    else if (act === 'start') startRound();
    else if (act === 'choose') choose(b.dataset.id);
    else if (act === 'nextReveal') player.nextReveal?.();
    else if (act === 'resume') { hideScreen(); player.phase = 'playing'; try { player.inst?.resume(); } catch { /* ignora */ } }
  }

  // cliques na aba e no botão flutuante
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-arc]');
    if (!b) return;
    if (b.dataset.arc === 'open') openPark(b);
    else if (b.dataset.arc === 'play') choose(b.dataset.id);
    else if (b.dataset.arc === 'float') {
      if (status && !status.started) openPark(b);
      else onChange?.('jogos');
    }
  });

  return { close, refresh, onSnapshot, view, get status() { return status; } };
}
