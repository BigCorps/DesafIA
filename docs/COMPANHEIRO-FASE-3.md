# Companheiro Vivo — Fase 3

Classificação: **VERCEL_BUILD_REQUIRED** (alteração visual e funcional web).
Sem mudanças no Ignored Build Step, Android, assinatura, versão, Auth, push,
billing, Supabase ou workflows.

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

Estado repo-local no frontend: `desafia-companion-v1:local` para demonstração,
ou `desafia-companion-v1:player:<UUID>` para o jogador retornado pela RPC existente.
QA usa o storage já isolado em sessionStorage; reset QA remove também o caderninho.
O UUID existente serve apenas para separar jogadores no mesmo navegador, sem
guardar device token, nomes, texto de missões ou dados pessoais novos no diário.
Armazena IDs fechados de catálogo/memórias, contadores limitados e dia de interações.
Não há IA, chat, fornecedor novo, telemetria, dependência ou chamada remota nova.

Limites: não sincroniza entre aparelhos e limpar dados do navegador apaga os
registros locais. Se o storage estiver indisponível, funciona somente na sessão.
Isolamento por jogador evita exibição cruzada na UI; localStorage não é uma
fronteira de autorização. Dados decorativos locais nunca autorizam ações reais.
Nenhuma migration foi criada ou aplicada. O Supabase compartilhado não foi alterado.

## Verificação

`npm run check`, `node --test scripts/companion*.test.mjs scripts/adventures.test.mjs scripts/qa-state.test.mjs`,
`npm run build` e `git diff --check`. Inspeção em navegador mobile: sono, animação,
reduced motion, Casa vazia/preenchida, refresh/reset QA e erros de runtime.
Preview remoto só pode ser declarado validado com evidência da URL e do commit.
