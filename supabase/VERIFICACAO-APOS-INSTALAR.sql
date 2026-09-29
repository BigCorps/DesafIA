-- DesafIA — verificação SOMENTE LEITURA após instalar a migration.

-- 1) Todas as tabelas esperadas.
select table_schema, table_name
from information_schema.tables
where table_schema='desafia' and table_type='BASE TABLE'
order by table_name;

-- 2) RLS deve estar ligada em todas as tabelas do schema.
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname='desafia'
order by tablename;

-- 3) anon/authenticated NÃO devem ter privilégios diretos de tabela.
select grantee, table_schema, table_name, privilege_type
from information_schema.role_table_grants
where table_schema='desafia' and grantee in ('anon','authenticated')
order by grantee, table_name, privilege_type;
-- Esperado: zero linhas.

-- 4) RPCs liberadas para cada papel.
select routine_schema, routine_name, grantee, privilege_type
from information_schema.role_routine_grants
where routine_schema='desafia' and grantee in ('anon','authenticated')
order by grantee, routine_name;

-- 5) Não usamos Realtime/Postgres Changes no DesafIA 0.3.
select schemaname, tablename
from pg_publication_tables
where pubname='supabase_realtime' and schemaname='desafia';
-- Esperado: zero linhas.

-- 6) Não deve existir usuário anônimo criado pelo DesafIA.
select count(*)::int as anonymous_users_total
from auth.users
where is_anonymous is true;
-- Este número pertence ao projeto inteiro. O DesafIA 0.3 não cria novos.
