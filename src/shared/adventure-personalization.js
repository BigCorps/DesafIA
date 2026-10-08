export function adventurePreference(patterns=[],preferenceFor=()=>null){
  for(const pattern of patterns){
    const preference=preferenceFor(pattern);
    if(preference)return {pattern,preference};
  }
  return {pattern:patterns[0]||null,preference:null};
}

export function personalizedAdventureIntro(adventure,{preference=null,petName='Pipo'}={}){
  if(!adventure)return '';
  const lines={
    'plant-carer':petName+' reparou primeiro nos detalhes de cuidado dessa aventura. ',
    'tree-explorer':petName+' já está procurando alguma novidade escondida pelo caminho. ',
    'story-inventor':petName+' acha que essa aventura tem cara de história que ainda pode surpreender. ',
    'memory-reader':petName+' ficou com a sensação de que essa aventura pode lembrar alguma coisa importante. ',
    'comet-chaser':petName+' está atento a qualquer coisa rápida ou inesperada que apareça. ',
    'star-seeker':petName+' quer observar com calma antes de escolher o caminho. ',
    'achievement-collector':petName+' ficou curioso para descobrir o que vocês vão conquistar juntos aqui. ',
    'treasure-storyteller':petName+' está mais interessado na história que essa aventura vai deixar. ',
    'cozy-home':petName+' parece tranquilo para explorar no ritmo de vocês. ',
    'home-decorator':petName+' já está reparando nos pequenos detalhes desse lugar. '
  };
  return ((lines[preference?.id]||'')+(adventure.intro||'')).trim();
}

export function personalizedAdventureResult(choice,{preference=null,petName='Pipo'}={}){
  if(!choice)return '';
  const category=choice.discovery?.category||'';
  const suffix={
    'plant-carer':category==='natureza'?' '+petName+' gostou especialmente de perceber esse detalhe da natureza.':'',
    'tree-explorer':category==='natureza'?' '+petName+' parece feliz por ter encontrado algo novo escondido pelo caminho.':'',
    'story-inventor':category==='historias'?' '+petName+' já está imaginando o que poderia acontecer depois dessa descoberta.':'',
    'memory-reader':' '+petName+' parece querer guardar esse momento como mais uma página da história de vocês.',
    'comet-chaser':category==='ceu'?' '+petName+' ficou ainda mais atento porque essa descoberta veio do céu.':'',
    'star-seeker':category==='ceu'?' '+petName+' quis observar essa descoberta por mais um instante.':'',
    'achievement-collector':category==='tesouros'?' '+petName+' olhou para a descoberta com aquele orgulho de conquista.':'',
    'treasure-storyteller':category==='tesouros'?' '+petName+' parece gostar mais da história dessa descoberta do que de possuir o objeto.':'',
    'cozy-home':category==='amizade'?' '+petName+' parece ter gostado especialmente da parte vivida juntos.':'',
    'home-decorator':category==='amizade'?' '+petName+' achou que essa descoberta combina com as coisas que deixam o mundo com cara de casa.':''
  };
  return ((choice.result||'')+(suffix[preference?.id]||'')).trim();
}