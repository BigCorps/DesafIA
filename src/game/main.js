import './game.css';
import { createChildNotificationUI } from './notifications.js';
import { qaEnabled, qaAllEnabled, uiStorage } from '../shared/qa-environment.js';
import { petMarkup, applyLook, COLORS, HATS, ACCS, PET_NAMES } from '../shared/pet.js';
import { HOUSE_ITEMS, levelOf, levelProgress } from '../shared/progression.js';
import { companionAmbientLine, companionMoodLabel, deriveCompanionMood, missionCompanionAction, worldCompanionAction } from '../shared/companion.js';
import { DISCOVERIES, adventureForDay, collectedDiscoveries, discoveryById, findAdventureChoice } from '../shared/adventures.js';
import { createCompanionJournal } from '../shared/companion-journal.js';
import { createKidSupabase, supabaseReady, friendlyError } from '../lib/supabase.js';
import { createCloud } from './cloud.js';
import { createLocal } from './local.js';
import { setupPWA } from '../shared/pwa.js';
import { initDistribution } from '../shared/platform.js';
import { createArcade } from '../games/arcade.js';
import { parkTreasures } from '../games/registry.js';
import { chooseWorldRoutine, unlockedWorldDetails, worldMoment, worldRoutineCandidates, worldStage } from '../shared/world-life.js';

const $=(id)=>document.getElementById(id);
const esc=(v)=>String(v??'').replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const seenRewardKey='desafia-seen-rewards-v3';
const seenDayKey='desafia-seen-day-v3';
const panelStateKey='desafia-panel-collapsed-v1';
const companionJournal=createCompanionJournal(uiStorage);
const TIMES=['dia','tarde','noite'];
const PERIOD={manha:'de manhã',tarde:'à tarde',noite:'à noite'};

let api=null,snap=null,tab='missoes',parentMode=false,unsubscribe=()=>{},refreshing=false,lastReaction=-1,reactionLockedUntil=0;
let companionMood='calm',petClickTimer=0,suppressPetClick=false,petHoldTimer=0,idleTimer=0,worldRoutineTimer=0,lastWorldRoutine='';
let companionProfileState={traits:[],likes:[],memories:[]};
let activeAdventure=null,adventureBusy=false;
let qaController=null;
const kidSb=qaEnabled?null:createKidSupabase();
const childNotifications=createChildNotificationUI(kidSb);
const arcade=createArcade({getApi:()=>api,getSnap:()=>snap,say:(t,ms)=>say(t,ms),toast:(a,b)=>toast(a,b),onChange:(goTab)=>{syncWorldLife();if(goTab){tab=goTab;expandPanel();renderPanel();return}if(tab==='jogos'||tab==='casa')renderPanel();}});
if(!qaEnabled)initDistribution();

function petName(){return String(snap?.petName||$('onboardName')?.value||'Pipo').trim().slice(0,12)||'Pipo'}
function readPanelState(){try{return uiStorage.getItem(panelStateKey)==='1'}catch{return false}}
function viewportHeight(){return Math.round(window.visualViewport?.height||window.innerHeight||document.documentElement.clientHeight||0)}
let viewportRaf=0;
function syncViewport(){
  cancelAnimationFrame(viewportRaf);
  viewportRaf=requestAnimationFrame(()=>{
    const h=viewportHeight();
    if(h>0)document.documentElement.style.setProperty('--app-height',`${h}px`);
  });
}
function restoreGameLayout(){
  syncViewport();
  const collapsed=readPanelState();
  requestAnimationFrame(()=>{
    setPanelCollapsed(collapsed,{persist:false});
    const panel=$('panel');if(panel&&panel.scrollTop<0)panel.scrollTop=0;
    document.documentElement.scrollTop=0;document.body.scrollTop=0;
    requestAnimationFrame(syncViewport);
  });
}
function syncPetLabels(){
  const name=petName(),collapsed=document.querySelector('.game-shell')?.classList.contains('panel-collapsed');
  $('panelToggleTitle').textContent=collapsed?'Abrir atividades':`Ver só o ${name}`;
  $('pet').setAttribute('aria-label',`Brincar com ${name}`);
  $('scene').setAttribute('aria-label',`Mundo de ${name}`);
  if($('celebrationPetName'))$('celebrationPetName').textContent=name;
}
function setPanelCollapsed(collapsed,{persist=true}={}){
  const shell=document.querySelector('.game-shell');
  if(!shell)return;
  const scroller=$('panel');
  if(scroller)scroller.scrollTop=0;
  shell.classList.toggle('panel-collapsed',collapsed);
  $('panelToggle').setAttribute('aria-expanded',String(!collapsed));
  $('panelToggleHint').textContent=collapsed?'toque para ver missões, casa e prêmios':'toque para esconder missões e menus';
  syncPetLabels();
  if(persist){try{uiStorage.setItem(panelStateKey,collapsed?'1':'0')}catch{}}
}
function expandPanel(){setPanelCollapsed(false)}
setPanelCollapsed(readPanelState(),{persist:false});
syncViewport();
window.addEventListener('pageshow',restoreGameLayout);
window.addEventListener('resize',syncViewport,{passive:true});
window.visualViewport?.addEventListener('resize',syncViewport,{passive:true});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){restoreGameLayout();if(!qaEnabled)childNotifications.refresh(api,{visible:true});}});

$('petMount').innerHTML=petMarkup('main');
$('connectPet').innerHTML=petMarkup('connect');
$('onboardPet').innerHTML=petMarkup('onboard');
const petSvg=$('petMount').querySelector('svg');
const mouth=petSvg.querySelector('.mouth');

