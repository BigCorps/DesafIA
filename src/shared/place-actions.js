import { dominantTrait } from './world-life.js';

const STORY_BITS=[
  'Era uma vez uma sementinha que queria conversar com a Lua. 🌱🌙',
  'Um dragão de papel descobriu que coragem também pode ser bem quietinha. 🐉📚',
  'Uma estrela caiu num jardim e pediu ajuda para voltar ao céu. ⭐🌻'
];
const STAR_BITS=[
  'Achei uma estrela que pisca devagarinho. ✨',
  'Olha! Duas estrelinhas parecem estar conversando. ⭐⭐',
  'Tem uma luz bem pequena ali. Vamos chamar de Estrela do Pipo! 🌟'
];

export function placeActionFor(placeId,{profile={},treasures=[],period='dia',index=0}={}){
  const trait=dominantTrait(profile);
  const pick=(list)=>list[Math.abs(Number(index)||0)%list.length];

  if(placeId==='jardim')return{
    id:'regar-jardim',icon:'💧',label:'Cuidar do jardim',objectId:'scenePlant',
    motion:trait==='caring'?'hug':'wave',
    burst:['💧','🌱','✨'],
    text:trait==='curious'?'Será que cresceu alguma folhinha nova? Vou olhar bem de pertinho! 🌱':'Um pouquinho de cuidado deixa o jardim ainda mais feliz. 💧🌻'
  };

  if(placeId==='leitura')return{
    id:'imaginar-historia',icon:'📖',label:'Imaginar história',objectId:'sceneBooks',
    motion:trait==='artist'?'dance':'wiggle',
    burst:['📖','✨','💜'],
    text:pick(STORY_BITS)
  };

  if(placeId==='observatorio')return{
    id:'procurar-estrela',icon:'🌟',label:'Procurar estrela',objectId:'sceneTelescope',
    motion:'curious',burst:['⭐','✨','🌙'],
    text:pick(STAR_BITS)
  };

  if(placeId==='parque'){
    const treasure=treasures.at(-1);
    return treasure?{
      id:'rever-tesouro',icon:treasure.icon||'🏆',label:'Rever tesouro',objectId:'sceneTreasure',
      motion:'proud',burst:[treasure.icon||'🏆','✨','💜'],
      text:`Esse ${treasure.title} lembra uma conquista nossa. Eu gosto de olhar para ele! ${treasure.icon||''}`
    }:{
      id:'brincar-parque',icon:'🎵',label:'Brincar no Parque',objectId:'sceneRug',
      motion:'dance',burst:['🎵','✨','⭐'],
      text:'Enquanto nosso primeiro tesouro não chega, dá para inventar uma dancinha por aqui! 🎵'
    };
  }

  return{
    id:'curtir-colina',icon:period==='noite'?'🌙':'💜',label:period==='noite'?'Descansar um pouco':'Brincar no cantinho',
    objectId:'sceneRug',motion:period==='noite'?'hug':trait==='artist'?'dance':'proud',
    burst:period==='noite'?['🌙','💜','✨']:['💜','✨','🌈'],
    text:period==='noite'?'Esse cantinho está tão tranquilo. Vou descansar só um pouquinho. 🌙':'Gosto de voltar para o nosso cantinho. Ele já tem um pouco da nossa história! 💜'
  };
}
