export const COMPANION_MOODS = {
  calm: { label: 'Calmo', icon: '💜' },
  curious: { label: 'Curioso', icon: '✨' },
  excited: { label: 'Animado', icon: '🎉' },
  proud: { label: 'Orgulhoso', icon: '🌟' },
  sleepy: { label: 'Sonolento', icon: '🌙' }
};

export function deriveCompanionMood(snapshot, period = 'dia') {
  const missions = Array.isArray(snapshot?.missions) ? snapshot.missions : [];
  const total = missions.length;
  const done = missions.filter((m) => m?.status === 'done').length;
  const pending = missions.filter((m) => m?.status === 'pending').length;

  if (total > 0 && done === total) return 'proud';
  if (total > 0 && done + pending === total) return 'excited';
  if (period === 'noite') return 'sleepy';
  if (done > 0 || pending > 0) return 'excited';
  if (period === 'tarde') return 'curious';
  return 'calm';
}

export function companionMoodLabel(mood) {
  const state = COMPANION_MOODS[mood] || COMPANION_MOODS.calm;
  return `${state.icon} ${state.label}`;
}

export function companionAmbientLine(mood, name = 'Pipo') {
  const lines = {
    calm: [
      `Que bom ficar aqui com você. 💜`,
      `Oi! Eu sou ${name}. Vamos fazer algo legal juntos?`
    ],
    curious: [
      'Será que tem alguma novidade por aqui? ✨',
      'Estou com vontade de descobrir alguma coisa!'
    ],
    excited: [
      'Estamos avançando! Eu estou animado! 🎉',
      'Cada pequena conquista deixa nosso mundo mais vivo!'
    ],
    proud: [
      'Olha quanta coisa você conseguiu hoje! 🌟',
      'Estou muito orgulhoso do que fizemos juntos!'
    ],
    sleepy: [
      'A noite chegou. Podemos ficar bem tranquilos por aqui. 🌙',
      'Que dia gostoso. Agora estou ficando sonolento.'
    ]
  };
  const list = lines[mood] || lines.calm;
  return list[Math.floor(Math.random() * list.length)];
}

export function missionCompanionAction(mission = {}) {
  const icon = String(mission.icon || '');
  const title = String(mission.title || '').toLocaleLowerCase('pt-BR');
  const has = (...terms) => terms.some((term) => title.includes(term));

  if (icon === '🪥' || has('dente', 'escov')) {
    return { motion: 'proud', burst: ['✨', '😁'], objectId: null, text: 'Meu sorriso também ficou brilhando! 😁' };
  }
  if (icon === '📚' || has('ler', 'leitura', 'livro', 'história')) {
    return { motion: 'wiggle', burst: ['📚', '✨'], objectId: 'sceneBooks', text: 'Histórias deixam nosso mundo maior! 📚' };
  }
  if (icon === '💧' || has('água', 'agua', 'hidratar')) {
    return { motion: 'giggle', burst: ['💧', '✨'], objectId: 'scenePlant', text: 'Ahhh, água faz bem para nós e para a plantinha! 💧' };
  }
  if (icon === '🧸' || has('organizar', 'arrumar', 'guardar')) {
    return { motion: 'twirl', burst: ['✨', '🧸'], objectId: null, text: 'Tudo organizado. Que sensação boa!' };
  }
  if (icon === '✏️' || has('estudar', 'atividade', 'tarefa', 'escola')) {
    return { motion: 'proud', burst: ['⭐', '✏️'], objectId: 'sceneBooks', text: 'Missão inteligente concluída! ⭐' };
  }
  if (icon === '🛏️' || has('cama', 'dormir', 'sono', 'quarto')) {
    return { motion: 'hug', burst: ['🌙', '💜'], objectId: null, text: 'Que cantinho gostoso. Depois podemos descansar. 🌙' };
  }
  return { motion: 'proud', burst: ['⭐', '✨'], objectId: null, text: 'Você conseguiu! Estou crescendo com você! 🌟' };
}

export function worldCompanionAction(id, name = 'Pipo') {
  const actions = {
    sceneTree: { motion: 'twirl', burst: ['🍃', '✨'], text: 'As folhas estão dançando! Será que mora alguém nessa árvore?' },
    sceneBooks: { motion: 'wiggle', burst: ['📚', '✨'], text: 'Qual história vamos imaginar hoje?' },
    scenePlant: { motion: 'squish', burst: ['💧', '🌱'], text: 'Vou cuidar da nossa plantinha. Ela está crescendo com a gente!' },
    sceneTelescope: { motion: 'curious', burst: ['⭐', '🌙'], text: `${name}, será que hoje encontramos uma constelação nova?` }
  };
  return actions[id] || null;
}
