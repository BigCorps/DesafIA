# Skills locais do Codex

Somente duas skills, em `.agents/skills/`, sem configuração global:

| Skill | Quando carregar | Motivo |
| --- | --- | --- |
| `supabase-postgres-best-practices` | SQL, schemas, migrations, RLS, índices, funções/triggers, filas/pg_cron e diagnóstico Postgres | Referências oficiais Supabase para banco, segurança e performance |
| `desafia-project-guardrails` | Áreas críticas: backend/Auth/pairing/push/billing/persistência/privacidade/PWA/TWA/Android/arquitetura/produção com risco | Checklist curta dos limites específicos do DesafIA |

O `AGENTS.md` contém apenas roteamento condicional e invariantes básicos. Copy,
CSS/layout trivial, espaçamento, ícone isolado e documentação sem impacto técnico
não exigem nenhuma das duas. Mudanças SQL críticas podem exigir ambas.
Nome/description ficam disponíveis para descoberta; o corpo e as referências
podem aumentar contexto somente quando carregados. Leia apenas referências
pertinentes, sem carregar a coleção inteira em toda tarefa.

Não há runtime, dependência npm, instalação global, scripts executáveis, MCP,
automação remota nem chamada adicional de API paga nesta instalação. Não usamos
Claude Code, Superpowers ou skills React neste projeto neste momento.

## Proveniência e revisão

- Upstream oficial: [supabase/agent-skills](https://github.com/supabase/agent-skills).
- Caminho: `skills/supabase-postgres-best-practices`.
- Commit exato: `c9be0e931b7930f7d02126d04774d904c381e7d7`.
- Importação: **06/10/2026** (America/Sao_Paulo), cópia repo-local.
- Página GitHub oficial conferida: `isArchived: false`.
- SKILL.md, changelog e referências de uso copiados sem alterações técnicas;
  guias de contribuição/template de autoria omitidos por não serem necessários.
  Licença MIT
  © 2026 Supabase copiada do `LICENSE` upstream para o diretório local.
- SKILL.md, changelog e referências revisados; não há scripts, coleta de
  credenciais, envio de dados, instalação automática ou instruções de ignorar
  o repositório. Exemplos SQL incluem operações como DROP/ALTER SYSTEM/revokes:
  são demonstrativos, não autorização para executá-los no projeto compartilhado.

## Atualização e remoção

Atualize manualmente em uma branch: confira que o repositório oficial segue ativo,
selecione e registre um SHA explícito, leia SKILL.md/referências/qualquer script
novo, compare o diretório com a cópia atual e preserve licença/atribuição.
Copie somente `skills/supabase-postgres-best-practices` e a licença aplicável;
não importe plugins, MCPs ou outras skills. Revise todo o diff antes do commit,
atualize SHA/data neste documento e execute `git diff --check` e `npm run check`.
Não existe atualização automática ou resolução silenciosa de "latest".

Para remover, faça um commit revisado removendo o diretório da skill e seu
roteamento em AGENTS.md, atualizando esta documentação. Para reverter a instalação
inteira, reverta o commit de instalação via Git; não remova código do produto.
