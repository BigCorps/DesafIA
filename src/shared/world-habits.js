import { levelOf } from './progression.js';
import { dominantTrait } from './world-life.js';

function hash(value=''){
  let h=2166136261;
  for(const ch of String(value)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}
  return h>>>0;
}

const HABITS=[
  {
    id:'cuidar-planta',placeId:'jardim',minLevel:5,periods:['dia','tarde'],traits:['caring','curious'],
    objectId:'scenePlant',motion:'wave',
    text:'Vou dar uma olhadinha na plantinha. Gosto de ver como ela está crescendo. 🌱',
    sceneEffect:{kind:'garden-bloom',chars:['🌱','💧','✨'],count:7}
  },
  {
    id:'olhar-arvore',placeId:'jardim',minLevel:5,periods:['dia'],traits:['adventurous','curious'],
    objectId:'sceneTree',motion:'curious',
    text:'Antes de sair daqui, quero ver se apareceu alguma novidade perto da árvore. 🍃',
    sceneEffect:{kind:'garden-bloom',chars:['🍃','✨'],count:6}
  },
  {
    id:'folhear-livros',placeId:'leitura',minLevel:4,periods:['dia','tarde'],traits:['artist','curious'],
    objectId:'sceneBooks',motion:'wiggle',
    text:'Eu gosto de mexer nos livros um pouquinho quando venho aqui. 📚',
    sceneEffect:{kind:'story-pages',chars:['📖','✨'],count:6}
  },
  {
    id:'aconchegar-almofada',placeId:'leitura',minLevel:6,periods:['tarde','noite'],traits:['caring','artist'],
    objectId:'sceneCushion',motion:'hug',
    text:'Essa almofada já virou parte do meu cantinho de leitura. 💜',
    sceneEffect:{kind:'memory-glow',chars:['💜','✨'],count:5}
  },
  {
    id:'olhar-ceu',placeId:'observatorio',minLevel:7,periods:['noite'],traits:['curious','adventurous'],
    objectId:'sceneTelescope',motion:'curious',
    text:'Antes de descansar, eu gosto de procurar uma estrela diferente. 🔭',
    sceneEffect:{kind:'shooting-star',chars:['🌟','✨'],count:1}
  },
  {
    id:'rever-tesouro',placeId:'parque',minLevel:2,periods:['dia','tarde'],traits:['adventurous','curious'],
    objectId:'sceneTreasure',motion:'proud',
    text:'Às vezes eu gosto de rever um Tesouro só para lembrar da conquista. 🏆',
    sceneEffect:{kind:'treasure-glow',chars:['🏆','✨','⭐'],count:7},
    needsTreasure:true
  },
  {
    id:'dancinha-parque',placeId:'parque',minLevel:2,periods:['dia','tarde'],traits:['artist','adventurous'],
    objectId:'sceneRug',motion:'dance',
    text:'Acho que esse cantinho do Parque pede uma dancinha bem curtinha. 🎵',
    sceneEffect:{kind:'park-sparkle',chars:['🎵','✨'],count:7}
  },
  {
    id:'arrumar-cantinho',placeId:'colina',minLevel:1,periods:['dia','tarde'],traits:['caring','artist'],
    objectId:'sceneRug',motion:'proud',
    text:'Eu gosto de deixar nosso cantinho com cara de casa. 💜',
    sceneEffect:{kind:'hill-glow',chars:['💜','✨'],count:6}
  },
  {
    id:'descansar-colina',placeId:'colina',minLevel:1,periods:['noite'],traits:['caring','artist','curious','adventurous'],
    objectId:'sceneRug',motion:'hug',
    text:'Quando fica de noite, eu gosto de voltar para um cantinho tranquilo. 🌙',
    sceneEffect:{kind:'fireflies',chars:['✨','💛'],count:6}
  }
];

export function habitCandidates({xp=0,period='dia',profile={},favorite=null,treasures=[],currentPlace='colina'}={}){
  const level=levelOf(xp),trait=dominantTrait(profile);
  return HABITS
    .filter((h)=>h.placeId===currentPlace&&level>=h.minLevel&&h.periods.includes(period)&&(!h.needsTreasure||treasures.length))
    .map((h)=>({
      ...h,
      score:
        (h.traits.includes(trait)?3:0)+
        (favorite?.id===h.placeId?2:0)+
        (h.needsTreasure&&treasures.length?1:0)
    }))
    .sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
}

export function dailyHabit(input={}){
  const list=habitCandidates(input);
  if(!list.length)return null;
  const top=list[0].score;
  const pool=list.filter((h)=>h.score===top);
  const day=input.day||'';
  return pool[hash(`${day}:${input.period||'dia'}:${input.currentPlace||'colina'}:habit`)%pool.length]||null;
}

export function habitSeenId(day='',period='dia',habit=null){
  return habit?.id?`${day}:${period}:${habit.id}`:'';
}
