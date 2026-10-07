export const ADVENTURES = [
  {
    id: 'arvore_portinha',
    icon: '🌳',
    title: 'A portinha na árvore',
    intro: 'Uma portinha bem pequena apareceu no tronco da árvore. Ela parece ter sido feita para alguém do tamanho de uma joaninha.',
    choices: [
      {
        id: 'bater',
        label: 'Bater de leve na porta',
        result: 'Ninguém respondeu, mas uma borboleta azul saiu voando de uma frestinha e deu três voltas ao nosso redor.',
        motion: 'wave',
        discovery: { id: 'borboleta_azul', icon: '🦋', name: 'Borboleta Azul', description: 'Ela sempre dá três voltinhas quando encontra um novo amigo.', category: 'natureza' }
      },
      {
        id: 'seguir',
        label: 'Seguir as pegadinhas',
        result: 'As pegadinhas levaram até uma bolota com um risquinho brilhante apontando para o jardim.',
        motion: 'march',
        discovery: { id: 'bolota_bussola', icon: '🌰', name: 'Bolota-Bússola', description: 'Uma pequena bolota que parece saber onde ficam os lugares secretos.', category: 'natureza' }
      }
    ]
  },
  {
    id: 'livro_sussurrante',
    icon: '📚',
    title: 'O livro que sussurrou',
    intro: 'Um dos livros começou a fazer “psiu, psiu” bem baixinho. Quando abrimos, duas páginas estavam brilhando.',
    choices: [
      {
        id: 'pagina_dourada',
        label: 'Abrir a página dourada',
        result: 'Um marcador dourado pulou do livro e ficou flutuando como se tivesse encontrado sua história favorita.',
        motion: 'proud',
        discovery: { id: 'marcador_dourado', icon: '🔖', name: 'Marcador Dourado', description: 'Ele gosta de guardar o lugar das histórias que queremos continuar.', category: 'historias' }
      },
      {
        id: 'pagina_desenhada',
        label: 'Abrir a página desenhada',
        result: 'Um pequeno dragão de papel dobrou as asas, espirrou uma estrelinha e pousou perto do livro.',
        motion: 'twirl',
        discovery: { id: 'dragao_papel', icon: '🐉', name: 'Dragão de Papel', description: 'Um dragão minúsculo que prefere histórias a tesouros.', category: 'historias' }
      }
    ]
  },
  {
    id: 'jardim_gotas',
    icon: '🪴',
    title: 'As gotas do jardim',
    intro: 'A plantinha estava coberta de gotinhas brilhantes. Duas delas começaram a se mexer como se quisessem mostrar alguma coisa.',
    choices: [
      {
        id: 'folha',
        label: 'Olhar embaixo da folha',
        result: 'Uma joaninha estava cochilando ali, toda enroladinha. Ela acordou, acenou e voltou a dormir.',
        motion: 'hug',
        discovery: { id: 'joaninha_soneca', icon: '🐞', name: 'Joaninha Soneca', description: 'Ela conhece os cantinhos mais tranquilos do jardim.', category: 'natureza' }
      },
      {
        id: 'terra',
        label: 'Chegar perto da terra',
        result: 'Uma sementinha fez “plim!” e soltou uma notinha musical tão pequena quanto ela.',
        motion: 'dance',
        discovery: { id: 'semente_cantora', icon: '🌱', name: 'Semente Cantora', description: 'Ela canta baixinho enquanto cria coragem para crescer.', category: 'natureza' }
      }
    ]
  },
  {
    id: 'telescopio_luzes',
    icon: '🔭',
    title: 'Uma luz no telescópio',
    intro: 'Hoje o céu parece diferente. Pelo telescópio, duas luzinhas estão piscando como se quisessem chamar nossa atenção.',
    choices: [
      {
        id: 'luz_rapida',
        label: 'Seguir a luz mais rápida',
        result: 'Era um cometinha fazendo uma curva enorme no céu. Antes de sumir, ele deixou um brilho em forma de estrela.',
        motion: 'twirl',
        discovery: { id: 'cometa_mirim', icon: '☄️', name: 'Cometa Mirim', description: 'Pequeno, veloz e sempre procurando uma nova volta para dar.', category: 'ceu' }
      },
      {
        id: 'luz_calma',
        label: 'Seguir a luz mais calma',
        result: 'A luz formou a silhueta de um coelhinho na Lua. Parecia que ele estava dando tchau para nós.',
        motion: 'wave',
        discovery: { id: 'coelho_lunar', icon: '🐇', name: 'Coelho Lunar', description: 'Uma constelação que só aparece para exploradores pacientes.', category: 'ceu' }
      }
    ]
  },
  {
    id: 'vento_dancante',
    icon: '🍃',
    title: 'O vento dançante',
    intro: 'Uma rajadinha passou pelo mundo e fez tudo balançar. Duas coisas coloridas vieram voando com ela.',
    choices: [
      {
        id: 'pena',
        label: 'Pegar a peninha',
        result: 'A pena fez uma espiral no ar e pousou bem devagar. Quando mexemos nela, o vento parece fazer cócegas.',
        motion: 'giggle',
        discovery: { id: 'pena_espiral', icon: '🪶', name: 'Pena Espiral', description: 'Ela nunca cai em linha reta: prefere dançar até o chão.', category: 'aventura' }
      },
      {
        id: 'fita',
        label: 'Pegar a fita colorida',
        result: 'Era a ponta de uma pipa que passou lá no alto. A fita ficou dançando no ar mesmo quando o vento parou.',
        motion: 'dance',
        discovery: { id: 'fita_de_pipa', icon: '🎏', name: 'Fita de Pipa', description: 'Uma lembrança de que o céu também pode ser lugar de brincadeira.', category: 'aventura' }
      }
    ]
  },
  {
    id: 'ponte_nuvens',
    icon: '🌈',
    title: 'A ponte depois da chuva',
    intro: 'Depois de uma chuvinha apareceu uma ponte de cores bem fraquinha. Perto dela há um brilho no chão e uma nuvem engraçada no céu.',
    choices: [
      {
        id: 'nuvem',
        label: 'Observar a nuvem',
        result: 'A nuvem tomou a forma de um peixinho e começou a “nadar” pelo céu antes de virar nuvem de novo.',
        motion: 'curious',
        discovery: { id: 'peixe_nuvem', icon: '🐟', name: 'Peixe-Nuvem', description: 'Um peixe que nada no céu e muda de forma quando quer.', category: 'ceu' }
      },
      {
        id: 'brilho',
        label: 'Investigar o brilho',
        result: 'Era uma pedrinha com várias cores. Quando viramos de lado, ela parece guardar um pedacinho do arco-íris.',
        motion: 'proud',
        discovery: { id: 'pedra_arco_iris', icon: '💎', name: 'Pedra Arco-Íris', description: 'Uma pedrinha que muda de cor dependendo de como olhamos.', category: 'tesouros' }
      }
    ]
  },
  {
    id: 'trilha_luzes',
    icon: '✨',
    title: 'A trilha de luzinhas',
    intro: 'Pequenos pontos luminosos apareceram perto do jardim. Alguns voam, outros parecem estar escondidos entre as folhas.',
    choices: [
      {
        id: 'voando',
        label: 'Seguir as luzes que voam',
        result: 'Uma delas parou na nossa frente: era um vagalume tão brilhante que parecia carregar uma lanterninha.',
        motion: 'wave',
        discovery: { id: 'vagalume_lanterna', icon: '💡', name: 'Vagalume-Lanterna', description: 'Ele ilumina só o necessário para ninguém se perder no caminho.', category: 'natureza' }
      },
      {
        id: 'folhas',
        label: 'Olhar entre as folhas',
        result: 'Encontramos uma folhinha prateada. Ela guarda luz durante o dia e solta um brilho fraquinho à noite.',
        motion: 'curious',
        discovery: { id: 'folha_prateada', icon: '🍂', name: 'Folha Prateada', description: 'Uma folha que prefere brilhar baixinho, sem chamar muita atenção.', category: 'tesouros' }
      }
    ]
  },
  {
    id: 'piquenique_estrelas',
    icon: '🧺',
    title: 'O piquenique surpresa',
    intro: 'Uma toalhinha apareceu no gramado. Em cima dela há uma frutinha diferente e um copinho feito de folha.',
    choices: [
      {
        id: 'frutinha',
        label: 'Examinar a frutinha',
        result: 'Ela tem o desenho de uma estrela no meio. Não vamos comer sem conhecer, mas podemos guardar o desenho no álbum.',
        motion: 'proud',
        discovery: { id: 'fruta_estrela', icon: '⭐', name: 'Fruta-Estrela', description: 'Uma fruta misteriosa do mundo do companheiro, conhecida pelo desenho de estrela.', category: 'tesouros' }
      },
      {
        id: 'copinho',
        label: 'Olhar o copinho de folha',
        result: 'Dentro havia duas gotinhas lado a lado. O companheiro encostou o copinho no nosso e fez um brinde imaginário.',
        motion: 'highfive',
        discovery: { id: 'copo_amizade', icon: '🥤', name: 'Copo da Amizade', description: 'Um copinho de folha para lembrar das conquistas feitas em companhia.', category: 'amizade' }
      }
    ]
  }
];

