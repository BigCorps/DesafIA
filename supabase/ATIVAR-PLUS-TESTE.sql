-- DesafIA — helper opcional APENAS para QA manual do Plus.
-- O fluxo normal 0.5 deve usar a cobrança PIX da Edge Function desafia-billing.
-- TROQUE o e-mail antes de executar.

select f.id, f.name, f.plan, f.plan_expires_at
from desafia.families f
join desafia.family_members m on m.family_id=f.id
join auth.users u on u.id=m.user_id
where lower(u.email)=lower('TROQUE@EXEMPLO.COM');

-- Ativar Plus manualmente por 30 dias e registrar entitlement manual:
-- begin;
-- update desafia.families
--    set plan='plus', plan_expires_at=now()+interval '30 days'
--  where id='UUID_DA_FAMILIA';
-- insert into desafia.subscriptions(
--   family_id,plan_code,provider,status,current_period_start,current_period_end,updated_at
-- ) values (
--   'UUID_DA_FAMILIA','plus_monthly','manual','active',now(),now()+interval '30 days',now()
-- ) on conflict (family_id) do update set
--   provider='manual',status='active',current_period_start=now(),
--   current_period_end=now()+interval '30 days',updated_at=now();
-- commit;

-- Voltar para grátis manualmente:
-- begin;
-- update desafia.families set plan='free', plan_expires_at=null where id='UUID_DA_FAMILIA';
-- update desafia.subscriptions set status='canceled',current_period_end=now(),updated_at=now()
--  where family_id='UUID_DA_FAMILIA';
-- commit;
