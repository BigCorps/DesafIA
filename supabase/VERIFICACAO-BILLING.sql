-- DesafIA 0.5 — verificação somente leitura do billing
select table_name
from information_schema.tables
where table_schema='desafia'
  and table_name in ('subscriptions','billing_invoices','billing_events')
order by table_name;

select p.proname,
       p.prosecdef as security_definer,
       has_function_privilege('anon',p.oid,'EXECUTE') as anon_exec,
       has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_exec,
       has_function_privilege('service_role',p.oid,'EXECUTE') as service_exec
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname='desafia' and p.proname='apply_paid_invoice';

select table_name, grantee, privilege_type
from information_schema.role_table_grants
where table_schema='desafia'
  and table_name in ('subscriptions','billing_invoices','billing_events')
  and grantee in ('anon','authenticated','service_role')
order by table_name,grantee,privilege_type;

select f.id,f.name,f.plan,f.plan_expires_at,
       s.provider,s.status as subscription_status,s.current_period_end
from desafia.families f
left join desafia.subscriptions s on s.family_id=f.id
order by f.created_at desc;