let timeIdx=(()=>{const h=new Date().getHours();return h>=6&&h<17?0:h<19?1:2})();
$('scene').dataset.time=TIMES[timeIdx];
$('skyBtn').addEventListener('click',()=>{timeIdx=(timeIdx+1)%3;$('scene').dataset.time=TIMES[timeIdx];refreshCompanionMood();syncWorldLife();});
$('panelToggle').addEventListener('click',()=>setPanelCollapsed(!document.querySelector('.game-shell').classList.contains('panel-collapsed')));

function openModal(id){$(id).classList.add('open');}
function closeModal(id){$(id).classList.remove('open');}
function toast(title,text){$('toastTitle').textContent=title;$('toastText').textContent=text;$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),2500);}
function say(text,ms=2200){
  const b=$('bubble'),scene=$('scene');
  b.textContent=text;b.classList.add('show');scene.classList.add('speaking');
  clearTimeout(say.t);
  say.t=setTimeout(()=>{b.classList.remove('show');scene.classList.remove('speaking')},ms);
}
function applyMoodFace(mood=companionMood){
  petSvg.dataset.mood=mood;
  petSvg.classList.toggle('is-resting',mood==='sleepy');
  mouth?.setAttribute('fill','none');
  const shapes={
    calm:'M88 124 Q100 136 112 124',
    curious:'M93 127 Q100 132 107 127',
    excited:'M87 122 Q100 139 113 122',
    proud:'M86 121 Q100 140 114 121',
    sleepy:'M92 125 Q100 132 108 125'
  };
  mouth?.setAttribute('d',shapes[mood]||shapes.calm);
}
function refreshCompanionMood(){
  companionMood=deriveCompanionMood(snap,TIMES[timeIdx]);
  $('scene').dataset.mood=companionMood;
  $('pet').dataset.mood=companionMood;
  if($('moodText'))$('moodText').textContent=companionMoodLabel(companionMood);
  applyMoodFace(companionMood);
}
function happy(){mouth?.setAttribute('d','M86 121 Q100 146 114 121 Z');mouth?.setAttribute('fill','#2A2350');petSvg.classList.remove('is-resting');clearTimeout(happy.t);happy.t=setTimeout(()=>applyMoodFace(companionMood),1100);}
function clearPetMotions(){$('pet').classList.remove('jump','giggle','wiggle','twirl','squish','dance','hug','highfive','proud','curious','wave','march')}
function motion(name){
  happy();
  if(reduce)return;
  const p=$('pet');clearPetMotions();void p.offsetWidth;p.classList.add(name);
  clearTimeout(motion.t);motion.t=setTimeout(()=>p.classList.remove(name),1100);
}
function jump(){motion('jump')}
function blink(ms=360){
  petSvg.classList.add('is-blinking');
  clearTimeout(blink.t);blink.t=setTimeout(()=>petSvg.classList.remove('is-blinking'),reduce?40:ms);
}
function tinyTap(){
  if(reduce)return;
  $('pet').animate([{filter:'brightness(1)'},{filter:'brightness(1.08)'},{filter:'brightness(1)'}],{duration:180});
}
function haptic(pattern=12){try{if(!reduce&&navigator.vibrate)navigator.vibrate(pattern)}catch{}}
function pulseSceneObject(id){
  const el=$(id);if(!el||!el.classList.contains('unlocked'))return;
  el.classList.remove('companion-active');void el.offsetWidth;el.classList.add('companion-active');
  setTimeout(()=>el.classList.remove('companion-active'),900);
}
function performCompanionAction(action,{haptics=true}={}){
  if(!action)return;
  if(action.motion==='curious')motion('curious');else motion(action.motion||'proud');
  if(action.objectId)pulseSceneObject(action.objectId);
  if(action.burst?.length)burst(action.burst,8);
  if(action.text)say(action.text,1800);
  if(haptics)haptic([10,30,10]);
}
function petReaction(){
  const now=Date.now();
  if(now<reactionLockedUntil){tinyTap();return}
  reactionLockedUntil=now+(reduce?650:1050);
  rememberInteraction('tap');
  const name=petName();
  const reactions=[
    ()=>{jump();burst(['💜','✨'],7);say('Uhuu! Olha o meu pulo! 😄',1350);haptic(18)},
    ()=>{motion('giggle');burst(['😄','✨'],6);say('Hihi! Isso faz cócegas!',1350);haptic([10,35,10])},
    ()=>{motion('wiggle');say('Olha eu balançando! ✨',1300);haptic(12)},
    ()=>{motion('twirl');burst(['⭐','✨'],5);say('Uma voltinha!',1200);haptic([10,30,10])},
    ()=>{motion('wave');say('Oiii! 👋',1200);haptic(8)},
    ()=>{motion('march');burst(['⭐','✨'],5);say('Olha meus passinhos! 😄',1300);haptic([8,28,8])},
    ()=>{blink(650);motion('squish');say('Pisca-pisca! 👀',1250);haptic(9)},
    ()=>{motion('dance');burst(['🎵','💜'],6);say('Dancinha do dia! 🎵',1450);haptic([9,30,9,30,9])},
    ()=>{blink(700);motion(companionMood==='sleepy'?'hug':'curious');say(companionAmbientLine(companionMood,name),1800);haptic(8)}
  ];
  let idx=Math.floor(Math.random()*reactions.length);
  if(reactions.length>1&&idx===lastReaction)idx=(idx+1+Math.floor(Math.random()*(reactions.length-1)))%reactions.length;
  lastReaction=idx;reactions[idx]();
}
function petHug(){
  rememberInteraction('hug');
  reactionLockedUntil=Date.now()+1100;
  motion('hug');burst(['💜','✨'],9);say('Abraço recebido! Eu gosto de ficar pertinho de você. 💜',1750);haptic([12,45,18]);
}
function petHighFive(){
  rememberInteraction('highfive');
  reactionLockedUntil=Date.now()+950;
  motion('highfive');burst(['✋','⭐','✨'],9);say('Toca aqui! Mandamos muito bem! ✋',1500);haptic([14,30,14]);
}
function scheduleCompanionIdle(){
  clearTimeout(idleTimer);
  if(reduce)return;
  idleTimer=setTimeout(()=>{
    if(snap&&document.visibilityState==='visible'&&!$('scene').classList.contains('speaking')){
      if(companionMood==='sleepy')blink(1100);
      else if(companionMood==='proud')motion('proud');
      else if(companionMood==='curious')motion('curious');
      else if(companionMood==='excited')motion('march');
      else if(Math.random()<.28)motion('wave');
      else blink(420);
    }
    scheduleCompanionIdle();
  },18000+Math.random()*14000);
}
function burst(chars=['⭐','✨','💜'],n=12){
  if(reduce)n=Math.min(n,3);const rect=$('pet').getBoundingClientRect(),scene=$('scene').getBoundingClientRect();
  const x=rect.left-scene.left+rect.width/2,y=rect.top-scene.top+rect.height/2;
  for(let i=0;i<n;i+=1){const e=document.createElement('span');e.className='particle';e.textContent=chars[i%chars.length];e.style.left=`${x}px`;e.style.top=`${y}px`;$('fx').appendChild(e);const a=Math.random()*Math.PI*2,d=55+Math.random()*85,dx=Math.cos(a)*d,dy=Math.sin(a)*d-45;e.animate([{transform:'translate(-50%,-50%) scale(.4)',opacity:1},{transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(1.2)`,opacity:1,offset:.62},{transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy+34}px)) scale(.75)`,opacity:0}],{duration:reduce?20:800+Math.random()*400,easing:'cubic-bezier(.2,.8,.3,1)'}).onfinish=()=>e.remove();}
}
function seenList(key){try{return JSON.parse(uiStorage.getItem(key)||'[]')}catch{return[]}}
function markSeen(key,id){const a=[...new Set([...seenList(key),id])].slice(-100);uiStorage.setItem(key,JSON.stringify(a));}

