import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, extname } from 'node:path';
import { execFileSync } from 'node:child_process';

const root=new URL('../',import.meta.url).pathname;
const required=[
  'index.html','pais/index.html','src/game/main.js','src/game/cloud.js','src/game/local.js','src/pais/main.js',
  'src/lib/supabase.js','src/shared/pet.js','src/shared/progression.js','src/shared/pwa.js',
  'supabase/migrations/20260929000100_desafia_schema.sql','TESTE-PASSO-A-PASSO.md','vercel.json',
  'public/manifest.webmanifest','public/sw.js'
];
let failed=false;
function fail(msg){failed=true;console.error('✗',msg)}
function ok(msg){console.log('✓',msg)}
for(const f of required){if(!existsSync(join(root,f)))fail(`faltando ${f}`)}
for(const f of ['package.json','vercel.json','public/manifest.webmanifest','public/.well-known/assetlinks.json']){
  try{JSON.parse(readFileSync(join(root,f),'utf8'));ok(`JSON válido: ${f}`)}catch(e){fail(`JSON inválido ${f}: ${e.message}`)}
}
function walk(dir){
  for(const name of readdirSync(dir,{withFileTypes:true})){
    const p=join(dir,name.name);
    if(name.isDirectory())walk(p);
    else if(['.js','.mjs'].includes(extname(name.name))){
      try{execFileSync(process.execPath,['--check',p],{stdio:'pipe'});ok(`JS válido: ${p.replace(root,'')}`)}
      catch(e){fail(`JS inválido: ${p.replace(root,'')}\n${e.stderr}`)}
    }
  }
}
walk(join(root,'src'));walk(join(root,'scripts'));

const sql=readFileSync(join(root,'supabase/migrations/20260929000100_desafia_schema.sql'),'utf8');
for(const dangerous of ['revoke all on all tables in schema public','nspname = \'public\'','signInAnonymously','alter publication supabase_realtime']){
  if(sql.toLowerCase().includes(dangerous.toLowerCase()))fail(`migration contém padrão proibido: ${dangerous}`)
}
if(!sql.includes('create schema if not exists desafia'))fail('migration não cria schema desafia');else ok('migration isolada em schema desafia');
if(existsSync(join(root,'supabase/migrations/20260928000000_desafia_init.sql')))fail('migration antiga ainda está no pacote final');else ok('migration antiga removida do pacote final');

const sources=['src/game/cloud.js','src/lib/supabase.js'].map((f)=>readFileSync(join(root,f),'utf8')).join('\n');
if(sources.includes('signInAnonymously'))fail('frontend ainda usa Anonymous Auth');else ok('frontend infantil sem Anonymous Auth');
if(!sources.includes('p_device_token'))fail('RPC infantil não envia segredo do aparelho');else ok('RPC infantil usa segredo do aparelho');
if(!sources.includes('keyLooksReal'))fail('detecção de chave placeholder ausente');else ok('placeholders Supabase são rejeitados');

const game=readFileSync(join(root,'src/game/main.js'),'utf8');
const parent=readFileSync(join(root,'src/pais/main.js'),'utf8');
const pet=readFileSync(join(root,'src/shared/pet.js'),'utf8');
if(!game.includes('function petReaction()')||!game.includes("motion('giggle')")||!game.includes("motion('dance')"))fail('reações do personagem incompletas');else ok('reações aleatórias do personagem presentes');
if(!pet.includes("['Pipo', 'Lumi', 'Nino', 'Zupi']"))fail('sugestões de nome ausentes');else ok('sugestões de nome presentes');
if(!game.includes('reactionLockedUntil'))fail('cooldown de reação ausente');else ok('cooldown de reação presente');
if(!game.includes('setupPWA()')||!parent.includes('setupPWA()'))fail('PWA não inicializada em jogo e portal');else ok('PWA inicializada em jogo e portal');
if(!parent.includes("window.location.assign('/')"))fail('portal ainda abre jogo fora da mesma janela');else ok('navegação pai → jogo permanece na PWA');


if(!parent.includes("function cleanAuthUrl()")||!parent.includes("function suggestedFamily()"))fail('fluxo inicial dos pais incompleto');else ok('login/setup/dashboard dos pais corrigidos');
if(!readFileSync(join(root,'src/shared/base.css'),'utf8').includes('[hidden]{display:none!important}'))fail('hidden global não protegido');else ok('hidden sempre prevalece');
if(!game.includes("window.location.assign('/pais/')"))fail('área dos pais não navega ao portal');else ok('área dos pais abre portal real');
const gameCss=readFileSync(join(root,'src/game/game.css'),'utf8');
if(!gameCss.includes('top:57%;bottom:auto;--pet-y:-50%'))fail('personagem não centralizado no modo imersivo');else ok('personagem centralizado no modo imersivo');
if(!gameCss.includes('height:100dvh;overflow:hidden'))fail('viewport mobile ainda pode rolar externamente');else ok('viewport mobile fixa e painel rolável');

const sw=readFileSync(join(root,'public/sw.js'),'utf8');
if(!sw.includes("event.data?.type === 'SKIP_WAITING'"))fail('service worker sem atualização controlada');else ok('service worker aceita atualização controlada');
if(sw.includes('cache.put(req, res.clone())')||sw.includes('cache.put(request, response.clone())'))fail('service worker contém clone tardio conhecido');else ok('service worker sem padrão de clone tardio');
if(!sw.includes('const copy = response.clone()'))fail('service worker não clona resposta antes do cache');else ok('service worker clona respostas de forma segura');
if(!sw.includes('async function precache()'))fail('service worker sem pré-cache de assets');else ok('service worker pré-carrega shell e assets');

const manifest=JSON.parse(readFileSync(join(root,'public/manifest.webmanifest'),'utf8'));
if(!Array.isArray(manifest.shortcuts)||manifest.shortcuts.length<2)fail('manifest sem atalhos Jogo/Pais');else ok('manifest com atalhos Jogo/Pais');

const pkg=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
if(pkg.version!=='0.4.1')fail(`versão inesperada: ${pkg.version}`);else ok('versão final 0.4.1');

if(failed)process.exit(1);
console.log('\nDesafIA: checagem estática concluída.');
