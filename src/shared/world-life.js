import { levelOf } from './progression.js';

export const WORLD_DETAILS = [
  { id:'sceneRug', level:1, kind:'rug' },
  { id:'sceneLamp', level:2, kind:'lamp' },
  { id:'scenePlant', level:3, kind:'plant' },
  { id:'sceneBooks', level:4, kind:'books' },
  { id:'sceneTree', level:5, kind:'tree' },
  { id:'sceneCushion', level:6, kind:'cushion' },
  { id:'sceneTelescope', level:7, kind:'telescope' },
  { id:'sceneLittleHouse', level:9, kind:'house' },
  { id:'sceneFlowers', level:12, kind:'flowers' }
];

export function worldStage(xp = 0) {
  const level = levelOf(xp);
  if (level >= 12) return 'florido';
  if (level >= 9) return 'ampliado';
  if (level >= 6) return 'aconchegante';
  if (level >= 3) return 'vivo';
  return 'inicio';
}

export function unlockedWorldDetails(xp = 0) {
  const level = levelOf(xp);
  return WORLD_DETAILS.filter((item) => level >= item.level);
}

export function dominantTrait(profile = {}) {
  const traits = Array.isArray(profile.traits) ? profile.traits : [];
  const ranked = traits
    .map((trait, index) => ({ ...trait, points:Number(trait.points)||0, index }))
    .sort((a,b) => b.points-a.points || a.index-b.index);
  return ranked[0]?.points > 0 ? ranked[0].id : null;
}

function routine(id, objectId, motion, text, extra = {}) {
  return { id, objectId, motion, text, ...extra };
}

export function worldRoutineCandidates({ xp=0, period='dia', profile={}, treasures=[] } = {}) {
  const level = levelOf(xp);
  const trait = dominantTrait(profile);
  const list = [];

  list.push(routine('tapete','sceneRug','dance','Esse tapete é perfeito para uma dancinha bem curtinha! 🎵',{traits:['artist']}));
  if (level >= 2 && period === 'noite') list.push(routine('luz','sceneLamp','wave','Vou deixar uma luz bem tranquila acesa por aqui. 💡',{traits:['caring']}));
  if (level >= 3 && period !== 'noite') list.push(routine('plantinha','scenePlant','squish','A plantinha está crescendo com a gente. Vou dar uma olhadinha nela! 🌱',{traits:['caring','curious']}));
  if (level >= 4) list.push(routine('leitura','sceneBooks','wiggle','Acho que hoje cabe mais uma história aqui. 📚',{traits:['artist','curious']}));
  if (level >= 5 && period !== 'noite') list.push(routine('arvore','sceneTree','march','Será que apareceu alguma novidade perto da árvore? 🍃',{traits:['adventurous','curious']}));
  if (level >= 6 && period === 'noite') list.push(routine('almofada','sceneCushion','hug','Essa almofada parece um ótimo lugar para descansar um pouquinho. 💜',{traits:['caring']}));
  if (level >= 7 && period === 'noite') list.push(routine('telescopio','sceneTelescope','curious','O céu está bonito. Vou procurar uma estrelinha diferente! 🔭',{traits:['curious','adventurous']}));
  if (level >= 9) list.push(routine('casinha','sceneLittleHouse','proud','Nossa casinha mudou tanto desde o começo! 🏡',{traits:['caring','adventurous']}));
  if (level >= 12 && period !== 'noite') list.push(routine('jardim','sceneFlowers','wave','Olha quantas flores apareceram por aqui! 🌻',{traits:['caring','artist']}));
  if (treasures.length) {
    const treasure = treasures.at(-1);
    list.push(routine('tesouro','sceneTreasure','proud',`Olha o meu ${treasure.title}! Ele lembra uma conquista nossa. ${treasure.icon}`,{traits:['adventurous','curious'],treasure}));
  }

  if (!trait) return list;
  return [...list].sort((a,b) => Number(b.traits?.includes(trait)) - Number(a.traits?.includes(trait)));
}

export function chooseWorldRoutine(input, index = 0) {
  const list = worldRoutineCandidates(input);
  if (!list.length) return null;
  const safe = Math.abs(Number(index)||0) % list.length;
  return list[safe];
}

export function worldMoment({ xp=0, period='dia', profile={}, treasures=[] } = {}) {
  const trait = dominantTrait(profile);
  const memory = Array.isArray(profile.memories) ? profile.memories.at(-1) : null;
  const treasure = treasures.at(-1);

  if (treasure) return {
    icon: treasure.icon,
    title: 'Um tesouro ganhou lugar no mundo',
    text: `${treasure.title} agora faz parte das coisas que o companheiro gosta de rever.`
  };
  if (memory) return {
    icon: memory.icon || '💜',
    title: 'Uma lembrança especial',
    text: memory.text || 'Uma pequena memória ficou guardada por aqui.'
  };
  if (trait) {
    const names={curious:'curioso',adventurous:'aventureiro',artist:'artista',caring:'cuidador'};
    return {
      icon: trait==='curious'?'🔎':trait==='adventurous'?'🧭':trait==='artist'?'🎨':'🌱',
      title: 'O jeitinho dele aparece no mundo',
      text: `Hoje o lado ${names[trait]||trait} está aparecendo um pouquinho mais nas brincadeiras.`
    };
  }
  const stage=worldStage(xp);
  return {
    icon: period==='noite'?'🌙':'🏡',
    title: stage==='inicio'?'Nosso cantinho está começando':'O mundo está crescendo',
    text: stage==='inicio'?'Cada rotina vai deixando este lugar mais com a cara de vocês.':'Novos detalhes aparecem conforme vocês vivem mais momentos juntos.'
  };
}
