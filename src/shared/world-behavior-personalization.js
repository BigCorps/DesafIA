const ROUTINE_BY_PREFERENCE={
  'plant-carer':['plantinha','jardim'],
  'tree-explorer':['arvore'],
  'story-inventor':['leitura'],
  'memory-reader':['leitura','almofada'],
  'comet-chaser':['telescopio'],
  'star-seeker':['telescopio'],
  'achievement-collector':['tesouro'],
  'treasure-storyteller':['tesouro'],
  'cozy-home':['almofada','casinha','tapete'],
  'home-decorator':['casinha','tapete']
};

export function preferredRoutineIds(preference){
  return ROUTINE_BY_PREFERENCE[preference?.id]||[];
}

export function personalizedPlaceEvent(event,preference,petName='Pipo'){
  if(!event||!preference)return event;
  const variants={
    'plant-carer':{
      title:'A plantinha chamou atenção',
      text:`${petName} percebeu primeiro um detalhe novo perto da plantinha. O cuidado dele já muda a forma de olhar o Jardim.`,
      effect:{kind:'garden-bloom',chars:['🌱','💧','🌼','✨'],count:10}
    },
    'tree-explorer':{
      title:'Uma novidade perto da árvore',
      text:`${petName} foi direto reparar num detalhe diferente perto da árvore. Parece que ele sempre procura alguma novidade por ali.`,
      effect:{kind:'garden-bloom',chars:['🍃','🔎','✨'],count:8}
    },
    'story-inventor':{
      title:'Uma página virou ideia',
      text:`${petName} olhou para a história e já começou a imaginar um caminho diferente para ela.`,
      effect:{kind:'story-pages',chars:['📖','✨','💭'],count:8}
    },
    'memory-reader':{
      title:'Uma página puxou uma lembrança',
      text:`${petName} encontrou um detalhe nos livros que fez uma lembrança antiga voltar por um instante.`,
      effect:{kind:'memory-glow',chars:['🔖','💜','✨'],count:7}
    },
    'comet-chaser':{
      title:event.rarity==='rare'?'O céu respondeu à procura':'Um risco de luz diferente',
      text:event.rarity==='rare'
        ? `${petName} estava justamente procurando algo diferente e um cometa acabou cruzando o céu.`
        : `${petName} ficou atento a qualquer risco de luz que pudesse atravessar o céu.`,
      effect:{kind:'shooting-star',chars:[event.rarity==='rare'?'☄️':'✨','🌟'],count:1}
    },
    'star-seeker':{
      title:'Uma estrela escolhida',
      text:`${petName} acabou escolhendo uma luz do céu para observar com mais calma hoje.`,
      effect:{kind:'shooting-star',chars:['🌟','✨'],count:1}
    },
    'achievement-collector':{
      title:'Uma conquista em destaque',
      text:`${petName} reparou no conjunto de conquistas e escolheu uma para rever com orgulho.`,
      effect:{kind:'treasure-glow',chars:[event.icon||'🏆','⭐','✨'],count:9}
    },
    'treasure-storyteller':{
      title:'Um Tesouro trouxe uma história',
      text:`${petName} olhou para um Tesouro e pareceu lembrar mais da história dele do que da conquista em si.`,
      effect:{kind:'treasure-glow',chars:[event.icon||'💫','💜','✨'],count:8}
    },
    'cozy-home':{
      title:'O cantinho ficou ainda mais tranquilo',
      text:`${petName} percebeu esse momento como mais uma chance de ficar perto do cantinho que considera aconchegante.`,
      effect:{kind:event.effect?.kind||'hill-glow',chars:['💜','✨','🏡'],count:7}
    },
    'home-decorator':{
      title:'Um detalhe deixou tudo com cara de casa',
      text:`${petName} reparou em mais um pequeno detalhe que deixa a Colina com jeito de lar.`,
      effect:{kind:'hill-glow',chars:['🏡','✨','💜'],count:7}
    }
  };
  const variant=variants[preference.id];
  return variant?{...event,...variant,preferenceId:preference.id}:event;
}
