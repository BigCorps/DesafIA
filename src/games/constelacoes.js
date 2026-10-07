import { el, rand, shuffle, sleep } from './kit.js';
import { petMarkup, applyLook } from '../shared/pet.js';

const SHAPES=[5,6,7,8,9];
export default function mount(root,env){
  const wrap=el('div','g-stars');
  wrap.innerHTML=`
    <div class="g-stars-top"><div class="g-stars-pet">${petMarkup('stars')}</div><div><small>Constelação</small><strong id="stLevel">1/5</strong></div><div><small>Pontos</small><strong id="stHits">0</strong></div></div>
    <div class="g-stars-sky"><svg class="g-stars-lines" viewBox="0 0 100 100" preserveAspectRatio="none"></svg><div class="g-stars-points"></div></div>
    <p class="g-hint" id="stMsg">Toque na estrela 1 para começar.</p>`;
  root.appendChild(wrap);applyLook(wrap.querySelector('svg.pet-svg'),env.look,500);
  const sky=wrap.querySelector('.g-stars-sky'),pointsEl=wrap.querySelector('.g-stars-points'),lines=wrap.querySelector('.g-stars-lines'),pet=wrap.querySelector('.g-stars-pet');
  let level=0,score=0,nextIdx=0,points=[],paused=false,over=false,alive=true;
  function makePoints(n){
    const base=Array.from({length:n},(_,i)=>({i,x:12+rand(0,76),y:12+rand(0,72)}));
    return shuffle(base).map((p,i)=>({...p,i}));
  }
  function draw(){
    pointsEl.innerHTML=points.map((p,i)=>`<button class="g-star-point ${i<nextIdx?'done':''}" style="left:${p.x}%;top:${p.y}%" data-i="${i}" aria-label="estrela ${i+1}"><span>${i+1}</span></button>`).join('');
    let d='';for(let i=1;i<nextIdx;i++)d+=`<line x1="${points[i-1].x}" y1="${points[i-1].y}" x2="${points[i].x}" y2="${points[i].y}"/>`;
    lines.innerHTML=d;wrap.querySelector('#stHits').textContent=nextIdx;wrap.querySelector('#stLevel').textContent=`${level+1}/5`;
  }
  async function finishShape(){
    const bonus=SHAPES[level]*45+level*80;score+=bonus;env.onScore(score);env.sound.play('level');env.haptic([12,25,12]);
    pet.classList.remove('cheer');void pet.offsetWidth;pet.classList.add('cheer');
    wrap.querySelector('#stMsg').textContent=`Constelação completa! +${bonus}`;
    level++;if(level>=SHAPES.length){over=true;await sleep(700);if(alive)env.onGameOver(score);return}
    await sleep(850);if(!alive)return;startShape();
  }
  function startShape(){points=makePoints(SHAPES[level]);nextIdx=0;draw();wrap.querySelector('#stMsg').textContent='Siga os números das estrelas.'}
  const click=(e)=>{
    const b=e.target.closest('.g-star-point');if(!b||paused||over)return;
    const i=Number(b.dataset.i);
    if(i!==nextIdx){env.sound.play('hit');env.haptic(8);wrap.querySelector('#stMsg').textContent=`Procure a estrela ${nextIdx+1} ✨`;return}
    env.sound.play('note',i%4);nextIdx++;draw();if(nextIdx===points.length)finishShape();
  };
  sky.addEventListener('click',click);
  return{start(){level=0;score=0;over=false;env.onScore(0);startShape()},pause(){paused=true},resume(){paused=false},destroy(){alive=false;sky.removeEventListener('click',click);wrap.remove()}};
}
