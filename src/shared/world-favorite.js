import { unlockedWorldPlaces } from './world-places.js';
import { dominantTrait } from './world-life.js';
import { memoryPlace } from './world-memory.js';

const TRAIT_BONUS={
  colina:{caring:2,artist:1},
  parque:{adventurous:2,curious:1},
  leitura:{artist:2,curious:1},
  jardim:{caring:2,curious:1},
  observatorio:{curious:2,adventurous:1}
};
const actionCount=(actions,id)=>Math.max(0,Number(actions?.[id])||0);

export function placeAffinities({xp=0,profile={},treasures=[]}={}){
  const unlocked=unlockedWorldPlaces(xp);
  const trait=dominantTrait(profile);
  const memories=Array.isArray(profile.memories)?profile.memories:[];
  const actions=profile.actions||{};
  const memoryCounts=memories.reduce((acc,m)=>{
    const place=memoryPlace(m);acc[place]=(acc[place]||0)+1;return acc;
  },{});

  const score={
    colina:actionCount(actions,'hug')*2+actionCount(actions,'highfive')+(memoryCounts.colina||0),
    parque:(Array.isArray(treasures)?treasures.length:0)*2+(memoryCounts.parque||0),
    leitura:actionCount(actions,'sceneBooks')*2+(memoryCounts.leitura||0),
    jardim:actionCount(actions,'scenePlant')*2+actionCount(actions,'sceneTree')+(memoryCounts.jardim||0),
    observatorio:actionCount(actions,'sceneTelescope')*2+(memoryCounts.observatorio||0)
  };
  for(const place of Object.keys(score)) score[place]+=(TRAIT_BONUS[place]?.[trait]||0);

  return unlocked.map((place)=>({
    id:place.id,
    score:score[place.id]||0,
    reasons:{
      trait:Boolean(TRAIT_BONUS[place.id]?.[trait]),
      memories:memoryCounts[place.id]||0,
      treasures:place.id==='parque'?(Array.isArray(treasures)?treasures.length:0):0
    }
  }));
}

export function favoriteWorldPlace(input={}){
  const ranked=placeAffinities(input).sort((a,b)=>b.score-a.score);
  if(ranked.length<2||!ranked[0]||ranked[0].score<3)return null;
  if(ranked[1]&&ranked[0].score===ranked[1].score)return null;
  return ranked[0];
}

export function favoritePlaceLine(placeId,petName='Pipo'){
  const lines={
    colina:`${petName} gosta muito de voltar para a Colina. Parece mesmo um lar. 💜`,
    parque:`${petName} anda especialmente animado quando chega ao Parque. 🎠`,
    leitura:`${petName} está criando um carinho especial pelo Cantinho de Leitura. 📚`,
    jardim:`${petName} parece se sentir muito bem cuidando do Jardim. 🌻`,
    observatorio:`${petName} fica especialmente curioso quando visita o Observatório. 🔭`
  };
  return lines[placeId]||'';
}
