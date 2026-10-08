// Catálogo dos minijogos. A lista de ids precisa ser igual à função
// desafia.game_catalog() da migration 20260930000100_desafia_minijogos.sql.
//
// medals: pontos para bronze, prata e ouro.
// Cada jogo é carregado só quando a criança abre (o app continua leve).

export const GAMES = [
  {
    id: 'pula', title: 'Pula-Pula', icon: '🏃', color: '#FF8FA3', ages: '4+',
    how: 'Toque na tela para pular os obstáculos. Toque de novo no ar para um pulo duplo! Pegue as estrelas.',
    medals: [150, 400, 900], load: () => import('./pula.js')
  },
  {
    id: 'voa', title: 'Voa Alto', icon: '🪽', color: '#72B9FF', ages: '5+',
    how: 'Toque para bater as asinhas e passar entre as árvores. Você tem 3 corações.',
    medals: [5, 15, 30], load: () => import('./voa.js')
  },
  {
    id: 'trenzinho', title: 'Trenzinho de Frutas', icon: '🚂', color: '#7FD67F', ages: '5+',
    how: 'Deslize o dedo (ou use as setas) para levar o trenzinho até as frutas. Cada fruta ganha um vagão novo!',
    medals: [80, 200, 400], load: () => import('./trenzinho.js')
  },
  {
    id: 'torre', title: 'Torre Alta', icon: '🏗️', color: '#FFD24D', ages: '4+',
    how: 'Toque para soltar o bloco bem em cima do outro. Acertou certinho? Ganha bônus!',
    medals: [10, 25, 45], load: () => import('./torre.js')
  },
  {
    id: 'bloquinhos', title: 'Quebra-Bloquinhos', icon: '🧱', color: '#AB8FFF', ages: '6+',
    how: 'Arraste o dedo para mover a plataforma e rebater a estrela. Quebre todos os blocos!',
    medals: [300, 900, 2000], load: () => import('./bloquinhos.js')
  },
  {
    id: 'evolucao', title: 'Evolução', icon: '🌱', color: '#5CCB8A', ages: '7+',
    how: 'Deslize para juntar peças iguais. Semente vira broto, broto vira flor… até chegar no diamante!',
    medals: [1000, 3000, 8000], load: () => import('./evolucao.js')
  },
  {
    id: 'frutas', title: 'Combina Frutas', icon: '🍓', color: '#FF7A8A', ages: '6+',
    how: 'Troque duas frutas vizinhas para formar 3 ou mais iguais em linha. Você tem 25 jogadas.',
    medals: [1200, 3000, 6000], load: () => import('./frutas.js')
  },
  {
    id: 'memoria', title: 'Memória', icon: '🃏', color: '#FFB23F', ages: '4+',
    how: 'Vire duas cartas por vez e encontre os pares. Cada fase tem mais cartas!',
    medals: [300, 700, 1100], load: () => import('./memoria.js')
  },
  {
    id: 'estrelinha', title: 'Pega-Estrelinha', icon: '⭐', color: '#FFC23D', ages: '3+',
    how: 'Toque nas estrelas antes que elas se escondam. Cuidado com a nuvem de chuva!',
    medals: [120, 280, 450], load: () => import('./estrelinha.js')
  },
  {
    id: 'cores', title: 'Siga as Cores', icon: '🎵', color: '#7B61FF', ages: '4+',
    how: 'Olhe e escute a sequência de cores. Depois toque na mesma ordem. A cada rodada, uma cor a mais!',
    medals: [5, 9, 14], load: () => import('./cores.js')
  },
  {
    id: 'labirinto', title: 'Labirinto do Pipo', icon: '🧭', color: '#51B78F', ages: '5+', tier: 'plus',
    how: 'Deslize para encontrar a saída. Cada fase muda de caminho e recompensa movimentos mais espertos.',
    medals: [300, 700, 1200],
    collectible: { icon: '🗺️', title: 'Mapa Secreto', text: 'Um mapa dobradinho encontrado depois de vencer o primeiro labirinto.' },
    load: () => import('./labirinto.js')
  },
  {
    id: 'constelacoes', title: 'Constelações', icon: '🌌', color: '#5E72D8', ages: '5+', tier: 'plus',
    how: 'Toque nas estrelas na ordem dos números para desenhar constelações no céu.',
    medals: [500, 1000, 1800],
    collectible: { icon: '🔭', title: 'Carta Celeste', text: 'Uma pequena carta do céu com as constelações que vocês encontraram.' },
    load: () => import('./constelacoes.js')
  },
  {
    id: 'ritmo', title: 'Ritmo das Estrelas', icon: '🥁', color: '#A66CF2', ages: '5+', tier: 'plus',
    how: 'Toque na estrela quando o pulso chegar ao centro. Acerte o ritmo e monte uma sequência musical.',
    medals: [600, 1300, 2200],
    collectible: { icon: '🎵', title: 'Sino de Estrelas', text: 'Um sininho que parece tocar baixinho quando o céu está tranquilo.' },
    load: () => import('./ritmo.js')
  },
  {
    id: 'quebracabeca', title: 'Quebra-Cabeça', icon: '🧩', color: '#F28A5B', ages: '5+', tier: 'plus',
    how: 'Deslize as peças para montar a imagem. Quanto menos movimentos, maior a pontuação.',
    medals: [500, 1000, 1700],
    collectible: { icon: '🧩', title: 'Peça Arco-Íris', text: 'Uma peça especial que lembra que cada parte encontra seu lugar.' },
    load: () => import('./quebracabeca.js')
  },
  {
    id: 'robo', title: 'Caminho do Robô', icon: '🤖', color: '#4FB5D8', ages: '6+', tier: 'plus',
    how: 'Monte uma sequência de setas e ajude o robô a chegar até a bateria.',
    medals: [500, 1100, 1900],
    collectible: { icon: '🔋', title: 'Bateria Brilhante', text: 'Uma bateria do robozinho, guardada depois de encontrar o caminho certo.' },
    load: () => import('./robo.js')
  },
  {
    id: 'cozinha', title: 'Cozinha Divertida', icon: '🍳', color: '#F2B84B', ages: '4+', tier: 'plus',
    how: 'Veja a receita e toque nos ingredientes na ordem certa para preparar pratos divertidos.',
    medals: [500, 1100, 1900],
    collectible: { icon: '🥄', title: 'Colher Dourada', text: 'Uma colher de brincadeira para lembrar das receitas feitas em equipe.' },
    load: () => import('./cozinha.js')
  }
];

export const GAME_IDS = GAMES.map((g) => g.id);
export const FREE_GAME_IDS = GAMES.filter((g) => g.tier !== 'plus').map((g) => g.id);
export const PLUS_GAME_IDS = GAMES.filter((g) => g.tier === 'plus').map((g) => g.id);
export const gameById = (id) => GAMES.find((g) => g.id === id) || null;
export const gameRequiresPlus = (id) => gameById(id)?.tier === 'plus';
export function parkTreasures(best = {}) {
  return GAMES.filter((g) => g.collectible && medalOf(g, Number(best[g.id] || 0)) > 0)
    .map((g) => ({ gameId:g.id, ...g.collectible, medal:medalOf(g, Number(best[g.id] || 0)) }));
}

/** 0 = sem medalha, 1 bronze, 2 prata, 3 ouro */
export function medalOf(game, score) {
  const m = game?.medals || [];
  let level = 0;
  m.forEach((min, i) => { if (score >= min) level = i + 1; });
  return level;
}
export const MEDAL_ICON = ['', '🥉', '🥈', '🥇'];
