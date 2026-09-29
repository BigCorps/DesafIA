-- DesafIA — exemplo para teste manual do Plus.
-- TROQUE o e-mail antes de executar. Este arquivo altera dados do DesafIA.

-- Descobrir a família pelo e-mail do responsável:
select f.id, f.name, f.plan, f.plan_expires_at
from desafia.families f
join desafia.family_members m on m.family_id=f.id
join auth.users u on u.id=m.user_id
where lower(u.email)=lower('TROQUE@EXEMPLO.COM');

-- Depois copie o UUID correto e rode APENAS a linha desejada:
-- update desafia.families set plan='plus', plan_expires_at=now()+interval '30 days' where id='UUID_DA_FAMILIA';
-- update desafia.families set plan='free', plan_expires_at=null where id='UUID_DA_FAMILIA';
