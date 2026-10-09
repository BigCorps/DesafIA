# DesafIA — endurecimento de segurança (09/10/2026)

Base do desenvolvimento: \`9da37da950c5663ea4f3a42542549d247dccef61\`.

## Escopo

A migration \`20261009180000_desafia_security_hardening.sql\` altera somente o schema \`desafia\`, preserva as assinaturas das RPCs, tokens e contas existentes, RLS, grants e os outros produtos no Supabase compartilhado. Histórico de migrations, Android, signing assets, OneSignal e service workers não foram modificados.

## Ordem de validação e publicação (não automática)

1. Confirmar CI da PR (`npm run check` e `npm run build`), revisar o diff e validar fluxo infantil.
2. Publicar o cliente compatível com o retorno \`NULL\` de \`pair_device\` **antes** de aplicar a migration; o cliente novo é compatível com o banco antigo.
3. Validar em ambiente controlado a Edge Function: conferir o formato do valor informado pelo Banco Inter e testes de respostas incompletas. Ela rejeita pagamento sem valor numérico válido em centavos. Não testar com dinheiro real sem autorização separada.
4. Aplicar a migration no Supabase existente **somente após aprovação explícita**; nunca aplicar em outro produto nem reescrever migrations anteriores.
5. Usar contas e dispositivos de teste para conferir: código inválido persiste tentativa; 12 erros/10 min bloqueiam o mesmo token; limite agregado protege contra rotação; código correto conecta uma única vez; revogação funciona; famílias não acessam dados umas das outras.
6. Validar com jogos de teste: missões pendentes, jogo desativado, parque não iniciado, tempo esgotado e Plus inativo rejeitam novas pontuações; fluxos legítimos continuam funcionando.
7. Revalidar políticas Google Play: canal \`play\` permanece sticky após \`?store=web\`; checkout da Play deve permanecer oculto. Rodar revisão manual no TWA real.
8. Reexecutar Supabase Security Advisors e conferir grants, SQL logs e logs de execução sem ler dados privados infantis.

## Riscos residuais e limitações

- O limite global de pareamento por 10 minutos pode bloquear temporariamente usuários legítimos durante abuso. Em implantação de grande escala, uma limitação de rede confiável no Edge/WAF complementaria a defesa.
- Pontuações são calculadas pelo cliente. O servidor barra envios fora dos controles parentais, porém a autenticidade matemática de cada resultado ainda exigiria validação do gameplay pelo backend.
- A duração do jogo é informada pelo cliente com limite de elapsed no servidor. Isso não é comprovação infalível de tempo efetivamente jogado.
- \`?store=play\` + localStorage são apenas uma defesa adicional, **não** prova nativa de origem Play. Uma revisão de políticas é necessária antes do lançamento.
- Os novos testes verificam funções JS e invariantes estruturais da migration. Uma prova real de isolamento/autorização/concorrência exige testes de integração no PostgreSQL, não executados nesta branch.
- O repositório público mantém binários Android e intermediários de build antigos. Limpeza deve ser separada para não tocar no processo de assinatura.

## Reversão

Não apagar dados para reverter. Caso um bug seja observado após aplicação, preparar uma migration **nova e revisada** que restaure a versão anterior das RPCs, com validação de compatibilidade do cliente. Reverter Edge/Frontend em release separado. Nenhum merge em \`main\` sem autorização expressa.
