import { discoveryById } from './adventures.js';

function hash(value=''){
  let h=2166136261;
  for(const ch of String(value)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}
  return h>>>0;
}

export function memoryPlace(memory={}){
  const id=String(memory?.id||'');
  if(id.startsWith('found:')){
    const discovery=discoveryById(id.slice(6));
    if(discovery?.category==='historias')return 'leitura';
    if(discovery?.category==='natureza')return 'jardim';
    if(discovery?.category==='ceu')return 'observatorio';
    if(['tesouros','aventura'].includes(discovery?.category))return 'parque';
    if(discovery?.category==='amizade')return 'colina';
  }
  if(id==='first_adventure'||id==='first_discovery')return 'parque';
  if(id==='first_day'||id.startsWith('level:'))return 'colina';
  return 'colina';
}

export function visibleMemoryFor(placeId,{memories=[],day=''}={}){
  const all=Array.isArray(memories)?memories.filter((m)=>m?.id&&m?.text):[];
  if(!all.length)return null;
  const exact=all.filter((m)=>memoryPlace(m)===placeId);
  const pool=exact.length?exact:(placeId==='colina'?all:[]);
  if(!pool.length)return null;
  return pool[hash(`${day}:${placeId}:memory`)%pool.length]||null;
}

export function memoryWorldAction(memory,placeId='colina'){
  if(!memory)return null;
  const lines={
    colina:'Esse cantinho me fez lembrar disso com carinho.',
    leitura:'Essa lembrança parece uma página da nossa própria história.',
    jardim:'Olhar para este lugar me fez lembrar de quando vivemos isso.',
    observatorio:'Essa lembrança voltou enquanto eu olhava para o céu.',
    parque:'O Parque me fez lembrar de uma conquista que já vivemos.'
  };
  return {
    id:`memory:${memory.id}`,
    objectId:'worldMemoryToken',
    motion:placeId==='colina'?'hug':placeId==='observatorio'?'curious':'proud',
    text:`${memory.icon||'💜'} ${memory.text}. ${lines[placeId]||lines.colina}`,
    burst:[memory.icon||'💜','✨'],
    sceneEffect:{kind:'memory-glow',chars:[memory.icon||'💜','✨'],count:7}
  };
}
