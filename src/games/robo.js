import { el } from './kit.js';
import { petMarkup, applyLook } from '../shared/pet.js';

const LEVELS=[
  {start:[0,4],goal:[3,2],obstacles:[[1,3],[2,3]],solution:['right','right','right','up','up']},
  {start:[4,4],goal:[1,1],obstacles:[[3,3],[3,2],[2,2]],solution:['left','left','left','up','up','up']},
  {start:[0,0],goal:[4,2],obstacles:[[1,1],[2,1],[3,1]],solution:['right','right','right','right','down','down']},
  {start:[4,0],goal:[1,4],obstacles:[[3,1],[2,1],[2,2],[2,3]],solution:['left','left','left','down','down','down','down']},
  {start:[0,4],goal:[4,0],obstacles:[[1,4],[1,3],[2,2],[3,1]],solution:['up','up','up','up','right','right','right','right']}
];
const ICON={up:'⬆️',down:'⬇️',left:'⬅️',right:'➡️'};
const DELTA={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};

export default function mount(root,env){
  const wrap=el('div','g-robo');
  wrap.innerHTML=`
    <div class="g-robo-top"><div class="g-robo-pet">${petMarkup('robo')}</div><div><small>Fase</small><strong id="rbLevel">1/5</strong></div><div><small>Pontos</small><strong id="rbScore">0</strong></div></div>
    <div class="g-robo-grid" aria-label="Mapa do robô"></div>
    <div class="g-robo-program" id="rbProgram" aria-live="polite"></div>
    <div class="g-robo-controls">
      <button data-cmd="up">⬆️</button><button data-cmd="left">⬅️</button><button data-cmd="down">⬇️</button><button data-cmd="right">➡️</button>
    </div>
    <div class="g-robo-actions"><button class="btn btn-soft" id="rbClear">Limpar</button><button class="btn btn-main" id="rbRun">▶ Executar</button></div>
    <p class="g-hint" id="rbMsg">Monte o caminho até a bateria.</p>`;
  root.appendChild(wrap);applyLook(wrap.querySelector('svg'),env.look,500);
  const grid=wrap.querySelector('.g-robo-grid'),programEl=wrap.querySelector('#rbProgram'),pet=wrap.querySelector('.g-robo-pet');
  let level=0,score=0,commands=[],paused=false,over=false,running=false,alive=true,pos=[0,0];

  function renderGrid(){
    const L=LEVELS[level],obs=new Set(L.obstacles.map(([x,y])=>`${x},${y}`));
    grid.innerHTML=Array.from({length:25},(_,i)=>{
      const x=i%5,y=Math.floor(i/5),key=`${x},${y}`;
      let v=''; if(x===pos[0]&&y===pos[1])v='🤖'; else if(x===L.goal[0]&&y===L.goal[1])v='🔋'; else if(obs.has(key))v='🪨';
      return `<div class="g-robo-cell">${v}</div>`;
    }).join('');
    wrap.querySelector('#rbLevel').textContent=`${level+1}/5`;wrap.querySelector('#rbScore').textContent=score;
  }
  function renderProgram(){programEl.innerHTML=commands.length?commands.map((c,i)=>`<span title="passo ${i+1}">${ICON[c]}</span>`).join(''):'<small>Escolha as setas…</small>'}
  function resetLevel(){commands=[];pos=[...LEVELS[level].start];renderGrid();renderProgram();wrap.querySelector('#rbMsg').textContent='Monte o caminho até a bateria.'}
  function add(cmd){if(paused||over||running||commands.length>=12)return;commands.push(cmd);env.sound.play('tap');renderProgram()}
  function invalidAt(next,L){return next[0]<0||next[0]>4||next[1]<0||next[1]>4||L.obstacles.some(([x,y])=>x===next[0]&&y===next[1])}
  async function run(){
    if(paused||over||running||!commands.length)return;running=true;const L=LEVELS[level];pos=[...L.start];renderGrid();
    let success=true;
    for(const cmd of commands){
      if(!alive){running=false;return}
      const d=DELTA[cmd],next=[pos[0]+d[0],pos[1]+d[1]];
      if(invalidAt(next,L)){success=false;env.sound.play('hit');env.haptic(8);break}
      pos=next;env.sound.play('tap');renderGrid();await new Promise(r=>setTimeout(r,env.reduced?30:220));
    }
    success=success&&pos[0]===L.goal[0]&&pos[1]===L.goal[1];
    if(success){
      const efficiency=Math.max(0,L.solution.length-(commands.length-L.solution.length));
      const bonus=260+level*100+Math.max(0,efficiency)*35;score+=bonus;env.onScore(score);env.sound.play('level');env.haptic([12,28,12]);
      pet.classList.remove('cheer');void pet.offsetWidth;pet.classList.add('cheer');
      wrap.querySelector('#rbMsg').textContent=`Robô carregado! +${bonus} pontos`;level++;
      if(level>=LEVELS.length){over=true;setTimeout(()=>alive&&env.onGameOver(score),700)}
      else setTimeout(()=>{running=false;resetLevel()},850);
    }else{
      wrap.querySelector('#rbMsg').textContent='Esse caminho não chegou. Tente outra sequência!';running=false;pos=[...L.start];renderGrid();
    }
  }
  const control=(e)=>{const b=e.target.closest('[data-cmd]');if(b)add(b.dataset.cmd)};
  wrap.querySelector('.g-robo-controls').addEventListener('click',control);
  const clear=()=>{if(running)return;commands=[];renderProgram();env.sound.play('tap')};
  wrap.querySelector('#rbClear').addEventListener('click',clear);wrap.querySelector('#rbRun').addEventListener('click',run);
  return{
    start(){level=0;score=0;over=false;running=false;env.onScore(0);resetLevel()},
    pause(){paused=true},resume(){paused=false},
    destroy(){alive=false;wrap.querySelector('.g-robo-controls').removeEventListener('click',control);wrap.querySelector('#rbClear').removeEventListener('click',clear);wrap.querySelector('#rbRun').removeEventListener('click',run);wrap.remove()}
  };
}