function currentParkTreasures(){return parkTreasures(arcade.status?.best||{})}
function worldContext(){
  return {xp:snap?.xp||0,period:TIMES[timeIdx],profile:companionProfileState,treasures:currentParkTreasures()};
}
function syncWorldLife(){
  if(!snap)return;
  const scene=$('scene'),unlocked=new Set(unlockedWorldDetails(snap.xp).map((item)=>item.id));
  scene.dataset.worldStage=worldStage(snap.xp);
  for(const id of ['sceneRug','sceneLamp','scenePlant','sceneBooks','sceneTree','sceneCushion','sceneTelescope','sceneLittleHouse','sceneFlowers']){
    const el=$(id);if(!el)continue;const open=unlocked.has(id);
    el.classList.toggle('unlocked',open);
    if(el.matches('button')){el.hidden=!open;el.disabled=!open;el.setAttribute('aria-hidden',String(!open));}
  }
  const treasures=currentParkTreasures(),treasure=$('sceneTreasure');
  if(treasure){
    const latest=treasures.at(-1);
    treasure.hidden=!latest;treasure.disabled=!latest;treasure.classList.toggle('unlocked',Boolean(latest));
    if(latest){$('sceneTreasureIcon').textContent=latest.icon;treasure.dataset.treasureTitle=latest.title;treasure.setAttribute('aria-label',`Ver ${latest.title}, Tesouro do Parque`);}
  }
}
function worldMomentView(){
  const moment=worldMoment(worldContext());
  return `<section class="world-moment"><span>${esc(moment.icon)}</span><div><small>Mundo de hoje</small><strong>${esc(moment.title)}</strong><p>${esc(moment.text)}</p></div></section>`;
}
function canRunWorldRoutine(){
  return Boolean(snap&&document.visibilityState==='visible'&&!$('scene').classList.contains('speaking')&&!document.querySelector('.modal.open')&&!document.querySelector('.arcade-player:not([hidden])'));
}
function runWorldRoutine(forObject=null){
  if(!canRunWorldRoutine())return;
  const ctx=worldContext();
  let candidates=worldRoutineCandidates(ctx).filter((item)=>!forObject||item.objectId===forObject);
  if(!candidates.length)return;
  if(candidates.length>1){const fresh=candidates.filter((item)=>item.id!==lastWorldRoutine);if(fresh.length)candidates=fresh;}
  const chosen=forObject?candidates[0]:candidates[Math.floor(Math.random()*candidates.length)]||chooseWorldRoutine(ctx,0);
  const action=chosen;
  if(!action)return;
  lastWorldRoutine=action.id;
  const burstChars=action.treasure?[action.treasure.icon,'✨','💜']:['✨','💜'];
  performCompanionAction({...action,burst:burstChars},{haptics:false});
}
function scheduleWorldRoutine(){
  clearTimeout(worldRoutineTimer);
  if(reduce)return;
  worldRoutineTimer=setTimeout(()=>{runWorldRoutine();scheduleWorldRoutine();},52000+Math.random()*26000);
}

