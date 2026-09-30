-- DesafIA 0.6.0 — verificação do parque de minijogos (somente leitura)
-- Rode no SQL Editor depois de aplicar 20260930000200_desafia_minijogos.sql.

-- 1) Colunas novas em families
select column_name, data_type, column_default
from information_schema.columns
where table_schema = 'desafia' and table_name = 'families'
  and column_name in ('play_minutes','play_requires_approval','games_disabled')
order by column_name;                                   -- esperado: 3 linhas

-- 2) Tabelas novas com RLS ligado e sem acesso direto do navegador
select c.relname as tabela, c.relrowsecurity as rls,
       has_table_privilege('anon', c.oid, 'select') as anon_le,
       has_table_privilege('authenticated', c.oid, 'select') as auth_le
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'desafia' and c.relname in ('play_days','game_unlocks','game_scores');
-- esperado: rls = true, anon_le = false, auth_le = false

-- 3) Catálogo (precisa ser igual a src/games/registry.js)
select desafia.game_catalog();                          -- esperado: 10 ids

-- 4) Quem pode chamar cada função
select p.proname as funcao,
       has_function_privilege('anon', p.oid, 'execute') as anon,
       has_function_privilege('authenticated', p.oid, 'execute') as responsavel
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'desafia'
  and p.proname in ('play_status','play_start','play_tick','game_score',
                    'parent_play_settings','parent_update_play','parent_add_play_time',
                    'play_state','play_missions_state','game_catalog')
order by p.proname;
-- esperado: play_*/game_score só anon; parent_* só responsavel;
--           play_state, play_missions_state e game_catalog: nenhum dos dois

-- 5) Configuração atual das famílias
select id, name, play_minutes, play_requires_approval, games_disabled
from desafia.families order by created_at desc limit 20;
