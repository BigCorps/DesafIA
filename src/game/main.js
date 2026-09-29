import './game.css';
import { petMarkup, applyLook, COLORS, HATS, ACCS } from '../shared/pet.js';
import { HOUSE_ITEMS, levelOf, levelProgress } from '../shared/progression.js';
import { createKidSupabase, supabaseReady, friendlyError } from '../lib/supabase.js';
import { createCloud } from './cloud.js';
import { createLocal } from './local.js';

const $=(id)=>document.getElementById(id);
const esc=(v)=>String(v??'').replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const seenRewardKey='desafia-seen-rewards-v3';
const seenDayKey='desafia-seen-day-v3';
const TIMES=['dia','tarde','noite'];
const PERIOD={manha:'de manhã',tarde:'à tarde',noite:'à noite'};

let api=null,snap=null,tab='missoes',parentMode=false,unsubscribe=()=>{},refreshing=false;
const kidSb=createKidSupabase();

$('petMount').innerHTML=petMarkup('main');
$('connectPet').innerHTML=petMarkup('connect');
$('onboardPet').innerHTML=petMarkup('onboard');
const petSvg=$('petMount').querySelector('svg');
const mouth=petSvg.querySelector('.mouth');

let timeIdx=(()=>{const h=new Date().getHours();return h>=6&&h<17?0:h<19?1:2})();
$('scene').dataset.time=TIMES[timeIdx];
$('skyBtn').addEventListener('click',()=>{timeIdx=(timeIdx+1)%3;$('scene').dataset.time=TIMES[timeIdx];});

