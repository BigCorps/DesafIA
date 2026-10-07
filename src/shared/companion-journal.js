import { DISCOVERIES } from './adventures.js';
import { levelOf } from './progression.js';

export const TRAITS = [
  { id: 'curious', name: 'Curioso', icon: '🔎', text: 'Gosta de olhar de pertinho.' },
  { id: 'adventurous', name: 'Aventureiro', icon: '🧭', text: 'Gosta de explorar caminhos.' },
  { id: 'artist', name: 'Artista', icon: '🎨', text: 'Gosta de imaginar e criar.' },
  { id: 'caring', name: 'Cuidador', icon: '🌱', text: 'Gosta de cuidar com carinho.' }
];
const LIKES = [
  { id: 'stars', name: 'Estrelas', icon: '⭐', categories: ['ceu', 'tesouros'], action: 'sceneTelescope' },
  { id: 'books', name: 'Livros e histórias', icon: '📚', categories: ['historias'], action: 'sceneBooks' },
  { id: 'plants', name: 'Plantinhas', icon: '🪴', categories: ['natureza'], action: 'scenePlant' },
  { id: 'wind', name: 'Vento e dança', icon: '🍃', categories: ['aventura'] },
  { id: 'exploring', name: 'Explorar', icon: '🧭', categories: ['aventura', 'ceu'], action: 'sceneTree' },
  { id: 'company', name: 'Carinho e companhia', icon: '💜', categories: ['amizade'], action: 'hug' }
];
const CATEGORY_TRAITS = {
  natureza: ['curious', 'caring'], historias: ['artist', 'curious'],
  ceu: ['adventurous', 'curious'], aventura: ['adventurous', 'artist'],
  tesouros: ['curious'], amizade: ['caring']
};
const ACTION_TRAITS = {
  sceneTree: 'adventurous', sceneBooks: 'artist', scenePlant: 'caring',
  sceneTelescope: 'curious', hug: 'caring', highfive: 'adventurous',
  tap: 'curious'
};
const MILESTONES = [3, 6, 10, 20];
const MEMORIES = [
  { id: 'first_day', icon: '🌟', text: 'Nosso primeiro dia completo' },
  { id: 'first_adventure', icon: '🧭', text: 'Nossa primeira aventura' },
  { id: 'first_discovery', icon: '✨', text: 'Nossa primeira descoberta' },
  ...DISCOVERIES.map((d) => ({ id: `found:${d.id}`, icon: d.icon, text: `Quando encontramos ${d.name}` })),
  ...MILESTONES.map((level) => ({ id: `level:${level}`, icon: '💜', text: `Quando nosso companheiro chegou ao nível ${level}` }))
];
const knownDiscovery = new Set(DISCOVERIES.map((d) => d.id));
const knownMemory = new Set(MEMORIES.map((m) => m.id));
const integer = (n) => Number.isSafeInteger(n) && n >= 0 ? Math.min(12, n) : 0;
const dayKey = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit'
}).format(new Date());

function clean(raw = {}) {
  const value = raw && typeof raw === 'object' ? raw : {};
  const list = (v, allowed) => Array.isArray(v) ? [...new Set(v.filter((id) => allowed.has(id)))] : [];
  return {
    version: 1,
    discoveries: list(value.discoveries, knownDiscovery),
    memories: list(value.memories, knownMemory),
    actions: Object.fromEntries(Object.keys(ACTION_TRAITS).map((id) => [id, integer(value.actions?.[id])])),
    actionDay: /^\d{4}-\d{2}-\d{2}$/.test(value.actionDay || '') ? value.actionDay : null,
    todayActions: list(value.todayActions, new Set(Object.keys(ACTION_TRAITS)))
  };
}

// Only the existing server-issued player UUID scopes a connected journal.
// No device secret, child name, mission copy or Auth session is stored here.
export function companionScope(snapshot) {
  if (!snapshot) return null;
  if (!snapshot.connected) return 'local';
  return /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(snapshot.playerId || '')
    ? `player:${snapshot.playerId.toLowerCase()}` : null;
}

