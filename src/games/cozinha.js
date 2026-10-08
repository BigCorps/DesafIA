import { el, shuffle } from './kit.js';
import { petMarkup, applyLook } from '../shared/pet.js';

const INGREDIENTS=[
  ['🍓','Morango'],['🍌','Banana'],['🥛','Leite'],['🥚','Ovo'],['🍞','Pão'],['🧀','Queijo'],['🍅','Tomate'],['🥬','Folha'],['🍎','Maçã'],['🥕','Cenoura']
];
const RECIPES=[
  {name:'Vitamina feliz',dish:'🥤',items:['🍓','🍌','🥛']},
  {name:'Sanduíche do jardim',dish:'🥪',items:['🍞','🧀','🍅','🥬']},
  {name:'Pratinho colorido',dish:'🍽️',items:['🥕','🍅','🥬']},
  {name:'Lanche da estrela',dish:'⭐',items:['🍎','🍞','🧀']},
  {name:'Café da manhã do Pipo',dish:'🍳',items:['🥚','🍞','🥛','🍓']}
];

export default function mount(root,env){
  const wrap=el('div','g-kitchen');
  wrap.innerHTML=`
    <div class="g-kitchen-top"><div class="g-kitchen-pet">${petMarkup('kitchen')}</div><div><small>Receita</small><strong id="ktLevel">1/5</strong></div><div><small>Pontos</small><strong id="ktScore">0</strong></div></div>
    <div class="g-kitchen-card"><span class="g-kitchen-dish" id="ktDish">🥤</span><div><small>Vamos preparar</small><h3 id="ktName"></h3></div></div>
    <div class="g-kitchen-recipe" id="ktRecipe"></div>
    <div class="g-kitchen-bowl" id="ktBowl"><span>🥣</span><div></div></div>
    <div class="g-kitchen-ingredients" id="ktIngredients"></div>
    <p class="g-hint" id="ktMsg">Toque nos ingredientes na ordem da receita.</p>`;
  root.appendChild(wrap);applyLook(wrap.querySelector('svg'),env.look,500);
  const ingredientsEl=wrap.querySelector('#ktIngredients'),recipeEl=wrap.querySelector('#ktRecipe'),bowl=wrap.querySelector('#ktBowl div'),pet=wrap.querySelector('.g-kitchen-pet');
  let level=0,step=0,score=0,mistakes=0,paused=false,over=false,alive=true;

  function render(){
    const R=RECIPES[level];
    wrap.querySelector('#ktLevel').textContent=`${level+1}/5`;wrap.querySelector('#ktScore').textContent=score;wrap.querySelector('#ktName').textContent=R.name;wrap.querySelector('#ktDish').textContent=R.dish;
    recipeEl.innerHTML=R.items.map((x,i)=>`<span class="${i<step?'done':i===step?'next':''}">${x}</span>`).join('');
    bowl.innerHTML=R.items.slice(0,step).map(x=>`<span>${x}</span>`).join('');
    const choices=shuffle(INGREDIENTS).slice(0,8);
    for(const need of R.items)if(!choices.some(([icon])=>icon===need))choices[Math.floor(Math.random()*choices.length)]=INGREDIENTS.find(([icon])=>icon===need);
    ingredientsEl.innerHTML=choices.map(([icon,name])=>`<button data-ing="${icon}" aria-label="${name}"><span>${icon}</span><small>${name}</small></button>`).join('');
  }
  function choose(icon){
    if(paused||over)return;const R=RECIPES[level],expected=R.items[step];
    if(icon!==expected){mistakes++;env.sound.play('hit');env.haptic(7);wrap.querySelector('#ktMsg').textContent=`Ainda não. Agora precisamos de ${expected}`;return}
    step++;env.sound.play('match',step);env.haptic(8);render();
    if(step===R.items.length){
      const bonus=Math.max(140,420-mistakes*45)+level*90;score+=bonus;env.onScore(score);env.sound.play('level');env.haptic([12,26,12]);
      pet.classList.remove('cheer');void pet.offsetWidth;pet.classList.add('cheer');
      wrap.querySelector('#ktMsg').textContent=`${R.name} pronto! +${bonus} pontos`;level++;
      if(level>=RECIPES.length){over=true;setTimeout(()=>alive&&env.onGameOver(score),750)}
      else setTimeout(()=>{step=0;mistakes=0;render();wrap.querySelector('#ktMsg').textContent='Nova receita! Siga a ordem.'},900);
    }
  }
  const click=(e)=>{const b=e.target.closest('[data-ing]');if(b)choose(b.dataset.ing)};
  ingredientsEl.addEventListener('click',click);
  return{
    start(){level=0;step=0;score=0;mistakes=0;over=false;env.onScore(0);render()},
    pause(){paused=true},resume(){paused=false},
    destroy(){alive=false;ingredientsEl.removeEventListener('click',click);wrap.remove()}
  };
}
