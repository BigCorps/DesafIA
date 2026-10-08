import { memoryPlace } from './world-memory.js';

const traitPoints=(profile,id)=>Math.max(0,Number(profile?.traits?.find((t)=>t.id===id)?.points)||0);
const actionCount=(profile,id)=>Math.max(0,Number(profile?.actions?.[id])||0);
const memoriesFor=(profile,place)=>Array.isArray(profile?.memories)?profile.memories.filter((m)=>memoryPlace(m)===place):[];

function winner(options=[]){
  const ranked=[...options].sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
  if(!ranked[0]||ranked[0].score<2)return null;
  if(ranked[1]&&ranked[0].score===ranked[1].score)return null;
  const {score,...preference}=ranked[0];
  return preference;
}

export function patternPreference(pattern,{profile={},treasures=[]}={}){
  if(!pattern?.id)return null;
  const placeMemories=memoriesFor(profile,pattern.placeId);

  if(pattern.id==='sky-watcher'){
    const cometMemories=placeMemories.filter((m)=>/cometa/i.test(String(m.id||'')+' '+String(m.text||''))).length;
    return winner([
      {id:'comet-chaser',icon:'☄️',label:'Caçador de cometas',text:'O Pipo presta atenção especial quando algo diferente cruza o céu.',score:cometMemories*4+traitPoints(profile,'adventurous')},
      {id:'star-seeker',icon:'🌟',label:'Procurador de estrelas',text:'O Pipo gosta de escolher uma estrela e observar com calma.',score:actionCount(profile,'sceneTelescope')+traitPoints(profile,'curious')}
    ]);
  }

  if(pattern.id==='garden-keeper'){
    return winner([
      {id:'plant-carer',icon:'🌱',label:'Cuida da plantinha',text:'Ele costuma conferir primeiro como a plantinha está crescendo.',score:actionCount(profile,'scenePlant')*2+traitPoints(profile,'caring')},
      {id:'tree-explorer',icon:'🍃',label:'Explora a árvore',text:'Ele prefere procurar pequenas novidades perto da árvore.',score:actionCount(profile,'sceneTree')*2+traitPoints(profile,'curious')+traitPoints(profile,'adventurous')}
    ]);
  }

  if(pattern.id==='story-seeker'){
    return winner([
      {id:'story-inventor',icon:'✨',label:'Inventa histórias',text:'O Pipo gosta de transformar livros em novas histórias na cabeça.',score:actionCount(profile,'sceneBooks')+traitPoints(profile,'artist')*2},
      {id:'memory-reader',icon:'🔖',label:'Relembra histórias',text:'Ele costuma ligar os livros às lembranças que vocês já viveram.',score:placeMemories.length*3+traitPoints(profile,'curious')}
    ]);
  }

  if(pattern.id==='treasure-keeper'){
    return winner([
      {id:'achievement-collector',icon:'🏆',label:'Coleciona conquistas',text:'O Pipo gosta de olhar o conjunto de Tesouros que vocês conquistaram.',score:(Array.isArray(treasures)?treasures.length:0)*2+traitPoints(profile,'adventurous')},
      {id:'treasure-storyteller',icon:'💫',label:'Revê as histórias dos Tesouros',text:'Para ele, cada Tesouro vale mais pela história que lembra.',score:placeMemories.length*3+traitPoints(profile,'curious')}
    ]);
  }

  if(pattern.id==='home-lover'){
    return winner([
      {id:'cozy-home',icon:'💜',label:'Procura aconchego',text:'O Pipo gosta de voltar ao cantinho para ficar tranquilo e perto de vocês.',score:actionCount(profile,'hug')*2+traitPoints(profile,'caring')},
      {id:'home-decorator',icon:'🏡',label:'Cuida do cantinho',text:'Ele presta atenção nos pequenos detalhes que deixam a Colina com cara de casa.',score:actionCount(profile,'highfive')+traitPoints(profile,'artist')*2+placeMemories.length}
    ]);
  }

  return null;
}

export function patternPreferences(patterns=[],input={}){
  return patterns.map((pattern)=>({
    pattern,
    preference:patternPreference(pattern,input)
  }));
}

export function preferredPatternReaction(reaction,preference,petName='Pipo'){
  if(!reaction||!preference)return reaction;
  const variants={
    'comet-chaser':{text:`${petName} sempre procura primeiro se tem algum risco de luz cruzando o céu. ☄️`,burst:['☄️','✨','🌟']},
    'star-seeker':{text:`${petName} escolheu uma estrela para observar com calma hoje. 🌟🔭`,burst:['🌟','🔭','✨']},
    'plant-carer':{text:`${petName} foi direto conferir a plantinha. Esse cuidado já é bem a cara dele. 🌱💧`,burst:['🌱','💧','✨']},
    'tree-explorer':{text:`${petName} foi procurar novidades perto da árvore antes de qualquer coisa. 🍃🔎`,burst:['🍃','🔎','✨']},
    'story-inventor':{text:`${petName} abriu os livros e já começou a inventar outra história na cabeça. 📚✨`,burst:['📚','✨','💭']},
    'memory-reader':{text:`${petName} mexeu nos livros e acabou lembrando de uma história que vocês já viveram. 🔖💜`,burst:['🔖','💜','✨']},
    'achievement-collector':{text:`${petName} gosta de olhar os Tesouros juntos e perceber quanta coisa vocês já conquistaram. 🏆⭐`,burst:['🏆','⭐','✨']},
    'treasure-storyteller':{text:`${petName} escolheu um Tesouro para lembrar da história por trás dele. 💫🏆`,burst:['💫','🏆','✨']},
    'cozy-home':{text:`${petName} voltou para o cantinho mais aconchegante e ficou tranquilo por ali. 💜`,burst:['💜','✨','🏡']},
    'home-decorator':{text:`${petName} reparou nos detalhes do cantinho como quem gosta de deixar tudo com cara de casa. 🏡✨`,burst:['🏡','✨','💜']}
  };
  const variant=variants[preference.id];
  return variant?{...reaction,...variant,preferenceId:preference.id}:reaction;
}
