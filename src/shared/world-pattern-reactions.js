export function patternReaction(pattern,habit,petName='Pipo'){
  if(!pattern||!habit)return null;
  const map={
    'sky-watcher':{
      motion:'curious',
      text:`${petName} já reconhece esse momento. Ele gosta de parar um pouquinho para olhar o céu. 🔭✨`,
      sceneEffect:{kind:'shooting-star',chars:['🌟','✨'],count:1},
      burst:['🔭','🌟','✨']
    },
    'garden-keeper':{
      motion:'wave',
      text:`${petName} parece saber exatamente o que fazer aqui. Cuidar do Jardim já virou um jeitinho dele. 🌱💧`,
      sceneEffect:{kind:'garden-bloom',chars:['🌱','💧','🌼','✨'],count:10},
      burst:['🌱','💧','✨']
    },
    'story-seeker':{
      motion:'wiggle',
      text:`${petName} já entra aqui procurando uma história. Esse cantinho está ficando bem a cara dele. 📚✨`,
      sceneEffect:{kind:'story-pages',chars:['📖','🔖','✨'],count:9},
      burst:['📚','📖','✨']
    },
    'treasure-keeper':{
      motion:'proud',
      text:`${petName} gosta de rever as conquistas de vocês. Os Tesouros já fazem parte da história dele. 🏆✨`,
      sceneEffect:{kind:'treasure-glow',chars:['🏆','⭐','✨'],count:10},
      burst:['🏆','⭐','✨']
    },
    'home-lover':{
      motion:'hug',
      text:`${petName} conhece esse cantinho de cor. Voltar para cá já parece parte da rotina dele. 💜🏡`,
      sceneEffect:{kind:'memory-glow',chars:['💜','🏡','✨'],count:8},
      burst:['💜','🏡','✨']
    }
  };
  const reaction=map[pattern.id];
  if(!reaction)return null;
  return {
    id:`pattern-reaction:${pattern.id}`,
    patternId:pattern.id,
    objectId:habit.objectId,
    ...reaction
  };
}
