// Modo local: o jogo funciona sem conta e sem internet, com dados só neste aparelho.
// Os pais aprovam no próprio aparelho depois de passar pela pergunta para adultos.

const KEY = 'desafia-local-v1';

export const LOCAL_MISSIONS = [
  { id: 'dentes', icon: '🪥', title: 'Escovar os dentes', points: 20, time_of_day: 'any' },
  { id: 'cama', icon: '🛏️', title: 'Arrumar a cama', points: 20, time_of_day: 'manha' },
  { id: 'ler', icon: '📚', title: 'Ler por 10 minutos', points: 20, time_of_day: 'any' },
  { id: 'agua', icon: '💧', title: 'Beber um copo de água', points: 10, time_of_day: 'any' },
  { id: 'brinquedos', icon: '🧸', title: 'Guardar os brinquedos', points: 20, time_of_day: 'noite' },
  { id: 'licao', icon: '✏️', title: 'Fazer a lição de casa', points: 30, time_of_day: 'tarde' }
];

export const LOCAL_REWARDS = [
  { id: 'jantar', icon: '🍕', title: 'Escolher o jantar', cost: 40 },
  { id: 'sorvete', icon: '🍦', title: 'Sorvete com a família', cost: 60 },
  { id: 'filme', icon: '🎬', title: 'Noite de filme', cost: 80 },
  { id: 'parque', icon: '🛝', title: 'Tarde no parque', cost: 120 },
  { id: 'passeio', icon: '🏝️', title: 'Passeio especial', cost: 200 }
];

function today() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function weekStart() {
  const d = new Date();
  const diff = (d.getDay() + 6) % 7; // segunda-feira
  d.setDate(d.getDate() - diff);
  return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
}
function fresh() {
  return {
    xp: 0, wallet: 0, week: 0, weekStart: weekStart(), day: today(),
    status: {}, requests: {}, recent: [],
    petName: 'Pipo', look: { color: 'rosa', hat: 'none', acc: 'none' }
  };
}
function load() {
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    if (s && s.status) return { ...fresh(), ...s };
  } catch (e) { /* armazenamento indisponível */ }
  return fresh();
}

export function createLocal() {
  let s = load();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* ignora */ } };
  const roll = () => {
    if (s.day !== today()) { s.day = today(); s.status = {}; }
    if (s.weekStart !== weekStart()) { s.weekStart = weekStart(); s.week = 0; }
  };
  const mission = (id) => LOCAL_MISSIONS.find((m) => m.id === id);
  const reward = (id) => LOCAL_REWARDS.find((r) => r.id === id);

  return {
    kind: 'local',
    async snapshot() {
      roll(); save();
      return {
        connected: false,
        familyName: null,
        nickname: 'Você',
        petName: s.petName,
        look: s.look,
        xp: s.xp,
        wallet: s.wallet,
        weekPoints: s.week,
        missions: LOCAL_MISSIONS.map((m) => ({ ...m, status: s.status[m.id] || 'todo' })),
        rewards: LOCAL_REWARDS.map((r) => ({ ...r, pending: !!s.requests[r.id] })),
        recentRewards: s.recent,
        ranking: [],
        challenges: [],
        leagues: []
      };
    },
    async markDone(id) {
      roll();
      if (!s.status[id] || s.status[id] === 'rejected') { s.status[id] = 'pending'; save(); }
    },
    async requestReward(id) {
      const r = reward(id);
      if (!r || s.requests[id]) return;
      if (s.wallet < r.cost) throw new Error('NOT_ENOUGH_STARS');
      s.wallet -= r.cost; s.requests[id] = true; save();
    },
    async savePet(petName, look) {
      s.petName = (petName || '').trim().slice(0, 12) || 'Pipo';
      s.look = { ...look }; save();
    },
    // Ações dos pais (só no modo local)
    async approve(id) {
      roll();
      if (s.status[id] !== 'pending') return;
      const p = mission(id).points;
      s.status[id] = 'done'; s.xp += p; s.wallet += p; s.week += p; save();
    },
    async reject(id) {
      if (s.status[id] === 'pending') { s.status[id] = 'rejected'; save(); }
    },
    async deliver(id) {
      if (!s.requests[id]) return;
      const r = reward(id);
      delete s.requests[id];
      s.recent = [...s.recent.slice(-9), { id: 'l' + Date.now(), status: 'delivered', title: r.title, icon: r.icon }];
      save();
    },
    async deny(id) {
      if (!s.requests[id]) return;
      const r = reward(id);
      delete s.requests[id];
      s.wallet += r.cost;
      s.recent = [...s.recent.slice(-9), { id: 'l' + Date.now(), status: 'denied', title: r.title, icon: r.icon }];
      save();
    },
    reset() { s = fresh(); save(); },
    subscribe() { return () => {}; }
  };
}
