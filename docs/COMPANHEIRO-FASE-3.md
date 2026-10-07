# Companheiro Vivo — Fase 3

Classificação: **VERCEL_BUILD_REQUIRED** (alteração visual e funcional web).
Sem mudanças no Ignored Build Step, Android, assinatura, versão, Auth, push,
billing ou workflows. O sync usa uma migration isolada no schema `desafia`.

## Sono e jeitinho

O sono usa olhos fechados existentes, boca oval pequena que abre/fecha e `zZz`
que sobe com fade. Com `prefers-reduced-motion`, boca e indicador ficam estáticos.
Corpo, braços e pés mantêm as dimensões originais.

A Casa contém quatro traços independentes, seis gostos possíveis e um caderninho
de memórias. Descobertas do catálogo contribuem de forma determinística para os
traços; interações com o mundo, abraço, high-five e toque contribuem uma
vez por tipo/dia. Sem ranking dos traços, perda por ausência, FOMO ou recompensa
por repetição de toques. Nada altera estrelas, XP, permissões ou jogos.

Memórias: primeiro dia completo, primeira aventura, primeira descoberta,
descobertas específicas (inclusive Borboleta Azul) e níveis 3/6/10/20. Uma leitura
repetida não duplica memórias. Dados já disponíveis de aventuras/XP são usados
para reconhecer conquistas existentes; a data histórica exata não é inventada.

## Persistência e privacidade

No modo local/demonstração, o estado continua em `desafia-companion-v1:local`.
No modo conectado, o navegador mantém apenas um espelho para resposta imediata;
os contadores de interação que influenciam personalidade/gostos são sincronizados
por `desafia.companion_journals`, identificado pelo `player_id` já existente.

O backend não duplica descobertas, XP ou textos de memória: essas informações
continuam derivadas das fontes existentes. A tabela sincronizada guarda apenas
contadores fechados por tipo de interação, o dia corrente e quais tipos já
contribuíram naquele dia. Não guarda device token, nome da criança, nome do
companheiro, texto de missão ou qualquer nova PII.

As RPCs `companion_journal_state` e `record_companion_action` são
`SECURITY DEFINER` intencionalmente expostas ao papel `anon`, como as demais
RPCs do aparelho infantil, mas exigem o segredo local validado por
`device_player`. A tabela não concede SELECT/INSERT/UPDATE/DELETE a `anon` ou
`authenticated`, usa RLS e não possui policy permissiva.

QA continua usando sessionStorage isolado; reset QA remove o caderninho de teste.
Sem IA, chat, fornecedor novo, telemetria ou dependência nova.

## Verificação

`npm run check`, `node --test scripts/companion*.test.mjs scripts/adventures.test.mjs scripts/qa-state.test.mjs`,
`npm run build` e `git diff --check`. Inspeção em navegador mobile: sono, animação,
reduced motion, Casa vazia/preenchida, refresh/reset QA e erros de runtime.
Preview remoto só pode ser declarado validado com evidência da URL e do commit.