function adventureState(){
  return snap?.adventure||{day:null,eligible:false,completed_today:false,today:null,discoveries:[]};
}
function syncAdventureUI(){
  const state=adventureState(),available=Boolean(state.eligible&&!state.completed_today);
  if($('adventureBtn'))$('adventureBtn').hidden=!available;
  if($('celebrationAdventure'))$('celebrationAdventure').hidden=!available;
}
function adventurePetPreview(){
  const mount=$('adventurePet');
  if(!mount)return;
  mount.innerHTML=petMarkup('adventure');
  applyLook(mount.querySelector('svg'),snap?.look,snap?.xp);
}
function discoveryAlbumView(){
  const state=adventureState(),found=collectedDiscoveries(state.discoveries||[]);
  const foundIds=new Set(found.map((item)=>item.id));
  const cards=DISCOVERIES.map((item)=>foundIds.has(item.id)
    ? `<article class="discovery-card found"><span>${esc(item.icon)}</span><strong>${esc(item.name)}</strong><small>${esc(item.description)}</small></article>`
    : '<article class="discovery-card locked"><span>❔</span><strong>Descoberta secreta</strong><small>Continue completando seus dias para explorar.</small></article>').join('');
  return `<section class="discoveries"><div class="discoveries-head"><div><h3>Álbum de descobertas</h3><p>Pequenas lembranças das aventuras de ${esc(snap.petName)}.</p></div><strong>${found.length}/${DISCOVERIES.length}</strong></div><div class="discovery-grid">${cards}</div></section>`;
}
function rememberInteraction(action){
  if(!snap)return;
  companionJournal.action(snap,action);
  companionProfileState=companionJournal.observe(snap);
  syncWorldLife();
  if(tab==='casa')renderPanel();
  if(api?.kind==='cloud'&&typeof api.recordCompanionAction==='function'){
    api.recordCompanionAction(action).then((remote)=>{
      if(!snap||!remote)return;
      snap.companionJournal=remote;
      companionProfileState=companionJournal.observe(snap);
      syncWorldLife();
      if(tab==='casa')renderPanel();
    }).catch((err)=>console.warn('companion sync',err));
  }
}
function companionJournalView(){
  const profile=companionProfileState?.traits?.length?companionProfileState:companionJournal.observe(snap);
  const traits=profile.traits.map((t)=>`<article class="companion-trait"><strong>${esc(t.icon)} ${esc(t.name)}</strong><small>${esc(t.expression)}</small><p>${esc(t.text)}</p></article>`).join('');
  const likes=profile.likes.length?`<ul class="companion-likes">${profile.likes.map((l)=>`<li>${esc(l.icon)} ${esc(l.name)}</li>`).join('')}</ul>`:'<p class="hint">Os gostos aparecem aos pouquinhos, nas brincadeiras e descobertas.</p>';
  const memories=profile.memories.length?`<ul class="companion-memories">${profile.memories.map((m)=>`<li><span aria-hidden="true">${esc(m.icon)}</span> ${esc(m.text)}</li>`).join('')}</ul>`:'<p class="hint">Nosso caderninho está pronto para guardar momentos juntos.</p>';
  const storageNote=snap.connected?'Sincronizado com este companheiro nos aparelhos conectados.':'Neste modo, o caderninho fica somente neste aparelho.';
  return `<section class="companion-journal" aria-labelledby="companionJournalTitle"><h3 id="companionJournalTitle">Jeitinho do ${esc(snap.petName)}</h3><p class="hint">Cada traço tem seu encanto. Eles podem florescer juntos, no nosso tempo.</p><div class="companion-traits">${traits}</div><h4>Coisas de que eu gosto</h4>${likes}<h4>Nossas memórias</h4>${memories}<small class="companion-storage-note">${esc(storageNote)}</small></section>`;
}
function renderAdventureIntro(adventure){
  activeAdventure=adventure;
  adventurePetPreview();
  $('adventureBody').innerHTML=`<div class="adventure-kicker">🧭 Aventura do dia</div><h2 id="adventureTitle">${esc(adventure.icon)} ${esc(adventure.title)}</h2><p>${esc(adventure.intro)}</p><div class="adventure-choices">${adventure.choices.map((choice)=>`<button class="adventure-choice" data-adventure-choice="${esc(choice.id)}"><strong>${esc(choice.label)}</strong><span>Escolher este caminho</span></button>`).join('')}</div>`;
}
function renderAdventureResult(adventure,choice){
  const d=choice.discovery;
  adventurePetPreview();
  $('adventureBody').innerHTML=`<div class="adventure-kicker">✨ Nova descoberta!</div><h2 id="adventureTitle">${esc(d.icon)} ${esc(d.name)}</h2><p>${esc(choice.result)}</p><article class="discovery-reveal"><span>${esc(d.icon)}</span><div><strong>${esc(d.name)}</strong><small>${esc(d.description)}</small></div></article><p class="adventure-note">Ela foi guardada no Álbum de Descobertas da Casa.</p>`;
}
function openAdventure(){
  if(!snap||!api)return;
  const state=adventureState();
  if(!state.eligible){toast('A aventura ainda está escondida','Complete as missões do dia para explorar com seu companheiro.');return}
  if(state.completed_today){
    const d=discoveryById(state.today?.discovery_id);
    if(d){
      adventurePetPreview();
      $('adventureBody').innerHTML=`<div class="adventure-kicker">🧭 Aventura concluída</div><h2 id="adventureTitle">${esc(d.icon)} ${esc(d.name)}</h2><p>Esta foi a descoberta de hoje. Amanhã pode aparecer um novo caminho.</p><article class="discovery-reveal"><span>${esc(d.icon)}</span><div><strong>${esc(d.name)}</strong><small>${esc(d.description)}</small></div></article>`;
      openModal('adventureModal');
    }
    return;
  }
  const adventure=adventureForDay(state.day,state.discoveries||[]);
  renderAdventureIntro(adventure);
  motion('curious');
  openModal('adventureModal');
}
async function chooseAdventure(choiceId,button){
  if(adventureBusy||!activeAdventure||!api)return;
  const choice=findAdventureChoice(activeAdventure.id,choiceId);
  if(!choice)return;
  adventureBusy=true;button?.setAttribute('disabled','');
  try{
    const state=await api.completeAdventure(activeAdventure.id,choice.id,choice.discovery.id);
    snap.adventure=state;
    performCompanionAction({motion:choice.motion,burst:[choice.discovery.icon,'✨','💜'],text:`Encontramos ${choice.discovery.name}! ✨`});
    renderAdventureResult(activeAdventure,choice);
    syncAdventureUI();
    if(tab==='casa')renderPanel();
  }catch(err){
    const code=String(err?.message||err);
    const msg=code.includes('ADVENTURE_ALREADY_DONE')?'A aventura de hoje já foi concluída.':code.includes('ADVENTURE_LOCKED')?'Complete as missões do dia antes de explorar.':friendlyError(err);
    toast('Não foi possível explorar',msg);
  }finally{
    adventureBusy=false;button?.removeAttribute('disabled');
  }
}

