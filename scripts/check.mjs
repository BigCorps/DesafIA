import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, extname } from 'node:path';
import { execFileSync } from 'node:child_process';

const root=new URL('../',import.meta.url).pathname;
const required=['index.html','pais/index.html','src/game/main.js','src/game/cloud.js','src/game/local.js','src/pais/main.js','src/lib/supabase.js','src/shared/pet.js','src/shared/progression.js','supabase/migrations/20260929000100_desafia_schema.sql','TESTE-PASSO-A-PASSO.md','vercel.json','public/manifest.webmanifest'];
let failed=false;
function fail(msg){failed=true;console.error('✗',msg)}
function ok(msg){console.log('✓',msg)}
for(const f of required){if(!existsSync(join(root,f)))fail(`faltando ${f}`)}
for(const f of ['package.json','vercel.json','public/manifest.webmanifest','public/.well-known/assetlinks.json']){try{JSON.parse(readFileSync(join(root,f),'utf8'));ok(`JSON válido: ${f}`)}catch(e){fail(`JSON inválido ${f}: ${e.message}`)}}
function walk(dir){for(const name of readdirSync(dir,{withFileTypes:true})){const p=join(dir,name.name);if(name.isDirectory())walk(p);else if(['.js','.mjs'].includes(extname(name.name))){try{execFileSync(process.execPath,['--check',p],{stdio:'pipe'});ok(`JS válido: ${p.replace(root,'')}`)}catch(e){fail(`JS inválido: ${p.replace(root,'')}\n${e.stderr}`)}}}}
walk(join(root,'src'));walk(join(root,'scripts'));
const sql=readFileSync(join(root,'supabase/migrations/20260929000100_desafia_schema.sql'),'utf8');
for(const dangerous of ['revoke all on all tables in schema public','nspname = \'public\'','signInAnonymously','alter publication supabase_realtime']){if(sql.toLowerCase().includes(dangerous.toLowerCase()))fail(`migration contém padrão proibido: ${dangerous}`)}
if(!sql.includes('create schema if not exists desafia'))fail('migration não cria schema desafia');else ok('migration isolada em schema desafia');
const sources=['src/game/cloud.js','src/lib/supabase.js'].map((f)=>readFileSync(join(root,f),'utf8')).join('\n');
if(sources.includes('signInAnonymously'))fail('frontend ainda usa Anonymous Auth');else ok('frontend infantil sem Anonymous Auth');
if(!sources.includes('p_device_token'))fail('RPC infantil não envia segredo do aparelho');else ok('RPC infantil usa segredo do aparelho');
if(failed)process.exit(1);console.log('\nDesafIA: checagem estática concluída.');
