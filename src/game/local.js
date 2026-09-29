import { DEFAULT_LOOK } from '../shared/pet.js';

const KEY = 'desafia-local-v3';
const TZ = 'America/Sao_Paulo';

const MISSIONS = [
  ['m1','🪥','Escovar os dentes',20,10,'any'],
  ['m2','🛏️','Arrumar a cama',20,10,'manha'],
  ['m3','📚','Ler por 10 minutos',20,10,'any'],
  ['m4','💧','Beber um copo de água',10,5,'any'],
  ['m5','🧸','Guardar os brinquedos',20,10,'noite'],
  ['m6','✏️','Fazer a lição de casa',30,18,'tarde']
];
const REWARDS = [
  ['r1','🍕','Escolher o jantar',40],['r2','🍦','Sorvete com a família',60],['r3','🎬','Noite de filme',80],['r4','🛝','Tarde no parque',120],['r5','🏝️','Passeio especial',200]
];

function localDay() {
  const parts = new Intl.DateTimeFormat('en-CA',{ timeZone: TZ, year:'numeric',month:'2-digit',day:'2-digit' }).formatToParts(new Date());
  const v = Object.fromEntries(parts.map((p)=>[p.type,p.value]));
  return `${v.year}-${v.month}-${v.day}`;
}
function mondayKey() {
  const d = new Date(`${localDay()}T12:00:00-03:00`);
  const day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  return new Intl.DateTimeFormat('en-CA',{ timeZone: TZ,year:'numeric',month:'2-digit',day:'2-digit' }).format(d);
}
function initial() {
  return {
    version:3,day:localDay(),week:mondayKey(),xp:0,wallet:0,weekPoints:0,petName:'Pipo',look:{...DEFAULT_LOOK},
    missions:MISSIONS.map(([id,icon,title,stars,xpReward,time])=>({id,icon,title,star_reward:stars,xp_reward:xpReward,time_of_day:time,status:'todo'})),
    rewards:REWARDS.map(([id,icon,title,cost])=>({id,icon,title,cost,pending:false})),
    recentRewards:[],dailyBonusDay:null,completedDays:[],familyGoal:500,
    nickname:'Você',familyName:'Família do Pipo'
  };
}
function load() {
  try { return { ...initial(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return initial(); }
}
function save(s) { localStorage.setItem(KEY, JSON.stringify(s)); }
function normalize(s) {
  const today = localDay(); const week = mondayKey();
  if (s.week !== week) { s.week = week; s.weekPoints = 0; }
  if (s.day !== today) {
    s.day = today; s.missions = MISSIONS.map(([id,icon,title,stars,xpReward,time])=>({id,icon,title,star_reward:stars,xp_reward:xpReward,time_of_day:time,status:'todo'}));
    s.recentRewards = []; s.dailyBonusDay = null;
  }
  return s;
}
function streak(days) {
  const set = new Set(days || []); let base = new Date(`${localDay()}T12:00:00-03:00`);
  if (!set.has(localDay())) base.setDate(base.getDate()-1);
  let n=0;
  while (n < 365) {
    const key = new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).format(base);
    if (!set.has(key)) break;
    n += 1; base.setDate(base.getDate()-1);
  }
  return n;
}
function snapshotFrom(s) {
  return {
    connected:false,familyName:s.familyName,nickname:s.nickname,petName:s.petName,look:s.look,xp:s.xp,wallet:s.wallet,
    weekPoints:s.weekPoints,streak:streak(s.completedDays),missions:s.missions,rewards:s.rewards,recentRewards:s.recentRewards,
    ranking:[{nickname:s.nickname,avatar:'🌸',points:s.weekPoints,me:true}],challenges:[],leagues:[],
    familyGoal:{current:s.weekPoints,target:s.familyGoal},dailyBonusDay:s.dailyBonusDay
  };
}

export function createLocal() {
  let state = normalize(load()); save(state);
  const commit = () => { state = normalize(state); save(state); return snapshotFrom(state); };
  const maybeBonus = () => {
    if (state.dailyBonusDay === state.day) return;
    if (state.missions.length && state.missions.every((m)=>m.status==='done')) {
      state.dailyBonusDay = state.day; state.wallet += 25; state.xp += 15; state.weekPoints += 25;
      if (!state.completedDays.includes(state.day)) state.completedDays.push(state.day);
      state.completedDays = state.completedDays.slice(-120);
    }
  };
  return {
    kind:'local',
    async snapshot(){ state=normalize(state); save(state); return snapshotFrom(state); },
    async markDone(id){ const m=state.missions.find((x)=>x.id===id); if(m && m.status!=='done') m.status='pending'; return commit(); },
    async decideMission(id,approve){
      const m=state.missions.find((x)=>x.id===id); if(!m || m.status!=='pending') return commit();
      if(approve){m.status='done';state.wallet+=m.star_reward;state.xp+=m.xp_reward;state.weekPoints+=m.star_reward;maybeBonus();} else m.status='todo';
      return commit();
    },
    async requestReward(id){
      const r=state.rewards.find((x)=>x.id===id); if(!r || r.pending) return commit();
      if(state.wallet<r.cost) throw new Error('NOT_ENOUGH_STARS'); state.wallet-=r.cost;r.pending=true;return commit();
    },
    async decideReward(id,deliver){
      const r=state.rewards.find((x)=>x.id===id); if(!r||!r.pending)return commit();r.pending=false;
      if(!deliver)state.wallet+=r.cost;
      state.recentRewards.push({id:`${Date.now()}`,reward_id:r.id,status:deliver?'delivered':'denied',title:r.title,icon:r.icon,decided_at:new Date().toISOString()});
      state.recentRewards=state.recentRewards.slice(-8);return commit();
    },
    async savePet(name,look){ state.petName=(name||'Pipo').trim().slice(0,12)||'Pipo';state.look={...state.look,...look};return commit(); },
    async reset(){ state=initial();return commit(); },
    async unpair(){ return commit(); },
    subscribe(){ return ()=>{}; }
  };
}