export function observeCompanion(raw, snapshot = {}) {
  const state = clean(raw);
  const remember = (id) => { if (!state.memories.includes(id)) state.memories.push(id); };
  const incoming = Array.isArray(snapshot.adventure?.discoveries) ? snapshot.adventure.discoveries : [];
  for (const item of incoming) {
    const id = typeof item === 'string' ? item : item?.id;
    if (!knownDiscovery.has(id)) continue;
    if (!state.discoveries.includes(id)) state.discoveries.push(id);
    remember(`found:${id}`);
  }
  if (snapshot.dailyBonusDay || snapshot.adventure?.eligible || snapshot.companionJournal?.has_completed_day || state.discoveries.length) remember('first_day');
  if (state.discoveries.length) { remember('first_adventure'); remember('first_discovery'); }
  for (const level of MILESTONES) if (levelOf(snapshot.xp) >= level) remember(`level:${level}`);
  return state;
}

export function recordCompanionAction(raw, action, day = dayKey()) {
  const state = clean(raw);
  if (!Object.hasOwn(ACTION_TRAITS, action) || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return state;
  if (state.actionDay !== day) { state.actionDay = day; state.todayActions = []; }
  // One gentle contribution per type/day: repeated tapping is never required.
  if (!state.todayActions.includes(action)) {
    state.actions[action] = Math.min(12, state.actions[action] + 1);
    state.todayActions.push(action);
  }
  return state;
}

export function companionProfile(raw) {
  const state = clean(raw);
  const points = Object.fromEntries(TRAITS.map((t) => [t.id, 0]));
  const found = DISCOVERIES.filter((d) => state.discoveries.includes(d.id));
  for (const d of found) for (const trait of CATEGORY_TRAITS[d.category] || []) points[trait] += 2;
  for (const [action, trait] of Object.entries(ACTION_TRAITS)) points[trait] += state.actions[action];
  return {
    traits: TRAITS.map((t) => ({ ...t, expression: points[t.id] >= 6 ? 'Florescendo' : points[t.id] > 0 ? 'Aparecendo' : 'Uma sementinha' })),
    likes: LIKES.filter((like) => found.some((d) => like.categories.includes(d.category)) || state.actions[like.action] >= 2),
    memories: state.memories.map((id) => MEMORIES.find((m) => m.id === id))
  };
}

function remoteCompanionState(snapshot) {
  const remote = snapshot?.connected ? snapshot?.companionJournal : null;
  if (!remote || typeof remote !== 'object') return null;
  return clean({
    actions: remote.actions,
    actionDay: remote.action_day ?? remote.actionDay,
    todayActions: remote.today_actions ?? remote.todayActions,
    discoveries: [],
    memories: []
  });
}

export function createCompanionJournal(storage) {
  const fallback = new Map();
  const unsaved = new Set();
  const keyFor = (snapshot) => {
    const scope = companionScope(snapshot);
    return scope ? `desafia-companion-v1:${scope}` : null;
  };
  function load(key) {
    if (unsaved.has(key)) return clean(fallback.get(key));
    try { return clean(JSON.parse(storage.getItem(key) || 'null')); }
    catch { return clean(fallback.get(key)); }
  }
  function save(key, state) {
    fallback.set(key, state);
    try { storage.setItem(key, JSON.stringify(state)); unsaved.delete(key); }
    catch { unsaved.add(key); /* session-only if storage is unavailable */ }
  }
  return {
    observe(snapshot) {
      const key = keyFor(snapshot);
      if (!key) return companionProfile({});
      const state = observeCompanion(remoteCompanionState(snapshot) || load(key), snapshot);
      save(key, state);
      return companionProfile(state);
    },
    action(snapshot, action) {
      const key = keyFor(snapshot);
      if (!key) return;
      save(key, recordCompanionAction(observeCompanion(load(key), snapshot), action));
    }
  };
}
