import { dominantTrait } from './world-life.js';

function hashText(value=''){
  let h=2166136261;
  for(const ch of String(value)){
    h^=ch.charCodeAt(0);
    h=Math.imul(h,16777619);
  }
  return h>>>0;
}
function pick(seed,list){return list[seed%list.length]}
function count(actions,key){return Math.max(0,Number(actions?.[key])||0)}

export function placeDayKey(snapshot={}){
  return snapshot?.adventure?.day || snapshot?.dailyBonusDay || snapshot?.day || new Date().toISOString().slice(0,10);
}

export function placeDailyEvent(placeId,{
  day='',
  period='dia',
  profile={},
  treasures=[],
  actions={},
  memories=[]
}={}){
  const seed=hashText(`${day}:${placeId}`);
  const trait=dominantTrait(profile);
  const memory=memories.at(-1) || profile?.memories?.at?.(-1) || null;

  if(placeId==='jardim'){
    const care=count(actions,'scenePlant');
    if(care>=5)return{
      id:'jardim-cresceu',icon:'🌼',title:'O jardim respondeu ao cuidado',
      text:'Tem mais florzinhas aparecendo por aqui. O cuidado de vocês ficou visível no cantinho.',
      objectId:'scenePlant',effect:{kind:'garden-bloom',chars:['🌼','🌱','✨'],count:12},rarity:'progress'
    };
    return{
      id:'jardim-visita',icon:trait==='caring'?'🐞':'🦋',title:'Uma visita no jardim',
      text:trait==='caring'?'Uma joaninha resolveu descansar perto da plantinha.':'Uma borboleta passou voando bem perto das flores.',
      objectId:'scenePlant',effect:{kind:'garden-bloom',chars:[trait==='caring'?'🐞':'🦋','🌼','✨'],count:8},rarity:'common'
    };
  }

  if(placeId==='leitura'){
    if(memory)return{
      id:'leitura-memoria',icon:memory.icon||'📖',title:'Uma história conhecida',
      text:`Uma página fez o Pipo lembrar: “${memory.text||'uma coisa especial que vocês viveram juntos.'}”`,
      objectId:'sceneBooks',effect:{kind:'story-pages',chars:['📖','✨',memory.icon||'💜'],count:7},rarity:'memory'
    };
    return{
      id:'leitura-pagina',icon:'📜',title:'Uma página diferente',
      text:pick(seed,[
        'Hoje apareceu uma página sobre coragem de tentar de novo.',
        'Uma ilustração escondida parece mudar quando a gente olha com calma.',
        'Tem uma história curta sobre ajudar alguém sem esperar prêmio.'
      ]),
      objectId:'sceneBooks',effect:{kind:'story-pages',chars:['📖','📜','✨'],count:7},rarity:'common'
    };
  }

  if(placeId==='observatorio'){
    const rare=seed%5===0;
    return rare?{
      id:'observatorio-cometa',icon:'☄️',title:'Um cometa raro!',
      text:'Um cometa cruzou o céu hoje. Ele não dá prêmio — só virou uma lembrança bonita de observar.',
      objectId:'sceneTelescope',effect:{kind:'shooting-star',chars:['☄️','✨'],count:1},rarity:'rare'
    }:{
      id:'observatorio-ceu',icon:'🌟',title:'O céu de hoje',
      text:pick(seed,[
        'Uma estrela parece mais brilhante que as outras esta noite.',
        'Duas luzinhas ficaram bem próximas no céu.',
        'A Lua deixou o céu com um brilho diferente por alguns instantes.'
      ]),
      objectId:'sceneTelescope',effect:{kind:'shooting-star',chars:['🌟','✨'],count:1},rarity:'common'
    };
  }

  if(placeId==='parque'){
    const treasure=treasures.length?treasures[seed%treasures.length]:null;
    if(treasure)return{
      id:`parque-${treasure.gameId||'tesouro'}`,icon:treasure.icon||'🏆',title:'Tesouro em destaque',
      text:`Hoje o ${treasure.title} ficou em evidência no Parque. Ele lembra uma conquista que já aconteceu.`,
      objectId:'sceneTreasure',effect:{kind:'treasure-glow',chars:[treasure.icon||'🏆','⭐','✨'],count:9},rarity:'treasure'
    };
    return{
      id:'parque-brisa',icon:'🪁',title:'Uma brisa no Parque',
      text:'Uma brisa passou pelo Parque e pareceu perfeita para uma brincadeira inventada.',
      objectId:'sceneRug',effect:{kind:'park-sparkle',chars:['🪁','🎵','✨'],count:8},rarity:'common'
    };
  }

  if(period==='noite')return{
    id:'colina-vagalumes',icon:'✨',title:'Vaga-lumes na Colina',
    text:'Alguns pontinhos de luz apareceram perto do cantinho do Pipo.',
    objectId:'sceneRug',effect:{kind:'fireflies',chars:['✨','💛'],count:8},rarity:'common'
  };
  return{
    id:'colina-momento',icon:period==='tarde'?'🌤️':'☀️',title:period==='tarde'?'Luz de fim de tarde':'Começo tranquilo',
    text:period==='tarde'?'A luz deixou a Colina com outro tom por alguns minutos.':'A Colina está calma, pronta para mais um pedacinho da história de vocês.',
    objectId:'sceneRug',effect:{kind:'hill-glow',chars:['✨','💜','🌈'],count:7},rarity:'common'
  };
}

export function shouldAutoShowPlaceEvent(placeId,day=''){
  return hashText(`show:${day}:${placeId}`)%3!==0;
}
