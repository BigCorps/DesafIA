export const LEVEL_THRESHOLDS = [
  0, 100, 250, 450, 700, 1000, 1350, 1750, 2200, 2700,
  3250, 3850, 4500, 5200, 5950, 6750, 7600, 8500, 9450, 10450
];

export function levelOf(xp = 0) {
  const safe = Math.max(0, Number(xp) || 0);
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i -= 1) {
    if (safe >= LEVEL_THRESHOLDS[i]) return i + 1;
  }
  return 1;
}

export function levelProgress(xp = 0) {
  const safe = Math.max(0, Number(xp) || 0);
  const level = levelOf(safe);
  const start = LEVEL_THRESHOLDS[level - 1] ?? 0;
  const next = LEVEL_THRESHOLDS[level] ?? (start + 1000 + Math.max(0, level - 20) * 100);
  const pct = Math.max(0, Math.min(100, Math.round(((safe - start) / Math.max(1, next - start)) * 100)));
  return { level, start, next, pct, remaining: Math.max(0, next - safe) };
}

export function stageOf(xp = 0) {
  const level = levelOf(xp);
  if (level >= 10) return 4;
  if (level >= 6) return 3;
  if (level >= 3) return 2;
  return 1;
}

export const HOUSE_ITEMS = [
  { id: 'tapete', level: 1, icon: '🟪', title: 'Tapete macio', text: 'Um cantinho confortável para começar.' },
  { id: 'luminaria', level: 2, icon: '💡', title: 'Luminária', text: 'Uma luz nova para a casa.' },
  { id: 'planta', level: 3, icon: '🪴', title: 'Plantinha', text: 'A casa começa a ganhar vida.' },
  { id: 'livros', level: 4, icon: '📚', title: 'Cantinho de leitura', text: 'Histórias para explorar.' },
  { id: 'arvore', level: 5, icon: '🌳', title: 'Árvore do jardim', text: 'Um jardim de verdade começa aqui.' },
  { id: 'almofada', level: 6, icon: '🛋️', title: 'Cantinho de descanso', text: 'Depois de um bom dia, hora de relaxar.' },
  { id: 'telescopio', level: 7, icon: '🔭', title: 'Telescópio', text: 'Novos mundos para descobrir.' },
  { id: 'casinha', level: 9, icon: '🏡', title: 'Casa ampliada', text: 'Mais espaço para novas conquistas.' },
  { id: 'jardim', level: 12, icon: '🌻', title: 'Jardim florido', text: 'A rotina virou um mundo inteiro.' }
];

export const unlockedHouseItems = (xp = 0) => HOUSE_ITEMS.filter((item) => levelOf(xp) >= item.level);
