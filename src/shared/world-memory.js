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

function preferenceMemoryPool(pool,preference){
  if(!preference?.id||pool.length<2)return pool;
  if(preference.id==='comet-chaser'){
    const comet=pool.filter((m)=>/cometa/i.test(String(m.id||'')+' '+String(m.text||'')));
    return comet.length?comet:pool;
  }
  if(preference.id==='star-seeker'){
    const stars=pool.filter((m)=>!/cometa/i.test(String(m.id||'')+' '+String(m.text||'')));
    return stars.length?stars:pool;
  }
  if(preference.id==='memory-reader'){
    return [...pool].reverse();
  }
  return pool;
}

export function visibleMemoryFor(placeId,{memories=[],day='',preference=null}={}){
  const all=Array.isArray(memories)?memories.filter((m)=>m?.id&&m?.text):[];
  if(!all.length)return null;
  const exact=all.filter((m)=>memoryPlace(m)===placeId);
  const basePool=exact.length?exact:(placeId==='colina'?all:[]);
  if(!basePool.length)return null;
  const pool=preferenceMemoryPool(basePool,preference);
  return pool[hash(`${day}:${placeId}:${preference?.id||'base'}:memory`)%pool.length]||null;
}

export function memoryWorldAction(memory,placeId='colina',preference=null,petName='Pipo'){
  if(!memory)return null;
  const lines={
    colina:'Esse cantinho me fez lembrar disso com carinho.',
    leitura:'Essa lembrança parece uma página da nossa própria história.',
    jardim:'Olhar para este lugar me fez lembrar de quando vivemos isso.',
    observatorio:'Essa lembrança voltou enquanto eu olhava para o céu.',
    parque:'O Parque me fez lembrar de uma conquista que já vivemos.'
  };
  const preferenceLines={
    'comet-chaser':`${petName} ficou especialmente atento porque essa lembrança tem cara de céu em movimento.`,
    'star-seeker':`${petName} gosta de voltar a lembranças que fazem o céu parecer mais próximo.`,
    'memory-reader':`${petName} trata essa lembrança quase como uma página conhecida da própria história.`,
    'treasure-storyteller':`${petName} gosta mais da história por trás dessa lembrança do que do prêmio em si.`,
    'cozy-home':`${petName} parece guardar essa lembrança como parte do que faz este lugar parecer casa.`
  };
  const extra=preferenceLines[preference?.id]||lines[placeId]||lines.colina;
  return {
    id:`memory:${memory.id}`,
    objectId:'worldMemoryToken',
    motion:placeId==='colina'?'hug':placeId==='observatorio'?'curious':'proud',
    text:`${memory.icon||'💜'} ${memory.text}. ${extra}`,
    burst:[memory.icon||'💜','✨'],
    sceneEffect:{kind:'memory-glow',chars:[memory.icon||'💜','✨'],count:7}
  };
}
