import { el } from './kit.js';
import { petMarkup, applyLook } from '../shared/pet.js';

const TOTAL=24;
export default function mount(root,env){
  const wrap=el('div','g-rhythm');
  wrap.innerHTML=`
    <div class="g-rhythm-top"><div class="g-rhythm-pet">${petMarkup('rhythm')}</div><div><small>Batidas</small><strong id="rhBeat">0/${TOTAL}</strong></div><div><small>Combo</small><strong id="rhCombo">0</strong></div></div>
    <div class="g-rhythm-stage"><button class="g-rhythm-star" type="button" aria-label="Tocar no ritmo"><span>⭐</span><i></i></button></div>
    <p class="g-hint" id="rhMsg">Toque quando o círculo chegar perto da estrela.</p>`;
  root.appendChild(wrap);applyLook(wrap.querySelector('svg'),env.look,500);
  const btn=wrap.querySelector('.g-rhythm-star'),pet=wrap.querySelector('.g-rhythm-pet');
  let beat=0,combo=0,score=0,phase=0,last=0,raf=0,running=false,paused=false,over=false;
  const cycle=1.45;
  function hud(){wrap.querySelector('#rhBeat').textContent=`${beat}/${TOTAL}`;wrap.querySelector('#rhCombo').textContent=combo}
  function frame(t){
    if(!running)return;if(paused){last=t;raf=requestAnimationFrame(frame);return}
    if(!last)last=t;const dt=Math.min(.05,(t-last)/1000);last=t;phase+=dt/cycle;
    if(phase>=1){phase%=1;beat++;combo=0;hud();env.sound.play('tap');if(beat>=TOTAL){finish();return}}
    const scale=2.15-1.15*phase;btn.style.setProperty('--pulse-scale',String(scale));btn.style.setProperty('--pulse-alpha',String(.15+.7*phase));
    raf=requestAnimationFrame(frame);
  }
  function hit(){
    if(!running||paused||over)return;
    const dist=Math.min(phase,1-phase),quality=dist<.08?3:dist<.16?2:dist<.25?1:0;
    if(!quality){combo=0;env.sound.play('hit');wrap.querySelector('#rhMsg').textContent='Quase! Espere o círculo chegar mais perto.';hud();return}
    const pts=[0,35,70,110][quality]+Math.min(combo,8)*5;score+=pts;combo++;env.onScore(score);env.sound.play('note',(beat+combo)%4);env.haptic(8);
    wrap.querySelector('#rhMsg').textContent=quality===3?'Perfeito! ✨':quality===2?'Muito bom!':'Boa!';
    if(combo&&combo%6===0){pet.classList.remove('cheer');void pet.offsetWidth;pet.classList.add('cheer');}
    hud();
  }
  function finish(){running=false;over=true;cancelAnimationFrame(raf);env.sound.play('win');setTimeout(()=>env.onGameOver(score),650)}
  btn.addEventListener('pointerdown',hit);
  return{
    start(){beat=0;combo=0;score=0;phase=.45;last=0;over=false;running=true;env.onScore(0);hud();raf=requestAnimationFrame(frame)},
    pause(){paused=true},resume(){paused=false},
    destroy(){running=false;cancelAnimationFrame(raf);btn.removeEventListener('pointerdown',hit);wrap.remove()}
  };
}