function renderStats(){
  if(!snap)return;const p=levelProgress(snap.xp);$('starCount').textContent=snap.wallet;$('petNameTitle').textContent=snap.petName;$('lvlText').textContent=`Nível ${p.level} · ${p.remaining} XP para o próximo`;$('xpFill').style.width=`${p.pct}%`;$('xpBar').setAttribute('aria-valuenow',String(p.pct));applyLook(petSvg,snap.look,snap.xp);
  const goal=snap.familyGoal||{current:snap.weekPoints||0,target:500};$('familyGoalText').textContent=`${goal.current} / ${goal.target} ⭐`;$('familyGoalFill').style.width=`${Math.min(100,Math.round(goal.current/Math.max(1,goal.target)*100))}%`;
  const level=p.level;
  [['sceneTree',5],['sceneBooks',4],['scenePlant',3],['sceneTelescope',7]].forEach(([id,min])=>{const el=$(id),open=level>=min;el?.classList.toggle('unlocked',open);if(el){el.disabled=!open;el.setAttribute('aria-hidden',String(!open));}});
  refreshCompanionMood();syncAdventureUI();syncPetLabels();document.title=`DesafIA — ${snap.petName}`;
}
function nextMission(){return snap?.missions?.find((m)=>m.status==='todo'||m.status==='rejected')||null;}
function renderNext(){
  const m=nextMission();const box=$('nextCard');
  if(!snap){box.innerHTML='';return}
  if(!m){const pending=snap.missions?.some((x)=>x.status==='pending');box.innerHTML=`<div class="next-row"><span class="next-icon">${pending?'⏳':'🌟'}</span><div class="next-body"><small>${pending?'Quase lá':'Tudo feito por aqui'}</small><strong>${pending?'Um adulto ainda vai confirmar':`${esc(snap.petName)} está feliz com você!`}</strong></div></div>`;return;}
  box.innerHTML=`<div class="next-row"><span class="next-icon">${esc(m.icon)}</span><div class="next-body"><small>Próxima missão</small><strong>${esc(m.title)}</strong><span class="next-reward">+${m.star_reward} ⭐ · +${m.xp_reward} XP</span></div><button class="btn btn-main" data-act="done" data-id="${m.id}">Fiz!</button></div>`;
}
function missionHTML(m){
  const period=PERIOD[m.time_of_day]?` · ${PERIOD[m.time_of_day]}`:'';let action='';
  if(m.status==='done')action='<span class="badge badge-done">Feito ✓</span>';
  else if(m.status==='pending')action=parentMode?`<div><button class="btn btn-soft" data-act="reject" data-id="${m.id}">↩</button> <button class="btn btn-ok" data-act="approve" data-id="${m.id}">✓</button></div>`:'<span class="badge badge-pending">Esperando adulto</span>';
  else action=`<button class="btn btn-main" data-act="done" data-id="${m.id}">Fiz!</button>`;
  return `<li class="mission ${m.status}"><span class="item-icon">${esc(m.icon)}</span><span class="item-body"><strong>${esc(m.title)}</strong><small>+${m.star_reward} ⭐ · +${m.xp_reward} XP${period}</small></span>${action}</li>`;
}
function missionsView(){const done=snap.missions.filter((m)=>m.status==='done').length;return `<div class="panel-title"><h2>Missões de hoje</h2><span class="badge badge-soft">${done}/${snap.missions.length}</span></div><p class="hint">${parentMode?'Confirme o que foi realizado.':'Faça no mundo real, toque em “Fiz!” e um adulto confirma.'}</p><ul class="mission-list">${snap.missions.map(missionHTML).join('')}</ul>`;}
function rewardsView(){
  const rows=snap.rewards.map((r)=>{const can=snap.wallet>=r.cost;let act=r.pending?(parentMode?`<div><button class="btn btn-soft" data-act="deny" data-id="${r.id}">↩</button> <button class="btn btn-ok" data-act="deliver" data-id="${r.id}">✓</button></div>`:'<span class="badge badge-pending">Pedido feito</span>'):(can&&!parentMode?`<button class="btn btn-gold" data-act="redeem" data-id="${r.id}">Trocar</button>`:`<span class="badge badge-soft">${r.cost} ⭐</span>`);return `<li class="reward"><span class="item-icon">${esc(r.icon)}</span><span class="item-body"><strong>${esc(r.title)}</strong><small>${r.pending?'Esperando um adulto':can?'Você já tem estrelas suficientes':`Faltam ${Math.max(0,r.cost-snap.wallet)} estrelas`}</small></span>${act}</li>`;}).join('');
  return `<div class="panel-title"><h2>Prêmios combinados</h2><span class="badge badge-soft">${snap.wallet} ⭐</span></div><p class="hint">As estrelas viram experiências e combinados reais — nada é comprado dentro do jogo.</p><ul class="reward-list">${rows}</ul>`;
}
function houseView(){const level=levelOf(snap.xp);return `<div class="panel-title"><h2>Casa do ${esc(snap.petName)}</h2><span class="badge badge-soft">Nível ${level}</span></div><p class="hint">Sua rotina transforma o mundo do ${esc(snap.petName)}. Continue evoluindo para liberar novos cantinhos.</p>${worldMomentView()}<div class="house-grid">${HOUSE_ITEMS.map((it)=>`<article class="house-item ${level<it.level?'locked':''}"><span class="hi">${level<it.level?'🔒':it.icon}</span><strong>${esc(it.title)}</strong><small>${esc(it.text)}</small><em>${level<it.level?`Libera no nível ${it.level}`:'Desbloqueado ✓'}</em></article>`).join('')}</div>${companionJournalView()}${discoveryAlbumView()}`;}
function rankRows(items=[]){const max=Math.max(1,...items.map((i)=>Number(i.points)||0));return items.map((it,i)=>`<li class="${it.me||it.mine?'me':''}"><span class="rank-pos">${i+1}</span><span class="rank-avatar">${esc(it.avatar||'🌟')}</span><span><span class="rank-name">${esc(it.nickname||'Família')}</span><span class="rank-bar"><i style="width:${Math.round((Number(it.points)||0)/max*100)}%"></i></span></span><span class="rank-points">${Number(it.points)||0} ⭐</span></li>`).join('');}
function familyView(){
  const goal=snap.familyGoal||{current:snap.weekPoints,target:500};let extra='';
  for(const c of snap.challenges||[]){const done=Number(c.done||0),target=Number(c.target_days||1);extra+=`<div class="challenge-card"><strong>${esc(c.icon||'🎯')} ${esc(c.title)}</strong><div class="dots">${Array.from({length:Math.min(target,14)},(_,i)=>`<i class="${i<done?'on':''}"></i>`).join('')}</div><small>${done} de ${target} dias${c.prize?` · Prêmio: ${esc(c.prize)}`:''}</small></div>`;}
  return `<div class="panel-title"><h2>Juntos é mais divertido</h2><span class="badge badge-soft">esta semana</span></div><div class="family-summary"><div class="stat-card"><span>Sequência do ${esc(snap.petName)}</span><strong>🔥 ${snap.streak||0} dias</strong></div><div class="stat-card"><span>Meta da família</span><strong>${goal.current}/${goal.target} ⭐</strong></div></div><p class="hint">Se um dia for diferente, tudo bem. A maior vitória é voltar e continuar.</p>${extra}<h3>Placar da família</h3><ul class="rank-list">${rankRows(snap.ranking)}</ul>${(snap.leagues||[]).map((l)=>`<h3>${esc(l.name)}</h3><ul class="rank-list">${rankRows(l.families)}</ul>`).join('')}`;
}
function visualView(){
  const level=levelOf(snap.xp);const colors=Object.entries(COLORS).map(([id,c])=>`<button class="color-dot" data-act="color" data-id="${id}" aria-label="${c.name}" aria-pressed="${snap.look?.color===id}" style="background:linear-gradient(135deg,${c.g[0]},${c.g[2]})"></button>`).join('');
  const choices=(list,type)=>list.map((x)=>{const locked=level<x.level;return `<button class="choice ${locked?'locked':''}" data-act="${type}" data-id="${x.id}" ${locked?'aria-disabled="true"':''} aria-pressed="${snap.look?.[type==='hat'?'hat':'acc']===x.id}"><span>${locked?'🔒':x.em}</span>${esc(x.name)}${locked?`<small>Nível ${x.level}</small>`:''}</button>`}).join('');
  const names=PET_NAMES.map((name)=>`<button class="name-chip" data-act="name" data-id="${esc(name)}" aria-pressed="${snap.petName===name}">${esc(name)}</button>`).join('');return `<div class="panel-title"><h2>Meu ${esc(snap.petName)}</h2><span class="badge badge-soft">Nível ${level}</span></div><div class="visual-preview" id="visualPreview">${petMarkup('preview')}</div><label class="field">Nome<input class="input" id="petNameInput" maxlength="12" value="${esc(snap.petName)}"></label><div class="name-suggestions compact">${names}</div><strong class="picker-title">Cor</strong><div class="color-picker">${colors}</div><strong class="picker-title">Chapéu</strong><div class="choices">${choices(HATS,'hat')}</div><strong class="picker-title">Acessório</strong><div class="choices">${choices(ACCS,'acc')}</div>`;
}
function renderPanel(){
  if(!snap)return;document.querySelectorAll('.nav-item').forEach((b)=>b.classList.toggle('active',b.dataset.tab===tab));
  $('panel').innerHTML=tab==='missoes'?missionsView():tab==='casa'?houseView():tab==='premios'?rewardsView():tab==='familia'?familyView():tab==='jogos'?arcade.view():visualView();
  if(tab==='visual'){const svg=$('visualPreview')?.querySelector('svg');applyLook(svg,snap.look,snap.xp);$('petNameInput')?.addEventListener('change',async(e)=>{await savePet(e.target.value,snap.look)});}
}
function renderAll(){companionProfileState=companionJournal.observe(snap);renderStats();syncWorldLife();renderNext();renderPanel();}
function missionReaction(m){performCompanionAction(missionCompanionAction(m));}
function checkFresh(prev,next){
  if(prev){for(const m of next.missions||[]){const old=prev.missions?.find((x)=>x.id===m.id);if(old?.status==='pending'&&m.status==='done'){jump();burst(['⭐','✨',m.icon],14);missionReaction(m);}}}
  const seen=new Set(seenList(seenRewardKey));const fresh=(next.recentRewards||[]).filter((r)=>!seen.has(r.id));if(fresh.length){const r=fresh.at(-1);markSeen(seenRewardKey,r.id);if(r.status==='delivered'){jump();burst(['🎉','🎁','✨',r.icon],18);toast('Prêmio entregue!',r.title)}else{say('Esse prêmio ficou para depois. Suas estrelas voltaram!');}}
  if(next.dailyBonusDay&&!seenList(seenDayKey).includes(next.dailyBonusDay)){markSeen(seenDayKey,next.dailyBonusDay);openModal('celebrationModal');burst(['🎉','⭐','✨','💜'],22);jump();}
}
async function refresh(){if(!api||refreshing)return;refreshing=true;try{const next=await api.snapshot();if(!next){if(api.kind==='cloud'){unsubscribe();if(!qaEnabled)childNotifications.refresh(api);openModal('connectModal');}return}const prev=snap;snap=next;checkFresh(prev,next);renderAll();arcade.onSnapshot(prev,next);if(!qaEnabled)childNotifications.refresh(api);}catch(e){console.warn(e)}finally{refreshing=false}}
async function startLocal(){if(!qaEnabled)childNotifications.refresh(null);unsubscribe();api=qaController?.api||createLocal();snap=await api.snapshot();closeModal('connectModal');renderAll();arcade.onSnapshot(null,snap);unsubscribe=api.subscribe(refresh);if(!uiStorage.getItem('desafia-local-onboarded'))openModal('onboardingModal');}
async function startCloud(){unsubscribe();api=createCloud(kidSb);const next=await api.snapshot();if(!next){childNotifications.refresh(api);openModal('connectModal');return false}snap=next;closeModal('connectModal');renderAll();arcade.onSnapshot(null,snap);unsubscribe=api.subscribe(refresh);childNotifications.refresh(api);return true;}
async function savePet(name,look){try{await api.savePet(name,look);await refresh()}catch(e){toast('Não foi possível salvar',friendlyError(e));}}

