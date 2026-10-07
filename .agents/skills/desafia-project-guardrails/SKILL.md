---
name: desafia-project-guardrails
description: "Use somente ao alterar áreas críticas do DesafIA: Supabase/migrations/RLS/RPCs/security definer, Auth/autorização, pairing/device token, OneSignal/push/Edge Functions/pg_cron, billing/pagamentos, persistência de estrelas/XP/missões, privacidade/exclusão, PWA/service workers, TWA/Android/Play Store, arquitetura ou produção com risco relevante. Não usar em copy, CSS/layout trivial, espaçamento, ícone isolado ou documentação sem impacto técnico."
---

# DesafIA: guardrails técnicos

Leia somente quando a tarefa atingir as áreas da description. Checklist concisa;
consulte os contratos reais do repositório antes de implementar.

## Arquitetura e dados

- Vite/JavaScript/PWA, não React/Next.js: criança em `/`, responsável em `/pais/`.
- Android é TWA/Bubblewrap, package `com.app.desafia`.
- Supabase compartilhado com outros produtos BigCorps: não crie novo projeto
  Supabase para o DesafIA. Objetos do app ficam no schema `desafia`; não altere
  objetos de outros produtos sem pedido explícito.
- DDL via nova migration; não edite migrations históricas já aplicadas.
- Browser sem acesso direto desnecessário a tabelas. Revise RLS, grants,
  security definer e search_path seguro, preservando validação de identidade.
- Device infantil usa segredo local; servidor guarda apenas hash. Não crie
  conta Supabase Auth infantil sem decisão arquitetural explícita.

## Push e Android

- OneSignal isolado; secrets próprios server-side usam `DESAFIA_`.
  REST API Key nunca vai para frontend, Vercel ou GitHub.
- Worker OneSignal permanece separado do worker PWA em
  `/onesignal/OneSignalSDKWorker.js`. Não altere `public/sw.js` para integrar
  OneSignal sem necessidade comprovada; sem prompt automático de push.
- Criança requer consentimento parental e ativação explícita no aparelho;
  não envie PII infantil ao fornecedor.
- O job `desafia-notifications` do pg_cron autentica com `cron_automations`
  via `SUPABASE_SECRET_KEYS`/Vault. Não coloque service role no pg_cron.
- Em tarefas web/backend, não altere Android/TWA/AAB/assetlinks/assinatura
  sem necessidade técnica. Build Android somente com impacto Android/TWA.
- Nunca gere nova assinatura/keystore nem substitua fingerprints do Play
  pelos da upload key.
- A distribuição Google Play é consumption-only: pode reconhecer Plus já ativo,
  mas não deve exibir PIX, botão/link de compra externa ou checkout externo
  dentro da versão Play.

## Git, deploy e verificação

- GitHub é fonte da verdade; mudanças médias/grandes usam feature branch.
  `staging` é a branch permanente de Preview.
- Nunca faça merge na main sem aprovação explícita; mudanças pequenas só
  vão direto para main se o usuário pedir explicitamente. Sem ZIP como padrão.
- Testes proporcionais: para web/runtime, `npm run check`, `npm run build`
  e `git diff --check`, mais testes pertinentes. Não faça build Android
  sem impacto Android. Declare pronto somente com evidência dos testes executados.

## Revisão de segurança do diff

Ao alterar auth, RLS, migrations, payments, APIs públicas, pairing, push, cron
ou dados pessoais, revise explicitamente: autorização, isolamento entre famílias,
idempotência, concorrência, replay, exposição de secrets, privilégios excessivos
e regressões de RLS. Recomendações SQL genéricas não autorizam alterações
no Supabase compartilhado; adapte-as ao schema e aos privilégios do DesafIA.
