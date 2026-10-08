import { dominantTrait } from './world-life.js';
import { memoryPlace } from './world-memory.js';

const count=(obj,key)=>Math.max(0,Number(obj?.[key])||0);

export function worldPatterns({profile={},treasures=[]}={}){
  const trait=dominantTrait(profile);
  const memories=Array.isArray(profile.memories)?profile.memories:[];
  const actions=profile.actions||{};
  const memoryCounts=memories.reduce((acc,m)=>{
    const place=memoryPlace(m);acc[place]=(acc[place]||0)+1;return acc;
  },{});

  const candidates=[
    {
      id:'sky-watcher',icon:'🔭',title:'Observador do céu',placeId:'observatorio',
      score:count(actions,'sceneTelescope')*2+(memoryCounts.observatorio||0)*2+(trait==='curious'?3:trait==='adventurous'?1:0),
      min:6,
      text:'Olhar o céu está começando a virar um costume do Pipo.'
    },
    {
      id:'garden-keeper',icon:'🌱',title:'Cuidador do Jardim',placeId:'jardim',
      score:count(actions,'scenePlant')*2+count(actions,'sceneTree')+(memoryCounts.jardim||0)*2+(trait==='caring'?3:trait==='curious'?1:0),
      min:7,
      text:'Cuidar das plantas está virando um jeitinho próprio do Pipo.'
    },
    {
      id:'story-seeker',icon:'📚',title:'Caçador de histórias',placeId:'leitura',
      score:count(actions,'sceneBooks')*2+(memoryCounts.leitura||0)*2+(trait==='artist'?3:trait==='curious'?2:0),
      min:6,
      text:'O Pipo está criando o hábito de procurar histórias e lembranças nos livros.'
    },
    {
      id:'treasure-keeper',icon:'🏆',title:'Guardião de Tesouros',placeId:'parque',
      score:(Array.isArray(treasures)?treasures.length:0)*2+(memoryCounts.parque||0)*2+(trait==='adventurous'?2:trait==='curious'?1:0),
      min:6,
      text:'Rever conquistas e Tesouros está virando parte do jeito do Pipo.'
    },
    {
      id:'home-lover',icon:'💜',title:'Apegado ao cantinho',placeId:'colina',
      score:count(actions,'hug')*2+count(actions,'highfive')+(memoryCounts.colina||0)*2+(trait==='caring'?3:0),
      min:7,
      text:'Voltar para o cantinho e lembrar do que viveram juntos está virando um costume.'
    }
  ];

  return candidates
    .filter((item)=>item.score>=item.min)
    .sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id))
    .slice(0,2)
    .map(({min,...item})=>item);
}

export function patternForHabit(habit,patterns=[]){
  if(!habit)return null;
  const map={
    'olhar-ceu':'sky-watcher',
    'cuidar-planta':'garden-keeper',
    'olhar-arvore':'garden-keeper',
    'folhear-livros':'story-seeker',
    'aconchegar-almofada':'story-seeker',
    'rever-tesouro':'treasure-keeper',
    'arrumar-cantinho':'home-lover',
    'descansar-colina':'home-lover'
  };
  const patternId=map[habit.id];
  return patterns.find((p)=>p.id===patternId)||null;
}

export function patternedHabitText(habit,pattern,petName='Pipo'){
  if(!habit||!pattern)return habit?.text||'';
  const text={
    'sky-watcher':`${petName} já está criando um costume: antes de descansar, gosta de procurar uma estrela diferente. 🔭`,
    'garden-keeper':`${petName} está criando um jeitinho próprio de sempre conferir como o Jardim está. 🌱`,
    'story-seeker':`${petName} já começa a procurar os livros quase como parte da rotina dele. 📚`,
    'treasure-keeper':`${petName} gosta de rever os Tesouros para lembrar das conquistas de vocês. 🏆`,
    'home-lover':`${petName} parece ter criado o costume de voltar para este cantinho quando quer ficar tranquilo. 💜`
  };
  return text[pattern.id]||habit.text;
}
