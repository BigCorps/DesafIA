# Skills

Carregue apenas as skills pertinentes à tarefa e referências necessárias:

- Antes de criar/alterar SQL, schema, migrations, RLS, índices, triggers,
  funções Postgres, filas ou pg_cron, ou diagnosticar problemas de Postgres:
  use `$supabase-postgres-best-practices` em
  `.agents/skills/supabase-postgres-best-practices/SKILL.md`.
- Para alterações em Supabase, Auth/autorização, pairing/device token, push,
  Edge Functions, billing, persistência, privacidade/exclusão de dados,
  PWA/TWA/Android, Play Store, arquitetura ou produção com risco relevante:
  use `$desafia-project-guardrails` em
  `.agents/skills/desafia-project-guardrails/SKILL.md`.
- Em copy, CSS/layout trivial, espaçamento, ícone isolado ou documentação
  sem impacto técnico, não carregue skills desnecessariamente.

# Invariantes

- GitHub é a fonte da verdade; confira a branch/base atual antes de alterar.
- Não faça merge na main sem aprovação explícita.
- Não modifique Android em tarefa web sem necessidade técnica.
- Execute testes proporcionais ao escopo e reporte a evidência real.
- Nunca exponha secrets.

Origem, atualização manual e remoção: [docs/AGENT-SKILLS.md](docs/AGENT-SKILLS.md).
