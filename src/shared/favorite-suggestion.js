function hash(value=''){
  let h=2166136261;
  for(const ch of String(value)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}
  return h>>>0;
}

const ICONS={colina:'🏡',parque:'🎠',leitura:'📚',jardim:'🌻',observatorio:'🔭'};

export function favoriteSuggestion({favorite=null,currentPlace='colina',petName='Pipo',day=''}={}){
  if(!favorite?.id)return null;
  const same=favorite.id===currentPlace;
  const icon=ICONS[favorite.id]||'💜';
  const elsewhere={
    colina:`${petName} está com vontade de voltar para a Colina. ${icon}`,
    parque:`${petName} ficou com vontade de passar no Parque. ${icon}`,
    leitura:`${petName} está pensando no Cantinho de Leitura. ${icon}`,
    jardim:`${petName} parece com vontade de visitar o Jardim. ${icon}`,
    observatorio:`${petName} está com vontade de olhar o céu no Observatório. ${icon}`
  };
  const here={
    colina:`${petName} gosta mesmo de ficar por aqui. Parece um lar. ${icon}`,
    parque:`${petName} fica especialmente animado quando está no Parque. ${icon}`,
    leitura:`${petName} parece muito à vontade neste cantinho de histórias. ${icon}`,
    jardim:`${petName} parece feliz cuidando deste Jardim. ${icon}`,
    observatorio:`${petName} adora ficar olhando o céu daqui. ${icon}`
  };
  return {
    id:`favorite-suggestion:${day||'today'}`,
    placeId:favorite.id,
    samePlace:same,
    text:(same?here:elsewhere)[favorite.id]||`${petName} está pensando em um cantinho especial. 💜`,
    motion:same?'proud':'curious'
  };
}

export function shouldSuggestFavorite({favorite=null,day=''}={}){
  if(!favorite?.id||!day)return false;
  return hash(`${day}:${favorite.id}:favorite-suggestion`)%2===0;
}
