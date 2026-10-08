export function personalizedPlaceArrival(place,preference,petName='Pipo'){
  if(!place)return '';
  if(!preference)return place.speech||'';
  const lines={
    'plant-carer':`${petName} chegou querendo conferir primeiro como a plantinha está. 🌱💧`,
    'tree-explorer':`${petName} já entrou olhando para a árvore para ver se apareceu alguma novidade. 🍃🔎`,
    'story-inventor':`${petName} chegou pensando em inventar uma história nova por aqui. 📚✨`,
    'memory-reader':`${petName} entrou lembrando das histórias que vocês já viveram juntos. 🔖💜`,
    'comet-chaser':`${petName} já chegou procurando algum risco de luz diferente no céu. ☄️🔭`,
    'star-seeker':`${petName} quer escolher uma estrela para observar com calma hoje. 🌟🔭`,
    'achievement-collector':`${petName} chegou querendo olhar quantas conquistas vocês já juntaram. 🏆⭐`,
    'treasure-storyteller':`${petName} quer escolher um Tesouro e lembrar da história por trás dele. 💫🏆`,
    'cozy-home':`${petName} voltou para o cantinho onde mais gosta de ficar tranquilo. 💜🏡`,
    'home-decorator':`${petName} chegou reparando nos detalhes que deixam este lugar com cara de casa. 🏡✨`
  };
  return lines[preference.id]||place.speech||'';
}

export function personalizedPlaceShort(place,preference){
  if(!place)return '';
  if(!preference)return place.short||'';
  const lines={
    'plant-carer':'O cantinho onde ele gosta de cuidar da plantinha.',
    'tree-explorer':'Onde ele prefere procurar novidades perto da árvore.',
    'story-inventor':'Um lugar que faz o Pipo querer inventar histórias.',
    'memory-reader':'Onde livros e lembranças acabam se encontrando.',
    'comet-chaser':'O lugar onde ele procura riscos de luz no céu.',
    'star-seeker':'Onde ele gosta de escolher uma estrela para observar.',
    'achievement-collector':'O lugar onde ele gosta de rever as conquistas.',
    'treasure-storyteller':'Onde cada Tesouro lembra uma história diferente.',
    'cozy-home':'O cantinho para onde ele volta quando quer aconchego.',
    'home-decorator':'Onde ele gosta de deixar tudo com cara de casa.'
  };
  return lines[preference.id]||place.short||'';
}
