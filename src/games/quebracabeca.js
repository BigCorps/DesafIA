import { el, shuffle } from './kit.js';
import { petMarkup, applyLook } from '../shared/pet.js';

const SIZE=3;
const PIECES=['🌙','⭐','☁️','🌳','🐞','🌼','🪴','💜'];
function shuffledBoard(){
  let board=[0,1,2,3,4,5,6,7,null], blank=8;
  const neighbors=(i)=>{const x=i%SIZE,y=Math.floor(i/SIZE),r=[];if(x>0)r.push(i-1);if(x<SIZE-1)r.push(i+1);if(y>0)r.push(i-SIZE);if(y<SIZE-1)r.push(i+SIZE);return r};
  let previous=-1;
  for(let n=0;n<80;n++){
    const opts=shuffle(neighbors(blank).filter((i)=>i!==previous));
    const pick=opts[0];previous=blank;board[blank]=board[pick];board[pick]=null;blank=pick;
  }
  return board;
}
function solved(board){return board.every((v,i)=>i===8?v===null:v===i)}

export default function mount(root,env){
  const wrap=el('div','g-puzzle');
  wrap.innerHTML=`
    <div class="g-puzzle-top">
      <div class="g-puzzle-pet">${petMarkup('puzzle')}</div>
      <div><small>Fase</small><strong id="pzLevel">1/4</strong></div>
      <div><small>Movimentos</small><strong id="pzMoves">0</strong></div>
    </div>
    <div class="g-puzzle-preview" aria-label="Imagem modelo">${PIECES.map((p)=>`<span>${p}</span>`).join('')}<span class="blank">✨</span></div>
    <div class="g-puzzle-board" aria-label="Quebra-cabeça deslizante"></div>
    <p class="g-hint" id="pzMsg">Toque numa peça ao lado do espaço vazio.</p>`;
  root.appendChild(wrap);
  applyLook(wrap.querySelector('svg'),env.look,500);
  const boardEl=wrap.querySelector('.g-puzzle-board'),pet=wrap.querySelector('.g-puzzle-pet');
  let board=[],moves=0,level=0,score=0,paused=false,over=false,alive=true;

  function draw(){
    boardEl.innerHTML=board.map((v,i)=>v===null
      ? `<button class="g-puzzle-tile blank" data-i="${i}" aria-label="espaço vazio"></button>`
      : `<button class="g-puzzle-tile" data-i="${i}" aria-label="peça ${v+1}"><span>${PIECES[v]}</span><small>${v+1}</small></button>`).join('');
    wrap.querySelector('#pzMoves').textContent=moves;
    wrap.querySelector('#pzLevel').textContent=`${level+1}/4`;
  }
  function startLevel(){board=shuffledBoard();moves=0;draw();wrap.querySelector('#pzMsg').textContent='Monte a ordem mostrada no modelo.'}
  function neighbors(a,b){const ax=a%SIZE,ay=Math.floor(a/SIZE),bx=b%SIZE,by=Math.floor(b/SIZE);return Math.abs(ax-bx)+Math.abs(ay-by)===1}
  function move(i){
    if(paused||over)return;
    const blank=board.indexOf(null);if(!neighbors(i,blank)){env.sound.play('hit');env.haptic(6);return}
    [board[i],board[blank]]=[board[blank],board[i]];moves++;env.sound.play('tap');draw();
    if(solved(board)){
      const bonus=Math.max(120,520-moves*8)+level*120;score+=bonus;env.onScore(score);env.sound.play('level');env.haptic([12,28,12]);
      pet.classList.remove('cheer');void pet.offsetWidth;pet.classList.add('cheer');
      wrap.querySelector('#pzMsg').textContent=`Montou! +${bonus} pontos`;
      level++;
      if(level>=4){over=true;setTimeout(()=>alive&&env.onGameOver(score),700)}
      else setTimeout(()=>alive&&!over&&startLevel(),850);
    }
  }
  const click=(e)=>{const b=e.target.closest('[data-i]');if(b)move(Number(b.dataset.i))};
  boardEl.addEventListener('click',click);
  return{
    start(){level=0;score=0;over=false;env.onScore(0);startLevel()},
    pause(){paused=true},resume(){paused=false},
    destroy(){alive=false;boardEl.removeEventListener('click',click);wrap.remove()}
  };
}