export const DISCOVERIES = ADVENTURES.flatMap((adventure) =>
  adventure.choices.map((choice) => ({
    ...choice.discovery,
    adventureId: adventure.id,
    adventureTitle: adventure.title
  }))
);

export function findAdventure(id) {
  return ADVENTURES.find((adventure) => adventure.id === id) || null;
}

export function findAdventureChoice(adventureId, choiceId) {
  return findAdventure(adventureId)?.choices.find((choice) => choice.id === choiceId) || null;
}

export function discoveryById(id) {
  return DISCOVERIES.find((discovery) => discovery.id === id) || null;
}

function hashDay(day = '') {
  return [...String(day)].reduce((hash, char) => ((hash * 31) + char.charCodeAt(0)) >>> 0, 2166136261);
}

export function adventureForDay(day, discovered = []) {
  const seen = new Set(discovered.map((item) => typeof item === 'string' ? item : item?.id).filter(Boolean));
  const unfinished = ADVENTURES.filter((adventure) =>
    adventure.choices.some((choice) => !seen.has(choice.discovery.id))
  );
  const pool = unfinished.length ? unfinished : ADVENTURES;
  return pool[hashDay(day) % pool.length] || ADVENTURES[0];
}

export function collectedDiscoveries(discovered = []) {
  const found = new Map(discovered.map((item) => [typeof item === 'string' ? item : item?.id, item]));
  return DISCOVERIES.filter((item) => found.has(item.id)).map((item) => ({
    ...item,
    foundAt: found.get(item.id)?.first_found_at || found.get(item.id)?.found_at || null
  }));
}