$('codeInput').addEventListener('input',(e)=>{const raw=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);e.target.value=raw.length>4?`${raw.slice(0,4)}-${raw.slice(4)}`:raw;});
$('codeBtn').addEventListener('click',async()=>{if(qaEnabled)return;const code=$('codeInput').value;const btn=$('codeBtn');$('codeError').textContent='';btn.disabled=true;try{api=createCloud(kidSb);await api.pair(code);await startCloud();openModal('onboardingModal');}catch(e){$('codeError').textContent=friendlyError(e)}finally{btn.disabled=false}});
$('localBtn').addEventListener('click',startLocal);

let onboardLook={color:'rosa',hat:'none',acc:'none'};
function syncOnboardNames(){const value=$('onboardName').value.trim();$('onboardNames').querySelectorAll('[data-name-choice]').forEach((b)=>b.setAttribute('aria-pressed',String(b.dataset.nameChoice===value)))}
$('onboardNames').innerHTML=PET_NAMES.map((name)=>`<button type="button" class="name-chip" data-name-choice="${esc(name)}">${esc(name)}</button>`).join('');
$('onboardNames').addEventListener('click',(e)=>{const b=e.target.closest('[data-name-choice]');if(!b)return;$('onboardName').value=b.dataset.nameChoice;syncOnboardNames();syncPetLabels()});
$('onboardName').addEventListener('input',()=>{syncOnboardNames();syncPetLabels()});
syncOnboardNames();
$('onboardColors').innerHTML=Object.entries(COLORS).map(([id,c])=>`<button class="color-dot" data-color="${id}" aria-label="${c.name}" style="background:linear-gradient(135deg,${c.g[0]},${c.g[2]})"></button>`).join('');
$('onboardColors').addEventListener('click',(e)=>{const b=e.target.closest('[data-color]');if(!b)return;onboardLook.color=b.dataset.color;applyLook($('onboardPet').querySelector('svg'),onboardLook,0);$('onboardColors').querySelectorAll('button').forEach((x)=>x.setAttribute('aria-pressed',String(x===b)));});
$('onboardDone').addEventListener('click',async()=>{const name=$('onboardName').value.trim()||'Pipo';try{await savePet(name,onboardLook);uiStorage.setItem(api.kind==='local'?'desafia-local-onboarded':'desafia-cloud-onboarded','1');closeModal('onboardingModal');say(`Oi! Eu sou o ${name}. Vamos crescer juntos?`,3000)}catch(e){$('onboardError').textContent=friendlyError(e)}});
applyLook($('connectPet').querySelector('svg'),{color:'lilas'},0);applyLook($('onboardPet').querySelector('svg'),onboardLook,0);

