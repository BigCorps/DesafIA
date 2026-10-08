export function preferredPlaceAction(action,preference,petName='Pipo'){
  if(!action||!preference)return action;
  const variants={
    'plant-carer':{
      icon:'🌱',label:'Cuidar da plantinha',objectId:'scenePlant',
      text:`${petName} quer conferir primeiro como a plantinha está crescendo. 🌱💧`,
      motion:'wave',burst:['🌱','💧','✨'],
      sceneEffect:{kind:'garden-bloom',chars:['🌱','💧','🌼','✨'],count:10}
    },
    'tree-explorer':{
      icon:'🍃',label:'Procurar novidades',objectId:'sceneTree',
      text:`${petName} prefere olhar se apareceu alguma novidade perto da árvore. 🍃🔎`,
      motion:'curious',burst:['🍃','🔎','✨'],
      sceneEffect:{kind:'garden-bloom',chars:['🍃','✨'],count:8}
    },
    'story-inventor':{
      icon:'✨',label:'Inventar história',objectId:'sceneBooks',
      text:`${petName} abriu os livros e já começou a imaginar uma história nova. 📚✨`,
      motion:'wiggle',burst:['📚','✨','💭'],
      sceneEffect:{kind:'story-pages',chars:['📖','✨','⭐'],count:9}
    },
    'memory-reader':{
      icon:'🔖',label:'Relembrar história',objectId:'sceneBooks',
      text:`${petName} quer folhear os livros pensando nas histórias que vocês já viveram. 🔖💜`,
      motion:'hug',burst:['🔖','💜','✨'],
      sceneEffect:{kind:'memory-glow',chars:['🔖','💜','✨'],count:7}
    },
    'comet-chaser':{
      icon:'☄️',label:'Procurar cometa',objectId:'sceneTelescope',
      text:`${petName} quer procurar algum risco de luz diferente cruzando o céu. ☄️🔭`,
      motion:'curious',burst:['☄️','🌟','✨'],
      sceneEffect:{kind:'shooting-star',chars:['☄️','✨'],count:1}
    },
    'star-seeker':{
      icon:'🌟',label:'Escolher uma estrela',objectId:'sceneTelescope',
      text:`${petName} quer escolher uma estrela e observar com calma. 🌟🔭`,
      motion:'curious',burst:['🌟','🔭','✨'],
      sceneEffect:{kind:'shooting-star',chars:['🌟','✨'],count:1}
    },
    'achievement-collector':{
      icon:'🏆',label:'Rever conquistas',
      text:`${petName} quer olhar os Tesouros juntos e lembrar de tudo o que vocês já conquistaram. 🏆⭐`,
      motion:'proud',burst:['🏆','⭐','✨']
    },
    'treasure-storyteller':{
      icon:'💫',label:'Lembrar um Tesouro',
      text:`${petName} quer escolher um Tesouro e lembrar da história por trás dele. 💫🏆`,
      motion:'proud',burst:['💫','🏆','✨']
    },
    'cozy-home':{
      icon:'💜',label:'Ficar aconchegado',objectId:'sceneRug',
      text:`${petName} quer ficar um pouquinho no cantinho mais aconchegante. 💜`,
      motion:'hug',burst:['💜','✨','🏡'],
      sceneEffect:{kind:'fireflies',chars:['✨','💛'],count:6}
    },
    'home-decorator':{
      icon:'🏡',label:'Cuidar do cantinho',objectId:'sceneRug',
      text:`${petName} quer dar atenção aos detalhes que deixam este lugar com cara de casa. 🏡✨`,
      motion:'proud',burst:['🏡','✨','💜'],
      sceneEffect:{kind:'hill-glow',chars:['🏡','✨','💜'],count:7}
    }
  };
  const variant=variants[preference.id];
  return variant?{...action,...variant,preferenceId:preference.id}:action;
}

export function personalizedWorldMoment(moment,{pattern=null,preference=null,petName='Pipo'}={}){
  if(!moment||!pattern)return moment;
  if(preference){
    return {
      ...moment,
      icon:preference.icon||moment.icon,
      title:`${pattern.title} · ${preference.label}`,
      text:`${petName} está deixando esse jeitinho aparecer cada vez mais no mundo. ${preference.text}`
    };
  }
  return {
    ...moment,
    icon:pattern.icon||moment.icon,
    title:pattern.title,
    text:`${moment.text} Esse costume já está começando a ficar com a cara do ${petName}.`
  };
}