function openModal(id){$(id).classList.add('open');}
function closeModal(id){$(id).classList.remove('open');}
function toast(title,text){$('toastTitle').textContent=title;$('toastText').textContent=text;$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),2500);}
function say(text,ms=2200){const b=$('bubble');b.textContent=text;b.classList.add('show');clearTimeout(say.t);say.t=setTimeout(()=>b.classList.remove('show'),ms);}
function happy(){mouth?.setAttribute('d','M86 121 Q100 146 114 121 Z');mouth?.setAttribute('fill','#2A2350');clearTimeout(happy.t);happy.t=setTimeout(()=>{mouth?.setAttribute('d','M88 124 Q100 136 112 124');mouth?.setAttribute('fill','none');},1100);}
function jump(){happy();if(reduce)return;const p=$('pet');p.classList.remove('jump');void p.offsetWidth;p.classList.add('jump');}
function burst(chars=['⭐','✨','💜'],n=12){
  if(reduce)n=Math.min(n,3);const rect=$('pet').getBoundingClientRect(),scene=$('scene').getBoundingClientRect();
  const x=rect.left-scene.left+rect.width/2,y=rect.top-scene.top+rect.height/2;
  for(let i=0;i<n;i+=1){const e=document.createElement('span');e.className='particle';e.textContent=chars[i%chars.length];e.style.left=`${x}px`;e.style.top=`${y}px`;$('fx').appendChild(e);const a=Math.random()*Math.PI*2,d=55+Math.random()*85,dx=Math.cos(a)*d,dy=Math.sin(a)*d-45;e.animate([{transform:'translate(-50%,-50%) scale(.4)',opacity:1},{transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) scale(1.2)`,opacity:1,offset:.62},{transform:`translate(calc(-50% + ${dx}px),calc(-50% + ${dy+34}px)) scale(.75)`,opacity:0}],{duration:reduce?20:800+Math.random()*400,easing:'cubic-bezier(.2,.8,.3,1)'}).onfinish=()=>e.remove();}
}
function seenList(key){try{return JSON.parse(localStorage.getItem(key)||'[]')}catch{return[]}}
function markSeen(key,id){const a=[...new Set([...seenList(key),id])].slice(-100);localStorage.setItem(key,JSON.stringify(a));}

function renderStats(){
  if(!snap)return;const p=levelProgress(snap.xp);$('starCount').textContent=snap.wallet;$('petNameTitle').textContent=snap.petName;$('lvlText').textContent=`Nível ${p.level} · ${p.remaining} XP para o próximo`;$('xpFill').style.width=`${p.pct}%`;$('xpBar').setAttribute('aria-valuenow',String(p.pct));applyLook(petSvg,snap.look,snap.xp);
  const goal=snap.familyGoal||{current:snap.weekPoints||0,target:500};$('familyGoalText').textContent=`${goal.current} / ${goal.target} ⭐`;$('familyGoalFill').style.width=`${Math.min(100,Math.round(goal.current/Math.max(1,goal.target)*100))}%`;
  const level=p.level;$('sceneTree').classList.toggle('unlocked',level>=5);$('sceneBooks').classList.toggle('unlocked',level>=4);$('scenePlant').classList.toggle('unlocked',level>=3);$('sceneTelescope').classList.toggle('unlocked',level>=7);
}
function nextMission(){return snap?.missions?.find((m)=>m.status==='todo'||m.status==='rejected')||null;}
function renderNext(){
  const m=nextMission();const box=$('nextCard');
  if(!snap){box.innerHTML='';return}
  if(!m){const pending=snap.missions?.some((x)=>x.status==='pending');box.innerHTML=`<div class="next-row"><span class="next-icon">${pending?'⏳':'🌟'}</span><div class="next-body"><small>${pending?'Quase lá':'Tudo feito por aqui'}</small><strong>${pending?'Um adulto ainda vai confirmar':'O Pipo está orgulhoso de você!'}</strong></div></div>`;return;}
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
function houseView(){const level=levelOf(snap.xp);return `<div class="panel-title"><h2>Casa do ${esc(snap.petName)}</h2><span class="badge badge-soft">Nível ${level}</span></div><p class="hint">Sua rotina transforma o mundo do ${esc(snap.petName)}. Continue evoluindo para liberar novos cantinhos.</p><div class="house-grid">${HOUSE_ITEMS.map((it)=>`<article class="house-item ${level<it.level?'locked':''}"><span class="hi">${level<it.level?'🔒':it.icon}</span><strong>${esc(it.title)}</strong><small>${esc(it.text)}</small><em>${level<it.level?`Libera no nível ${it.level}`:'Desbloqueado ✓'}</em></article>`).join('')}</div>`;}
function rankRows(items=[]){const max=Math.max(1,...items.map((i)=>Number(i.points)||0));return items.map((it,i)=>`<li class="${it.me||it.mine?'me':''}"><span class="rank-pos">${i+1}</span><span class="rank-avatar">${esc(it.avatar||'🌟')}</span><span><span class="rank-name">${esc(it.nickname||'Família')}</span><span class="rank-bar"><i style="width:${Math.round((Number(it.points)||0)/max*100)}%"></i></span></span><span class="rank-points">${Number(it.points)||0} ⭐</span></li>`).join('');}
function familyView(){
  const goal=snap.familyGoal||{current:snap.weekPoints,target:500};let extra='';
  for(const c of snap.challenges||[]){const done=Number(c.done||0),target=Number(c.target_days||1);extra+=`<div class="challenge-card"><strong>${esc(c.icon||'🎯')} ${esc(c.title)}</strong><div class="dots">${Array.from({length:Math.min(target,14)},(_,i)=>`<i class="${i<done?'on':''}"></i>`).join('')}</div><small>${done} de ${target} dias${c.prize?` · Prêmio: ${esc(c.prize)}`:''}</small></div>`;}
  return `<div class="panel-title"><h2>Juntos é mais divertido</h2><span class="badge badge-soft">esta semana</span></div><div class="family-summary"><div class="stat-card"><span>Sequência do ${esc(snap.petName)}</span><strong>🔥 ${snap.streak||0} dias</strong></div><div class="stat-card"><span>Meta da família</span><strong>${goal.current}/${goal.target} ⭐</strong></div></div><p class="hint">Se um dia for diferente, tudo bem. A maior vitória é voltar e continuar.</p>${extra}<h3>Placar da família</h3><ul class="rank-list">${rankRows(snap.ranking)}</ul>${(snap.leagues||[]).map((l)=>`<h3>${esc(l.name)}</h3><ul class="rank-list">${rankRows(l.families)}</ul>`).join('')}`;
}
function visualView(){
  const level=levelOf(snap.xp);const colors=Object.entries(COLORS).map(([id,c])=>`<button class="color-dot" data-act="color" data-id="${id}" aria-label="${c.name}" aria-pressed="${snap.look?.color===id}" style="background:linear-gradient(135deg,${c.g[0]},${c.g[2]})"></button>`).join('');
  const choices=(list,type)=>list.map((x)=>{const locked=level<x.level;return `<button class="choice ${locked?'locked':''}" data-act="${type}" data-id="${x.id}" ${locked?'aria-disabled="true"':''} aria-pressed="${snap.look?.[type==='hat'?'hat':'acc']===x.id}"><span>${locked?'🔒':x.em}</span>${esc(x.name)}${locked?`<small>Nível ${x.level}</small>`:''}</button>`}).join('');
  return `<div class="panel-title"><h2>Meu ${esc(snap.petName)}</h2><span class="badge badge-soft">Nível ${level}</span></div><div class="visual-preview" id="visualPreview">${petMarkup('preview')}</div><label class="field">Nome<input class="input" id="petNameInput" maxlength="12" value="${esc(snap.petName)}"></label><strong class="picker-title">Cor</strong><div class="color-picker">${colors}</div><strong class="picker-title">Chapéu</strong><div class="choices">${choices(HATS,'hat')}</div><strong class="picker-title">Acessório</strong><div class="choices">${choices(ACCS,'acc')}</div>`;
}
function renderPanel(){
  if(!snap)return;document.querySelectorAll('.nav-item').forEach((b)=>b.classList.toggle('active',b.dataset.tab===tab));
  $('panel').innerHTML=tab==='missoes'?missionsView():tab==='casa'?houseView():tab==='premios'?rewardsView():tab==='familia'?familyView():visualView();
  if(tab==='visual'){const svg=$('visualPreview')?.querySelector('svg');applyLook(svg,snap.look,snap.xp);$('petNameInput')?.addEventListener('change',async(e)=>{await savePet(e.target.value,snap.look)});}
}
function renderAll(){renderStats();renderNext();renderPanel();}
function missionReaction(m){const map={'🪥':'Meu sorriso também ficou brilhando!','📚':'Histórias deixam meu mundo maior!','💧':'Ahhh, água faz bem!','🧸':'Tudo organizado. Que alívio!','✏️':'Missão inteligente concluída!','🛏️':'Que quarto gostoso!'};say(map[m?.icon]||'Você conseguiu! Estou crescendo com você!');}
function checkFresh(prev,next){
  if(prev){for(const m of next.missions||[]){const old=prev.missions?.find((x)=>x.id===m.id);if(old?.status==='pending'&&m.status==='done'){jump();burst(['⭐','✨',m.icon],14);missionReaction(m);}}}
  const seen=new Set(seenList(seenRewardKey));const fresh=(next.recentRewards||[]).filter((r)=>!seen.has(r.id));if(fresh.length){const r=fresh.at(-1);markSeen(seenRewardKey,r.id);if(r.status==='delivered'){jump();burst(['🎉','🎁','✨',r.icon],18);toast('Prêmio entregue!',r.title)}else{say('Esse prêmio ficou para depois. Suas estrelas voltaram!');}}
  if(next.dailyBonusDay&&!seenList(seenDayKey).includes(next.dailyBonusDay)){markSeen(seenDayKey,next.dailyBonusDay);openModal('celebrationModal');burst(['🎉','⭐','✨','💜'],22);jump();}
}
async function refresh(){if(!api||refreshing)return;refreshing=true;try{const next=await api.snapshot();if(!next){if(api.kind==='cloud'){unsubscribe();openModal('connectModal');}return}const prev=snap;snap=next;checkFresh(prev,next);renderAll();}catch(e){console.warn(e)}finally{refreshing=false}}
async function startLocal(){unsubscribe();api=createLocal();snap=await api.snapshot();closeModal('connectModal');renderAll();unsubscribe=api.subscribe(refresh);if(!localStorage.getItem('desafia-local-onboarded'))openModal('onboardingModal');}
async function startCloud(){unsubscribe();api=createCloud(kidSb);const next=await api.snapshot();if(!next){openModal('connectModal');return false}snap=next;closeModal('connectModal');renderAll();unsubscribe=api.subscribe(refresh);return true;}
async function savePet(name,look){try{await api.savePet(name,look);await refresh()}catch(e){toast('Não foi possível salvar',friendlyError(e));}}

$('codeInput').addEventListener('input',(e)=>{const raw=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,8);e.target.value=raw.length>4?`${raw.slice(0,4)}-${raw.slice(4)}`:raw;});
$('codeBtn').addEventListener('click',async()=>{const code=$('codeInput').value;const btn=$('codeBtn');$('codeError').textContent='';btn.disabled=true;try{api=createCloud(kidSb);await api.pair(code);await startCloud();openModal('onboardingModal');}catch(e){$('codeError').textContent=friendlyError(e)}finally{btn.disabled=false}});
$('localBtn').addEventListener('click',startLocal);

let onboardLook={color:'rosa',hat:'none',acc:'none'};
$('onboardColors').innerHTML=Object.entries(COLORS).map(([id,c])=>`<button class="color-dot" data-color="${id}" aria-label="${c.name}" style="background:linear-gradient(135deg,${c.g[0]},${c.g[2]})"></button>`).join('');
$('onboardColors').addEventListener('click',(e)=>{const b=e.target.closest('[data-color]');if(!b)return;onboardLook.color=b.dataset.color;applyLook($('onboardPet').querySelector('svg'),onboardLook,0);$('onboardColors').querySelectorAll('button').forEach((x)=>x.setAttribute('aria-pressed',String(x===b)));});
$('onboardDone').addEventListener('click',async()=>{const name=$('onboardName').value.trim()||'Pipo';try{await savePet(name,onboardLook);localStorage.setItem(api.kind==='local'?'desafia-local-onboarded':'desafia-cloud-onboarded','1');closeModal('onboardingModal');say(`Oi! Eu sou o ${name}. Vamos crescer juntos?`,3000)}catch(e){$('onboardError').textContent=friendlyError(e)}});
applyLook($('connectPet').querySelector('svg'),{color:'lilas'},0);applyLook($('onboardPet').querySelector('svg'),onboardLook,0);

function gate(){return new Promise((resolve)=>{const a=2+Math.floor(Math.random()*8),b=2+Math.floor(Math.random()*8);$('gateQ').textContent=`${a} × ${b} = ?`;$('gateInput').value='';$('gateError').textContent='';openModal('gateModal');const ok=()=>{if(Number($('gateInput').value)===a*b){cleanup();closeModal('gateModal');resolve(true)}else $('gateError').textContent='Tente de novo.'};const cancel=()=>{cleanup();closeModal('gateModal');resolve(false)};const cleanup=()=>{$('gateOk').removeEventListener('click',ok);$('gateCancel').removeEventListener('click',cancel)};$('gateOk').addEventListener('click',ok);$('gateCancel').addEventListener('click',cancel);});}
$('adultsBtn').addEventListener('click',async()=>{if(!(await gate()))return;if(api?.kind==='local'){parentMode=true;tab='missoes';renderAll();$('adultsBody').innerHTML='<p>Modo adulto local ativado. Você pode confirmar missões e prêmios diretamente nas abas do jogo.</p>';openModal('adultsModal');}else{$('adultsBody').innerHTML='<p>Use o portal dos pais para aprovar missões, criar desafios e administrar a família.</p><a class="btn btn-main btn-block" href="/pais/" target="_blank" rel="noopener">Abrir portal dos pais</a>';openModal('adultsModal')}});
$('adultsClose').addEventListener('click',()=>closeModal('adultsModal'));
$('celebrationClose').addEventListener('click',()=>closeModal('celebrationModal'));
$('familyGoalBtn').addEventListener('click',()=>{tab='familia';renderPanel();});
$('pet').addEventListener('click',()=>{jump();burst(['💜','✨'],7);say(['Oi! 💜','Você está indo muito bem!','Qual é nossa próxima missão?','Seu esforço deixa meu mundo mais bonito!'][Math.floor(Math.random()*4)])});
document.querySelector('.game-nav').addEventListener('click',(e)=>{const b=e.target.closest('[data-tab]');if(!b)return;tab=b.dataset.tab;renderPanel();});

async function action(act,id,el){if(!api)return;el?.setAttribute('disabled','');try{
  if(act==='done'){await api.markDone(id);toast('Missão enviada','Um adulto vai confirmar.');}
  if(act==='redeem'){await api.requestReward(id);toast('Pedido enviado','Agora é só combinar com um adulto.');}
  if(api.kind==='local'&&act==='approve')await api.decideMission(id,true);
  if(api.kind==='local'&&act==='reject')await api.decideMission(id,false);
  if(api.kind==='local'&&act==='deliver')await api.decideReward(id,true);
  if(api.kind==='local'&&act==='deny')await api.decideReward(id,false);
  if(['color','hat','acc'].includes(act)){
    const level=levelOf(snap.xp),source=act==='hat'?HATS:act==='acc'?ACCS:null,item=source?.find((x)=>x.id===id);if(item&&level<item.level)return;
    const look={...snap.look};if(act==='color')look.color=id;else look[act]=id;await savePet(snap.petName,look);return;
  }
  await refresh();
}catch(e){toast('Ops',friendlyError(e))}finally{el?.removeAttribute('disabled')}}
document.addEventListener('click',(e)=>{const b=e.target.closest('[data-act]');if(b)action(b.dataset.act,b.dataset.id,b);});

(async function boot(){
  if('serviceWorker'in navigator&&location.protocol==='https:')navigator.serviceWorker.register('/sw.js').catch(()=>{});
  if(supabaseReady){try{if(await startCloud())return}catch(e){console.warn('cloud boot',e)}}
  openModal('connectModal');
})();