function gate(){return new Promise((resolve)=>{const a=2+Math.floor(Math.random()*8),b=2+Math.floor(Math.random()*8);$('gateQ').textContent=`${a} × ${b} = ?`;$('gateInput').value='';$('gateError').textContent='';openModal('gateModal');const ok=()=>{if(Number($('gateInput').value)===a*b){cleanup();closeModal('gateModal');resolve(true)}else $('gateError').textContent='Tente de novo.'};const cancel=()=>{cleanup();closeModal('gateModal');resolve(false)};const cleanup=()=>{$('gateOk').removeEventListener('click',ok);$('gateCancel').removeEventListener('click',cancel)};$('gateOk').addEventListener('click',ok);$('gateCancel').addEventListener('click',cancel);});}
async function openAdults(){
  if(qaEnabled){parentMode=!parentMode;tab='missoes';expandPanel();renderPanel();return;}
  if(!(await gate()))return;
  try{uiStorage.setItem(panelStateKey,document.querySelector('.game-shell')?.classList.contains('panel-collapsed')?'1':'0')}catch{}
  window.location.assign('/pais/');
}
$('adultsBtn').addEventListener('click',openAdults);
$('adultsQuickBtn').addEventListener('click',openAdults);
$('adultsClose').addEventListener('click',()=>closeModal('adultsModal'));
$('celebrationClose').addEventListener('click',()=>closeModal('celebrationModal'));
$('celebrationAdventure').addEventListener('click',()=>{closeModal('celebrationModal');openAdventure();});
$('adventureBtn').addEventListener('click',openAdventure);
$('adventureClose').addEventListener('click',()=>closeModal('adventureModal'));
$('adventureModal').addEventListener('click',(e)=>{if(e.target===$('adventureModal'))closeModal('adventureModal');});
$('adventureBody').addEventListener('click',(e)=>{const b=e.target.closest('[data-adventure-choice]');if(b)chooseAdventure(b.dataset.adventureChoice,b);});
$('familyGoalBtn').addEventListener('click',()=>{tab='familia';expandPanel();renderPanel();});
const petButton=$('pet');
petButton.addEventListener('pointerdown',()=>{
  suppressPetClick=false;
  clearTimeout(petHoldTimer);
  petHoldTimer=setTimeout(()=>{suppressPetClick=true;petHug();},650);
});
['pointerup','pointercancel','pointerleave'].forEach((type)=>petButton.addEventListener(type,()=>clearTimeout(petHoldTimer)));
petButton.addEventListener('contextmenu',(e)=>e.preventDefault());
petButton.addEventListener('click',()=>{
  if(suppressPetClick){suppressPetClick=false;return}
  clearTimeout(petClickTimer);
  petClickTimer=setTimeout(petReaction,230);
});
petButton.addEventListener('dblclick',(e)=>{e.preventDefault();clearTimeout(petClickTimer);petHighFive();});
document.querySelectorAll('[data-companion-action]').forEach((el)=>el.addEventListener('click',()=>{
  if(el.disabled)return;
  rememberInteraction(el.id);
  performCompanionAction(worldCompanionAction(el.id,petName()));
}));
document.querySelectorAll('[data-world-detail]').forEach((el)=>el.addEventListener('click',()=>{if(!el.disabled)runWorldRoutine(el.id);}));
$('sceneTreasure').addEventListener('click',()=>{if(!$('sceneTreasure').disabled)runWorldRoutine('sceneTreasure');});
scheduleCompanionIdle();
scheduleWorldRoutine();
document.querySelector('.game-nav').addEventListener('click',(e)=>{const b=e.target.closest('[data-tab]');if(!b)return;tab=b.dataset.tab;renderPanel();});
document.addEventListener('click',(e)=>{const b=e.target.closest('[data-tab-go]');if(!b)return;tab=b.dataset.tabGo;expandPanel();renderPanel();});

