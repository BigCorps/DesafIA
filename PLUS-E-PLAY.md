# DesafIA Plus + Banco Inter + Google Play

Versão: 0.5.0 — 30/09/2026

## Arquitetura escolhida

O entitlement do Plus pertence à **família**, não ao meio de pagamento.

```text
Família DesafIA
   ↓
desafia.families.plan / plan_expires_at
   ↓
desafia.subscriptions
   ├── provider = inter       (Web/PWA)
   ├── provider = google_play (preparado para futuro)
   └── provider = manual      (QA/admin)
```

Isso permite trocar ou adicionar meios de pagamento sem duplicar regras do jogo.

## Web/PWA: PIX Banco Inter

O checkout web usa a mesma infraestrutura de PIX já adotada nos produtos minhAi:

1. responsável entra com Google;
2. abre **Config. → Plano**;
3. toca em **Ativar DesafIA Plus**;
4. `desafia-billing` valida que o usuário pertence à família;
5. a Edge Function gera a cobrança no Banco Inter usando `BANCO_INTER_API_KEY`;
6. o frontend mostra QR Code + PIX Copia e Cola;
7. o portal consulta a cobrança a cada poucos segundos;
8. quando o Inter confirma, a Edge Function valida o valor e chama `desafia.apply_paid_invoice`;
9. a função SQL libera o Plus de forma atômica e idempotente.

Cada pagamento acrescenta **30 dias**. Se a família renovar antes do vencimento, os novos 30 dias começam a partir do vencimento atual, sem perder dias.

A renovação PIX desta versão **não é automática**.

## Preço

O preço não está hardcoded no frontend nem na migration.

Configure no projeto Supabase:

```text
DESAFIA_PLUS_MONTHLY_CENTS=<valor em centavos>
```

Exemplo conceitual: `1990` representaria R$ 19,90 — use apenas o valor comercial que for decidido para o DesafIA.

A Edge Function nunca aceita o valor enviado pelo navegador.

## Google Play: primeira publicação em modo consumption-only

O Plus libera funcionalidades digitais do próprio app. Para a primeira publicação na Google Play, a estratégia escolhida é **consumption-only**:

- o app da Play reconhece normalmente um Plus já ativo;
- o app da Play **não exibe botão, QR Code ou link de pagamento externo**;
- a contratação PIX fica disponível no Web/PWA normal;
- depois de contratar fora do app, basta usar a mesma conta Google no app e o entitlement é reconhecido pelo Supabase.

Para identificar a distribuição Play sem confundir com um PWA instalado pelo navegador, o TWA deve abrir uma vez com:

```text
https://SEU-DOMINIO/?store=play
```

O frontend salva `play` localmente e mantém o checkout externo oculto no portal dos pais daquele app.

## Por que não colocar PIX direto dentro do TWA da Play agora

O Google Play exige o sistema de faturamento do Google Play para funcionalidades/conteúdo digital vendido dentro do app, salvo programas/exceções aplicáveis. O Brasil está entre os mercados elegíveis para programas de faturamento alternativo/escolha do usuário, mas esses programas exigem inscrição e integração específica com as APIs/Biblioteca de faturamento do Google Play.

A primeira versão consumption-only evita colocar o lançamento do jogo dependente dessa integração nativa.

Documentação oficial consultada em 30/09/2026:

- Política de pagamentos: https://support.google.com/googleplay/android-developer/answer/10281818?hl=pt-BR
- Escolha de faturamento: https://support.google.com/googleplay/android-developer/answer/17161464?hl=pt-br
- Integração alternativa com escolha do usuário: https://developer.android.com/google/play/billing/alternative/alternative-billing-with-user-choice-in-app?hl=pt-br

## Futuro: Google Play Billing / User Choice Billing

A estrutura 0.5 já deixa preparado:

- `desafia.subscriptions.provider = 'google_play'`;
- `desafia.billing_events` para idempotência e auditoria;
- entitlement continua em `families.plan` + `plan_expires_at`.

Quando for desejável vender dentro do app, a camada Android poderá validar a compra Google e aplicar o mesmo entitlement, sem alterar o jogo infantil nem as regras de Plus.

## Segurança

- tabelas de billing não têm SELECT/INSERT/UPDATE/DELETE para `anon` ou `authenticated`;
- o browser fala somente com a Edge Function autenticada;
- `service_role` e `BANCO_INTER_API_KEY` ficam apenas no Supabase;
- o valor cobrado vem de `DESAFIA_PLUS_MONTHLY_CENTS`, nunca do cliente;
- a confirmação compara o valor recebido no Inter com o valor da invoice;
- `apply_paid_invoice` é idempotente e usa lock de linha;
- uma renovação paga duas vezes não é aplicada duas vezes para a mesma invoice.
