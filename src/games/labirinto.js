import { el, onSwipe, shuffle } from './kit.js';
import { petMarkup, applyLook } from '../shared/pet.js';

const SIZE=7;
function makeMaze(){
  const dirs=[[0,-1],[1,0],[0,1],[-1,0]];
  const cells=Array.from({length:SIZE*SIZE},()=>({walls:[1,1,1,1],seen:false}));
  const idx=(x,y)=>y*SIZE+x;
  const stack=[[0,0]];cells[0].seen=true;
  while(stack.length){
    const [x,y]=stack.at(-1);
    const options=shuffle(dirs.map((d,i)=>({d,i,nx:x+d[0],ny:y+d[1]}))).filter(o=>o.nx>=0&&o.nx<SIZE&&o.ny>=0&&o.ny<SIZE&&!cells[idx(o.nx,o.ny)].seen);
    if(!options.length){stack.pop();continue}
    const o=options[0],ni=idx(o.nx,o.ny);
    cells[idx(x,y)].walls[o.i]=0;cells[ni].walls[(o.i+2)%4]=0;cells[ni].seen=true;stack.push([o.nx,o.ny]);
  }
  return cells.map(({walls})=>walls);
}

export default function mount(root,env){
  const wrap=el('div','g-maze');
  wrap.innerHTML=`
    <div class="g-maze-top"><div class="g-maze-pet">${petMarkup('maze')}</div><div><small>Fase</small><strong id="mzLevel">1/5</strong></div><div><small>Passos</small><strong id="mzSteps">0</strong></div></div>
    <div class="g-maze-board" aria-label="Labirinto"></div>
    <p class="g-hint" id="mzMsg">Deslize para encontrar a bandeira 🏁</p>`;
  root.appendChild(wrap);applyLook(wrap.querySelector('svg'),env.look,500);
  const board=wrap.querySelector('.g-maze-board'),pet=wrap.querySelector('.g-maze-pet');
  let level=0,score=0,steps=0,x=0,y=0,maze=[],paused=false,over=false,alive=true;

  const draw=()=>{
    board.innerHTML=maze.map((walls,i)=>{
      const cx=i%SIZE,cy=Math.floor(i/SIZE),here=cx===x&&cy===y,goal=cx===SIZE-1&&cy===SIZE-1;
      const cls=[walls[0]?'wt':'',walls[1]?'wr':'',walls[2]?'wb':'',walls[3]?'wl':''].join(' ');
      return `<div class="g-maze-cell ${cls}" data-x="${cx}" data-y="${cy}">${here?'<span class="g-maze-you">🌱</span>':goal?'<span>🏁</span>':''}</div>`;
    }).join('');
    wrap.querySelector('#mzSteps').textContent=steps;
    wrap.querySelector('#mzLevel').textContent=`${level+1}/5`;
  };
  function next(){
    if(level>=5){over=true;env.sound.play('win');setTimeout(()=>env.onGameOver(score),500);return}
    maze=makeMaze();x=0;y=0;steps=0;draw();
  }
  function move(dir){
    if(paused||over||!alive)return;
    const map={up:[0,-1,0],right:[1,0,1],down:[0,1,2],left:[-1,0,3]},m=map[dir];if(!m)return;
    const cell=maze[y*SIZE+x];if(cell[m[2]]){env.sound.play('hit');env.haptic(8);return}
    x+=m[0];y+=m[1];steps++;env.sound.play('tap');draw();
    if(x===SIZE-1&&y===SIZE-1){
      const bonus=Math.max(80,320-steps*7)+level*80;score+=bonus;env.onScore(score);env.sound.play('level');env.haptic([12,30,12]);
      pet.classList.remove('cheer');void pet.offsetWidth;pet.classList.add('cheer');
      wrap.querySelector('#mzMsg').textContent=`Encontrou! +${bonus} pontos`;
      level++;setTimeout(()=>{if(alive&&!over){wrap.querySelector('#mzMsg').textContent='Novo caminho!';next()}},850);
    }
  }
  const offSwipe=onSwipe(board,move,18);
  const key=(e)=>{const m={ArrowUp:'up',ArrowRight:'right',ArrowDown:'down',ArrowLeft:'left'}[e.key];if(m){e.preventDefault();move(m)}};
  addEventListener('keydown',key);
  return{
    start(){level=0;score=0;over=false;env.onScore(0);next()},
    pause(){paused=true},resume(){paused=false},
    destroy(){alive=false;offSwipe();removeEventListener('keydown',key);wrap.remove()}
  };
}