async function action(act,id,el){if(!api)return;el?.setAttribute('disabled','');try{
  if(act==='done'){await api.markDone(id);toast('Missão enviada','Um adulto vai confirmar.');}
  if(act==='redeem'){await api.requestReward(id);toast('Pedido enviado','Agora é só combinar com um adulto.');}
  if(api.kind==='local'&&act==='approve')await api.decideMission(id,true);
  if(api.kind==='local'&&act==='reject')await api.decideMission(id,false);
  if(api.kind==='local'&&act==='deliver')await api.decideReward(id,true);
  if(api.kind==='local'&&act==='deny')await api.decideReward(id,false);
  if(act==='name'){await savePet(id,snap.look);say(`Agora eu sou ${id}! 💜`,1500);return}
  if(['color','hat','acc'].includes(act)){
    const level=levelOf(snap.xp),source=act==='hat'?HATS:act==='acc'?ACCS:null,item=source?.find((x)=>x.id===id);if(item&&level<item.level)return;
    const look={...snap.look};if(act==='color')look.color=id;else look[act]=id;await savePet(snap.petName,look);return;
  }
  await refresh();
}catch(e){toast('Ops',friendlyError(e))}finally{el?.removeAttribute('disabled')}}
document.addEventListener('click',(e)=>{const b=e.target.closest('[data-act]');if(b)action(b.dataset.act,b.dataset.id,b);});

(async function boot(){
  if(qaEnabled){
    const { mountQA } = await import('./qa.js');
    qaController=mountQA({
      storage:uiStorage, beforeChange:()=>arcade.close(),
      onChange:async()=>{api=qaController.api;await refresh();await arcade.refresh();},
      onboarding:(show)=>{closeModal('connectModal');closeModal('celebrationModal');show?openModal('onboardingModal'):closeModal('onboardingModal');},
      games:()=>{tab='jogos';expandPanel();renderPanel();},
      allMode:qaAllEnabled
    });
    if(qaAllEnabled)await qaController.unlockEverything();
    await startLocal();
    await arcade.refresh();
    return;
  }
  setupPWA();
  if(supabaseReady){try{if(await startCloud())return}catch(e){console.warn('cloud boot',e)}}
  openModal('connectModal');
})();
