function hash(value=''){
  let h=2166136261;
  for(const ch of String(value)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}
  return h>>>0;
}

export function featuredParkTreasure(treasures=[],{preference=null,day=''}={}){
  const list=Array.isArray(treasures)?treasures.filter(Boolean):[];
  if(!list.length)return null;
  if(preference?.id==='achievement-collector'){
    return [...list].sort((a,b)=>(Number(b.medal)||0)-(Number(a.medal)||0)||String(a.gameId||'').localeCompare(String(b.gameId||'')))[0];
  }
  if(preference?.id==='treasure-storyteller'){
    return list[hash(`${day}:treasure-story`)%list.length];
  }
  return list.at(-1);
}

export function treasureMemoryLine(treasure,preference,petName='Pipo'){
  if(!treasure)return '';
  if(preference?.id==='achievement-collector'){
    return `${petName} gosta de olhar o ${treasure.title} como uma conquista importante que vocês alcançaram juntos. ${treasure.icon||'🏆'}`;
  }
  if(preference?.id==='treasure-storyteller'){
    return `${petName} escolheu o ${treasure.title} porque gosta de lembrar da história por trás dele. ${treasure.icon||'💫'}`;
  }
  return `Esse ${treasure.title} lembra uma conquista nossa. Eu gosto de olhar para ele! ${treasure.icon||''}`;
}
