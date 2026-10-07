import './pais.css';
import { renderNotifications } from './notifications.js';
import { notifications } from '../shared/notifications.js';
import { createParentSupabase, supabaseReady, friendlyError } from '../lib/supabase.js';
import { levelOf } from '../shared/progression.js';
import { setupPWA } from '../shared/pwa.js';
import { initDistribution, isPlayDistribution } from '../shared/platform.js';
import { createBillingClient } from './billing.js';
import { GAMES, medalOf, MEDAL_ICON } from '../games/registry.js';

const $=(id)=>document.getElementById(id);
const esc=(v)=>String(v??'').replace(/[&<>"']/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sb=createParentSupabase();
const billing=createBillingClient(sb);
initDistribution();
let session=null,families=[],familyId=null,dash=null,tab='hoje',poll=null,entering=false;
let billingState={familyId:null,loading:false,data:null,error:''},billingPoll=null;

function toast(title,text){$('toastTitle').textContent=title;$('toastText').textContent=text;$('toast').classList.add('show');setTimeout(()=>$('toast').classList.remove('show'),2600)}
function stopBillingPoll(){if(billingPoll){clearInterval(billingPoll);billingPoll=null}}
function openInfo(html){$('modalBody').innerHTML=html;$('infoModal').classList.add('open')}
function closeInfo(){stopBillingPoll();$('infoModal').classList.remove('open')}
$('modalClose').addEventListener('click',closeInfo);
async function rpc(fn,args={}){const {data,error}=await sb.rpc(fn,args);if(error)throw error;return data}
function isPlus(){return Boolean(dash?.family?.plus)}
function fmtDate(v){if(!v)return '—';try{return new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(new Date(v))}catch{return v}}
function fmtMoney(cents){return new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format((Number(cents)||0)/100)}
function billingError(err){const code=String(err?.message||err||'');const map={billing_price_not_configured:'O preço do Plus ainda não foi configurado.',banco_inter_not_configured:'A cobrança PIX ainda não foi configurada no servidor.',billing_company_not_found:'A conta recebedora BigCorps não foi encontrada.',billing_pix_key_not_configured:'A chave PIX da BigCorps não está configurada.',pix_create_failed:'Não foi possível gerar o PIX agora. Tente novamente.',paid_amount_mismatch:'O valor recebido não confere com esta cobrança. O acesso não foi liberado automaticamente.',invoice_not_found:'Esta cobrança não foi encontrada.',invoice_without_pix:'Esta cobrança ainda não recebeu um PIX válido.',forbidden:'Você não tem permissão para administrar este plano.',unauthorized:'Sua sessão expirou. Entre novamente.'};return map[code]||friendlyError(err)}

function topNow(){requestAnimationFrame(()=>window.scrollTo({top:0,left:0,behavior:'auto'}))}
function showAuth(){clearInterval(poll);$('authView').hidden=false;$('setupView').hidden=true;$('appView').hidden=true;$('logoutBtn').hidden=true;$('familySelect').hidden=true;topNow()}
function showApp({scroll=true}={}){$('authView').hidden=true;$('setupView').hidden=true;$('appView').hidden=false;$('logoutBtn').hidden=false;$('familySelect').hidden=families.length<2;if(scroll)topNow()}
function showSetup(){$('authView').hidden=true;$('setupView').hidden=false;$('appView').hidden=true;$('logoutBtn').hidden=false;$('familySelect').hidden=true;topNow()}
function googleName(){
  const u=session?.user,meta=u?.user_metadata||{};
  return String(meta.given_name||meta.name||meta.full_name||u?.email?.split('@')[0]||'Responsável').trim().split(/\s+/)[0].slice(0,30)||'Responsável';
}
function suggestedFamily(){
  const meta=session?.user?.user_metadata||{};
  const full=String(meta.full_name||meta.name||'').trim();
  const parts=full.split(/\s+/).filter(Boolean);
  return parts.length>1?`Família ${parts.at(-1)}`:'';
}
function cleanAuthUrl(){
  if(location.hash||location.search){try{history.replaceState(null,'',new URL('/pais/',location.origin).pathname)}catch{}}
}

$('googleLoginBtn').addEventListener('click',async()=>{
  if(!supabaseReady){$('loginError').textContent='Configure VITE_SUPABASE_URL e a publishable key no Vercel.';return}
  const btn=$('googleLoginBtn');btn.disabled=true;$('loginError').textContent='';
  try{
    const redirect=new URL('/pais/',location.origin).href;
    const {error}=await sb.auth.signInWithOAuth({provider:'google',options:{redirectTo:redirect}});
    if(error)throw error;
  }catch(err){
    $('loginError').textContent=friendlyError(err);btn.disabled=false;
  }
});
$('logoutBtn').addEventListener('click',async()=>{notifications.logout();await sb.auth.signOut();session=null;showAuth()});

async function loadFamilies(){families=await rpc('my_families')||[];const sel=$('familySelect');sel.innerHTML=families.map((f)=>`<option value="${f.id}">${esc(f.name)}</option>`).join('');if(!familyId||!families.some((f)=>f.id===familyId))familyId=families[0]?.id||null;if(familyId)sel.value=familyId;}
$('familySelect').addEventListener('change',async(e)=>{familyId=e.target.value;billingState={familyId:null,loading:false,data:null,error:''};stopBillingPoll();await loadDashboard();if(tab==='config')await loadBillingStatus();});

function setupView(){
  const suggested=suggestedFamily();
  $('setupView').innerHTML=`<div class="setup-card setup-first"><div class="auth-hero"><img class="auth-logo" src="/icons/icon-192.png" alt="Logo DesafIA.app"></div><h1>Como vamos chamar sua família?</h1><p>É só isso para começar. Depois, no painel, você adiciona a criança e conecta o aparelho dela.</p><form class="form" id="createFamilyForm"><label class="field">Nome da família<input class="input" name="name" maxlength="60" required value="${esc(suggested)}" placeholder="Família Almeida" autocomplete="organization"></label><button class="btn btn-main btn-block">Criar família e continuar</button><div class="error" id="setupError"></div></form><p class="fine brand-credit">DesafIA.app <span>|</span> Desenvolvido por BigCorps <span>|</span> Tecnologia minhAi</p></div>`;
  $('createFamilyForm').addEventListener('submit',async(e)=>{e.preventDefault();const fd=new FormData(e.currentTarget),btn=e.submitter;if(btn)btn.disabled=true;$('setupError').textContent='';try{familyId=await rpc('create_family',{p_name:fd.get('name'),p_display_name:googleName(),p_avatar:'👤'});await loadFamilies();await loadDashboard()}catch(err){$('setupError').textContent=friendlyError(err)}finally{if(btn)btn.disabled=false}});
}

async function loadDashboard(silent=false){if(!familyId)return;try{dash=await rpc('parent_dashboard',{p_family:familyId});showApp({scroll:!silent});renderHeader();render();if(!silent){clearInterval(poll);poll=setInterval(()=>loadDashboard(true),12000)}}catch(err){if(!silent)toast('Não foi possível carregar',friendlyError(err))}}
function renderHeader(){const f=dash.family;const pending=(dash.pending_missions?.length||0)+(dash.pending_rewards?.length||0);$('pendingBadge').textContent=pending?String(pending):'';$('welcome').innerHTML=`<div><h1>Olá, ${esc(dash.me?.nickname||'responsável')} 👋</h1><p>${esc(f.name)} · ${dash.today}</p></div><span class="plan-pill ${f.plus?'plus':''}">${f.plus?'Plus ✦':'Plano grátis'}</span>`;document.querySelectorAll('.parent-nav button').forEach((b)=>b.classList.toggle('active',b.dataset.tab===tab));}
function empty(text){return `<div class="empty">${esc(text)}</div>`}
function stat(label,value){return `<div class="summary"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`}

function todayView(){
  const pm=dash.pending_missions||[],pr=dash.pending_rewards||[],mine=dash.my_missions||[];
  const missionRows=pm.length?`<ul class="rows">${pm.map((x)=>`<li class="row attention"><span class="row-icon">${esc(x.icon)}</span><span class="row-main"><strong>${esc(x.nickname)} · ${esc(x.title)}</strong><small>+${x.star_reward} ⭐ · +${x.xp_reward} XP · enviado ${fmtDate(x.created_at)}</small></span><span class="row-actions"><button class="btn btn-soft" data-act="mission-reject" data-id="${x.id}">Tentar de novo</button><button class="btn btn-ok" data-act="mission-approve" data-id="${x.id}">Aprovar</button></span></li>`).join('')}</ul>`:empty('Nenhuma missão esperando aprovação.');
  const rewardRows=pr.length?`<ul class="rows">${pr.map((x)=>`<li class="row attention"><span class="row-icon">${esc(x.icon)}</span><span class="row-main"><strong>${esc(x.nickname)} pediu: ${esc(x.title)}</strong><small>${x.cost} estrelas · ${fmtDate(x.created_at)}</small></span><span class="row-actions"><button class="btn btn-soft" data-act="reward-deny" data-id="${x.id}">Agora não</button><button class="btn btn-ok" data-act="reward-deliver" data-id="${x.id}">Entregue</button></span></li>`).join('')}</ul>`:empty('Nenhum prêmio esperando decisão.');
  const mineRows=mine.length?`<ul class="rows">${mine.map((m)=>`<li class="row"><span class="row-icon">${esc(m.icon)}</span><span class="row-main"><strong>${esc(m.title)}</strong><small>+${m.star_reward} ⭐ para a meta familiar</small></span>${m.done?'<span class="badge badge-done">Feito ✓</span>':`<button class="btn btn-main" data-act="parent-done" data-id="${m.id}">Fiz</button>`}</li>`).join('')}</ul>`:empty('Sem missões de adultos ativas.');
  return `<div class="grid"><section class="card"><h2>Visão de hoje</h2><div class="summary-grid">${stat('Pendências',String(pm.length+pr.length))}${stat('Meta da família',`${dash.family_goal.current}/${dash.family_goal.target} ⭐`)}${stat('Jogadores',String(dash.players.length))}${stat('Plano',dash.family.plus?'Plus':'Grátis')}</div></section><section class="card half"><h2>Missões para confirmar</h2><p class="lead">A estrela só entra depois da sua confirmação.</p>${missionRows}</section><section class="card half"><h2>Prêmios pedidos</h2><p class="lead">O pedido já reserva as estrelas; ao negar, elas voltam.</p>${rewardRows}</section><section class="card"><h2>Suas missões</h2><p class="lead">Adultos também podem contribuir para a meta da família.</p>${mineRows}</section></div>`;
}

function familyView(){
  const players=(dash.players||[]).map((p)=>{const devs=(p.devices||[]).map((d)=>`<div class="device"><span class="status-dot"></span><small>${esc(d.label||'Aparelho')} · visto ${fmtDate(d.last_seen_at)}</small><button class="btn btn-danger" data-act="revoke-device" data-id="${d.id}">Desconectar</button></div>`).join('');return `<li class="row"><span class="row-icon">${esc(p.avatar)}</span><div class="row-main"><strong>${esc(p.nickname)} ${p.kind==='adult'?'<span class="badge badge-soft">adulto</span>':''}</strong><small>Nível ${levelOf(p.xp)} · ${p.wallet} ⭐ · sequência ${p.streak||0} dias</small>${devs}</div><span class="row-actions">${p.kind==='child'?`<button class="btn btn-main" data-act="pair-code" data-id="${p.id}">Conectar aparelho</button>`:''}</span></li>`}).join('');
  return `<div class="grid"><section class="card"><h2>Sua família</h2><p class="lead">Cada criança pode ter um aparelho conectado por um segredo local. Nenhuma conta infantil é criada no Supabase Auth.</p><ul class="rows">${players}</ul></section><section class="card half"><h2>Adicionar criança</h2><p class="lead">Plano grátis: 1 criança. Plus: até 10.</p><form class="form" data-form="create-child"><div class="two"><label class="field">Apelido<input class="input" name="nickname" maxlength="30" required></label><label class="field">Avatar<select class="input" name="avatar"><option>🌸</option><option>🦊</option><option>🐼</option><option>🦄</option><option>🐯</option><option>🐸</option></select></label></div><button class="btn btn-main">Adicionar</button></form></section><section class="card half"><h2>Como conectar</h2><p class="lead">Gere o código aqui, abra o jogo no aparelho da criança e digite o código. Ele expira em 30 minutos e só funciona uma vez.</p><button class="btn btn-soft" data-act="open-game">Abrir jogo em nova aba</button></section></div>`;
}

function missionEditor(m){return `<li class="row"><span class="row-icon">${esc(m.icon)}</span><span class="row-main"><strong>${esc(m.title)} ${m.is_custom?'<span class="badge badge-plus">personalizada</span>':''}</strong><small>${m.audience==='adult'?'Adultos':'Crianças'} · ${m.star_reward} ⭐ · ${m.xp_reward} XP · ${m.time_of_day}</small></span><span class="row-actions"><button class="btn btn-soft" data-act="edit-mission" data-id="${m.id}">Editar</button>${m.is_custom?`<button class="btn btn-danger" data-act="delete-mission" data-id="${m.id}">Excluir</button>`:''}</span></li>`}
function routineView(){const child=dash.missions.filter((m)=>m.audience==='child'),adult=dash.missions.filter((m)=>m.audience==='adult');return `<div class="grid"><section class="card"><h2>Rotina das crianças</h2><p class="lead">Estrelas alimentam recompensas; XP controla a evolução de longo prazo do personagem.</p><ul class="rows">${child.map(missionEditor).join('')}</ul><h3>Missões dos adultos</h3><ul class="rows">${adult.map(missionEditor).join('')}</ul></section><section class="card">${isPlus()?`<h2>Nova missão personalizada</h2><form class="form" data-form="create-mission"><div class="two"><label class="field">Nome<input class="input" name="title" maxlength="60" required></label><label class="field">Ícone<input class="input" name="icon" maxlength="8" value="⭐"></label></div><div class="three"><label class="field">Para<select class="input" name="audience"><option value="child">Criança</option><option value="adult">Adulto</option></select></label><label class="field">Estrelas<input class="input" type="number" name="stars" min="1" max="500" value="20"></label><label class="field">XP<input class="input" type="number" name="xp" min="0" max="250" value="10"></label></div><label class="field">Período<select class="input" name="time"><option value="any">Qualquer hora</option><option value="manha">Manhã</option><option value="tarde">Tarde</option><option value="noite">Noite</option></select></label><button class="btn btn-main">Criar missão</button></form>`:`<div class="plus-lock"><strong>Missões personalizadas são Plus ✦</strong><p class="lead">No grátis, você pode ativar/desativar e ajustar estrelas/XP das missões padrão.</p></div>`}</section></div>`}
function rewardsView(){return `<div class="grid"><section class="card"><h2>Prêmios da família</h2><p class="lead">São combinados reais. O jogo infantil não vende nada.</p><ul class="rows">${dash.rewards.map((r)=>`<li class="row"><span class="row-icon">${esc(r.icon)}</span><span class="row-main"><strong>${esc(r.title)} ${r.is_custom?'<span class="badge badge-plus">personalizado</span>':''}</strong><small>${r.cost} estrelas · ${r.active?'ativo':'desligado'}</small></span><span class="row-actions"><button class="btn btn-soft" data-act="edit-reward" data-id="${r.id}">Editar</button>${r.is_custom?`<button class="btn btn-danger" data-act="delete-reward" data-id="${r.id}">Excluir</button>`:''}</span></li>`).join('')}</ul></section><section class="card">${isPlus()?`<h2>Novo prêmio</h2><form class="form" data-form="create-reward"><div class="two"><label class="field">Nome<input class="input" name="title" maxlength="60" required></label><label class="field">Ícone<input class="input" name="icon" maxlength="8" value="🎁"></label></div><label class="field">Custo em estrelas<input class="input" type="number" name="cost" min="1" max="10000" value="100"></label><button class="btn btn-main">Criar prêmio</button></form>`:`<div class="plus-lock"><strong>Prêmios personalizados são Plus ✦</strong><p class="lead">Os prêmios padrão continuam disponíveis no plano grátis.</p></div>`}</section></div>`}
function challengesView(){const list=(dash.challenges||[]).length?`<ul class="rows">${dash.challenges.map((c)=>`<li class="row"><span class="row-icon">🎯</span><span class="row-main"><strong>${esc(c.title)}</strong><small>${c.target_days} dias · ${esc(c.mission_title)}${c.prize?` · ${esc(c.prize)}`:''}</small></span><button class="btn btn-danger" data-act="delete-challenge" data-id="${c.id}">Excluir</button></li>`).join('')}</ul>`:empty('Nenhum desafio criado.');return `<div class="grid"><section class="card"><h2>Desafios</h2>${list}</section><section class="card">${isPlus()?`<h2>Novo desafio</h2><form class="form" data-form="create-challenge"><label class="field">Título<input class="input" name="title" maxlength="60" required placeholder="7 dias lendo juntos"></label><label class="field">Missão<select class="input" name="mission">${dash.missions.filter((m)=>m.audience==='child'&&m.active).map((m)=>`<option value="${m.id}">${esc(m.icon)} ${esc(m.title)}</option>`).join('')}</select></label><div class="two"><label class="field">Meta de dias<input class="input" type="number" name="days" min="1" max="60" value="7"></label><label class="field">Para<select class="input" name="player"><option value="">Todas as crianças</option>${dash.players.filter((p)=>p.kind==='child').map((p)=>`<option value="${p.id}">${esc(p.nickname)}</option>`).join('')}</select></label></div><label class="field">Prêmio especial (opcional)<input class="input" name="prize" maxlength="80"></label><button class="btn btn-main">Criar desafio</button></form>`:`<div class="plus-lock"><strong>Desafios fazem parte do Plus ✦</strong><p class="lead">O jogo básico, missões, estrelas e recompensas continuam funcionando no plano grátis.</p></div>`}</section></div>`}
function leagueView(){const list=(dash.leagues||[]).length?dash.leagues.map((l)=>`<section class="card"><h2>${esc(l.name)}</h2><p class="lead">Código: <strong>${esc(l.code||'visível ao responsável')}</strong></p><ul class="rows">${(l.families||[]).map((f,i)=>`<li class="row"><span class="row-icon">${i+1}</span><span class="row-main"><strong>${esc(f.avatar)} ${esc(f.nickname)}</strong><small>${f.points} estrelas na semana</small></span></li>`).join('')}</ul></section>`).join(''):'';return `<div class="grid">${list||'<section class="card">'+empty('Sua família ainda não participa de uma liga.')+'</section>'}<section class="card">${isPlus()?`<h2>Criar ou entrar em uma liga</h2><div class="two"><form class="form" data-form="create-league"><label class="field">Nome da liga<input class="input" name="name" required maxlength="40"></label><label class="field">Apelido da família<input class="input" name="nickname" required maxlength="30" value="${esc(dash.family.name)}"></label><button class="btn btn-main">Criar liga</button></form><form class="form" data-form="join-league"><label class="field">Código<input class="input" name="code" required maxlength="9"></label><label class="field">Apelido da família<input class="input" name="nickname" required maxlength="30" value="${esc(dash.family.name)}"></label><button class="btn btn-soft">Entrar</button></form></div>`:`<div class="plus-lock"><strong>Ligas entre famílias são Plus ✦</strong><p class="lead">A competição é opcional; a meta cooperativa da própria família existe em todos os planos.</p></div>`}</section></div>`}
function plusBenefits(features=[]){const fallback=['Até 10 crianças na família','Missões personalizadas','Prêmios personalizados','Desafios em família','Ligas entre famílias','3 jogos extras e Tesouros do Parque'];return `<ul class="plan-benefits">${(features.length?features:fallback).map((x)=>`<li>✓ ${esc(x)}</li>`).join('')}</ul>`}
function planView(){
  const active=Boolean(dash.family.plus),expires=dash.family.plan_expires_at;
  if(isPlayDistribution()){
    return `<div class="plan-card-head"><div><span class="plan-kicker">${active?'PLUS ATIVO':'PLANO ATUAL'}</span><strong>${active?'DesafIA Plus ✦':'Grátis'}</strong></div>${active&&expires?`<span class="plan-valid">até ${fmtDate(expires)}</span>`:''}</div>${plusBenefits(billingState.data?.plan?.features)}<div class="play-billing-note"><strong>App da Google Play</strong><p>${active?'Seu Plus é reconhecido automaticamente neste app.':'A contratação e a renovação do Plus são feitas fora deste aplicativo. Ao entrar com a mesma conta Google, o acesso é reconhecido automaticamente.'}</p></div>`;
  }
  if(billingState.loading&&!billingState.data)return `<div class="billing-loading">Carregando plano…</div>`;
  if(billingState.error&&!billingState.data)return `<p class="lead">${esc(billingState.error)}</p><button class="btn btn-soft btn-block" data-act="billing-refresh">Tentar novamente</button>`;
  const info=billingState.data,plan=info?.plan||{},pending=info?.pending_payment;
  const price=Number(plan.price_cents||0)>0?fmtMoney(plan.price_cents):'Preço em configuração';
  const configured=Boolean(info?.configured);
  return `<div class="plan-card-head"><div><span class="plan-kicker">${active?'PLUS ATIVO':'PLANO ATUAL'}</span><strong>${active?'DesafIA Plus ✦':'Grátis'}</strong></div>${active&&expires?`<span class="plan-valid">até ${fmtDate(expires)}</span>`:''}</div><div class="plan-price"><strong>${price}</strong><span>${Number(plan.price_cents||0)>0?'por 30 dias':''}</span></div>${plusBenefits(plan.features)}${pending?`<div class="pending-payment"><span>PIX aguardando pagamento</span><strong>${fmtMoney(pending.amount_cents)}</strong><button class="btn btn-main btn-block" data-act="billing-resume">Continuar pagamento</button></div>`:`<button class="btn btn-main btn-block" data-act="billing-create" ${configured?'':'disabled'}>${active?'Renovar Plus por 30 dias':'Ativar DesafIA Plus'}</button>`}${!configured?'<p class="billing-small">A infraestrutura está pronta. Falta configurar o valor mensal e/ou a credencial de cobrança no Supabase.</p>':'<p class="billing-small">Pagamento único por PIX para 30 dias de Plus. A renovação não é automática.</p>'}`;
}
function configView(){return `<div class="grid"><section class="card half"><h2>Configurações da família</h2><form class="form" data-form="update-family"><label class="field">Nome<input class="input" name="name" maxlength="60" value="${esc(dash.family.name)}"></label><label class="field">Meta semanal de estrelas<input class="input" type="number" min="100" max="10000" step="50" name="goal" value="${dash.family.weekly_goal}"></label><button class="btn btn-main">Salvar</button></form></section><section class="card half plan-card"><h2>Plano</h2>${planView()}</section><section class="card" id="notificationsSettings"></section><section class="card danger-zone"><h2>Privacidade e acesso</h2><p class="lead">Crianças não têm conta de e-mail. O aparelho guarda um segredo local que pode ser revogado aqui na aba Família. Sessões dos responsáveis usam o Supabase Auth.</p><a href="/privacidade/">Política de privacidade</a> · <a href="/termos/">Termos</a></section></div>`}

// ---------------------------------------------------------------------------
// Parque de minijogos (aba Jogos)
// ---------------------------------------------------------------------------
let playSettings=null,playLoadedFor=null,playLoadedAt=0,playLoading=false;
const PLAY_PRESETS=[0,10,30,60];
const fmtMin=(sec)=>{const m=Math.round((Number(sec)||0)/60);return `${m} min`};
async function loadPlaySettings(force=false){
  if(!familyId||playLoading)return;
  if(!force&&playLoadedFor===familyId&&Date.now()-playLoadedAt<20000)return;
  playLoading=true;
  try{playSettings=await rpc('parent_play_settings',{p_family:familyId});playLoadedFor=familyId;playLoadedAt=Date.now();}
  catch(err){playSettings={error:friendlyError(err)}}
  finally{playLoading=false}
  const box=$('playView');if(box)box.innerHTML=playInner();
}
function playInner(){
  const ps=playSettings;
  if(!ps)return '<section class="card"><p class="lead">Carregando…</p></section>';
  if(ps.error)return `<section class="card"><p class="lead">${esc(ps.error)}</p><button class="btn btn-soft" data-play="reload">Tentar de novo</button></section>`;
  const custom=!PLAY_PRESETS.includes(Number(ps.minutes));
  const opts=PLAY_PRESETS.map((m)=>`<button class="btn ${Number(ps.minutes)===m?'btn-main':'btn-soft'}" data-play="minutes" data-min="${m}">${m===0?'Desligado':`${m} min`}</button>`).join('');
  const kids=(ps.children||[]).map((c)=>{
    const left=Math.max(0,Number(ps.minutes)*60+Number(c.bonus_seconds||0)-Number(c.used_seconds||0));
    const m=c.missions||{};
    const state=!Number(m.total)?'Sem missões ativas hoje':m.ok?(c.opened_today?`Jogou ${fmtMin(c.used_seconds)} · restam ${fmtMin(left)}`:'Parque liberado, ainda não abriu'):`Missões: ${Number(m.done||0)}/${Number(m.total||0)} concluídas${m.waiting?` · ${m.waiting} para aprovar`:''}`;
    const best=Object.entries(c.best||{}).map(([id,v])=>{const g=GAMES.find((x)=>x.id===id);if(!g)return '';return `<span class="play-best" title="${esc(g.title)}">${g.icon} ${Number(v.best)||0}${MEDAL_ICON[medalOf(g,Number(v.best)||0)]?' '+MEDAL_ICON[medalOf(g,Number(v.best)||0)]:''}</span>`}).join('');
    const availableTotal=(ps.available_catalog||[]).length||GAMES.filter((g)=>ps.plus||g.tier!=='plus').length;
    return `<li><span class="row-main"><strong>${esc(c.avatar||'🌸')} ${esc(c.nickname)}</strong><small>${state}</small><small>Álbum: ${Number(c.unlocked_available??c.unlocked)||0}/${availableTotal} jogos disponíveis no plano</small>${best?`<span class="play-bests">${best}</span>`:''}</span>
      <span class="row-actions"><button class="btn btn-soft" data-play="bonus" data-id="${c.id}" data-min="15">+15 min hoje</button></span></li>`;
  }).join('');
  const games=GAMES.map((g)=>{const off=(ps.disabled||[]).includes(g.id),locked=g.tier==='plus'&&!ps.plus;return `<label class="play-game ${off?'off':''} ${locked?'plus-locked':''}"><input type="checkbox" data-play="toggle" data-id="${g.id}" ${off?'':'checked'} ${locked?'disabled':''}><span class="pg-ic" style="background:${g.color}">${g.icon}</span><span><strong>${esc(g.title)} ${g.tier==='plus'?'<span class="badge badge-plus">Plus ✦</span>':''}</strong><small>${locked?'Disponível no DesafIA Plus':`Idade ${g.ages}`}</small></span></label>`}).join('');
  return `<div class="grid">
    <section class="card"><h2>Parque de jogos</h2>
      <p class="lead">Quando a criança completa todas as missões do dia, o parque abre por um tempo que vocês escolhem. A cada dia completo, um jogo surpresa entra no álbum dela. Sem anúncios, sem compras e sem internet dentro dos jogos.</p>
      <h3>Tempo por dia</h3><div class="play-presets">${opts}</div>
      <label class="field play-custom">Outro tempo (minutos)<input class="input" type="number" min="0" max="180" step="5" data-play="custom" value="${custom?Number(ps.minutes):''}" placeholder="ex.: 45"></label>
      <label class="switch"><input type="checkbox" data-play="approval" ${ps.requires_approval?'checked':''}> Só liberar depois que um adulto aprovar todas as missões</label>
      <p class="lead" style="margin-top:8px">${ps.requires_approval?'Recomendado: evita que a criança toque em “Fiz!” só para abrir os jogos.':'O parque abre assim que a criança marcar todas as missões, mesmo antes da aprovação.'}</p>
    </section>
    <section class="card"><h2>Hoje</h2><ul class="rows">${kids||'<li><span class="row-main"><small>Adicione uma criança na aba Família.</small></span></li>'}</ul></section>
    <section class="card"><h2>Jogos disponíveis</h2><p class="lead">Desmarque os jogos que não quiser no álbum. O plano grátis mantém os 10 jogos originais; o Plus acrescenta novas experiências sem mudar o limite de tempo definido pela família.</p><div class="play-games">${games}</div></section>
  </div>`;
}
function gamesView(){setTimeout(()=>loadPlaySettings(),0);return `<div id="playView">${playInner()}</div>`}
async function savePlay(patch){
  const ps=playSettings;if(!ps||ps.error)return;
  const next={minutes:Number(ps.minutes),requires_approval:Boolean(ps.requires_approval),disabled:[...(ps.disabled||[])],...patch};
  try{
    await rpc('parent_update_play',{p_family:familyId,p_minutes:next.minutes,p_requires_approval:next.requires_approval,p_disabled:next.disabled});
    Object.assign(playSettings,next);
    toast('Pronto','Parque de jogos atualizado.');
  }catch(err){toast('Ops',friendlyError(err))}
  const box=$('playView');if(box)box.innerHTML=playInner();
}
document.addEventListener('click',async(e)=>{
  const b=e.target.closest('button[data-play]');if(!b)return;
  const act=b.dataset.play;
  if(act==='reload'){await loadPlaySettings(true);return}
  if(act==='minutes'){await savePlay({minutes:Number(b.dataset.min)});return}
  if(act==='bonus'){b.disabled=true;try{await rpc('parent_add_play_time',{p_family:familyId,p_player:b.dataset.id,p_minutes:Number(b.dataset.min)});toast('Tempo extra','+15 minutos só para hoje.');await loadPlaySettings(true)}catch(err){toast('Ops',friendlyError(err))}finally{b.disabled=false}}
});
document.addEventListener('change',async(e)=>{
  const t=e.target.closest('[data-play]');if(!t||t.tagName==='BUTTON')return;
  const act=t.dataset.play;
  if(act==='custom'){const v=Math.round(Number(t.value));if(!Number.isFinite(v)||t.value==='')return;await savePlay({minutes:Math.max(0,Math.min(180,v))});return}
  if(act==='approval'){await savePlay({requires_approval:t.checked});return}
  if(act==='toggle'){const set=new Set(playSettings?.disabled||[]);if(t.checked)set.delete(t.dataset.id);else set.add(t.dataset.id);await savePlay({disabled:[...set]});}
});
function render(){if(!dash)return;if(tab==='config'&&($('notificationsSettings')?.dataset.busy==='true'||document.activeElement?.closest?.('#notificationsSettings'))){renderHeader();return;}if(tab==='jogos'&&$('playView')&&document.activeElement?.closest?.('#playView')){renderHeader();return}renderHeader();$('view').innerHTML=tab==='hoje'?todayView():tab==='familia'?familyView():tab==='rotina'?routineView():tab==='premios'?rewardsView():tab==='desafios'?challengesView():tab==='liga'?leagueView():tab==='jogos'?gamesView():configView();if(tab==='config')renderNotifications({sb,familyId,root:$('notificationsSettings')});}

document.querySelector('.parent-nav').addEventListener('click',(e)=>{const b=e.target.closest('[data-tab]');if(!b)return;tab=b.dataset.tab;render();if(tab==='config')loadBillingStatus()});


async function loadBillingStatus({rerender=true}={}){
  if(!familyId||isPlayDistribution()){if(rerender&&tab==='config')render();return null}
  if(billingState.loading)return billingState.data;
  billingState={...billingState,familyId,loading:true,error:''};if(rerender&&tab==='config')render();
  try{const data=await billing.status(familyId);billingState={familyId,loading:false,data,error:''};return data}
  catch(err){billingState={familyId,loading:false,data:null,error:billingError(err)};return null}
  finally{if(rerender&&tab==='config')render()}
}
function copyText(value){if(navigator.clipboard?.writeText)return navigator.clipboard.writeText(value);const t=document.createElement('textarea');t.value=value;t.style.position='fixed';t.style.opacity='0';document.body.appendChild(t);t.select();document.execCommand('copy');t.remove();return Promise.resolve()}
function paymentModal(payment){
  const code=String(payment?.pix_code||''),qr=String(payment?.qr_code_url||''),amount=fmtMoney(payment?.amount_cents||0);
  openInfo(`<div class="pix-checkout"><div class="pix-mark">✦</div><h2>DesafIA Plus</h2><div class="pix-amount"><strong>${amount}</strong><span>30 dias de Plus</span></div>${qr?`<img class="pix-qr" src="${esc(qr)}" alt="QR Code PIX">`:''}<p class="pix-help">Escaneie o QR Code ou copie o PIX abaixo. A liberação acontece automaticamente após a confirmação.</p><div class="pix-copy"><code id="pixCode">${esc(code)}</code><button class="btn btn-soft" id="copyPix">Copiar PIX</button></div><div class="payment-wait" id="paymentWait"><span class="payment-pulse"></span><span id="paymentWaitText">Aguardando pagamento…</span></div><button class="btn btn-main btn-block" id="checkPayment">Já paguei · verificar agora</button><small class="billing-small">O PIX expira em ${fmtDate(payment?.expires_at)}.</small></div>`);
  $('copyPix')?.addEventListener('click',()=>copyText(code).then(()=>toast('PIX copiado','Cole no aplicativo do seu banco.')));
  $('checkPayment')?.addEventListener('click',()=>checkBillingPayment(payment.invoice_id,false));
  stopBillingPoll();billingPoll=setInterval(()=>checkBillingPayment(payment.invoice_id,true),4500);
}
async function checkBillingPayment(invoiceId,silent=true){
  if(!invoiceId||!familyId)return;
  const btn=$('checkPayment');if(btn&&!silent)btn.disabled=true;
  try{
    const result=await billing.check(familyId,invoiceId);
    if(result.status==='paid'){
      stopBillingPoll();
      if($('modalBody'))$('modalBody').innerHTML='<div class="payment-success"><div>🎉</div><h2>Plus liberado!</h2><p>O pagamento foi confirmado e os recursos Plus já estão disponíveis para sua família.</p></div>';
      await loadDashboard(true);await loadBillingStatus({rerender:false});if(tab==='config')render();toast('DesafIA Plus ativo','Pagamento confirmado.');
      return;
    }
    if(result.status==='expired'){
      stopBillingPoll();const t=$('paymentWaitText');if(t)t.textContent='Este PIX expirou. Feche e gere uma nova cobrança.';if(btn)btn.disabled=true;await loadBillingStatus({rerender:false});return;
    }
    const t=$('paymentWaitText');if(t&&!silent)t.textContent='Ainda aguardando a confirmação do PIX…';
  }catch(err){if(!silent)toast('Não foi possível verificar',billingError(err))}
  finally{if(btn&&!silent)btn.disabled=false}
}
async function beginBilling(){
  if(isPlayDistribution()){toast('Plano Plus','A contratação é feita fora do aplicativo da Google Play.');return}
  try{const result=await billing.create(familyId);if(!result?.payment)throw new Error('pix_create_failed');billingState={familyId,loading:false,data:{...(billingState.data||{}),pending_payment:result.payment},error:''};paymentModal(result.payment)}catch(err){toast('Não foi possível gerar o PIX',billingError(err))}
}

async function doAction(act,id){try{
  if(act==='billing-refresh'){await loadBillingStatus();return}
  if(act==='billing-create'){await beginBilling();return}
  if(act==='billing-resume'){const p=billingState.data?.pending_payment;if(p)paymentModal(p);else await beginBilling();return}
  if(act==='open-game'){window.location.assign('/');return}
  if(act==='mission-approve')await rpc('decide_mission',{p_log:id,p_approve:true});
  if(act==='mission-reject')await rpc('decide_mission',{p_log:id,p_approve:false});
  if(act==='reward-deliver')await rpc('decide_reward',{p_request:id,p_deliver:true});
  if(act==='reward-deny')await rpc('decide_reward',{p_request:id,p_deliver:false});
  if(act==='parent-done')await rpc('parent_mark_done',{p_player:dash.me.id,p_mission:id});
  if(act==='pair-code'){const x=await rpc('create_pairing_code',{p_player:id});const code=String(x.code||'');openInfo(`<h2>Conectar aparelho</h2><p>Abra o jogo no aparelho da criança e digite:</p><div class="code-box"><strong>${esc(code.slice(0,4))}-${esc(code.slice(4))}</strong><small>Válido por 30 minutos · uso único</small><button class="btn btn-main" id="copyCode">Copiar código</button></div>`);setTimeout(()=>$('copyCode')?.addEventListener('click',()=>navigator.clipboard?.writeText(code).then(()=>toast('Copiado','Código pronto para colar.'))),0);return}
  if(act==='revoke-device')await rpc('parent_revoke_device',{p_family:familyId,p_device:id});
  if(act==='delete-mission'&&confirm('Excluir esta missão personalizada?'))await rpc('parent_delete_mission',{p_family:familyId,p_mission:id});
  if(act==='delete-reward'&&confirm('Excluir este prêmio personalizado?'))await rpc('parent_delete_reward',{p_family:familyId,p_reward:id});
  if(act==='delete-challenge'&&confirm('Excluir este desafio?'))await rpc('parent_delete_challenge',{p_family:familyId,p_challenge:id});
  if(act==='edit-mission'){const m=dash.missions.find((x)=>x.id===id);openInfo(`<h2>Editar missão</h2><form class="form" id="editMission"><label class="field">Nome<input class="input" name="title" maxlength="60" value="${esc(m.title)}" ${!m.is_custom&&!isPlus()?'readonly':''}></label><div class="three"><label class="field">Ícone<input class="input" name="icon" maxlength="8" value="${esc(m.icon)}" ${!m.is_custom&&!isPlus()?'readonly':''}></label><label class="field">Estrelas<input class="input" type="number" name="stars" min="1" max="500" value="${m.star_reward}"></label><label class="field">XP<input class="input" type="number" name="xp" min="0" max="250" value="${m.xp_reward}"></label></div><label class="field">Período<select class="input" name="time"><option value="any">Qualquer hora</option><option value="manha">Manhã</option><option value="tarde">Tarde</option><option value="noite">Noite</option></select></label><label class="switch"><input type="checkbox" name="active" ${m.active?'checked':''}> Missão ativa</label><button class="btn btn-main">Salvar</button></form>`);setTimeout(()=>{const f=$('editMission');f.elements.time.value=m.time_of_day;f.addEventListener('submit',async(e)=>{e.preventDefault();const fd=new FormData(f);await rpc('parent_update_mission',{p_family:familyId,p_mission:id,p_title:fd.get('title'),p_icon:fd.get('icon'),p_star_reward:Number(fd.get('stars')),p_xp_reward:Number(fd.get('xp')),p_time_of_day:fd.get('time'),p_active:fd.get('active')==='on'});$('infoModal').classList.remove('open');await loadDashboard(true)})},0);return}
  if(act==='edit-reward'){const r=dash.rewards.find((x)=>x.id===id);openInfo(`<h2>Editar prêmio</h2><form class="form" id="editReward"><label class="field">Nome<input class="input" name="title" maxlength="60" value="${esc(r.title)}" ${!r.is_custom&&!isPlus()?'readonly':''}></label><div class="two"><label class="field">Ícone<input class="input" name="icon" maxlength="8" value="${esc(r.icon)}" ${!r.is_custom&&!isPlus()?'readonly':''}></label><label class="field">Custo<input class="input" type="number" name="cost" min="1" max="10000" value="${r.cost}"></label></div><label class="switch"><input type="checkbox" name="active" ${r.active?'checked':''}> Prêmio ativo</label><button class="btn btn-main">Salvar</button></form>`);setTimeout(()=>$('editReward').addEventListener('submit',async(e)=>{e.preventDefault();const fd=new FormData(e.currentTarget);await rpc('parent_update_reward',{p_family:familyId,p_reward:id,p_title:fd.get('title'),p_icon:fd.get('icon'),p_cost:Number(fd.get('cost')),p_active:fd.get('active')==='on'});$('infoModal').classList.remove('open');await loadDashboard(true)}),0);return}
  await loadDashboard(true);toast('Pronto','Alteração salva.');
}catch(err){toast('Ops',friendlyError(err))}}
document.addEventListener('click',(e)=>{const b=e.target.closest('[data-act]');if(b)doAction(b.dataset.act,b.dataset.id)});

document.addEventListener('submit',async(e)=>{const form=e.target.closest('[data-form]');if(!form)return;e.preventDefault();const fd=new FormData(form),name=form.dataset.form,btn=e.submitter;if(btn)btn.disabled=true;try{
  if(name==='create-child')await rpc('create_child',{p_family:familyId,p_nickname:fd.get('nickname'),p_avatar:fd.get('avatar')});
  if(name==='create-mission')await rpc('parent_create_mission',{p_family:familyId,p_title:fd.get('title'),p_icon:fd.get('icon'),p_audience:fd.get('audience'),p_star_reward:Number(fd.get('stars')),p_xp_reward:Number(fd.get('xp')),p_time_of_day:fd.get('time')});
  if(name==='create-reward')await rpc('parent_create_reward',{p_family:familyId,p_title:fd.get('title'),p_icon:fd.get('icon'),p_cost:Number(fd.get('cost'))});
  if(name==='create-challenge')await rpc('parent_create_challenge',{p_family:familyId,p_mission:fd.get('mission'),p_title:fd.get('title'),p_target_days:Number(fd.get('days')),p_prize:fd.get('prize')||null,p_player:fd.get('player')||null});
  if(name==='create-league'){const x=await rpc('create_league',{p_family:familyId,p_name:fd.get('name'),p_nickname:fd.get('nickname'),p_avatar:'🏡'});openInfo(`<h2>Liga criada</h2><p>Compartilhe este código com outra família Plus:</p><div class="code-box"><strong>${esc(x.code)}</strong></div>`)}
  if(name==='join-league')await rpc('join_league',{p_family:familyId,p_code:fd.get('code'),p_nickname:fd.get('nickname'),p_avatar:'🏡'});
  if(name==='update-family')await rpc('update_family',{p_family:familyId,p_name:fd.get('name'),p_weekly_goal:Number(fd.get('goal'))});
  form.reset();await loadDashboard(true);toast('Pronto','Alteração salva.');
}catch(err){toast('Ops',friendlyError(err))}finally{if(btn)btn.disabled=false}});

async function enterAuthenticated(){
  if(entering)return;entering=true;
  try{
    cleanAuthUrl();
    await loadFamilies();
    if(!families.length){showSetup();setupView();return}
    await loadDashboard();
  }finally{entering=false}
}
async function bootstrap(){
  if(!supabaseReady){showAuth();$('loginError').textContent='Configure VITE_SUPABASE_URL e a publishable key antes de testar.';return}
  const urlError=new URLSearchParams(location.search).get('error_description')||new URLSearchParams(location.hash.slice(1)).get('error_description');
  if(urlError){showAuth();$('loginError').textContent='Não foi possível entrar com o Google. Tente novamente.';return}
  const {data}=await sb.auth.getSession();session=data.session;
  if(!session){showAuth();return}
  await enterAuthenticated();
}
sb?.auth.onAuthStateChange((event,next)=>{
  const hadSession=Boolean(session);session=next;
  if(!next){if(notifications.remembered()?.kind==='parent')notifications.logout();showAuth();return}
  if(!hadSession||event==='SIGNED_IN')setTimeout(()=>enterAuthenticated().catch((err)=>toast('Ops',friendlyError(err))),0);
});
setupPWA();
bootstrap();
